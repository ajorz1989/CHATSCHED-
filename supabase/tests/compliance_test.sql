-- Compliance schema tests (brief section 31) — pgTAP.
--
-- HONESTY NOTE, read before running this: this repo has no existing
-- database-level test harness — supabase/ has no prior tests/ directory,
-- no pgTAP extension enabled anywhere, and package.json's `npm test` only
-- runs vitest against pure TS functions (see src/lib/*.test.ts). This file
-- is new infrastructure, written to the pattern pgTAP + supabase-test-runner
-- expects, but it has NOT been run against a real Postgres instance in this
-- session — there is no database here to run it against. Before relying on
-- it: `supabase test db` (or `pg_prove` directly) against a local Supabase
-- instance with the `pgtap` extension enabled, on TOP of every
-- schema_phase*.sql file through schema_phase40_proof_screenshots.sql
-- already applied — this file exercises the campaign-proof-screenshots
-- storage bucket that migration creates, so phase39 alone isn't enough.
--
-- Scope: this file tests the compliance schema in isolation (auto-creation,
-- RLS, the "server is the only writer of status" rule, and the core status
-- transitions in recompute_campaign_compliance). It does NOT attempt the
-- brief's full end-to-end scenario (business creates → publisher accepts →
-- disclosure → proof → admin verifies → payout eligible) — that crosses
-- into the payments/payout schema this migration doesn't touch, and is a
-- separate, larger integration test worth its own file once this one is
-- confirmed to actually run.

begin;
select plan(28);

-- ── fixtures ────────────────────────────────────────────────────────────
-- Minimal rows to exercise the schema. Assumes auth.users rows can be
-- inserted directly in a test transaction the way supabase-test-runner's
-- own fixtures do; adjust to this project's actual fixture helpers if it
-- has any by the time this is wired up.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'business@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'creator@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'admin@example.test');

-- handle_new_user() (schema.sql) already auto-creates a profiles row the
-- moment auth.users is inserted above, defaulting role to 'business' —
-- confirmed directly, this is exactly the kind of thing "never run
-- against real Postgres" was hiding. UPDATE the roles that need to
-- differ from that default rather than INSERT, which collided on
-- profiles_pkey the first time this file was actually run.
update public.profiles set role = 'business' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'publisher' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'business' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'admin' where id = '44444444-4444-4444-4444-444444444444';

insert into public.publishers (id, user_id, name, category, channel_slug, city, province)
values ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Test Creator', 'Food & Restaurants', 'social-media', 'Cape Town', 'Western Cape');

-- ── auto-creation (create_campaign_compliance_stub) ────────────────────
insert into public.requests (id, business_id, publisher_id, campaign_message, budget, status)
values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Test campaign brief', 500, 'pending');

select is(
  (select count(*)::int from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  1,
  'a campaign_compliance row is created automatically when a requests row is inserted'
);

select is(
  (select status from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  'not_started',
  'a freshly created campaign_compliance row starts as not_started'
);

select is(
  (select business_id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'business_id is derived server-side from the requests row, not client-supplied'
);

-- ── RLS: only participants + admin can see the record ──────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set role authenticated;
select is(
  (select count(*)::int from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  1,
  'the business participant can see its own campaign_compliance row'
);
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set role authenticated;
select is(
  (select count(*)::int from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  1,
  'the creator (via publishers.user_id) can see the campaign_compliance row'
);
reset role;

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set role authenticated;
select is(
  (select count(*)::int from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  0,
  'an unrelated business cannot see someone else''s campaign_compliance row'
);

-- ── "never trust the client for status" ─────────────────────────────────
-- Postgres RLS silently excludes rows an UPDATE isn't allowed to touch
-- rather than raising an exception — only a failed WITH CHECK on the
-- resulting row does that (see the storage.objects INSERT test further
-- down for a case where throws_ok is the right tool). campaign_compliance
-- has no UPDATE policy at all, so this proves the block by running the
-- update and confirming it had zero effect, not by expecting an error.
select lives_ok(
  $$ update public.campaign_compliance set status = 'ready' where request_id = '66666666-6666-6666-6666-666666666666' $$,
  'a direct client UPDATE of campaign_compliance runs without raising an error...'
);
reset role;
-- reset role BEFORE this check, not after: the identity used above
-- (33333333, an unrelated business) can't SELECT this row at all — its
-- own SELECT policy correctly hides it, proven already by test 6. Left
-- as authenticated/33333333 here on the first real run, this check's own
-- scalar subquery returned zero rows -> NULL, which correctly reads as
-- "not_started" != NULL and fails — not because the UPDATE leaked
-- through, but because the check was reading through the wrong identity's
-- eyes. Confirmed directly: as an admin (bypasses the SELECT policy) the
-- row is provably still there with status genuinely unchanged.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set role authenticated;
select is(
  (select status from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  'not_started',
  '...but silently affects zero rows — no update policy grants it, so status is unchanged'
);
reset role;

-- ── set_campaign_compliance_context ──────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set role authenticated;
select lives_ok(
  $$ select public.set_campaign_compliance_context(
       (select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
       'instagram', 'Food & Restaurants'
     ) $$,
  'the campaign''s own business can set platform/category via the RPC'
);
reset role;

select is(
  (select platform from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  'instagram',
  'platform is set after set_campaign_compliance_context'
);
select is(
  (select category_assessed from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  true,
  'category_assessed flips to true once platform + category are both set'
);
select is(
  (select disclosure_identified from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  true,
  'disclosure_identified is recomputed to true once platform + category are both set'
);
select is(
  (select status from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  'needs_attention',
  'status moves to needs_attention once context is set but disclosure/tracking are still outstanding'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set role authenticated;
select throws_ok(
  $$ select public.set_campaign_compliance_context(
       (select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
       'tiktok', 'Retail'
     ) $$,
  null, null,
  'a business that does not own the campaign cannot set its platform/category'
);
reset role;

-- ── acknowledge_campaign_disclosure ──────────────────────────────────────
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set role authenticated;
select throws_ok(
  $$ select public.acknowledge_campaign_disclosure(
       (select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
       'instagram'
     ) $$,
  null, null,
  'someone who is not the campaign''s creator cannot acknowledge its disclosure'
);
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set role authenticated;
select lives_ok(
  $$ select public.acknowledge_campaign_disclosure(
       (select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
       'instagram'
     ) $$,
  'the campaign''s own creator can acknowledge its disclosure requirement'
);
reset role;

select is(
  (select creator_accepted from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  true,
  'creator_accepted flips to true after the disclosure is acknowledged'
);

-- ── campaign_proof: creator inserts, only admin reviews ──────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set role authenticated;
insert into public.campaign_proof (campaign_compliance_id, submitted_by, platform, post_url, disclosure_confirmed)
values (
  (select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  '22222222-2222-2222-2222-222222222222', 'instagram', 'https://instagram.com/p/test', true
);
select is(
  (select count(*)::int from public.campaign_proof cp join public.campaign_compliance cc on cc.id = cp.campaign_compliance_id where cc.request_id = '66666666-6666-6666-6666-666666666666'),
  1,
  'the campaign''s own creator can submit proof'
);

select lives_ok(
  $$ update public.campaign_proof set status = 'verified' where campaign_compliance_id = (select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666') $$,
  'a direct client UPDATE of campaign_proof runs without raising an error...'
);
select is(
  (select status from public.campaign_proof where campaign_compliance_id = (select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666')),
  'pending_review',
  '...but silently affects zero rows — the creator cannot mark their own proof verified this way; only review_campaign_proof (admin) can'
);
reset role;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set role authenticated;
select lives_ok(
  $$ select public.review_campaign_proof(
       (select cp.id from public.campaign_proof cp join public.campaign_compliance cc on cc.id = cp.campaign_compliance_id where cc.request_id = '66666666-6666-6666-6666-666666666666'),
       'verified'
     ) $$,
  'an admin can verify submitted proof'
);
reset role;

-- ── tracking link flips tracking_configured and can complete the checklist ──
insert into public.campaigns (id, request_id, owner_id, name, destination_url, utm_source, utm_medium, utm_campaign, slug)
values ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Test tracking link', 'https://example.test', 'chatsched', 'referral', 'test', 'test-slug');

select is(
  (select tracking_configured from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  true,
  'tracking_configured flips to true once a tracking link exists for the same request'
);
select is(
  (select status from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  'ready',
  'status reaches ready once category is allowed, disclosure is acknowledged, and tracking is configured'
);

-- ── campaign-proof-screenshots storage RLS (schema_phase40) ──────────────
-- Path convention: {campaign_compliance_id}/{filename} — see that
-- migration's header for why this is keyed by campaign, not by uploader.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set role authenticated;
insert into storage.objects (bucket_id, name, owner)
values ('campaign-proof-screenshots', (select id::text from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666') || '/test.jpg', '22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'campaign-proof-screenshots'),
  1,
  'the campaign''s own creator can upload a screenshot into the campaign-keyed storage path'
);
reset role;

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('campaign-proof-screenshots', (select id::text from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666') || '/intruder.jpg', '33333333-3333-3333-3333-333333333333') $$,
  null, null,
  'someone who is not the campaign''s creator cannot upload into its screenshot path'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'campaign-proof-screenshots'),
  0,
  'an unrelated business cannot even see the screenshot the creator uploaded (private bucket, participant-only SELECT)'
);
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set role authenticated;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'campaign-proof-screenshots'),
  1,
  'the campaign''s own business — a participant who did not upload the file — can still see it'
);
reset role;

-- ── not_accepted category always yields not_eligible, regardless of other progress ──
update public.campaign_category_rules set chatsched_status = 'not_accepted' where category = 'Food & Restaurants';
select public.recompute_campaign_compliance((select id from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'));
select is(
  (select status from public.campaign_compliance where request_id = '66666666-6666-6666-6666-666666666666'),
  'not_eligible',
  'a not_accepted category forces not_eligible even when every other checklist item is done'
);

select * from finish();
rollback;
