-- ChatSched — Phase 113: new booking payment model (Oct 2026)
-- NOT APPLIED. Review, then apply only when AJ says so.
--
-- What this does
--   1. Adds a per-booking money snapshot to channel_requests (creator price,
--      commission, booking fee, total due, creator payout), written
--      server-side the moment a booking becomes 'awaiting_payment'.
--      Later changes to the commission rate or fee tiers never rewrite
--      old bookings, and a business can never edit what it owes.
--   2. Adds payment_reference (CS-XXXXXXXX, same format already used by the
--      UI) and funds_cleared_at / funds_cleared_by.
--   3. A booking can only become 'paid' by an admin, which stamps
--      funds_cleared_at. A creator can only go 'live' after that stamp.
--      A business's "I've paid" click stays a claim, never a confirmation.
--   4. Creators no longer need an active Publisher Network subscription
--      to accept a request (sign-up is free).
--
-- Heads-up: this REPLACES enforce_channel_request_transition() and is built
--   from schema_phase73's version. schema_phase86 (applied later) re-created
--   the function from the older phase71 shape and so silently dropped two
--   things phase73 had restored: the counter-offer transitions
--   (pending -> countered, countered -> awaiting_payment / cancelled) and
--   the "content must be approved before going live" gate. Both are
--   restored here. Refund / cancellation transitions are NOT in this
--   phase; they follow once the refund rules are confirmed.
--
-- Fee maths is duplicated from src/lib/fees.ts on purpose: the snapshot has
--   to be computed where the client can't tamper with it. Keep them in
--   sync; src/lib/fees.test.ts and supabase/tests/booking_breakdown_test.sql
--   pin the same R299 example.

-- ── 1. Fee function (integer cents) ─────────────────────────────────────
create or replace function public.booking_breakdown(p_price_cents bigint)
returns table (
  creator_price_cents bigint,
  commission_rate numeric,
  commission_cents bigint,
  booking_fee_cents bigint,
  total_due_cents bigint,
  creator_payout_cents bigint
)
language sql
immutable
as $$
  select
    p_price_cents,
    0.12::numeric,
    round(p_price_cents * 0.12)::bigint,
    (case when p_price_cents < 50000 then 3000 else 5000 end)::bigint,
    p_price_cents + (case when p_price_cents < 50000 then 3000 else 5000 end)::bigint,
    p_price_cents - round(p_price_cents * 0.12)::bigint;
$$;

-- ── 2. Columns ──────────────────────────────────────────────────────────
alter table public.channel_requests
  add column if not exists creator_price_cents bigint,
  add column if not exists commission_rate numeric,
  add column if not exists commission_cents bigint,
  add column if not exists booking_fee_cents bigint,
  add column if not exists total_due_cents bigint,
  add column if not exists creator_payout_cents bigint,
  add column if not exists payment_reference text,
  add column if not exists funds_cleared_at timestamptz,
  add column if not exists funds_cleared_by uuid references auth.users(id);

comment on column public.channel_requests.funds_cleared_at is
  'Set only by an admin, after the money has actually cleared in the ChatSched bank account. Never set from a proof-of-payment screenshot. A placement cannot go live without it.';

create unique index if not exists channel_requests_payment_reference_key
  on public.channel_requests(payment_reference) where payment_reference is not null;

