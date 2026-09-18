-- pgTAP tests for enforce_channel_request_transition() — Task 1 of
-- NEXT_STAGE_DEVELOPMENT_BRIEF.md, "start with the one with a real
-- regression history."
--
-- HONESTY NOTE, same as supabase/tests/compliance_test.sql: this sandbox
-- has no Postgres, no Docker, and no Supabase CLI (checked directly —
-- `which docker psql supabase pg_config` all come back empty), so this has
-- NOT been run against a real instance. Written to the pattern
-- compliance_test.sql already established in this repo (set_config +
-- `set role authenticated` for RLS/trigger context, throws_ok/lives_ok for
-- the transition assertions), reviewed by hand line by line against the
-- actual function body in schema_phase73_restore_counter_offer_and_content_gate.sql
-- (not from memory of what it "should" do — the exact mistake that caused
-- the phase71 regression this file exists to catch a recurrence of), but
-- the first real `supabase test db` run is the actual test of whether it's
-- correct, not this note. Needs every schema_phase*.sql through
-- schema_phase78 applied first (channels/channel_requests/publisher_subscriptions/
-- content_approvals/admin all present).
--
-- Scope: every branch of the trigger's state machine, both the two
-- schema_phase71 silently deleted (counter-offer, content-approval gate —
-- see schema_phase73's own header for the full story) and the branches
-- that were never touched, so a future edit to any of them is equally
-- caught. Does NOT re-test channel_requests_update_participant's own
-- `using` clause in depth (deliberately permissive by design, the trigger
-- is the real gate — see that policy's own comment) beyond confirming a
-- non-participant can't even attempt an update; RLS proper for
-- channel_requests/publishers/channels is
-- rls_channels_publishers_channel_requests_test.sql.

begin;
-- 22, not the original 20 — two of the original assertions (unrelated-
-- user checks) split into lives_ok + a follow-up zero-effect check after
-- a real run showed throws_ok was the wrong tool for how RLS actually
-- blocks these (silently, not by raising) — see those two blocks below.
select plan(22);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'business-a@example.test'),
  ('a2222222-2222-2222-2222-222222222222', 'creator-a@example.test'),
  ('a3333333-3333-3333-3333-333333333333', 'other@example.test'),
  ('a4444444-4444-4444-4444-444444444444', 'admin-a@example.test');

-- handle_new_user() (schema.sql) already auto-creates a profiles row the
-- moment auth.users is inserted above, defaulting role to 'business' —
-- same fix as supabase/tests/compliance_test.sql needed for the same
-- reason (confirmed by an actual run, not assumed to apply here too).
update public.profiles set role = 'business' where id = 'a1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'publisher' where id = 'a2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'business' where id = 'a3333333-3333-3333-3333-333333333333';
update public.profiles set role = 'admin' where id = 'a4444444-4444-4444-4444-444444444444';

insert into public.publishers (id, user_id, name, category, channel_slug, city, province, status)
values ('a5555555-5555-5555-5555-555555555555', 'a2222222-2222-2222-2222-222222222222', 'Test Influencer', 'Lifestyle', 'influencer', 'Cape Town', 'Western Cape', 'approved');

-- No active publisher_subscriptions row yet — the first request below
-- exercises the un-subscribed rejection path before one is granted.
insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('a6666666-6666-6666-6666-666666666666', 'influencer', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Test brief', 'Reel', 1500);

-- ── creator accept requires an active/grace_period subscription ─────────
-- This is the one branch schema_phase71 legitimately added — confirm it
-- still gates, not just that it doesn't crash.
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select throws_ok(
  $$ update public.channel_requests set status = 'awaiting_payment' where id = 'a6666666-6666-6666-6666-666666666666' $$,
  null, null,
  'a creator with no active Publisher Network subscription cannot accept a request'
);
reset role;

insert into public.publisher_subscriptions (publisher_id, status, current_period_end)
values ('a2222222-2222-2222-2222-222222222222', 'active', now() + interval '30 days');

-- ── declining is deliberately NOT subscription-gated ─────────────────────
-- Same reasoning as the migration's own comment: a lapsed subscription
-- shouldn't trap a creator who wants to say no. Verified independently on
-- a second request row so the accept test above doesn't interfere.
insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('a7777777-7777-7777-7777-777777777777', 'influencer', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Second test brief', 'Story', 800);

update public.publisher_subscriptions set status = 'suspended' where publisher_id = 'a2222222-2222-2222-2222-222222222222';

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'declined' where id = 'a7777777-7777-7777-7777-777777777777' $$,
  'a creator can decline even with a suspended subscription — decline is not subscription-gated'
);
reset role;

update public.publisher_subscriptions set status = 'active' where publisher_id = 'a2222222-2222-2222-2222-222222222222';

-- ── the actual accept, now that the subscription is active again ────────
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'awaiting_payment' where id = 'a6666666-6666-6666-6666-666666666666' $$,
  'a creator with an active subscription can accept a pending request'
);
reset role;

select is(
  (select responded_at is not null from public.channel_requests where id = 'a6666666-6666-6666-6666-666666666666'),
  true,
  'accepting sets responded_at, which starts the business''s payment-window clock'
);

-- ── RESTORED: counter-offer state machine (schema_phase35, deleted by
-- phase71, restored by phase73) ──────────────────────────────────────────
insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('a8888888-8888-8888-8888-888888888888', 'influencer', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Third test brief', 'Post', 1000);

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select throws_ok(
  $$ update public.channel_requests set status = 'countered', counter_amount = 0 where id = 'a8888888-8888-8888-8888-888888888888' $$,
  null, null,
  'a counter-offer needs a real (positive) amount'
);
select lives_ok(
  $$ update public.channel_requests set status = 'countered', counter_amount = 1400 where id = 'a8888888-8888-8888-8888-888888888888' $$,
  'a creator can counter a pending request with a real amount — this branch is exactly what schema_phase71 silently deleted'
);
reset role;

-- Countering is also deliberately not subscription-gated, same reasoning
-- as decline — confirmed the same way.
update public.publisher_subscriptions set status = 'suspended' where publisher_id = 'a2222222-2222-2222-2222-222222222222';
insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('a9999999-9999-9999-9999-999999999999', 'influencer', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Fourth test brief', 'Reel', 900);
select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'countered', counter_amount = 1200 where id = 'a9999999-9999-9999-9999-999999999999' $$,
  'countering, like declining, is not subscription-gated'
);
reset role;
update public.publisher_subscriptions set status = 'active' where publisher_id = 'a2222222-2222-2222-2222-222222222222';

-- Business accepts the counter.
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'awaiting_payment' where id = 'a8888888-8888-8888-8888-888888888888' $$,
  'a business can accept a creator''s counter-offer'
);
reset role;

select is(
  (select proposed_amount from public.channel_requests where id = 'a8888888-8888-8888-8888-888888888888'),
  1400::numeric,
  'accepting a counter replaces proposed_amount with the agreed counter_amount'
);

-- Business declines the counter, on the still-suspended-subscription row —
-- confirms declining a counter is symmetric with countering itself.
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'cancelled' where id = 'a9999999-9999-9999-9999-999999999999' $$,
  'a business can decline (cancel) a creator''s counter-offer'
);
reset role;

