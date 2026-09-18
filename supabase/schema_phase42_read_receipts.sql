-- ChatSched — Phase 42 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- Read receipts. Neither message system (the request-scoped `messages`
-- from Phase 3, nor the 1:1 business<->publisher `conversation_messages`
-- from Phase 29) had any notion of "has the other person seen this" —
-- exactly the anxiety that makes people give up on in-platform messaging
-- and go find each other on WhatsApp/Instagram DMs instead, which is the
-- real competition here, not another marketplace.
--
-- Both tables get the same shape: a nullable read_at, set once, by
-- whoever isn't the sender, the first time they view the thread. Not
-- reset-able (no policy allows clearing it back to null) and not
-- settable by the sender themselves (the UPDATE policies below only ever
-- allow a non-sender to write their own read timestamp).

alter table public.conversation_messages add column read_at timestamptz;
alter table public.messages add column read_at timestamptz;

-- ── conversation_messages ────────────────────────────────────────────────
-- A participant (business or the matching publisher) can mark a message
-- as read, but only one they didn't send themselves, and only within a
-- conversation they're actually part of. Admins can read every
-- conversation (see the existing SELECT policy) but deliberately can't
-- mark things read here — an admin opening a thread to check on it
-- shouldn't tell either participant the other one has seen their message.
create policy conversation_messages_update_mark_read
  on public.conversation_messages for update
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          c.business_id = auth.uid()
          or exists (select 1 from public.publishers p where p.id = c.publisher_id and p.user_id = auth.uid())
        )
    )
  )
  with check (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          c.business_id = auth.uid()
          or exists (select 1 from public.publishers p where p.id = c.publisher_id and p.user_id = auth.uid())
        )
    )
  );

-- ── messages (request-scoped, business<->admin) ─────────────────────────
-- Same shape, simpler participant check — messages.sender_role is only
-- ever 'business' or 'admin' (see schema_phase3.sql's own comment: no
-- publisher accounts existed when that table was designed), so the only
-- non-sender who can mark something read here is the business that owns
-- the request, or an admin.
create policy messages_update_mark_read
  on public.messages for update
  using (
    sender_id <> auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.requests r where r.id = request_id and r.business_id = auth.uid())
    )
  )
  with check (
    sender_id <> auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.requests r where r.id = request_id and r.business_id = auth.uid())
    )
  );
