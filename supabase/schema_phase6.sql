-- ChatSched — Phase 6 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase5.sql.
-- Adds what the publisher's own dashboard needs: a publisher can now read
-- requests made to them, message the business on a shared thread
-- (previously business <-> admin only — see schema_phase3.sql's own
-- comment about that), and see the business's name on a request they're
-- part of. Nothing here removes or narrows existing access — business and
-- admin behaviour is untouched; everything below is a new grant.

-- ── messages: a publisher can now be a sender too ──────────────────────
alter table public.messages drop constraint messages_sender_role_check;
alter table public.messages add constraint messages_sender_role_check
  check (sender_role in ('business', 'admin', 'publisher'));

-- ── requests: a publisher can read requests made to them ───────────────
create policy "requests_select_own_publisher" on public.requests
  for select using (
    exists (select 1 from public.publishers p where p.id = requests.publisher_id and p.user_id = auth.uid())
  );

-- ── messages: publisher can read/post on the thread for their own request ──
create policy "messages_select_own_publisher" on public.messages
  for select using (
    exists (
      select 1 from public.requests r
      join public.publishers p on p.id = r.publisher_id
      where r.id = request_id and p.user_id = auth.uid()
    )
  );

create policy "messages_insert_own_publisher" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and sender_role = 'publisher'
    and exists (
      select 1 from public.requests r
      join public.publishers p on p.id = r.publisher_id
      where r.id = request_id and p.user_id = auth.uid()
    )
  );

-- ── profiles: let a publisher see the name of a business they share a
-- request with. profiles otherwise stays exactly "read your own, admin
-- reads all" (schema.sql, profiles_select_own_or_admin) — this is scoped
-- narrowly to that one relationship, not a general profile-browsing grant.
create policy "profiles_select_via_shared_request" on public.profiles
  for select using (
    exists (
      select 1 from public.requests r
      join public.publishers p on p.id = r.publisher_id
      where r.business_id = profiles.id and p.user_id = auth.uid()
    )
  );

-- Nothing needed for reviews: reviews_select_public (schema_phase2.sql) is
-- already `using (true)`, so a publisher reading back their own submitted
-- review needs no new policy, and reviews_insert_own_completed_publisher
-- (schema_phase5.sql) already covers the insert this dashboard makes.
