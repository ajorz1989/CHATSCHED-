-- ChatSched — Phase 108 schema patch
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- What this changes: the approval_due_at deadline in
-- set_channel_request_due_dates() is now channel-aware.
--
-- Before this patch (phase 17):
--   new.approval_due_at := new.created_at + interval '7 days';
--
-- After this patch:
--   Events & Tournaments requests get 30 days; every other channel keeps 7.
--
-- Why 30 days for events:
--   Event organisers need lead time for programme production, signage
--   printing and logistics that other channel types don't — a social-media
--   creator can approve in days, but a conference organiser needs to confirm
--   dates, allocate a sponsor slot, and book print production before
--   accepting a sponsorship request. The 30-day window matches the
--   `approvalWindowDays: 30` field set on the events channel definition in
--   src/channels/events/index.ts (added in the same PR as this migration).
--
-- Nothing else changes:
--   payment_due_at (responded_at + 7 days) and payout_due_at
--   (live_at + 48 hours) are the same for every channel.
--   The state machine in enforce_channel_request_transition() is untouched.
--   Existing pending events requests will have their approval_due_at
--   recalculated correctly the next time the row is touched, because the
--   trigger fires on UPDATE too (see the CREATE TRIGGER in phase 17 —
--   `before insert or update`). Rows that are already past pending are
--   terminal states; recalculating their deadline is harmless.

create or replace function public.set_channel_request_due_dates()
returns trigger
language plpgsql
as $$
begin
  -- Approval window: 30 days for Events & Tournaments, 7 days for all others.
  -- Matches the per-channel approvalWindowDays field in the TypeScript channel
  -- definitions (src/channels/events/index.ts sets approvalWindowDays: 30;
  -- all other channel modules omit the field, defaulting to the global
  -- CREATOR_APPROVAL_WINDOW_DAYS = 7 in src/lib/constants.ts).
  new.approval_due_at :=
    new.created_at + case
      when new.channel_slug = 'events' then interval '30 days'
      else                                  interval '7 days'
    end;

  -- Payment window: 7 days from the creator's response, for every channel.
  new.payment_due_at := case
    when new.responded_at is not null
    then new.responded_at + interval '7 days'
    else null
  end;

  -- Payout window: 48 hours from going live, for every channel.
  new.payout_due_at := case
    when new.live_at is not null
    then new.live_at + interval '48 hours'
    else null
  end;

  return new;
end;
$$;

-- The trigger itself (defined in phase 17) doesn't change — it already fires
-- `before insert or update on public.channel_requests for each row`, which
-- is exactly what we need. Replacing the function body above is sufficient;
-- no DROP/CREATE TRIGGER is required.

-- Backfill: recalculate approval_due_at for any existing pending events
-- requests that are not yet past their approval window. Rows in terminal
-- states (declined, cancelled, awaiting_payment, ...) don't need it, and
-- touching them unnecessarily would fire the transition-enforcement trigger,
-- which would raise for non-status-changing updates to non-pending rows.
-- The trigger fires on UPDATE, so this UPDATE triggers the newly-replaced
-- function and writes the correct 30-day deadline in one step.
update public.channel_requests
set    updated_at = now()   -- a no-op column touch to fire the BEFORE trigger
where  channel_slug = 'events'
and    status       = 'pending'
and    approval_due_at > now(); -- only rows not yet expired under the old window
-- Note: if channel_requests has no `updated_at` column, replace the SET line
-- with any column that exists and is safe to re-set to its current value, e.g.
--   set campaign_message = campaign_message
-- Both produce the same result: a no-op data change that fires the BEFORE
-- trigger so it can recalculate approval_due_at from the new function body.
