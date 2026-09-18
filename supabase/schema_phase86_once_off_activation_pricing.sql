-- ChatSched — Phase 86 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase85_retire_direct_messaging.sql.
--
-- Fixes "Claude To fix 1..txt" item 10, HIGH — Current pricing code does
-- not match the latest intended pricing specification. Confirmed
-- against the user's own explicit decisions (this item had no "Required
-- fix" checklist in the audit itself, unlike items 5-9 — it's a product/
-- commercial spec, not a discrete bug, so the shape of the fix was
-- clarified directly rather than inferred):
--   - Publisher: R199 ONCE-OFF activation, no renewal, ever.
--   - Business: R399 ONCE-OFF activation, no renewal, ever — the R199
--     launch credit is INCLUDED in this fee, not a separate purchase.
--   - Marketplace commission: 12% -> 8% (publisher share 88% -> 92%).
--   - A genuinely new, separate, recurring product — "Featured & Advertise
--     placements", from R99/month, in-house — covered by
--     schema_phase87_featured_placement_subscriptions.sql, not this file.
--
-- This file only touches the once-off conversion of the two membership
-- fees. Verified against the real, current schema before writing
-- anything: publisher_subscriptions / business_subscriptions
-- (schema_phase55_subscriptions.sql) were built entirely around monthly
-- recurring PayFast billing, with a full lapse lifecycle added later
-- (schema_phase72_subscription_grace_period.sql / expire-subscription-
-- grace-periods) — past_due -> grace_period -> suspended, a PayFast
-- recurring token, and a rolling current_period_end. None of that has
-- any meaning once a membership is paid once and never renews: there is
-- no recurring charge left to fail, no period to roll forward, no token
-- to store. This migration removes it rather than leaving it in place
-- unused — vestigial lifecycle columns that can never be written again
-- are exactly the kind of "still technically there" surface this whole
-- exercise has been about closing, not just a matter of tidiness.

-- ── 1. Simplify the status lifecycle to match a once-off payment ────────
-- pending (checkout started) -> active (paid) or failed (declined, can
-- retry by starting over — publisher-subscribe/business-subscribe already
-- reset an existing non-active row back to 'pending' on a new attempt).
-- 'cancelled' is kept, but only ever admin-set now (see cancel-subscription
-- below) — a full refund/policy revocation, not a lapsed renewal.
alter table public.publisher_subscriptions drop constraint if exists publisher_subscriptions_status_check;
alter table public.publisher_subscriptions add constraint publisher_subscriptions_status_check
  check (status in ('pending', 'active', 'failed', 'cancelled'));

alter table public.business_subscriptions drop constraint if exists business_subscriptions_status_check;
alter table public.business_subscriptions add constraint business_subscriptions_status_check
  check (status in ('pending', 'active', 'failed', 'cancelled'));

-- Any row already sitting in one of the three removed states has no
-- once-off equivalent to map to cleanly except "not currently active" —
-- 'failed' is the closer reading (something needs the member to pay
-- again) than 'cancelled' (a deliberate revocation), so that's the one
-- rows are moved to. In a pre-launch database this affects zero rows;
-- recorded for correctness regardless of environment.
update public.publisher_subscriptions set status = 'failed' where status in ('past_due', 'grace_period', 'suspended');
update public.business_subscriptions set status = 'failed' where status in ('past_due', 'grace_period', 'suspended');

-- ── 2. Drop the now-meaningless recurring-lifecycle columns ─────────────
alter table public.publisher_subscriptions drop column if exists current_period_end;
alter table public.publisher_subscriptions drop column if exists grace_period_started_at;
alter table public.publisher_subscriptions drop column if exists payfast_token;

alter table public.business_subscriptions drop column if exists current_period_end;
alter table public.business_subscriptions drop column if exists grace_period_started_at;
alter table public.business_subscriptions drop column if exists payfast_token;

-- ── 3. Add what a once-off payment record actually needs instead ───────
-- Same naming as public.payments (schema.sql / schema_phase30) for the
-- same two facts about a completed PayFast charge — a real PayFast
-- transaction reference and when it landed — rather than inventing new
-- names for the same concept.
alter table public.publisher_subscriptions add column if not exists payfast_payment_id text;
alter table public.publisher_subscriptions add column if not exists paid_at timestamptz;

alter table public.business_subscriptions add column if not exists payfast_payment_id text;
alter table public.business_subscriptions add column if not exists paid_at timestamptz;

comment on table public.publisher_subscriptions is
  'ChatSched Publisher Network membership — a R199 ONCE-OFF activation fee (schema_phase86, item 10), not a recurring subscription. status: pending -> active (paid, permanent) or failed (can retry via publisher-subscribe again); cancelled is admin-only (see cancel-subscription).';
comment on table public.business_subscriptions is
  'ChatSched Business membership — a R399 ONCE-OFF activation fee (schema_phase86, item 10) that already includes the R199 launch credit, not a recurring subscription. status: pending -> active (paid, permanent) or failed (can retry via business-subscribe again); cancelled is admin-only (see cancel-subscription). launch_credit_granted/business_launch_credits are unchanged — "first-ever completed payment" and "the only payment" are now the same event.';

-- ── 4. Update the four subscription-gated enforcement policies +
--       enforce_channel_request_transition() (schema_phase71) ──────────
-- All five hardcoded status in ('active', 'grace_period') — the exact
-- match for isSubscriptionUsable() at the time schema_phase71 shipped.
-- grace_period no longer exists as a status; "usable" is now just
-- status = 'active', matching src/lib/subscriptions.ts's own updated
-- isSubscriptionUsable().
drop policy if exists "requests_insert_own" on public.requests;
create policy "requests_insert_own" on public.requests
  for insert with check (
    auth.uid() = business_id
    and exists (
      select 1 from public.business_subscriptions
      where business_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "channel_requests_insert_business" on public.channel_requests;
create policy "channel_requests_insert_business" on public.channel_requests
  for insert with check (
    auth.uid() = business_id and status = 'pending'
    and exists (
      select 1 from public.business_subscriptions
      where business_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "opportunities_insert_own" on public.opportunities;
create policy opportunities_insert_own
  on public.opportunities for insert
  with check (
    business_id = auth.uid()
    and exists (
      select 1 from public.business_subscriptions
      where business_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "opportunity_applications_insert_publisher" on public.opportunity_applications;
create policy opportunity_applications_insert_publisher
  on public.opportunity_applications for insert
  with check (
    exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid() and status = 'approved')
    and exists (select 1 from public.opportunities where id = opportunity_id and status = 'open')
    and exists (
      select 1 from public.publisher_subscriptions
      where publisher_id = auth.uid() and status = 'active'
    )
  );

-- Identical to schema_phase71's version except the one changed check
-- (grace_period removed) — everything else about this trigger (the
-- state-machine branches, who can do what) is untouched.
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
      return new;
    end if;
    raise exception 'That status change is not allowed for an admin.';
  end if;

  if is_creator and old.status = 'pending' and new.status = 'awaiting_payment' then
    if not exists (
      select 1 from public.publisher_subscriptions
      where publisher_id = auth.uid() and status = 'active'
    ) then
      raise exception 'An active Publisher Network subscription is required to accept new requests.';
    end if;
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'declined' then
    new.responded_at := now();
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
