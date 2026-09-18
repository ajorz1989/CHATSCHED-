-- pgTAP tests for schema_phase86 (once-off activation pricing) and
-- schema_phase87 (self-serve Featured Placement) — "Claude To fix
-- 1..txt" item 10, HIGH — Current pricing code does not match the
-- latest intended pricing specification.
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern already established in
-- this directory, reviewed by hand against the actual constraints,
-- policies, and trigger in schema_phase86_once_off_activation_pricing.sql
-- and schema_phase87_featured_placement_subscriptions.sql, not from
-- memory of what they "should" say. Needs every schema_phase*.sql
-- through schema_phase87 applied first.
--
-- Scope: the two schema files' own real, testable behavior — the
-- simplified status lifecycle actually rejects the removed values; the
-- opportunity_applications_insert_publisher enforcement policy (updated
-- by schema_phase86) matches on status = 'active' now, not
-- 'grace_period'; and the Featured Placement table's RLS and its
-- publishers.featured/featured_until sync trigger both work as
-- described. Does not attempt to invoke any Edge Function (Deno, not
-- reachable from pgTAP) — every state change below is set directly, the
-- same way every other test file in this directory simulates what an
-- Edge Function would have written.

begin;
select plan(10);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('h1111111-1111-1111-1111-111111111111', 'publisher-user-h@example.test'),
  ('h2222222-2222-2222-2222-222222222222', 'other-publisher-user-h@example.test'),
  ('h6666666-6666-6666-6666-666666666666', 'business-user-h@example.test');

update public.profiles set role = 'publisher' where id = 'h1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'publisher' where id = 'h2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'business' where id = 'h6666666-6666-6666-6666-666666666666';

insert into public.publishers (id, user_id, name, city, province, category, channel_slug, status) values
  ('h3333333-3333-3333-3333-333333333333', 'h1111111-1111-1111-1111-111111111111', 'Pricing Test Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved'),
  ('h4444444-4444-4444-4444-444444444444', 'h2222222-2222-2222-2222-222222222222', 'Other Pricing Test Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved');

-- ── 1. The removed statuses are actually rejected, not just unused ──────
select throws_ok(
  $$ insert into public.publisher_subscriptions (publisher_id, status) values ('h1111111-1111-1111-1111-111111111111', 'grace_period') $$,
  '23514',
  null,
  'grace_period is no longer a valid publisher_subscriptions status — the check constraint actually rejects it, not just "nothing sets it anymore"'
);
select throws_ok(
  $$ insert into public.business_subscriptions (business_id, status) values ('h1111111-1111-1111-1111-111111111111', 'suspended') $$,
  '23514',
  null,
  'suspended is no longer a valid business_subscriptions status either'
);

-- ── 2. The dropped recurring columns are actually gone ───────────────────
select hasnt_column('public', 'publisher_subscriptions', 'current_period_end', 'publisher_subscriptions.current_period_end was dropped — there is no period to track for a once-off payment');
select hasnt_column('public', 'business_subscriptions', 'payfast_token', 'business_subscriptions.payfast_token was dropped — there is no recurring token for a once-off payment');
select has_column('public', 'publisher_subscriptions', 'paid_at', 'publisher_subscriptions gained paid_at, the once-off equivalent of the dropped recurring columns');

-- ── 3. opportunity_applications_insert_publisher matches on status =
--       'active' now, not the old ('active', 'grace_period') pair ───────
insert into public.opportunities (id, business_id, title, brief, budget_min, budget_max, status)
values ('h5555555-5555-5555-5555-555555555555', 'h6666666-6666-6666-6666-666666666666', 'Test opportunity', 'A test opportunity for schema_phase86 enforcement', 500, 500, 'open');

select set_config('request.jwt.claim.sub', 'h1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select throws_ok(
  $$ insert into public.opportunity_applications (opportunity_id, publisher_id, message) values ('h5555555-5555-5555-5555-555555555555', 'h3333333-3333-3333-3333-333333333333', 'Interested in this one') $$,
  '42501',
  null,
  'a publisher with no active publisher_subscriptions row cannot apply to an opportunity'
);
reset role;

insert into public.publisher_subscriptions (publisher_id, status) values ('h1111111-1111-1111-1111-111111111111', 'active');

select set_config('request.jwt.claim.sub', 'h1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select lives_ok(
  $$ insert into public.opportunity_applications (opportunity_id, publisher_id, message) values ('h5555555-5555-5555-5555-555555555555', 'h3333333-3333-3333-3333-333333333333', 'Interested in this one') $$,
  'once that publisher_subscriptions row is active, the same publisher can apply'
);
reset role;

-- ── 4. Featured Placement: RLS and the publishers.featured sync trigger ─
insert into public.featured_placement_subscriptions (publisher_id, status) values ('h3333333-3333-3333-3333-333333333333', 'pending');

select set_config('request.jwt.claim.sub', 'h2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select is(
  (select count(*)::int from public.featured_placement_subscriptions where publisher_id = 'h3333333-3333-3333-3333-333333333333'),
  0,
  'a different publisher cannot see this publisher''s featured_placement_subscriptions row'
);
reset role;

update public.featured_placement_subscriptions set status = 'active', current_period_end = now() + interval '30 days' where publisher_id = 'h3333333-3333-3333-3333-333333333333';
select is(
  (select featured from public.publishers where id = 'h3333333-3333-3333-3333-333333333333'),
  true,
  'trg_sync_featured_placement_status sets publishers.featured = true when the subscription becomes active'
);

update public.featured_placement_subscriptions set status = 'past_due' where publisher_id = 'h3333333-3333-3333-3333-333333333333';
select is(
  (select featured from public.publishers where id = 'h3333333-3333-3333-3333-333333333333'),
  false,
  'the same trigger sets publishers.featured = false the moment the subscription goes past_due — no grace window for this product'
);

select * from finish();
rollback;