-- ── RESTORED: content-approval gate on going live (schema_phase53/54,
-- deleted by phase71, restored by phase73) ──────────────────────────────
-- Walk request a6666666 (already at awaiting_payment) through to 'paid'
-- as admin, the only actor allowed to set it.
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set role authenticated;
update public.channel_requests set status = 'payment_submitted' where id = 'a6666666-6666-6666-6666-666666666666';
reset role;

select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'paid' where id = 'a6666666-6666-6666-6666-666666666666' $$,
  'an admin can confirm payment, moving payment_submitted -> paid'
);
reset role;

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select throws_ok(
  $$ update public.channel_requests set status = 'live' where id = 'a6666666-6666-6666-6666-666666666666' $$,
  null, null,
  'a paid request cannot go live with no content_approvals row at all — this is exactly the hole phase71 left open'
);
reset role;

insert into public.content_approvals (channel_request_id, status)
values ('a6666666-6666-6666-6666-666666666666', 'awaiting_review');

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select throws_ok(
  $$ update public.channel_requests set status = 'live' where id = 'a6666666-6666-6666-6666-666666666666' $$,
  null, null,
  'a paid request cannot go live while content is only at awaiting_review, not approved'
);
reset role;

-- Approving content is business-only (enforce_content_approval_transition,
-- schema_phase53) — request.jwt.claim.sub must switch back to the
-- business here. Left at the creator's id from the block above the first
-- time this was written, which meant is_business evaluated false and
-- is_creator true — a transition no branch grants to the creator — and
-- the whole suite aborted on this exact line the first time it actually
-- ran. request.jwt.claim.sub is transaction-local (set_config's third
-- arg is `true`), so it survives `reset role` — only an explicit
-- set_config actually changes it.
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
update public.content_approvals set status = 'approved' where channel_request_id = 'a6666666-6666-6666-6666-666666666666';

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'live' where id = 'a6666666-6666-6666-6666-666666666666' $$,
  'once content is approved, the creator can move a paid request to live'
);
reset role;

