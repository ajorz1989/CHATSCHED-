-- ChatSched — Phase 95 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase94_manager_internal_roles.sql.
--
-- The request-side counterpart to publishers.channel_metadata
-- (schema_phase74_universal_channels.sql): a single rigid shared shape
-- across 11 different request-flow channel types would force
-- incompatible business-submitted fields to look equivalent, so this is
-- a plain jsonb column, not a typed one. Confirmed no column of this
-- name already exists on channel_requests under any name — duration_days
-- (schema_phase54_deliverables.sql) already covers one previously-shared
-- field, this covers everything channel-specific beyond it.
--
-- Populated by src/lib/channelRequestFieldSchemas.ts's per-channel field
-- definitions, written by ChannelRequestForm.tsx (the business filling
-- in the request) and read back by whoever reviews it
-- (PublisherDashboardView.tsx, AdminChannelRequests.tsx) — not queried
-- structurally, so no GIN index; if a field here ever needs to be
-- searched/filtered on, that's the signal to promote it to a real typed
-- column, not before. social-media is the one channel that never
-- populates this — it uses the sidebar campaign-request + PayFast
-- checkout flow on PublisherProfile.tsx instead of ChannelRequestForm.tsx.

alter table public.channel_requests add column if not exists request_metadata jsonb;

comment on column public.channel_requests.request_metadata is
  'Per-channel structured request fields the business supplies beyond the
   generic advertising method / campaign message / proposed budget /
   duration — e.g. preferredAirWindow/scriptProvided for podcast,
   preferredDates/screenCount for in-venue-screens. Shape defined per
   channel in src/lib/channelRequestFieldSchemas.ts. null for requests
   made before this column existed, and for social-media requests, which
   never use this flow.';
