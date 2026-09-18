-- pgTAP tests for the Phase 82 public-publisher-column fix
-- ("Claude To fix 1..txt" item 6, CRITICAL — Public publisher rows expose
-- sensitive columns).
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern already established by
-- rls_channels_publishers_channel_requests_test.sql (set_config +
-- `set role authenticated`, lives_ok + a follow-up is()/isnt() for writes
-- or reads RLS silently narrows rather than rejects with an error),
-- reviewed by hand against the actual `publishers_public` view and
-- `publishers_select_own_or_admin` policy in
-- schema_phase82_restrict_public_publisher_columns.sql, not from memory
-- of what they "should" say. Needs every schema_phase*.sql through
-- schema_phase82 applied first.
--
-- Scope: exactly what that migration changed — (1) publishers_public
-- returns only safe columns for approved publishers, to anon and
-- authenticated alike; (2) a non-owner, non-admin session can no longer
-- read ANY column of another publisher's row from the base `publishers`
-- table directly, closing the actual hole (RLS only used to restrict
-- rows, not columns); (3) the owner can still read their own full row,
-- and an admin can still read every column of every row, from the base
-- table. Does not re-test publishers_select_own_or_admin's own-row/admin
-- row-visibility logic beyond what's needed to prove (2) and (3) — that
-- shape was already correct before this fix and is
-- rls_channels_publishers_channel_requests_test.sql's territory, not
-- duplicated here.

begin;
select plan(8);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'creator-owner-d@example.test'),
  ('d2222222-2222-2222-2222-222222222222', 'unrelated-business-d@example.test'),
  ('d3333333-3333-3333-3333-333333333333', 'admin-d@example.test');

update public.profiles set role = 'publisher' where id = 'd1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'business' where id = 'd2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'admin' where id = 'd3333333-3333-3333-3333-333333333333';

-- One approved publisher, owned by d1111111, carrying every sensitive
-- column the finding names plus a couple more in the same spirit.
insert into public.publishers (
  id, user_id, name, city, province, category, channel_slug, status,
  email, mobile_number, business_name, company_registration, vat_number,
  admin_notes, rejected_reason, payout_method, payout_details,
  payout_account_verified_at
) values (
  'd4444444-4444-4444-4444-444444444444', 'd1111111-1111-1111-1111-111111111111',
  'Approved Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved',
  'creator@example.test', '+27000000000', 'Creator Pty Ltd', '2020/123456/07', '4123456789',
  'internal note about this creator', null, 'eft',
  '{"account_number": "secret-account-number"}'::jsonb, now()
);

-- ── 1. publishers_public exposes the row but not its sensitive columns ──
select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select is(
  (select count(*)::int from public.publishers_public where id = 'd4444444-4444-4444-4444-444444444444'),
  1,
  'an unrelated authenticated user can see the approved publisher via publishers_public'
);
select is(
  (select to_jsonb(pp) ? 'email' from public.publishers_public pp where id = 'd4444444-4444-4444-4444-444444444444'),
  false,
  'publishers_public does not expose the email column at all'
);
select is(
  (select to_jsonb(pp) ? 'payout_details' from public.publishers_public pp where id = 'd4444444-4444-4444-4444-444444444444'),
  false,
  'publishers_public does not expose the payout_details column at all'
);
select is(
  (select to_jsonb(pp) ? 'admin_notes' from public.publishers_public pp where id = 'd4444444-4444-4444-4444-444444444444'),
  false,
  'publishers_public does not expose the admin_notes column at all'
);
reset role;

-- ── 2. anon gets the same safe view, still nothing sensitive ────────────
set role anon;
select is(
  (select count(*)::int from public.publishers_public where id = 'd4444444-4444-4444-4444-444444444444'),
  1,
  'even an anonymous (logged-out) request can see the approved publisher via publishers_public'
);
reset role;

-- ── 3. the base table no longer leaks the row to a non-owner, non-admin ─
-- This is the actual hole the finding described: before this fix, the
-- same unrelated business could `select *` this row straight off
-- public.publishers (status = 'approved' was enough) and get every
-- sensitive column back. publishers_select_own_or_admin removes that
-- branch entirely, so the row should now be invisible on the base table
-- to anyone but its owner or an admin — not just column-restricted.
select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select is(
  (select count(*)::int from public.publishers where id = 'd4444444-4444-4444-4444-444444444444'),
  0,
  'an unrelated authenticated user cannot see the approved publisher''s row on the base publishers table at all'
);
reset role;

-- ── 4. the owner can still read every column of their own row ───────────
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select is(
  (select email from public.publishers where id = 'd4444444-4444-4444-4444-444444444444'),
  'creator@example.test',
  'the publisher''s own logged-in session can still read its own email from the base table'
);
reset role;

-- ── 5. an admin can still read every column of any row ──────────────────
select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select is(
  (select payout_method from public.publishers where id = 'd4444444-4444-4444-4444-444444444444'),
  'eft',
  'an admin session can still read sensitive columns (e.g. payout_method) from the base table'
);
reset role;

select * from finish();
rollback;