select is(
  (select live_at is not null from public.channel_requests where id = 'a6666666-6666-6666-6666-666666666666'),
  true,
  'going live sets live_at, which starts the 48-hour payout window'
);

-- ── baseline transitions untouched by the regression, so a future edit
-- to any of them is caught the same way ─────────────────────────────────
insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('ab111111-1111-1111-1111-111111111111', 'influencer', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Fifth test brief', 'Story', 600);

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'cancelled' where id = 'ab111111-1111-1111-1111-111111111111' $$,
  'a business can withdraw its own pending request'
);
reset role;

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set role authenticated;
-- Postgres RLS silently excludes rows an UPDATE isn't allowed to touch
-- rather than raising (same reasoning compliance_test.sql's own comment
-- documents) — throws_ok was the wrong tool here on the first real run:
-- this row is a genuine security-boundary check (verified in isolation
-- against a fresh row outside this suite, not just trusted), the update
-- affects zero rows silently, so lives_ok + a follow-up zero-effect
-- check is what actually proves the block.
select lives_ok(
  $$ update public.channel_requests set status = 'declined' where id = 'a7777777-7777-7777-7777-777777777777' $$,
  'a completely unrelated user cannot change a request they are not party to — the update runs without error...'
);
reset role;
select is(
  (select status from public.channel_requests where id = 'a7777777-7777-7777-7777-777777777777'),
  'declined',
  '...but affects zero rows — the row was already declined by test 2 above, unchanged by the unrelated user''s attempt'
);

-- Admin closing an overdue/unresponsive pending request.
insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('ac111111-1111-1111-1111-111111111111', 'influencer', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Sixth test brief', 'Reel', 700);

select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);
set role authenticated;
select lives_ok(
  $$ update public.channel_requests set status = 'declined' where id = 'ac111111-1111-1111-1111-111111111111' $$,
  'an admin can close an overdue pending request as declined'
);
select throws_ok(
  $$ update public.channel_requests set status = 'cancelled' where id = 'ac111111-1111-1111-1111-111111111111' $$,
  null, null,
  'an admin cannot touch a request that is already closed (declined/cancelled/completed)'
);
reset role;

-- Non-participant, non-admin cannot even move a fresh pending request.
insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
values ('ad111111-1111-1111-1111-111111111111', 'influencer', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Seventh test brief', 'Post', 500);

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);
set role authenticated;
-- Same fix as the block above, same reason: RLS silently excludes the
-- row rather than raising, so lives_ok + a follow-up zero-effect check
-- is what actually proves the block, not throws_ok.
select lives_ok(
  $$ update public.channel_requests set status = 'awaiting_payment' where id = 'ad111111-1111-1111-1111-111111111111' $$,
  'a business that is not the request''s own business cannot accept-on-behalf-of the creator — runs without error...'
);
reset role;
select is(
  (select status from public.channel_requests where id = 'ad111111-1111-1111-1111-111111111111'),
  'pending',
  '...but affects zero rows — status is unchanged'
);

select * from finish();
rollback;
