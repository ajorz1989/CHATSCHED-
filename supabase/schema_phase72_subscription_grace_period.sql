-- ChatSched — Phase 72 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase71_subscription_enforcement.sql.
--
-- What this adds: one column per subscription table, `grace_period_started_at`.
-- Closes a gap PHASE20_LAUNCH_CREDIT_FORFEITURE_DELIVERY.md flagged and
-- forfeitBusinessLaunchCredit's own doc comment repeated: schema_phase55
-- defined `grace_period` and `suspended` as valid statuses (the brief
-- specifically asked for both), but nothing has ever actually moved a
-- subscription into either one — `grace_period` had zero writers anywhere
-- in this codebase, and PHASE2_SUBSCRIPTIONS_DELIVERY.md said so plainly:
-- "nothing moves a subscription into them automatically... that needs
-- either a scheduled job or an admin action, and a grace-period-length
-- policy neither the brief nor the existing codebase states anywhere."
--
-- This migration and the expire-subscription-grace-periods Edge Function
-- built alongside it are that scheduled job. The length policy still
-- isn't stated anywhere authoritative — PHASE23's delivery notes are
-- explicit that the 7-day default it picked follows this codebase's own
-- existing precedent (channel_requests' approval/payment windows, see
-- schema_phase17_channel_marketplace.sql) rather than being confirmed
-- product policy, and should be treated as a placeholder worth a real
-- decision, not as settled.
--
-- Why a dedicated column instead of reusing updated_at: updated_at gets
-- touched by every write to these rows (a later COMPLETE payment, an
-- unrelated field change), so it can't reliably answer "how long has
-- this subscription actually been sitting in grace_period" the way a
-- write dedicated to that one transition can.

alter table public.business_subscriptions
  add column if not exists grace_period_started_at timestamptz;

alter table public.publisher_subscriptions
  add column if not exists grace_period_started_at timestamptz;

comment on column public.business_subscriptions.grace_period_started_at is
  'Set the moment a further failed payment moves this subscription from
   past_due into grace_period (payfast-notify). Null otherwise. Cleared
   back to null once the subscription recovers to active, or once
   expire-subscription-grace-periods moves it on to suspended. Read by
   that same Edge Function to decide whether the grace window has
   elapsed.';

comment on column public.publisher_subscriptions.grace_period_started_at is
  'Same purpose as business_subscriptions.grace_period_started_at — see
   that column''s comment. Publisher subscriptions have no launch credit
   to forfeit, but the grace_period -> suspended clock works identically.';
