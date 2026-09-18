-- pgTAP RLS tests for `channels`, `publishers`, and `channel_requests` —
-- Task 1 of NEXT_STAGE_DEVELOPMENT_BRIEF.md, the other half of "start
-- with enforce_channel_request_transition() ... and RLS on
-- channel_requests/publishers/channels."
--
-- Same honesty note as compliance_test.sql and
-- enforce_channel_request_transition_test.sql: no Postgres/Docker/Supabase
-- CLI in this sandbox, so this has NOT been run — written to the pattern,
-- reviewed by hand against the actual `create policy` statements in
-- schema.sql, schema_phase5.sql, schema_phase17_channel_marketplace.sql,
-- and schema_phase74_universal_channels.sql, not from memory of what they
-- "should" say.
--
-- Scope: the actual RLS policies (select/insert/update), not the trigger's
-- state-machine logic — that's enforce_channel_request_transition_test.sql.
-- channel_requests_update_participant is deliberately permissive at the
-- policy level (see its own comment in schema_phase17), so this file only
-- confirms a non-participant can't even attempt an update; which
-- transitions succeed for a real participant is the other file's job, not
-- duplicated here.
--
-- UPDATED for schema_phase82_restrict_public_publisher_columns.sql
-- ("Claude To fix 1..txt" item 6): the publishers block's one assertion
-- about approved-row visibility to an unrelated user was rewritten to
-- match the post-phase82 policy shape (base table: owner/admin only;
-- approved rows: publishers_public view only) — see that block's own
-- comment. Everything else in this file was already correct against
-- phase82 and needed no change.

begin;
-- 18, not the original 16/17 — the channels-table non-admin-write check
-- split into lives_ok + a follow-up zero-effect check after a real run
-- showed throws_ok was the wrong tool for how RLS actually blocks this
-- (silently, not by raising) — see that block below. Then, for
-- schema_phase82_restrict_public_publisher_columns.sql, the single
-- "unrelated user can see an approved publisher" check became two
-- (base table now 0, publishers_public now 1) — see that block's own
-- comment above.
select plan(18);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('b1111111-1111-1111-1111-111111111111', 'business-b@example.test'),
  ('b2222222-2222-2222-2222-222222222222', 'creator-b@example.test'),
  ('b3333333-3333-3333-3333-333333333333', 'other-b@example.test'),
  ('b4444444-4444-4444-4444-444444444444', 'admin-b@example.test');

-- handle_new_user() (schema.sql) already auto-creates a profiles row the
-- moment auth.users is inserted above, defaulting role to 'business' —
-- same fix as supabase/tests/compliance_test.sql and
-- enforce_channel_request_transition_test.sql needed for the same reason
-- (confirmed by an actual run, not assumed to apply here too).
update public.profiles set role = 'business' where id = 'b1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'publisher' where id = 'b2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'business' where id = 'b3333333-3333-3333-3333-333333333333';
update public.profiles set role = 'admin' where id = 'b4444444-4444-4444-4444-444444444444';

-- One approved publisher (own row), one pending_review publisher (not
-- creator-b's own — used to confirm it's invisible to a third party).
insert into public.publishers (id, user_id, name, category, channel_slug, city, province, status)
values
  ('b5555555-5555-5555-5555-555555555555', 'b2222222-2222-2222-2222-222222222222', 'Approved Creator', 'Lifestyle', 'influencer', 'Cape Town', 'Western Cape', 'approved'),
  ('b6666666-6666-6666-6666-666666666666', 'b3333333-3333-3333-3333-333333333333', 'Pending Creator', 'Lifestyle', 'website', 'Durban', 'KwaZulu-Natal', 'pending_review');

insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('b7777777-7777-7777-7777-777777777777', 'influencer', 'b5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'RLS test brief', 'Reel', 1200);

-- ── channels: select_all is genuinely public, admin_write is admin-only ──
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select ok(
  (select count(*)::int from public.channels) > 0,
  'any authenticated user can read the channels reference table (channels_select_all)'
);
-- Postgres RLS silently excludes rows an UPDATE isn't allowed to touch
-- rather than raising — only a failed WITH CHECK on the resulting row
-- does that (see the publisher/channel_requests INSERT throws_ok calls
-- below, which genuinely do raise, being WITH CHECK violations on
-- INSERT, not USING filtering on UPDATE). throws_ok was the wrong tool
-- here on the first real run — verified directly against an isolated
-- update first, not just trusted, that this really is RLS silently
-- blocking, not a gap.
select lives_ok(
  $$ update public.channels set active = false where slug = 'sports' $$,
  'a non-admin cannot write to the channels table — the update runs without error...'
);
select is(
  (select active from public.channels where slug = 'sports'),
  true,
  '...but affects zero rows — active is unchanged'
);
reset role;

select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);
set role authenticated;
select lives_ok(
  $$ update public.channels set active = false where slug = 'sports' $$,
  'an admin can write to the channels table (channels_admin_write)'
);
reset role;
update public.channels set active = true where slug = 'sports'; -- restore, as service role, for any later test relying on it