-- ── 3. Snapshot + column protection ─────────────────────────────────────
-- Name sorts after trg_enforce_channel_request_transition, so it sees the
-- final proposed_amount (the transition function copies counter_amount into
-- it when a business accepts a counter-offer).
create or replace function public.snapshot_channel_request_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  if tg_op = 'UPDATE' then
    -- Entering awaiting_payment: freeze the numbers, whoever triggered it.
    if new.status = 'awaiting_payment' and old.status is distinct from 'awaiting_payment' then
      select * into b from public.booking_breakdown(round(new.proposed_amount * 100)::bigint);
      new.creator_price_cents := b.creator_price_cents;
      new.commission_rate := b.commission_rate;
      new.commission_cents := b.commission_cents;
      new.booking_fee_cents := b.booking_fee_cents;
      new.total_due_cents := b.total_due_cents;
      new.creator_payout_cents := b.creator_payout_cents;
      new.payment_reference := 'CS-' || upper(left(new.id::text, 8));
    elsif auth.uid() is not null then
      -- Any other update from a live session may not touch the snapshot.
      new.creator_price_cents := old.creator_price_cents;
      new.commission_rate := old.commission_rate;
      new.commission_cents := old.commission_cents;
      new.booking_fee_cents := old.booking_fee_cents;
      new.total_due_cents := old.total_due_cents;
      new.creator_payout_cents := old.creator_payout_cents;
      new.payment_reference := old.payment_reference;
    end if;

    -- funds_cleared_* may only ever be written by the transition function
    -- on an admin's payment confirmation.
    if auth.uid() is not null and not public.is_admin() then
      new.funds_cleared_at := old.funds_cleared_at;
      new.funds_cleared_by := old.funds_cleared_by;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_snapshot_channel_request_payment on public.channel_requests;
create trigger trg_snapshot_channel_request_payment
  before update on public.channel_requests
  for each row execute function public.snapshot_channel_request_payment();

-- ── 4. Transition rules ─────────────────────────────────────────────────
create or replace function public.enforce_channel_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_creator boolean;
  is_business boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  -- Trusted server-side context (migrations, service-role functions).
  if auth.uid() is null then
    return new;
  end if;

  -- schema_phase114's cancel_channel_request() sets this transaction-local
  -- flag after doing its own authorisation and refund maths.
  if current_setting('app.cancel_rpc', true) = '1' then
    return new;
  end if;

  is_business := (auth.uid() = old.business_id);
  is_creator := exists (
    select 1 from public.publishers p
    where p.id = old.creator_id and p.user_id = auth.uid()
  );

  if public.is_admin() then
    if old.status in ('declined', 'cancelled', 'completed') then
      raise exception 'This request is already closed.';
    end if;
    -- Funds confirmed in the bank. From payment_submitted (business clicked
    -- "I've paid") or awaiting_payment (money arrived without the click).
    if new.status = 'paid' and old.status in ('payment_submitted', 'awaiting_payment') then
      new.paid_at := now();
      new.funds_cleared_at := now();
      new.funds_cleared_by := auth.uid();
      return new;
    end if;
    if new.status = 'completed' and old.status = 'live' then
      new.completed_at := now();
      return new;
    end if;
    if new.status in ('declined', 'cancelled') then
      return new; -- admin closing an overdue/unresponsive request
    end if;
    raise exception 'That status change is not allowed for an admin.';
  end if;

  -- Creator accepts. No subscription required any more (free sign-up).
  if is_creator and old.status = 'pending' and new.status = 'awaiting_payment' then
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'declined' then
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'countered' then
    if new.counter_amount is null or new.counter_amount <= 0 then
      raise exception 'A counter-offer needs a real amount.';
    end if;
    new.countered_at := now();
    return new;
  end if;

  if is_business and old.status = 'countered' and new.status = 'awaiting_payment' then
    new.responded_at := now();
    new.proposed_amount := old.counter_amount;
    return new;
  end if;

  if is_business and old.status = 'countered' and new.status = 'cancelled' then
    return new;
  end if;

  -- Going live needs BOTH cleared funds and approved content.
  if is_creator and old.status = 'paid' and new.status = 'live' then
    if old.funds_cleared_at is null then
      raise exception 'This booking cannot go live until ChatSched has confirmed the funds have cleared.';
    end if;
    if not exists (
      select 1 from public.content_approvals ca
      where ca.channel_request_id = old.id and ca.status in ('approved', 'published')
    ) then
      raise exception 'Content must be approved before this can go live — see the Content Approval panel.';
    end if;
    new.live_at := now();
    return new;
  end if;

  if is_business and old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;

  if is_business and old.status = 'awaiting_payment' and new.status = 'payment_submitted' then
    new.payment_submitted_at := now();
    return new;
  end if;

  raise exception 'That status change is not allowed.';
end;
$$;
