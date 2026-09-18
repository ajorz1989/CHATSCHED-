-- pgTAP tests for the Phase 89 atomic opportunity-acceptance fix
-- ("Claude To fix 1..txt" item 12, HIGH — Opportunity acceptance is not
-- atomic).
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern already established in
-- this directory, reviewed by hand against the actual function body in
-- schema_phase89_atomic_opportunity_acceptance.sql, not from memory of
-- what it "should" say. Needs every schema_phase*.sql through
-- schema_phase89 applied first.
--
-- A true race between two CONCURRENT accept calls can't be simulated
-- inside one pgTAP transaction (there's only one session) — same
-- limitation noted in atomic_launch_credit_redemption_test.sql. What
-- this file proves instead is that the sequential state transitions are
-- correct: the opportunity's own row lock means a second accept for a
-- different application on the same opportunity always sees the real,
-- current slot count (including close_out_accepted_opportunity's own
-- cascade from the first acceptance), never a stale one — which is
-- exactly what makes true concurrent calls resolve to this same
-- sequence rather than both proceeding.

begin;
select plan(9);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('j1111111-1111-1111-1111-111111111111', 'business-j@example.test'),
  ('j2222222-2222-2222-2222-222222222222', 'other-business-j@example.test'),
  ('j3333333-3333-3333-3333-333333333333', 'publisher-a-user-j@example.test'),
  ('j4444444-4444-4444-4444-444444444444', 'publisher-b-user-j@example.test'),
  ('j5555555-5555-5555-5555-555555555555', 'publisher-c-user-j@example.test');

update public.profiles set role = 'business' where id = 'j1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'business' where id = 'j2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'publisher' where id = 'j3333333-3333-3333-3333-333333333333';
update public.profiles set role = 'publisher' where id = 'j4444444-4444-4444-4444-444444444444';
update public.profiles set role = 'publisher' where id = 'j5555555-5555-5555-5555-555555555555';

insert into public.publishers (id, user_id, name, city, province, category, channel_slug, status) values
  ('j6666666-6666-6666-6666-666666666666', 'j3333333-3333-3333-3333-333333333333', 'Publisher A (social)', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved'),
  ('j7777777-7777-7777-7777-777777777777', 'j4444444-4444-4444-4444-444444444444', 'Publisher B (influencer)', 'Cape Town', 'Western Cape', 'Lifestyle', 'influencer', 'approved'),
  ('j8888888-8888-8888-8888-888888888888', 'j5555555-5555-5555-5555-555555555555', 'Publisher C (social)', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved');

-- Needs exactly 2 publishers.
insert into public.opportunities (id, business_id, title, brief, status, publishers_needed)
values ('j9999999-9999-9999-9999-999999999999', 'j1111111-1111-1111-1111-111111111111', 'Test opportunity', 'Needs two publishers', 'open', 2);

insert into public.opportunity_applications (id, opportunity_id, publisher_id, message, status) values
  ('ja111111-1111-1111-1111-111111111111', 'j9999999-9999-9999-9999-999999999999', 'j6666666-6666-6666-6666-666666666666', 'App from A', 'pending'),
  ('ja222222-2222-2222-2222-222222222222', 'j9999999-9999-9999-9999-999999999999', 'j7777777-7777-7777-7777-777777777777', 'App from B', 'pending'),
  ('ja333333-3333-3333-3333-333333333333', 'j9999999-9999-9999-9999-999999999999', 'j8888888-8888-8888-8888-888888888888', 'App from C', 'pending');

select set_config('request.jwt.claim.sub', 'j2222222-2222-2222-2222-222222222222', true);
set role authenticated;

-- ── 1. An unrelated business cannot accept on someone else's opportunity ─
select is(
  ((public.accept_opportunity_application('ja111111-1111-1111-1111-111111111111'))->>'ok')::boolean,
  false,
  'an unrelated business cannot accept an application on an opportunity it doesn''t own'
);
reset role;

-- ── 2. The real owner accepting application A succeeds — request row
--       created, application marked accepted, all in one transaction ───
select set_config('request.jwt.claim.sub', 'j1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select is(
  ((public.accept_opportunity_application('ja111111-1111-1111-1111-111111111111'))->>'ok')::boolean,
  true,
  'the opportunity''s real owner can accept application A (social-media publisher)'
);
select is(
  (select status from public.opportunity_applications where id = 'ja111111-1111-1111-1111-111111111111'),
  'accepted',
  'application A is now accepted'
);
select is(
  (select count(*)::int from public.requests where publisher_id = 'j6666666-6666-6666-6666-666666666666' and business_id = 'j1111111-1111-1111-1111-111111111111'),
  1,
  'a real requests row was created for the social-media publisher, in the same transaction'
);

-- ── 3. Accepting the same application again fails — it's no longer
--       pending ─────────────────────────────────────────────────────────
select is(
  ((public.accept_opportunity_application('ja111111-1111-1111-1111-111111111111'))->>'ok')::boolean,
  false,
  'accepting the same application twice fails — it is no longer pending'
);

-- ── 4. Accepting application B (2nd of 2 needed slots, non-social-media
--       publisher) succeeds — channel_requests row created, AND the
--       close_out_accepted_opportunity trigger cascades correctly inside
--       this same transaction: the opportunity fills, and application C
--       (still pending) is auto-declined ──────────────────────────────
select is(
  ((public.accept_opportunity_application('ja222222-2222-2222-2222-222222222222'))->>'ok')::boolean,
  true,
  'the owner can accept application B (influencer publisher) — 2nd of 2 needed slots'
);
select is(
  (select count(*)::int from public.channel_requests where creator_id = 'j7777777-7777-7777-7777-777777777777' and business_id = 'j1111111-1111-1111-1111-111111111111' and channel_slug = 'influencer'),
  1,
  'a real channel_requests row was created for the non-social-media publisher'
);
select is(
  (select status from public.opportunities where id = 'j9999999-9999-9999-9999-999999999999'),
  'filled',
  'the opportunity is now filled — close_out_accepted_opportunity''s cascade fired correctly from inside the same transaction as the booking insert'
);
select is(
  (select status from public.opportunity_applications where id = 'ja333333-3333-3333-3333-333333333333'),
  'declined',
  'application C, still pending when the opportunity filled, was auto-declined by that same cascade'
);
reset role;

select * from finish();
rollback;
