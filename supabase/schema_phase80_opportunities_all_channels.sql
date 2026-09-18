-- ChatSched — Phase 80 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase79_publisher_verification_checks.sql.
--
-- NEXT_STAGE_DEVELOPMENT_BRIEF.md Task 3: close the
-- `opportunities.channel_slug` gap. Same swap
-- schema_phase74_universal_channels.sql already did for
-- `publishers`/`channel_requests` — a hardcoded CHECK constraint,
-- listing only the original 5 channels, replaced by a real FK against
-- `public.channels(slug)`.
--
-- Checked the rest of the opportunity-marketplace stack before writing
-- this, expecting more to be hardcoded than there actually was:
--   - close_out_accepted_opportunity() (schema_phase69) — entirely
--     channel-agnostic already, works purely off opportunity_applications
--     status counts, no channel_slug branch at all.
--   - BusinessOpportunities.tsx's decide()-on-accept logic — already an
--     `if (channel_slug === 'social-media') insert into requests else
--     insert into channel_requests with that channel_slug` — the `else`
--     branch already handles any of the 12, not hardcoded to a list.
--   - Both CHANNEL_LABEL maps (BusinessOpportunities.tsx,
--     OpportunityFeed.tsx) already have all 12 entries — added
--     defensively ahead of this migration, per their own prior comment.
--   - The posting form's channel <select> already renders all 12 options
--     from CHANNEL_LABEL's own keys — it was only ever the INSERT that
--     failed server-side, not a UI gap.
--   - OpportunityFeed.tsx's own channel-match filter
--     (`channel_slug === null || channel_slug === publisherChannelSlug`)
--     is already channel-agnostic too.
-- So this migration, plus updating the two now-stale "not yet postable"
-- comments in those same two files, is the whole task — not because the
-- task was trivial, but because the frontend was genuinely already built
-- ahead of the schema catching up.

alter table public.opportunities drop constraint if exists opportunities_channel_slug_check;
alter table public.opportunities
  add constraint opportunities_channel_slug_fkey foreign key (channel_slug) references public.channels(slug);

comment on column public.opportunities.channel_slug is
  'Nullable — a business can target one channel type or leave it open to
   any. References channels(slug); was a hardcoded 5-value CHECK before
   this migration (schema_phase80) — see this file''s own header for why
   nothing else in the opportunity-marketplace stack needed a matching
   change.';
