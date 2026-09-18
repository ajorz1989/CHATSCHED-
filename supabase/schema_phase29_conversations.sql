-- ChatSched — Phase 29 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase28_eft_payment.sql.
--
-- In-platform direct messages between a business and a publisher. This is
-- what "Contact Publisher" on a public listing opens — ChatSched Messages,
-- not WhatsApp, not email. Campaign request threads (`messages` on
-- `requests`) stay as they are; this is a separate 1:1 inbox so a business
-- can reach a publisher without first submitting a campaign.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.profiles(id) on delete cascade,
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  created_at timestamptz not null default now(),
  unique (business_id, publisher_id)
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('business', 'admin', 'publisher')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index conversations_business_id_idx
  on public.conversations (business_id, last_message_at desc);
create index conversations_publisher_id_idx
  on public.conversations (publisher_id, last_message_at desc);
create index conversation_messages_conversation_id_idx
  on public.conversation_messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

-- A participant is the business who opened the thread, or the publisher
-- the thread is with (matched via publishers.user_id). Admins can read
-- every thread.
create policy conversations_select_participant_or_admin
  on public.conversations for select
  using (
    public.is_admin()
    or business_id = auth.uid()
    or exists (
      select 1 from public.publishers p
      where p.id = publisher_id and p.user_id = auth.uid()
    )
  );

-- Only a logged-in business (or admin acting as themselves) can open a
-- thread, and only with an approved listing. Publishers receive messages;
-- they don't start conversations from someone else's profile. A publisher
-- also can't open a thread with themselves.
create policy conversations_insert_business
  on public.conversations for insert
  with check (
    auth.uid() = business_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('business', 'admin')
    )
    and exists (
      select 1 from public.publishers
      where id = publisher_id and status = 'approved'
    )
    and not exists (
      select 1 from public.publishers
      where id = publisher_id and user_id = auth.uid()
    )
  );

create policy conversation_messages_select_participant_or_admin
  on public.conversation_messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          c.business_id = auth.uid()
          or exists (
            select 1 from public.publishers p
            where p.id = c.publisher_id and p.user_id = auth.uid()
          )
        )
    )
  );

create policy conversation_messages_insert_participant_or_admin
  on public.conversation_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or (
        sender_role = 'business'
        and exists (
          select 1 from public.conversations c
          where c.id = conversation_id and c.business_id = auth.uid()
        )
      )
      or (
        sender_role = 'publisher'
        and exists (
          select 1 from public.conversations c
          join public.publishers p on p.id = c.publisher_id
          where c.id = conversation_id and p.user_id = auth.uid()
        )
      )
    )
  );

-- Keep the inbox sort order and preview in sync without giving clients
-- an UPDATE grant on conversations. SECURITY DEFINER bypasses RLS.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = left(new.body, 140)
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_on_message on public.conversation_messages;
create trigger trg_touch_conversation_on_message
  after insert on public.conversation_messages
  for each row execute function public.touch_conversation_on_message();

-- In-app bell only — these stay on ChatSched. The other party gets a
-- notification that deep-links into /messages, not WhatsApp.
create or replace function public.notify_new_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convo public.conversations%rowtype;
  v_publisher_user_id uuid;
  v_publisher_name text;
  v_business_name text;
begin
  select * into v_convo from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;
  select user_id, name into v_publisher_user_id, v_publisher_name
    from public.publishers where id = v_convo.publisher_id;
  select coalesce(nullif(company_name, ''), nullif(full_name, ''), 'A business')
    into v_business_name
    from public.profiles where id = v_convo.business_id;

  if new.sender_role = 'publisher' then
    perform public.create_notification(
      v_convo.business_id, 'conversation_message',
      'New message',
      format('%s sent you a message on ChatSched.', coalesce(v_publisher_name, 'A publisher')),
      format('/messages?c=%s', v_convo.id)
    );
  else
    if v_publisher_user_id is not null then
      perform public.create_notification(
        v_publisher_user_id, 'conversation_message',
        'New message',
        format('%s sent you a message on ChatSched.', coalesce(v_business_name, 'A business')),
        format('/messages?c=%s', v_convo.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_conversation_message on public.conversation_messages;
create trigger trg_notify_new_conversation_message
  after insert on public.conversation_messages
  for each row execute function public.notify_new_conversation_message();

-- Let a publisher see the business's name (not phone/email) on a thread
-- they share. Same narrow grant as profiles_select_via_shared_request in
-- schema_phase6.sql — not a general profile-browsing policy.
create policy profiles_select_via_shared_conversation
  on public.profiles for select
  using (
    exists (
      select 1 from public.conversations c
      join public.publishers p on p.id = c.publisher_id
      where c.business_id = profiles.id and p.user_id = auth.uid()
    )
  );
