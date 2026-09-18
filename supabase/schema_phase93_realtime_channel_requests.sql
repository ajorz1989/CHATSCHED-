-- ChatSched — Phase 93 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase92_revert_premature_channel_launch.sql.
-- (Renumbered from this project's original phase 84 — that slot was
-- independently taken by schema_phase84_safe_cross_party_profile_access.sql
-- in the lineage this got merged into. Content unchanged from the original,
-- except this note.)
--
-- Adds channel_requests and content_approvals to the supabase_realtime
-- publication, the same way schema_phase45_realtime.sql added
-- notifications/messages/conversation_messages/conversations — read that
-- migration's own header comment for the full reasoning (RLS is still the
-- real security boundary for who receives an event; a subscription filter
-- is only a bandwidth narrowing; REPLICA IDENTITY FULL is needed because
-- these tables' RLS policies reference columns beyond the primary key,
-- which Postgres's logical replication needs the full OLD row to
-- evaluate for UPDATE events).
--
-- Enables src/components/CampaignActivityTimeline.tsx's live updates —
-- without this, its subscribe() calls would silently never fire (no
-- error, just nothing ever arriving), since a table isn't broadcastable
-- just because RLS allows selecting from it; it has to be explicitly
-- added to this publication first, and neither of these two tables ever
-- had been.
alter table public.channel_requests replica identity full;
alter table public.content_approvals replica identity full;

alter publication supabase_realtime add table public.channel_requests;
alter publication supabase_realtime add table public.content_approvals;
