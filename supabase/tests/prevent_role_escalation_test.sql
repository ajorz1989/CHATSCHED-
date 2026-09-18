-- pgTAP tests for the Phase 81 role-escalation fix
-- ("Claude To fix 1..txt" item 5, CRITICAL — Admin role escalation risk).
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern the other files in this
-- directory already establish (set_config + `set role authenticated` for
-- RLS/trigger context, lives_ok + a follow-up is() for updates that RLS
-- or a trigger silently no-ops rather than rejects with an error — see
-- rls_channels_publishers_channel_requests_test.sql's own note on why
-- throws_ok is the wrong tool for that shape of check), reviewed by hand
-- against the actual handle_new_user()/prevent_role_change() bodies in
-- schema_phase81_prevent_role_escalation.sql, not from memory of what
-- they "should" do. Needs every schema_phase*.sql through
-- schema_phase81 applied first.
--
-- Scope: exactly the two holes schema_phase81's own header describes —
-- (1) signup metadata can no longer seed role as 'admin', (2) a logged-in
-- non-admin can no longer move their own (or anyone else's) role via a
-- normal UPDATE. Does not re-test profiles_select_own_or_admin or
-- prevent_self_verification(), both already covered by their own history
-- in this codebase and out of scope for this fix.

begin;
select plan(6);

-- ── fixtures ────────────────────────────────────────────────────────────
-- No raw_user_meta_data on b/c/d — handle_new_user() must still default
-- those to 'business' exactly as before this fix; a is the one exercising
-- the actual attack, its metadata is set individually below instead of in
-- this shared insert so the attempted value is visible right next to the
-- assertion it feeds.
insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'attacker-c@example.test'),
  ('c2222222-2222-2222-2222-222222222222', 'legit-publisher-c@example.test'),
  ('c3333333-3333-3333-3333-333333333333', 'other-user-c@example.test'),
  ('c4444444-4444-4444-4444-444444444444', 'admin-c@example.test');

update public.profiles set role = 'business' where id = 'c1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'business' where id = 'c3333333-3333-3333-3333-333333333333';
update public.profiles set role = 'admin' where id = 'c4444444-4444-4444-4444-444444444444';

-- ── 1. Signup metadata cannot seed role as 'admin' ───────────────────────
-- Simulates exactly what a client calling supabase.auth.signUp() with
-- options.data = { role: 'admin' } produces: an auth.users row whose
-- raw_user_meta_data contains role: 'admin'. handle_new_user() fires via
-- on_auth_user_created regardless of who inserts the row.
insert into auth.users (id, email, raw_user_meta_data) values (
  'c5555555-5555-5555-5555-555555555555',
  'attacker-signup-c@example.test',
  '{"role": "admin", "full_name": "Attacker"}'::jsonb
);
select isnt(
  (select role from public.profiles where id = 'c5555555-5555-5555-5555-555555555555'),
  'admin',
  'signUp() metadata claiming role: admin does not create an admin profile'
);
select is(
  (select role from public.profiles where id = 'c5555555-5555-5555-5555-555555555555'),
  'business',
  'that same signup silently falls back to business, same default as if role had been omitted'
);

-- ── 2. Legitimate publisher signup still works (no regression) ──────────
insert into auth.users (id, email, raw_user_meta_data) values (
  'c6666666-6666-6666-6666-666666666666',
  'legit-signup-c@example.test',
  '{"role": "publisher", "full_name": "Real Publisher"}'::jsonb
);
select is(
  (select role from public.profiles where id = 'c6666666-6666-6666-6666-666666666666'),
  'publisher',
  'a genuine role: publisher signup is unaffected by the whitelist'
);

-- ── 3. A logged-in non-admin cannot promote themselves via UPDATE ───────
select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select lives_ok(
  $$ update public.profiles set role = 'admin' where id = 'c1111111-1111-1111-1111-111111111111' $$,
  'a business user updating their own role runs without error (RLS lets them touch their own row)...'
);
select is(
  (select role from public.profiles where id = 'c1111111-1111-1111-1111-111111111111'),
  'business',
  '...but prevent_role_change() silently resets it back to business — the escalation does not take effect'
);
reset role;

-- ── 4. An admin can still change another user's role (the intended path) ─
select set_config('request.jwt.claim.sub', 'c4444444-4444-4444-4444-444444444444', true);
set role authenticated;
select lives_ok(
  $$ update public.profiles set role = 'publisher' where id = 'c3333333-3333-3333-3333-333333333333' $$,
  'an admin can change another user''s role — prevent_role_change() only blocks non-admin sessions'
);
reset role;

select * from finish();
rollback;
