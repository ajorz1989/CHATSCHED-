-- ChatSched — Phase 84 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase83_secure_payout_rpcs.sql.
--
-- Fixes "Claude To fix 1..txt" item 8, HIGH — Business profile data
-- leakage through shared-request/conversation policies. Verified against
-- the real source before writing anything:
--
--   profiles_select_via_shared_request (schema_phase6.sql):
--       for select using (
--         exists (select 1 from public.requests r
--                 join public.publishers p on p.id = r.publisher_id
--                 where r.business_id = profiles.id and p.user_id = auth.uid())
--       )
--   profiles_select_via_shared_conversation (schema_phase29_conversations.sql):
--       for select using (
--         exists (select 1 from public.conversations c
--                 join public.publishers p on p.id = c.publisher_id
--                 where c.business_id = profiles.id and p.user_id = auth.uid())
--       )
--   Both policies' own comments say the intent is just showing a business
--   name to the publisher counterpart on a shared request/conversation.
--   But RLS is a row filter, not a column filter — once either exists()
--   check passes, the ENTIRE profiles row is readable, including phone,
--   industry, city, province, website, and every verification flag
--   (schema_phase7.sql). This is real and independent of what any
--   frontend file renders: `GET /rest/v1/profiles?select=phone&id=eq.<biz
--   id>` from a publisher who shares one active request with that
--   business returns their phone number today, regardless of the fact
--   that no UI currently displays it.
--
-- Required fix (from the finding): explicit safe views/RPCs for
-- cross-party profile access, returning only display name / business
-- name / avatar / permitted public metadata. This codebase has no avatar
-- concept on profiles at all (confirmed — schema_phase34's avatar_url is
-- on a different table entirely, for publishers' connected social
-- accounts), so the safe surface here is exactly full_name and
-- company_name — confirmed by reading every real consumer of the two
-- policies below, not assumed.
--
-- Why this is a view with its own auth.uid()-aware WHERE clause, not
-- simply narrower RLS policies on profiles itself: AuthContext.tsx loads
-- the LOGGED-IN USER'S OWN full profile via `select("*")` on `id =
-- auth.uid()` at session start (used throughout the app, including a
-- business editing their own phone/city/province in Dashboard.tsx) — so
-- profiles_select_own_or_admin has to keep granting full columns for a
-- user's own row. Postgres column-level GRANTs can't be conditioned on
-- which policy branch matched a row, so there is no way to keep
-- "authenticated" able to read their own phone via the base table while
-- also being unable to read someone else's phone via the same grant —
-- the ONLY way to give a genuinely narrower result for the cross-party
-- case is a separate, column-restricted view with its own row logic, per
-- the finding's own suggested fix.
--
-- Traced every real frontend caller of the two removed policies before
-- deciding what to keep working, not assumed:
--   - src/components/PublisherDashboardView.tsx and
--     src/lib/campaignWorkspace.ts each had a `requests` query embedding
--     `business:profiles(full_name, company_name, ...)` — genuinely
--     relies on profiles_select_via_shared_request.
--   - src/pages/Messages.tsx had a `conversations` query embedding
--     `business:profiles!business_id(full_name, company_name)` —
--     genuinely relies on profiles_select_via_shared_conversation.
--   - src/components/PublisherDashboardView.tsx and
--     src/lib/campaignWorkspace.ts ALSO each had a `channel_requests`
--     query with the same kind of embed — but no RLS policy anywhere in
--     this schema ever covered channel_requests -> profiles (confirmed by
--     grep across every schema_phase*.sql), so that embed was already
--     returning null before this fix. Left alone: not something this
--     change makes worse, and fixing a channel_requests/profiles
--     relationship that never worked is a new feature, not a fix to what
--     the two named files broke.
--   - src/pages/MediaKit.tsx and src/pages/PublisherProfile.tsx each
--     embed `business:profiles(full_name, company_name)` on `reviews`
--     (attributing a public review to the business that wrote it) — this
--     never depended on either policy being removed here either (reviews
--     are fully public via reviews_select_public regardless, and neither
--     removed policy's exists() check ever matched a reviews row), so
--     it's unaffected — already inconsistent before this change (only
--     resolves the name when the viewer happens to also share an
--     unrelated request/conversation with that same business) and stays
--     exactly that inconsistent after it. Worth a dedicated look
--     eventually, but out of scope for the two files this finding names.
--
-- The three real call sites above were updated to query the new view as
-- a separate, top-level request (via src/lib/businessContact.ts) instead
-- of an embedded resource. That's a deliberate choice, not a shortcut:
-- PostgREST's embedding syntax (`business:profiles(...)`) resolves
-- through a real foreign-key constraint, and business_contact_public has
-- no FK from requests/conversations pointing at it (only at the base
-- profiles table) — embedding a view under a different name isn't
-- something to rely on working across PostgREST versions, so a second,
-- explicit query is the guaranteed-correct approach.

-- ── 1. Drop the two over-broad policies ──────────────────────────────
-- profiles_select_own_or_admin (schema.sql) is untouched — still needed
-- for every user's own full-column profile load.
drop policy "profiles_select_via_shared_request" on public.profiles;
drop policy "profiles_select_via_shared_conversation" on public.profiles;

-- ── 2. The safe view ──────────────────────────────────────────────────
-- security_invoker = false is the default (kept explicit here because,
-- same as publishers_public in schema_phase82, the entire fix depends on
-- it) — reads run as this view's owner (`postgres`, since this migration
-- runs in the Supabase SQL editor), which bypasses RLS on the underlying
-- profiles table entirely. The WHERE clause below is a direct
-- column-restricted translation of the two policies just dropped, plus
-- an own-row branch (so a business viewing their own embedded entry —
-- e.g. their own row in their own Messages.tsx conversations list —
-- still resolves) and an admin branch for completeness, even though
-- admin-facing pages already query `profiles` directly and don't need
-- this view.
create or replace view public.business_contact_public
with (security_invoker = false)
as
select
  p.id,
  p.full_name,
  p.company_name
from public.profiles p
where
  p.id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.requests r
    join public.publishers pub on pub.id = r.publisher_id
    where r.business_id = p.id and pub.user_id = auth.uid()
  )
  or exists (
    select 1 from public.conversations c
    join public.publishers pub on pub.id = c.publisher_id
    where c.business_id = p.id and pub.user_id = auth.uid()
  );

comment on view public.business_contact_public is
  'Safe cross-party read surface for a business''s display name only — full_name and company_name, nothing else. Replaces profiles_select_via_shared_request and profiles_select_via_shared_conversation (schema_phase6.sql / schema_phase29_conversations.sql), which granted the ENTIRE profiles row (phone, verification flags, everything) to any publisher who merely shared a request or conversation with that business. Query this as its own request (see src/lib/businessContact.ts) rather than trying to embed it from requests/conversations — it has no foreign key relationship for PostgREST to embed through.';

grant select on public.business_contact_public to authenticated;
