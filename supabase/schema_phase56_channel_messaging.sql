-- ChatSched — Phase 56 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase55_subscriptions.sql.
--
-- Routes business <-> creator messaging for the 4 newer channels
-- (influencer/website/podcast/radio) through ChatSched, matching how the
-- original flow actually works today.
--
-- Two corrections to how that "matching" was scoped, found by reading the
-- actual current schema/RLS rather than trusting this repo's own migration
-- comments at face value:
--
-- 1. schema_phase3.sql's comment describes admin manually relaying
--    messages between business and publisher ("Publishers still don't
--    have accounts... an admin relays anything that needs to reach the
--    publisher for now"). That was true when phase3 shipped, but
--    schema_phase6.sql later gave publishers direct read/post access to
--    the SAME thread (messages_select_own_publisher /
--    messages_insert_own_publisher) — nothing partitions business's and
--    the publisher's view of a request's messages.thread. So "the
--    original flow" is actually a shared 3-way thread (business, creator,
--    admin all see and can post the same messages), not literal manual
--    relay. This migration matches that real behavior, not the stale
--    comment describing it.
--
-- 2. schema_phase42_read_receipts.sql's own comment repeats phase3's
--    stale claim ("messages.sender_role is only ever 'business' or
--    'admin' ... no publisher accounts existed when that table was
--    designed") and, on that mistaken basis, never gave a publisher the
--    ability to mark a business's message as read on their own request's
--    thread — only the business or an admin can (messages_update_mark_read).
--    A publisher can read and post but never mark-read, so read receipts
--    have been silently broken for publishers on the original flow this
--    whole time. Fixed below with the missing policy, since this
--    migration is already touching this exact area.
--
-- Same "exactly one of two nullable parent FKs" convention as deliverables
-- (schema_phase54) and content_approvals (schema_phase53).

alter table public.messages alter column request_id drop not null;
alter table public.messages add column channel_request_id uuid references public.channel_requests(id) on delete cascade;
alter table public.messages add constraint messages_exactly_one_parent check (
  (request_id is not null and channel_request_id is null)
  or (request_id is null and channel_request_id is not null)
);

create index messages_channel_request_id_idx on public.messages(channel_request_id);

-- ── channel_requests thread: business, creator, and admin all share it ──
-- Same shape as messages_select_own_or_admin / messages_select_own_publisher
-- (schema_phase3.sql, schema_phase6.sql) — just the channel_requests
-- participant check instead of requests'.
create policy messages_select_channel_participant on public.messages
  for select using (
    exists (
      select 1 from public.channel_requests cr
      where cr.id = channel_request_id
      and (cr.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

create policy messages_insert_channel_participant on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      (sender_role = 'admin' and public.is_admin())
      or (sender_role = 'business' and exists (
        select 1 from public.channel_requests cr where cr.id = channel_request_id and cr.business_id = auth.uid()
      ))
      or (sender_role = 'publisher' and exists (
        select 1 from public.channel_requests cr
        join public.publishers p on p.id = cr.creator_id
        where cr.id = channel_request_id and p.user_id = auth.uid()
      ))
    )
  );

-- Read receipts on the new channel_request_id path — same shape as
-- messages_update_mark_read (admin included, same as that policy), just
-- for the new column and its participant check.
create policy messages_update_mark_read_channel_participant on public.messages
  for update using (
    sender_id <> auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.channel_requests cr
        where cr.id = channel_request_id
        and (cr.business_id = auth.uid()
             or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
      )
    )
  )
  with check (
    sender_id <> auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.channel_requests cr
        where cr.id = channel_request_id
        and (cr.business_id = auth.uid()
             or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
      )
    )
  );

-- ── Bug fix: the original flow's publisher could never mark a message
-- read (see finding #2 above). Same shape as messages_update_mark_read
-- (schema_phase42_read_receipts.sql), extended to the publisher on their
-- own request's thread — mirrors messages_select_own_publisher /
-- messages_insert_own_publisher's participant check (schema_phase6.sql).
create policy messages_update_mark_read_publisher on public.messages
  for update using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.requests r
      join public.publishers p on p.id = r.publisher_id
      where r.id = request_id and p.user_id = auth.uid()
    )
  )
  with check (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.requests r
      join public.publishers p on p.id = r.publisher_id
      where r.id = request_id and p.user_id = auth.uid()
    )
  );
