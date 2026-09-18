-- ChatSched — Phase 35 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- Adds ONE round of counter-offer to the Request Feature workflow
-- (channel_requests — influencer/website/podcast/radio). Previously a
-- creator could only approve the business's exact proposed_amount or
-- decline outright; in a thin early marketplace, a flat "no" where a
-- small price adjustment would've closed the deal is a lost transaction,
-- not just a lost message. This gives the creator a third option.
--
-- Deliberately capped at one round, not open-ended haggling: the creator
-- counters once, the business accepts or declines that counter — no
-- counter-to-the-counter. A real back-and-forth negotiation belongs in
-- the message thread this request already has; this is a structured
-- price adjustment, not a chat feature, and keeping it to one round keeps
-- the deadline math (below) sane without redesigning the whole escrow
-- timeline.
--
-- ── New status: 'countered' ─────────────────────────────────────────────
--   pending → countered   (creator, before approval_due_at — same window
--                           as an ordinary approve/decline, not a new one)
--   countered → awaiting_payment  (business accepts the counter — this is
--                           the moment responded_at is set and the 7-day
--                           payment window starts, same as an ordinary
--                           approval; proposed_amount is overwritten with
--                           the agreed counter_amount here, so every
--                           downstream read of proposed_amount — the bank
--                           transfer instructions, the creator's payout
--                           math, admin's commission breakdown — reflects
--                           the real agreed price without those files
--                           needing to know a counter ever happened)
--   countered → cancelled (business declines the counter — same status
--                           as any other business-side withdrawal)
--
-- approval_due_at does NOT reset when a counter is made — a creator
-- countering on day 6 leaves the business only 1 day to respond. That's a
-- deliberate simplicity trade-off, not an oversight: resetting it would
-- mean the generated column's value depends on which row's state led
-- here, which stored generated columns can't express. A stale,
-- un-responded counter is picked up by the same scheduled expiry job that
-- already handles a stale 'pending' request — see below.

alter table public.channel_requests drop constraint channel_requests_status_check;
alter table public.channel_requests add constraint channel_requests_status_check
  check (status in (
    'pending', 'countered', 'declined', 'cancelled', 'awaiting_payment',
    'payment_submitted', 'paid', 'live', 'completed'
  ));

alter table public.channel_requests
  add column counter_amount numeric check (counter_amount > 0),
  add column counter_note text,
  add column countered_at timestamptz;

comment on column public.channel_requests.counter_amount is
  'Set when a creator counters instead of approving/declining outright.
   Once the business accepts (countered -> awaiting_payment), this value
   is copied into proposed_amount — see the trigger below — so this
   column stays as a historical record of what was countered, not
   something anything downstream needs to read directly.';

-- ── Extend the state machine ────────────────────────────────────────────
-- Same function as schema_phase17, extended with the three new legal
-- transitions. Everything else (admin's paid/completed/close-overdue
-- branch, is_business's pending->cancelled, is_creator's paid->live) is
-- copied unchanged from that file — this is a full CREATE OR REPLACE, not
-- a patch, since Postgres has no ALTER FUNCTION for adding a branch to a
-- plpgsql body.
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

  if auth.uid() is null then
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
    if new.status = 'paid' and old.status = 'payment_submitted' then
      new.paid_at := now();
      return new;
    end if;
    if new.status = 'completed' and old.status = 'live' then
      new.completed_at := now();
      return new;
    end if;
    if new.status in ('declined', 'cancelled') then
      return new; -- admin closing an overdue/unresponsive request (pending OR countered)
    end if;
    raise exception 'That status change is not allowed for an admin.';
  end if;

  if is_creator and old.status = 'pending' and new.status in ('awaiting_payment', 'declined') then
    new.responded_at := now();
    return new;
  end if;

  -- NEW: creator counters instead of approving/declining outright.
  -- Requires a real counter_amount — a creator can't move to 'countered'
  -- without actually proposing a number, same as insert requiring a real
  -- proposed_amount from the business in the first place.
  if is_creator and old.status = 'pending' and new.status = 'countered' then
    if new.counter_amount is null or new.counter_amount <= 0 then
      raise exception 'A counter-offer needs a real amount.';
    end if;
    new.countered_at := now();
    return new;
  end if;

  -- NEW: business accepts the counter — this is functionally the same
  -- moment an ordinary approval would set responded_at (starts the
  -- payment window), plus overwriting proposed_amount with the agreed
  -- price so nothing downstream needs to know a counter happened.
  if is_business and old.status = 'countered' and new.status = 'awaiting_payment' then
    new.responded_at := now();
    new.proposed_amount := old.counter_amount;
    return new;
  end if;

  -- NEW: business declines the counter.
  if is_business and old.status = 'countered' and new.status = 'cancelled' then
    return new;
  end if;

  if is_creator and old.status = 'paid' and new.status = 'live' then
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

-- Trigger itself is unchanged (same function name, same table) — no need
-- to drop/recreate it, only the function body changed above.
