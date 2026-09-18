-- ChatSched — Phase 12 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase11.sql.
--
-- Backs the Availability Calendar with a real, shared table. It previously
-- ran entirely on localStorage keyed by publisher ID (see the old
-- src/hooks/useAvailability.ts) — which meant a business viewing a
-- publisher's profile on their own device never actually saw that
-- publisher's real blocked dates, only whatever their own browser's local
-- storage happened to contain (usually nothing, since they'd never
-- toggled anything). The calendar rendered correctly and looked
-- complete; it just never shared anything between two different users,
-- which is the entire point of an availability calendar.

create table if not exists public.publisher_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  blocked_date date not null,
  created_at timestamptz not null default now(),
  unique (publisher_id, blocked_date)
);

create index if not exists idx_blocked_dates_publisher on public.publisher_blocked_dates(publisher_id);

alter table public.publisher_blocked_dates enable row level security;

-- Same visibility as the publisher row itself (schema_phase5.sql):
-- approved publishers' calendars are public, plus the owner and admin.
create policy blocked_dates_select on public.publisher_blocked_dates
  for select using (
    exists (
      select 1 from public.publishers p
      where p.id = publisher_id
        and (p.status = 'approved' or p.user_id = auth.uid() or public.is_admin())
    )
  );

-- Only the publisher's own account (or an admin) can block/unblock their
-- own dates — mirrors the ownership check already used for messaging and
-- earnings elsewhere.
create policy blocked_dates_write on public.publisher_blocked_dates
  for all using (
    exists (select 1 from public.publishers p where p.id = publisher_id and (p.user_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.publishers p where p.id = publisher_id and (p.user_id = auth.uid() or public.is_admin()))
  );
