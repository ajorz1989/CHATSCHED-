-- pgTAP tests for the Phase 83 payout-RPC security fix
-- ("Claude To fix 1..txt" item 7, CRITICAL — Payout RPCs are
-- insufficiently protected).
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern already established in
-- this directory, reviewed by hand against the actual function bodies
-- and policies in schema_phase83_secure_payout_rpcs.sql, not from memory
-- of what they "should" say. Needs every schema_phase*.sql through
-- schema_phase83 applied, AND schema_payouts_phase1.sql /
-- schema_payouts_functions.sql applied first (they are not part of the
-- numbered schema_phase* sequence — see workers/README.md for why this
-- pipeline lives in its own files).
--
-- Scope: exactly what schema_phase83 changed — RLS on the four payout
-- tables, the admin/worker check on the three previously-unprotected
-- RPCs, the status-transition whitelist, the idempotent ledger insert,
-- and the revoked PUBLIC execute grant. Does not attempt to test the
-- Node workers (payoutWorker.js / webhookServer.js) — those connect via
-- a raw DATABASE_URL connection outside of PostgREST/RLS entirely and
-- are out of pgTAP's reach; this file only proves what changes for a
-- session going through Postgres' normal role/RLS machinery.

begin;
select plan(15);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'payout-publisher-e@example.test'),
  ('e2222222-2222-2222-2222-222222222222', 'unrelated-business-e@example.test'),
  ('e3333333-3333-3333-3333-333333333333', 'admin-e@example.test');

update public.profiles set role = 'publisher' where id = 'e1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'business' where id = 'e2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'admin' where id = 'e3333333-3333-3333-3333-333333333333';

insert into public.publishers (id, user_id, name, city, province, category, channel_slug, status)
values ('e4444444-4444-4444-4444-444444444444', 'e1111111-1111-1111-1111-111111111111',
        'Payout Test Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved');

-- A positive ledger balance so create_payout_batch() has something real
-- to pick up in the admin-success test below.
insert into public.publisher_ledger (publisher_id, amount_cents, currency, type)
values ('e4444444-4444-4444-4444-444444444444', 50000, 'ZAR', 'earning');

-- A standalone payout batch + one pending item, for the
-- mark_payout_item_attempt()/update_payout_status() tests, independent
-- of whatever create_payout_batch() produces later in this file.
insert into public.payouts (id, status, total_amount_cents, total_items)
values ('e5555555-5555-5555-5555-555555555555', 'approved', 30000, 1);
insert into public.payout_items (id, payout_id, publisher_id, amount_cents, status)
values ('e6666666-6666-6666-6666-666666666666', 'e5555555-5555-5555-5555-555555555555',
        'e4444444-4444-4444-4444-444444444444', 30000, 'pending');

-- ── 1. RLS: an unrelated authenticated non-admin sees none of the four
--       payout tables at all ───────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select is((select count(*)::int from public.payouts), 0, 'a non-admin cannot see any row in payouts (RLS)');
select is((select count(*)::int from public.payout_items), 0, 'a non-admin cannot see any row in payout_items (RLS)');
select is((select count(*)::int from public.publisher_ledger), 0, 'a non-admin cannot see any row in publisher_ledger (RLS)');
select is((select count(*)::int from public.payout_provider_events), 0, 'a non-admin cannot see any row in payout_provider_events (RLS)');

-- ── 2. The three previously-unprotected RPCs all reject a non-admin ──────
select is(
  (select (public.create_payout_batch())->>'ok'),
  'false',
  'a non-admin calling create_payout_batch() gets ok:false'
);
select is(
  (select (public.mark_payout_item_attempt('e6666666-6666-6666-6666-666666666666', 'sent'))->>'ok'),
  'false',
  'a non-admin calling mark_payout_item_attempt() gets ok:false'
);
select is(
  (select (public.update_payout_status('e5555555-5555-5555-5555-555555555555', 'processing'))->>'ok'),
  'false',
  'a non-admin calling update_payout_status() gets ok:false'
);
reset role;

-- ── 3. anon can't even attempt these RPCs — PUBLIC execute was revoked ──
set role anon;
select throws_ok(
  $$ select public.create_payout_batch() $$,
  '42501',
  null,
  'an anonymous (logged-out) session gets a permission error calling create_payout_batch(), not a jsonb response — PUBLIC execute was revoked'
);
reset role;

-- ── 4. Admin: RLS grants full visibility ─────────────────────────────────
select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select is((select count(*)::int from public.payouts), 1, 'an admin can see the payouts row (RLS)');

-- ── 5. Admin: valid transitions succeed, in order, ending in an
--       idempotent ledger insert ─────────────────────────────────────────
select is(
  (select (public.mark_payout_item_attempt('e6666666-6666-6666-6666-666666666666', 'sent'))->>'ok'),
  'true',
  'an admin moving the item pending -> sent succeeds'
);
select is(
  (select (public.mark_payout_item_attempt('e6666666-6666-6666-6666-666666666666', 'succeeded'))->>'ok'),
  'true',
  'an admin moving the item sent -> succeeded succeeds'
);
select is(
  (select count(*)::int from public.publisher_ledger where reference_id = 'e6666666-6666-6666-6666-666666666666' and type = 'payout'),
  1,
  'exactly one payout ledger entry was created for this item'
);

-- ── 6. Admin: an invalid transition out of a terminal state is rejected ──
select is(
  (select (public.mark_payout_item_attempt('e6666666-6666-6666-6666-666666666666', 'processing'))->>'ok'),
  'false',
  'an admin cannot move the item backward out of succeeded (terminal state) — invalid transition'
);

-- ── 7. Admin: create_payout_batch() actually works end to end ───────────
select is(
  (select (public.create_payout_batch())->>'ok'),
  'true',
  'an admin calling create_payout_batch() succeeds'
);
select cmp_ok(
  (select count(*)::int from public.payout_items where publisher_id = 'e4444444-4444-4444-4444-444444444444' and payout_id <> 'e5555555-5555-5555-5555-555555555555'),
  '>=', 1,
  'the new batch picked up the publisher''s positive ledger balance as a real payout item'
);
reset role;

select * from finish();
rollback;
