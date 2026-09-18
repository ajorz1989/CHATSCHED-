-- ChatSched — Phase 88 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase87_featured_placement_subscriptions.sql.
--
-- Fixes "Claude To fix 1..txt" item 11, HIGH — Launch-credit race
-- condition. Verified against the real source before writing anything:
--
--   supabase/functions/payfast-checkout/index.ts SELECTs
--   business_launch_credits.remaining, computes creditApplied in
--   JavaScript, writes it onto payments.credit_applied — and for a
--   FULLY-covered campaign (credit >= amount), immediately marks the
--   payment 'paid' right there, with no PayFast round-trip at all. For a
--   PARTIALLY-covered campaign, the actual business_launch_credits.remaining
--   deduction doesn't happen until payfast-notify's redeemLaunchCredit()
--   runs, later, on a completely separate request when PayFast's webhook
--   arrives.
--
--   The race is real in BOTH branches, not just the one the finding's own
--   phrasing ("reads..computes..writes payment state, and later
--   decrements") most directly describes:
--     - Two concurrent checkouts for two DIFFERENT payments belonging to
--       the same business can each read the same remaining credit before
--       either writes anything back — this is the literal race the
--       finding names, and it hits hardest in the FULLY-covered branch
--       specifically, because that branch finalizes the payment as
--       'paid' immediately, with no later confirmation step to catch the
--       double-spend the way payfast-notify's own .neq("status","paid")
--       guard catches a duplicate ITN for the SAME payment.
--     - For the partially-covered branch, the actual deduction is
--       deferred correctly for a good reason (payments.credit_applied's
--       own comment in schema_phase55_subscriptions.sql: "only deducted
--       ... once payfast-notify confirms the payment actually completed,
--       the same way payments.status itself only ever changes from that
--       webhook, never from checkout" — a real, deliberate design
--       principle worth preserving, not a bug in itself) — but the
--       computation that decides HOW MUCH credit a given payment gets to
--       claim still has to be race-free the moment it's decided, or two
--       concurrent checkouts could each provisionally claim the full
--       remaining balance before either one's eventual PayFast outcome is
--       known.
--
-- Design: a reserve -> confirm/release pattern, not a single deduct-on-
-- checkout step, specifically to keep the schema_phase55 principle above
-- intact for the partial-coverage path while still closing the race for
-- the fully-covered path (which has no later confirmation step to defer
-- to — it finalizes immediately, so its reservation and its confirmation
-- are the same atomic action). All three operations below run as a
-- single locked transaction per business (SELECT ... FOR UPDATE on that
-- business's one business_launch_credits row), so two concurrent
-- reservations for the same business can never both observe the same
-- pre-deduction "remaining" value — the second one always waits for the
-- first to commit, then sees the already-reduced balance.

create table public.launch_credit_redemptions (
  id uuid primary key default gen_random_uuid(),
  -- Doubles as the idempotency key and the payment-to-credit relation the
  -- finding asks for: a payment can only ever have one redemption row, so
  -- a retried reserve call for the same payment_id can detect "already
  -- reserved" and return the existing figures instead of reserving again.
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  business_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'confirmed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.launch_credit_redemptions enable row level security;

create policy "launch_credit_redemptions_select_own_or_admin" on public.launch_credit_redemptions
  for select using (auth.uid() = business_id or public.is_admin());

-- No client insert/update/delete policy — same reasoning as
-- business_launch_credits itself: only the three functions below
-- (SECURITY DEFINER) ever write this table.

comment on table public.launch_credit_redemptions is
  'One row per payment that ever claimed launch credit — the reservation/redemption record item 11 asks for. status: reserved (deducted from business_launch_credits.remaining at checkout time, outcome not yet known) -> confirmed (payment completed — no further balance change, already deducted) or released (payment failed/cancelled — amount added back to remaining). Written only by reserve_launch_credit_for_payment / confirm_launch_credit_redemption / release_launch_credit_redemption below.';

-- Known, deliberately out-of-scope residual gap: a checkout that reserves
-- credit and is then silently abandoned (never completes, and PayFast
-- never sends a FAILED/CANCELLED ITN for it either — e.g. the business
-- just closes the tab) leaves that redemption sitting at 'reserved'
-- indefinitely, with its amount unavailable to other payments until
-- released. Retrying checkout for the SAME request is safe (reserve is
-- idempotent per payment_id, so it returns the existing reservation
-- rather than reserving again) — this only affects credit that's never
-- retried and never explicitly fails. A scheduled sweep that releases
-- stale 'reserved' rows after some window would close this properly; not
-- built here — same "don't add a second scheduled-job system within an
-- already-large fix" reasoning as schema_phase87's own decision not to
-- rebuild a full grace-period lifecycle for Featured Placement.

-- ── 1. Reserve — called from payfast-checkout, at checkout time ─────────
create or replace function public.reserve_launch_credit_for_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_credit public.business_launch_credits%rowtype;
  v_existing public.launch_credit_redemptions%rowtype;
  v_to_apply numeric(10,2);
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'payment not found');
  end if;
  if auth.uid() is not null and auth.uid() <> v_payment.business_id then
    return jsonb_build_object('ok', false, 'error', 'not your payment');
  end if;
  if v_payment.status = 'paid' then
    return jsonb_build_object('ok', false, 'error', 'already paid');
  end if;

  -- Idempotent: a retried checkout call for the same payment (the normal
  -- "user hit back and tried again" path payfast-checkout already
  -- supports by reusing the same payment row) must not reserve twice.
  select * into v_existing from public.launch_credit_redemptions where payment_id = p_payment_id;
  if found then
    if v_existing.status = 'released' then
      -- A previous attempt on this exact payment was released (its
      -- PayFast attempt failed/was cancelled) and the business is trying
      -- again — re-reserve fresh rather than treating the stale released
      -- row as still valid.
      delete from public.launch_credit_redemptions where id = v_existing.id;
    else
      return jsonb_build_object('ok', true, 'credit_applied', v_existing.amount, 'amount_due', greatest(round((v_payment.amount - v_existing.amount)::numeric, 2), 0));
    end if;
  end if;

  -- The one lock that actually closes the race: two concurrent
  -- reservations for the same business now serialize on this row.
  select * into v_credit from public.business_launch_credits where business_id = v_payment.business_id for update;

  if not found or v_credit.remaining <= 0 then
    v_to_apply := 0;
  else
    v_to_apply := round(least(v_credit.remaining, v_payment.amount)::numeric, 2);
  end if;

  if v_to_apply > 0 then
    update public.business_launch_credits set remaining = remaining - v_to_apply, updated_at = now() where id = v_credit.id;
  end if;

  insert into public.launch_credit_redemptions (payment_id, business_id, amount, status)
    values (p_payment_id, v_payment.business_id, v_to_apply, 'reserved');

  update public.payments set credit_applied = v_to_apply where id = p_payment_id;

  return jsonb_build_object('ok', true, 'credit_applied', v_to_apply, 'amount_due', greatest(round((v_payment.amount - v_to_apply)::numeric, 2), 0));
end;
$$;

-- ── 2. Confirm — called from payfast-notify, on payment_status = COMPLETE
create or replace function public.confirm_launch_credit_redemption(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No balance change — the amount was already deducted at reservation
  -- time. This just closes out the record so release_launch_credit_redemption
  -- can never act on it later. Guarded to 'reserved' only, so calling this
  -- twice (a retried ITN) or calling it on a payment that never reserved
  -- any credit (amount = 0 row, or no row at all) is always a safe no-op.
  update public.launch_credit_redemptions
     set status = 'confirmed', updated_at = now()
   where payment_id = p_payment_id and status = 'reserved';
end;
$$;

-- ── 3. Release — called from payfast-notify, on FAILED/CANCELLED ────────
create or replace function public.release_launch_credit_redemption(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.launch_credit_redemptions%rowtype;
begin
  select * into v_redemption from public.launch_credit_redemptions where payment_id = p_payment_id and status = 'reserved' for update;
  if not found then
    return; -- nothing reserved (amount was 0, already confirmed/released, or no attempt reserved anything)
  end if;

  if v_redemption.amount > 0 then
    -- Same lock as reserve — adding back to the same row a concurrent
    -- reserve might be waiting on is exactly why this needs the lock too,
    -- not just a plain UPDATE.
    update public.business_launch_credits
       set remaining = least(amount, remaining + v_redemption.amount), updated_at = now()
     where business_id = v_redemption.business_id;
  end if;

  update public.launch_credit_redemptions set status = 'released', updated_at = now() where id = v_redemption.id;
end;
$$;

revoke execute on function public.reserve_launch_credit_for_payment(uuid) from public;
revoke execute on function public.confirm_launch_credit_redemption(uuid) from public;
revoke execute on function public.release_launch_credit_redemption(uuid) from public;
grant execute on function public.reserve_launch_credit_for_payment(uuid) to authenticated;
grant execute on function public.confirm_launch_credit_redemption(uuid) to authenticated;
grant execute on function public.release_launch_credit_redemption(uuid) to authenticated;