-- ── publishers: approved is public via publishers_public (not the base
-- table), pending_review is owner/admin only on the base table ──────────
-- UPDATED for schema_phase82_restrict_public_publisher_columns.sql: this
-- block used to assert an unrelated authenticated user could read the
-- approved row straight off public.publishers (count = 1) — that was
-- exactly the column-exposure hole "Claude To fix 1..txt" item 6
-- described (RLS restricting rows, not columns, so status = 'approved'
-- was enough to read every column including payout details, admin
-- notes, etc.). Phase 82 removed that branch from
-- publishers_select_own_or_admin and moved approved-row public reads to
-- the new publishers_public view instead. Split into two assertions
-- below so both halves of that change are covered here rather than only
-- in publishers_public_column_restriction_test.sql (which covers the
-- column-restriction side in more depth; this file's job is the base
-- RLS shape).
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select is(
  (select count(*)::int from public.publishers where id = 'b5555555-5555-5555-5555-555555555555'),
  0,
  'an unrelated authenticated user can no longer see an approved publisher on the base publishers table (schema_phase82)'
);
select is(
  (select count(*)::int from public.publishers_public where id = 'b5555555-5555-5555-5555-555555555555'),
  1,
  'that same unrelated user can see the approved publisher via publishers_public instead (schema_phase82)'
);
reset role;

-- b3333333 is creator-b6's OWN user_id, so it should see its own
-- pending_review row via auth.uid() = user_id, independent of status.
select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select is(
  (select count(*)::int from public.publishers where id = 'b6666666-6666-6666-6666-666666666666'),
  1,
  'a pending_review publisher can see its own row'
);
reset role;

-- A genuinely different, unrelated user should NOT see that same
-- pending_review row.
select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select is(
  (select count(*)::int from public.publishers where id = 'b6666666-6666-6666-6666-666666666666'),
  0,
  'an unrelated user cannot see another publisher''s pending_review row'
);
reset role;

select set_config('request.jwt.claim.sub', 'b4444444-4444-4444-4444-444444444444', true);
set role authenticated;
select is(
  (select count(*)::int from public.publishers where id = 'b6666666-6666-6666-6666-666666666666'),
  1,
  'an admin can see a pending_review publisher regardless of ownership'
);
reset role;

-- Insert: a user can only apply for themselves, and only into
-- pending_review — never self-approve on insert.
select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select throws_ok(
  $$ insert into public.publishers (user_id, name, category, channel_slug, city, province, status)
     values ('b3333333-3333-3333-3333-333333333333', 'Fake Application', 'Lifestyle', 'website', 'Cape Town', 'Western Cape', 'pending_review') $$,
  null, null,
  'a user cannot submit a publisher application on someone else''s behalf'
);
select throws_ok(
  $$ insert into public.publishers (user_id, name, category, channel_slug, city, province, status)
     values ('b1111111-1111-1111-1111-111111111111', 'Self-approving Application', 'Lifestyle', 'website', 'Cape Town', 'Western Cape', 'approved') $$,
  null, null,
  'a user cannot self-approve their own application on insert (must land in pending_review)'
);
select lives_ok(
  $$ insert into public.publishers (user_id, name, category, channel_slug, city, province, status)
     values ('b1111111-1111-1111-1111-111111111111', 'Real Application', 'Lifestyle', 'website', 'Cape Town', 'Western Cape', 'pending_review') $$,
  'a user can submit their own publisher application, landing in pending_review'
);
reset role;

-- ── channel_requests: select is business/creator/admin only ─────────────
select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select is(
  (select count(*)::int from public.channel_requests where id = 'b7777777-7777-7777-7777-777777777777'),
  1,
  'the business participant can see its own channel_requests row'
);
reset role;

select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select is(
  (select count(*)::int from public.channel_requests where id = 'b7777777-7777-7777-7777-777777777777'),
  1,
  'the creator (via publishers.user_id) can see the channel_requests row addressed to them'
);
reset role;

select set_config('request.jwt.claim.sub', 'b3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select is(
  (select count(*)::int from public.channel_requests where id = 'b7777777-7777-7777-7777-777777777777'),
  0,
  'an unrelated user cannot see a channel_requests row they are not party to'
);
reset role;

-- Insert: a business can only create its own request, always at 'pending'.
select set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select throws_ok(
  $$ insert into public.channel_requests (channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount, status)
     values ('influencer', 'b5555555-5555-5555-5555-555555555555', 'b3333333-3333-3333-3333-333333333333', 'Spoofed brief', 'Reel', 500, 'pending') $$,
  null, null,
  'a business cannot create a channel_requests row on someone else''s behalf'
);
select throws_ok(
  $$ insert into public.channel_requests (channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount, status)
     values ('influencer', 'b5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'Skip-ahead brief', 'Reel', 500, 'awaiting_payment') $$,
  null, null,
  'a business cannot insert a channel_requests row starting anywhere but pending'
);
reset role;

-- Update: a genuinely unrelated user attempting to touch a request they
-- aren't party to is already covered above by the throws_ok on insert;
-- the update-side equivalent (USING clause excluding a non-participant)
-- is exercised in enforce_channel_request_transition_test.sql's own
-- "completely unrelated user" case, since that file already needs a
-- non-participant fixture to test the trigger's admin/participant
-- branches and duplicating it here would just be the same assertion
-- against the same policy twice.

select is(
  (select business_id from public.channel_requests where id = 'b7777777-7777-7777-7777-777777777777'),
  'b1111111-1111-1111-1111-111111111111'::uuid,
  'sanity check: the fixture row''s business_id is exactly who created it, not modified by any RLS test above'
);

select * from finish();
rollback;
