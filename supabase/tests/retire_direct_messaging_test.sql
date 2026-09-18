-- pgTAP tests for the Phase 85 direct-messaging retirement
-- ("Claude To fix 1..txt" item 9, HIGH — Business-to-publisher
-- communication conflicts with the new agency model).
--
-- HONESTY NOTE, same as every other file in this directory: no Postgres,
-- Docker, or Supabase CLI in this sandbox, so this has NOT been run
-- against a real instance. Written to the pattern already established in
-- this directory, reviewed by hand against the actual policy in
-- schema_phase85_retire_direct_messaging.sql, not from memory of what it
-- "should" say. Needs every schema_phase*.sql through schema_phase85
-- applied first.
--
-- Scope: exactly what schema_phase85 changed — an ordinary business can
-- no longer open a brand-new conversations row with a publisher at all;
-- an admin still can (with business_id forced to their own id, same
-- auth.uid() = business_id requirement the original policy already had —
-- this migration only added the is_admin() requirement alongside it, so
-- even an admin can't set business_id to someone else's id); and a
-- conversation that already existed before this fix keeps working
-- exactly as before for both of its real participants. Does not
-- re-test conversations_select_participant_or_admin or either
-- conversation_messages policy's own logic beyond what's needed to prove
-- "existing threads still work" — those weren't touched by this fix and
-- aren't its territory.

begin;
select plan(5);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('g1111111-1111-1111-1111-111111111111', 'business-g@example.test'),
  ('g2222222-2222-2222-2222-222222222222', 'publisher-user-g@example.test'),
  ('g3333333-3333-3333-3333-333333333333', 'admin-g@example.test');

update public.profiles set role = 'business' where id = 'g1111111-1111-1111-1111-111111111111';
update public.profiles set role = 'publisher' where id = 'g2222222-2222-2222-2222-222222222222';
update public.profiles set role = 'admin' where id = 'g3333333-3333-3333-3333-333333333333';

insert into public.publishers (id, user_id, name, city, province, category, channel_slug, status) values
  ('g4444444-4444-4444-4444-444444444444', 'g2222222-2222-2222-2222-222222222222',
   'Messaging Test Creator', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved'),
  ('g6666666-6666-6666-6666-666666666666', 'g2222222-2222-2222-2222-222222222222',
   'Messaging Test Creator Two', 'Cape Town', 'Western Cape', 'Lifestyle', 'social-media', 'approved');

-- A conversation that already existed before this fix (inserted here as
-- the unrestricted setup role, simulating data that predates
-- schema_phase85 — this is exactly what the migration is careful not to
-- touch).
insert into public.conversations (id, business_id, publisher_id)
values ('g5555555-5555-5555-5555-555555555555', 'g1111111-1111-1111-1111-111111111111', 'g4444444-4444-4444-4444-444444444444');

-- ── 1. An ordinary business can no longer open a NEW conversation ───────
select set_config('request.jwt.claim.sub', 'g1111111-1111-1111-1111-111111111111', true);
set role authenticated;
select throws_ok(
  $$ insert into public.conversations (business_id, publisher_id) values ('g1111111-1111-1111-1111-111111111111', 'g6666666-6666-6666-6666-666666666666') $$,
  '42501',
  null,
  'an ordinary business can no longer open a new conversation with a publisher it has no existing thread with (conversations_insert_business is gone)'
);

-- ── 2. That same business can still send a message in the PRE-EXISTING
--       conversation — this fix does not touch existing threads ────────
select lives_ok(
  $$ insert into public.conversation_messages (conversation_id, sender_id, sender_role, body) values ('g5555555-5555-5555-5555-555555555555', 'g1111111-1111-1111-1111-111111111111', 'business', 'Still works, right?') $$,
  'the business can still send a message in a conversation that already existed before this fix'
);
reset role;

-- ── 3. The publisher on that same pre-existing conversation can still
--       reply too ────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'g2222222-2222-2222-2222-222222222222', true);
set role authenticated;
select lives_ok(
  $$ insert into public.conversation_messages (conversation_id, sender_id, sender_role, body) values ('g5555555-5555-5555-5555-555555555555', 'g2222222-2222-2222-2222-222222222222', 'publisher', 'Yes, still here.') $$,
  'the publisher on that same pre-existing conversation can still reply'
);
reset role;

-- ── 4. An admin (ChatSched) can still open a brand-new conversation,
--       appearing as the business_id side themselves ─────────────────────
select set_config('request.jwt.claim.sub', 'g3333333-3333-3333-3333-333333333333', true);
set role authenticated;
select lives_ok(
  $$ insert into public.conversations (business_id, publisher_id) values ('g3333333-3333-3333-3333-333333333333', 'g4444444-4444-4444-4444-444444444444') $$,
  'ChatSched (an admin session) can still open a new conversation with a publisher, keeping publisher <-> ChatSched communication alive'
);

-- ── 5. But even an admin can't open one on behalf of a REAL business —
--       auth.uid() = business_id is still required, unchanged from the
--       original policy. Uses a fresh publisher/business pair (not the
--       pre-existing fixture) so this fails on the RLS check itself, not
--       on the unique(business_id, publisher_id) constraint.
select throws_ok(
  $$ insert into public.conversations (business_id, publisher_id) values ('g1111111-1111-1111-1111-111111111111', 'g6666666-6666-6666-6666-666666666666') $$,
  '42501',
  null,
  'an admin cannot open a conversation with business_id set to a real business''s id instead of their own — auth.uid() = business_id is still required alongside is_admin(), not replaced by it'
);
reset role;

select * from finish();
rollback;
