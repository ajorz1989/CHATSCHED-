-- ChatSched — Phase 31 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
-- Purely additive.
--
-- What this adds: a "last active" trust signal on publisher profiles —
-- "Active today" / "Active 2 hours ago" / "Active 3 days ago" / "Inactive
-- for 14 days" — built from one new column and one throttled function,
-- nothing more. Deliberately not a live "online now" indicator: the
-- bucketed labels (see src/lib/lastActive.ts) are computed client-side
-- from a plain timestamp, the same way responseTimeLabel() turns
-- avg_response_hours into a coarse phrase rather than showing raw numbers.
--
-- Why a heartbeat function instead of a trigger on every action a
-- publisher might take: this needs to reflect "was this person using
-- ChatSched recently" in general — logging in and browsing their
-- dashboard counts, not just the specific actions (approving a request,
-- editing their listing) that already have their own triggers elsewhere
-- in this schema. touch_publisher_activity() is called once per session
-- from AuthContext (on sign-in and on each token refresh while the tab
-- stays open — see AuthContext.tsx), which in practice pings roughly
-- hourly for anyone actively using the app, without hammering the table
-- on every render.

alter table public.publishers
  add column last_active_at timestamptz;

comment on column public.publishers.last_active_at is
  'Last time this publisher''s own account was active on ChatSched
   (session start or token refresh) — set only by
   touch_publisher_activity(), never editable directly. Null for
   publishers with no user_id (added by hand via /admin) or who have
   never logged in; the UI omits the badge entirely in that case rather
   than showing a misleading "inactive" label.';

-- ── touch_publisher_activity ─────────────────────────────────────────
-- SECURITY DEFINER only to reach the publishers row despite the owner-only
-- UPDATE policy already on that table — but scoped tightly to
-- `user_id = auth.uid()`, so a caller can only ever touch their own row,
-- never anyone else's. Throttled server-side (skip the write if already
-- touched within the last 30 minutes) so a long browsing session doesn't
-- generate a write on every token refresh.
create or replace function public.touch_publisher_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.publishers
  set last_active_at = now()
  where user_id = auth.uid()
    and (last_active_at is null or last_active_at < now() - interval '30 minutes');
end;
$$;

grant execute on function public.touch_publisher_activity() to authenticated;
