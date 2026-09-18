-- ChatSched — Phase 45 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase44_platform_rules_content.sql.
--
-- Adds four tables to the supabase_realtime publication so Postgres
-- Changes events actually fire for them — nothing before this migration
-- has ever opted a table into Realtime, so this is new capability, not a
-- config tweak. Read alongside the client-side changes it enables:
-- src/hooks/useNotifications.ts, src/components/MessageThread.tsx, and
-- src/pages/Messages.tsx, all of which replace a setInterval poll with a
-- subscription to the tables enabled here.
--
-- RLS still governs who actually receives an event, exactly as it governs
-- a normal SELECT — a client-supplied `filter` on a subscription (e.g.
-- `recipient_id=eq.<uuid>`) is a server-side narrowing for bandwidth, not
-- the security boundary. A malicious client subscribing with no filter at
-- all still only receives rows its own RLS policies would let it SELECT.
-- That's *why* the `conversations` subscription (see Messages.tsx) can
-- reasonably skip a `filter` param — its SELECT policy already covers
-- both business and publisher participants via an OR/join a single
-- column-equality filter can't express, so subscribing broadly and
-- trusting RLS is the correct move there, not a shortcut around it.
--
-- REPLICA IDENTITY FULL on all four: the default replica identity (primary
-- key only) is enough for INSERT events, but Postgres's logical
-- replication needs the full OLD row to evaluate an UPDATE/DELETE against
-- a USING clause that references columns beyond the primary key — which
-- every RLS policy on these four tables does (recipient_id, request_id,
-- conversation_id, business_id/publisher_id). Without this, UPDATE events
-- (read-receipt changes, in particular — the whole reason MessageThread
-- and Messages.tsx read read_at back) would silently fail to broadcast to
-- anyone once RLS is in the loop.
alter table public.notifications replica identity full;
alter table public.messages replica identity full;
alter table public.conversation_messages replica identity full;
alter table public.conversations replica identity full;

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_messages;
alter publication supabase_realtime add table public.conversations;
