-- pgTAP tests for the Phase 84 safe cross-party profile access fix
-- ("Claude To fix 1..txt" item 8, HIGH — Business profile data leakage
-- through shared-request/conversation policies).
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern already established in
-- this directory, reviewed by hand against the actual view definition in
-- schema_phase84_safe_cross_party_profile_access.sql, not from memory of
-- what it "should" say. Needs every schema_phase*.sql through
-- schema_phase84 applied first.
--
-- Scope: exactly what schema_phase84 changed — business_contact_public
-- grants a publisher who shares a request OR a conversation with a
-- business exactly (full_name, company_name) and nothing else, while the
-- base profiles table no longer grants that publisher any row access at
-- all; an unrelated publisher gets neither; the business's own session
-- and an admin session are unaffected on the base table. Does not
-- re-test profiles_select_own_or_admin's own-row/admin logic beyond
-- what's needed to prove that — it was already correct before this fix
-- and isn't this fix's territory.

begin;
select plan(11);

-- ── fixtures: a business + publisher who share a REQUEST ────────────────
insert into auth.users (id, email) values
  ('f1111111-1111-1111-1111-111111111111', 'business-f1@example.test'),
  ('f2222222-2222-2222-2222-222222222222', 'publisher-shares-request-f@example.test'),
  ('f3333333-3333-3333-3333-333333333333', 'publisher-unrelated-f@example.test'),
  ('f4444444-4444-4444-4444-444444444444', 'business-f2@example.test'),
  ('f5555555-5555-5555-5555-555555555555', 'publisher-shares-conversation-f@example.test'),
  ('f6666666-6666-6666-6666-666666666666', 'admin-f@example.test');

update public.profiles set role = 'business', phone = '+27011111111' where id = 'f1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'publisher' where id = 'f2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'publisher' where id = 'f3333333-3333-3333-3333-333333333333';
update public.profiles set role = 'business', phone = '+27022222222' where id = 'f4444444-4444-4444-4444-444444444444';
update public.profiles set role = 'publisher' where id = 'f5555555-5555-5555-5555-555555555555';
update public.profiles set role = 'admin' where id = 'f6666666-6666-6666-6666-666666666666';

insert into public.publishers (id, user_id, name, city, province, category, channel_slug, status) values
  ('f7777777-7777-7777-7777-777777777777', 'f2222222-2222-2222-2222-222222222222', 'Request Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved'),
  ('f8888888-8888-8888-8888-888888888888', 'f3333333-3333-3333-3333-333333333333', 'Unrelated Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved'),
  ('f9999999-9999-9999-9999-999999999999', 'f5555555-5555-5555-5555-555555555555', 'Conversation Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved');

insert into public.requests (publisher_id, business_id, campaign_message)
values ('f7777777-7777-7777-7777-777777777777', 'f1111111-1111-1111-1111-111111111111', 'Would love to work together');

insert into public.conversations (business_id, publisher_id)
values ('f4444444-4444-4444-4444-444444444444', 'f9999999-9999-9999-9999-999999999999');

-- ── 1. A publisher who shares a REQUEST sees the business's name only ───
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select is(
  (select count(*)::int from public.business_contact_public where id = 'f1111111-1111-1111-1111-111111111111'),
  1,
  'a publisher who shares a request with the business can see it via business_contact_public'
);
select is(
  (select to_jsonb(bc) ? 'phone' from public.business_contact_public bc where id = 'f1111111-1111-1111-1111-111111111111'),
  false,
  'business_contact_public does not expose the phone column at all'
);

-- ── 2. That same publisher gets nothing from the base profiles table ────
select is(
  (select count(*)::int from public.profiles where id = 'f1111111-1111-1111-1111-111111111111'),
  0,
  'that same publisher cannot see the business''s row on the base profiles table at all (the actual fix — not just a column restriction, the row itself is gone from that table for them)'
);
reset role;

-- ── 3. An unrelated publisher (no request, no conversation) gets neither ─
select set_config('request.jwt.claim.sub', 'f3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select is(
  (select count(*)::int from public.business_contact_public where id = 'f1111111-1111-1111-1111-111111111111'),
  0,
  'an unrelated publisher (no shared request or conversation) sees nothing via business_contact_public either'
);
reset role;

-- ── 4. A publisher who shares a CONVERSATION (not a request) also works ──
select set_config('request.jwt.claim.sub', 'f5555555-5555-5555-5555-555555555555', true);
set role authenticated;
select is(
  (select count(*)::int from public.business_contact_public where id = 'f4444444-4444-4444-4444-444444444444'),
  1,
  'a publisher who shares a conversation (not a request) with the business can also see it via business_contact_public'
);
reset role;

-- ── 5. The business's own session still sees its own full row, phone
--       included, on the base table ─────────────────────────────────────
select set_config('request.jwt.claim.sub', 'f1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select is(
  (select phone from public.profiles where id = 'f1111111-1111-1111-1111-111111111111'),
  '+27011111111',
  'the business''s own logged-in session can still read its own phone from the base table'
);
select is(
  (select count(*)::int from public.business_contact_public where id = 'f1111111-1111-1111-1111-111111111111'),
  1,
  'the business can also see its own row via business_contact_public (own-row branch)'
);
reset role;

-- ── 6. An admin still sees everything on the base table ─────────────────
select set_config('request.jwt.claim.sub', 'f6666666-6666-6666-6666-666666666666', true);
set role authenticated;
select is(
  (select phone from public.profiles where id = 'f4444444-4444-4444-4444-444444444444'),
  '+27022222222',
  'an admin session can still read any business''s phone from the base table'
);
reset role;

-- ── 7. anon gets nothing from either surface ─────────────────────────────
set role anon;
select is(
  (select count(*)::int from public.profiles where id = 'f1111111-1111-1111-1111-111111111111'),
  0,
  'an anonymous session sees nothing on the base profiles table'
);
select is(
  (select count(*)::int from public.business_contact_public where id = 'f1111111-1111-1111-1111-111111111111'),
  0,
  'an anonymous session sees nothing via business_contact_public either — no shared request/conversation, no own-row, no admin'
);
reset role;

-- ── 8. The unrelated publisher's own publisher row is untouched by any
--       of this (sanity check the fixture itself, not just the fix) ─────
select is(
  (select count(*)::int from public.publishers where id = 'f8888888-8888-8888-8888-888888888888'),
  1,
  'sanity check: the unrelated publisher row exists as inserted (fixture integrity, not the fix itself)'
);

select * from finish();
rollback;
