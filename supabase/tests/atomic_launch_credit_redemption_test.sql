-- pgTAP tests for the Phase 88 atomic launch-credit redemption fix
-- ("Claude To fix 1..txt" item 11, HIGH — Launch-credit race condition).
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern already established in
-- this directory, reviewed by hand against the actual function bodies in
-- schema_phase88_atomic_launch_credit_redemption.sql, not from memory of
-- what they "should" say. Needs every schema_phase*.sql through
-- schema_phase88 applied first.
--
-- A real race between two CONCURRENT requests can't be simulated inside a
-- single pgTAP transaction (there's only one session) — what this file
-- proves instead is that the sequential state transitions serialize
-- correctly (each reservation sees the balance the previous one actually
-- left behind, never a stale pre-deduction value), which is exactly what
-- the SELECT ... FOR UPDATE lock inside reserve_launch_credit_for_payment
-- is what makes true concurrent calls resolve to as well — two overlapping
-- calls become, from the database's point of view, this same sequence
-- with the second one blocked until the first commits.

begin;
select plan(12);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('i1111111-1111-1111-1111-111111111111', 'business-i@example.test'),
  ('i2222222-2222-2222-2222-222222222222', 'other-business-i@example.test'),
  ('i3333333-3333-3333-3333-333333333333', 'publisher-user-i@example.test');

update public.profiles set role = 'business' where id = 'i1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'business' where id = 'i2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'publisher' where id = 'i3333333-3333-3333-3333-333333333333';

insert into public.publishers (id, user_id, name, city, province, category, channel_slug, status)
values ('i4444444-4444-4444-4444-444444444444', 'i3333333-3333-3333-3333-333333333333', 'Credit Test Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved');

insert into public.requests (id, publisher_id, business_id, campaign_message, status, agreed_amount)
values
  ('i5555555-5555-5555-5555-555555555555', 'i4444444-4444-4444-4444-444444444444', 'i1111111-1111-1111-1111-111111111111', 'Campaign A', 'confirmed', 60),
  ('i6666666-6666-6666-6666-666666666666', 'i4444444-4444-4444-4444-444444444444', 'i1111111-1111-1111-1111-111111111111', 'Campaign B', 'confirmed', 60);

insert into public.payments (id, request_id, business_id, amount)
values
  ('i7777777-7777-7777-7777-777777777777', 'i5555555-5555-5555-5555-555555555555', 'i1111111-1111-1111-1111-111111111111', 60),
  ('i8888888-8888-8888-8888-888888888888', 'i6666666-6666-6666-6666-666666666666', 'i1111111-1111-1111-1111-111111111111', 60);

-- A business_subscription row is required by business_launch_credits' own
-- FK — content of the row itself doesn't matter for these tests.
insert into public.business_subscriptions (id, business_id, status)
values ('i9999999-9999-9999-9999-999999999999', 'i1111111-1111-1111-1111-111111111111', 'active');

insert into public.business_launch_credits (business_id, subscription_id, amount, remaining)
values ('i1111111-1111-1111-1111-111111111111', 'i9999999-9999-9999-9999-999999999999', 100, 100);

select set_config('request.jwt.claim.sub', 'i1111111-1111-1111-1111-111111111111', true);
set role authenticated;

-- ── 1. Payment A (R60) is fully covered by the R100 remaining credit ────
select is(
  ((public.reserve_launch_credit_for_payment('i7777777-7777-7777-7777-777777777777'))->>'credit_applied')::numeric,
  60::numeric,
  'payment A (R60) is fully covered — credit_applied = 60'
);
select is(
  ((public.reserve_launch_credit_for_payment('i7777777-7777-7777-7777-777777777777'))->>'amount_due')::numeric,
  0::numeric,
  '...leaving amount_due = 0 (idempotent re-call — see assertion 4 for the real idempotency check)'
);

-- ── 2. Payment B (R60) can only claim the R40 left — proves the two
--       reservations serialize against the same balance rather than each
--       seeing the pre-deduction R100 ─────────────────────────────────
select is(
  ((public.reserve_launch_credit_for_payment('i8888888-8888-8888-8888-888888888888'))->>'credit_applied')::numeric,
  40::numeric,
  'payment B only gets the R40 actually left after payment A''s reservation, not a stale R100'
);
select is(
  ((public.reserve_launch_credit_for_payment('i8888888-8888-8888-8888-888888888888'))->>'amount_due')::numeric,
  20::numeric,
  '...so R20 of payment B''s R60 still needs to go through PayFast'
);
select is(
  (select remaining from public.business_launch_credits where business_id = 'i1111111-1111-1111-1111-111111111111'),
  0::numeric,
  'the credit balance is now fully, correctly exhausted (60 + 40 = 100)'
);

-- ── 3. Re-reserving payment A again is a true no-op, not a double-deduct ─
select is(
  ((public.reserve_launch_credit_for_payment('i7777777-7777-7777-7777-777777777777'))->>'credit_applied')::numeric,
  60::numeric,
  'a retried reservation for the same payment returns the existing figure, not a fresh (impossible, since remaining is 0) deduction'
);
select is(
  (select remaining from public.business_launch_credits where business_id = 'i1111111-1111-1111-1111-111111111111'),
  0::numeric,
  '...and the balance is unchanged by that retry'
);

-- ── 4. Confirm A, then release B (simulating B''s PayFast payment
--       failing) — the release gives B''s reserved amount back ─────────
select lives_ok($$ select public.confirm_launch_credit_redemption('i7777777-7777-7777-7777-777777777777') $$, 'confirming payment A''s redemption succeeds');
select lives_ok($$ select public.release_launch_credit_redemption('i8888888-8888-8888-8888-888888888888') $$, 'releasing payment B''s redemption succeeds');
select is(
  (select remaining from public.business_launch_credits where business_id = 'i1111111-1111-1111-1111-111111111111'),
  40::numeric,
  'releasing payment B''s R40 reservation gives it back to remaining'
);

-- ── 5. Releasing an already-CONFIRMED redemption (A) is a safe no-op ─────
select lives_ok($$ select public.release_launch_credit_redemption('i7777777-7777-7777-7777-777777777777') $$, 'releasing an already-confirmed redemption does not error');
select is(
  (select remaining from public.business_launch_credits where business_id = 'i1111111-1111-1111-1111-111111111111'),
  40::numeric,
  '...and does not add A''s already-spent R60 back — confirmed redemptions are untouchable by release'
);

reset role;

select * from finish();
rollback;
