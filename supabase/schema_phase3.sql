-- ChatSched — Phase 3 schema additions
-- Run once in the Supabase SQL editor, AFTER schema.sql and schema_phase2.sql.
-- Adds a message thread per request. Publishers still don't have accounts
-- (see schema.sql), so this is business <-> admin, not business <-> publisher —
-- an admin relays anything that needs to reach the publisher for now.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('business', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_request_id_idx on public.messages(request_id);

alter table public.messages enable row level security;

-- A business can read and post on its own request's thread; an admin can
-- read and post on any thread.
create policy "messages_select_own_or_admin" on public.messages
  for select using (
    public.is_admin()
    or exists (select 1 from public.requests r where r.id = request_id and r.business_id = auth.uid())
  );
create policy "messages_insert_own_or_admin" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.requests r where r.id = request_id and r.business_id = auth.uid())
    )
  );
