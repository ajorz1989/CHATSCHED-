-- ChatSched — Phase 96 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase95_channel_request_metadata.sql.
--
-- The 13th channel: In-Venue Screens & Displays (src/channels/in-venue-
-- screens/index.ts). Same mechanism as schema_phase75/76/77: no new
-- table, an insert into the `channels` table (schema_phase74) plus
-- widening its category CHECK for one more value — 'outdoor', confirmed
-- unused by any of the 12 existing channel rows before this migration
-- (the front-end module already declares category: "outdoor").
--
-- Ships inactive (active: false) and feature-flagged off
-- (VITE_CHANNEL_IN_VENUE_SCREENS_ENABLED, default off in
-- src/lib/featureFlags.ts, deliberately NOT added to DEFAULT_ON) — same
-- "not yet a real publisher or listing" posture their branch already
-- applies to the 7 reverted channels (schema_phase92). This channel's
-- own module doc additionally notes a Phase 1 manual-workflow reason
-- for staying off by default independent of that: real venues need to
-- validate the manual creative-delivery flow first.
--
-- verification_required: true, matching every other request-bookingFlow
-- channel with an owner-authority eligibility check (informal-retail,
-- restaurants) rather than a follower-count one.

alter table public.channels drop constraint if exists channels_category_check;
alter table public.channels
  add constraint channels_category_check
  check (category in ('digital', 'broadcast', 'sports', 'events', 'community', 'transport', 'informal-retail', 'associations', 'food-and-beverage', 'outdoor'));

insert into public.channels (slug, name, category, active, verification_required, sort_order) values
  ('in-venue-screens', 'In-Venue Screens & Displays', 'outdoor', false, true, 12)
on conflict (slug) do nothing;
