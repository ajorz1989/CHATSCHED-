-- ChatSched — Phase 85 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase84_safe_cross_party_profile_access.sql.
--
-- Fixes "Claude To fix 1..txt" item 9, HIGH — Business-to-publisher
-- communication conflicts with the new agency model. Verified against
-- the real, current source before writing anything — including checking
-- whether each of the finding's own affected files still describes a
-- live problem, since one of them turned out not to.
--
-- What's actually still true today (confirmed by reading the code, not
-- assumed from the finding):
--   conversations_insert_business (schema_phase29_conversations.sql)
--   lets ANY authenticated business (or admin) open a brand-new
--   `conversations` row with ANY approved publisher, with no requirement
--   that a campaign request or booking exists at all:
--       with check (
--         auth.uid() = business_id
--         and exists (select 1 from public.profiles where id = auth.uid() and role in ('business', 'admin'))
--         and exists (select 1 from public.publishers where id = publisher_id and status = 'approved')
--         and not exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid())
--       )
--   This is exactly the "Business → publisher, unmediated" path the
--   current business model (Business → ChatSched → Publisher) is meant
--   to prevent — a business can fully route around the campaign-request/
--   escrow flow this codebase has otherwise standardised on (11 of the
--   12 channel definitions already use bookingFlow: "request", meaning
--   channel_requests with no direct messaging at all; only
--   social-media still has bookingFlow: "directory").
--
-- What's already NOT a live problem (confirmed by reading the current
-- code, not assumed from the finding's own affected-files list):
--   - src/pages/PublisherProfile.tsx has no "Contact Publisher" CTA
--     anywhere, for either booking flow — it already says "Start
--     Campaign Request" everywhere, inserts into `requests` (not
--     `conversations`), and the non-request-flow branch already carries
--     "ChatSched handles the publisher relationship" copy and a
--     "Managed" badge. This page needed no change at all; it's listed
--     here only because the finding named it, not because anything in
--     it was wrong.
--   - There is no live UI link anywhere in this codebase pointing at
--     `/messages?publisher=...` (confirmed by grep across all of src/)
--     — the "Contact Publisher" entry point the schema_phase29 header
--     comment describes is already unreachable through any button. The
--     capability was still live at the DATABASE level regardless (see
--     above) — button removal alone was never the actual fix, since
--     anyone could still call conversations_insert_business directly
--     over the API without a UI button existing for it.
--
-- Required fix, adapted to what's real: retire the ABILITY for an
-- ordinary business to open a new conversation (the actual bypass risk),
-- while keeping "publisher ↔ ChatSched communication" — the same
-- underlying `conversations` mechanism already allowed an admin account
-- to be the business_id side (`role in ('business', 'admin')`), so
-- ChatSched staff opening a thread with a publisher directly continues
-- to work through the same table; only the ordinary-business branch is
-- removed. Existing conversations, if any, are left exactly as they
-- were: this closes the door on NEW unmediated contact, it does not
-- retroactively delete or lock threads that already exist (a more
-- destructive action than what "retire" was asked to do, and one this
-- migration can't safely evaluate the consequences of without knowing
-- whether any real conversations already exist in production).

drop policy conversations_insert_business on public.conversations;

create policy conversations_insert_admin on public.conversations
  for insert
  with check (
    public.is_admin()
    and auth.uid() = business_id
  );

comment on policy conversations_insert_admin on public.conversations is
  'Replaces conversations_insert_business (schema_phase29_conversations.sql), which let any ordinary business open a brand-new, unmediated thread with any approved publisher — the exact "Business direct to Publisher" bypass the current agency model (Business -> ChatSched -> Publisher) is meant to prevent. Only ChatSched (an admin session) can open a new conversations row now; existing threads and their SELECT/message-send policies are untouched, so any conversation created before this fix keeps working for its participants.';
