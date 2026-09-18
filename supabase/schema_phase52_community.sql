-- ChatSched — Phase 52 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase51_advertise.sql.
--
-- /community — a starting community layer, deliberately NOT a forum.
-- Three admin-curated content types, each simple enough to manage from
-- a single admin tab, none of them open-ended user-generated threads:
--
--   - community_announcements — admin posts, publicly readable once
--     published. A lightweight news feed, not a discussion.
--   - community_events        — webinars and events, admin-managed,
--     upcoming/past by starts_at. No RSVP system yet — a location/link
--     is enough to start.
--   - community_questions     — the "Q&A" piece. Anyone can submit a
--     question (same public-insert posture as every other intake form
--     in this schema); it stays invisible until an admin answers and
--     explicitly publishes it. This is curated Q&A, not an open forum
--     thread — there's no reply-to-a-reply structure, on purpose.

create table public.community_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  pinned boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_announcements_published_idx
  on public.community_announcements(is_published, pinned desc, created_at desc);

alter table public.community_announcements enable row level security;

create policy "community_announcements_select_public" on public.community_announcements
  for select using (is_published or public.is_admin());
create policy "community_announcements_write_admin" on public.community_announcements
  for insert with check (public.is_admin());
create policy "community_announcements_update_admin" on public.community_announcements
  for update using (public.is_admin());
create policy "community_announcements_delete_admin" on public.community_announcements
  for delete using (public.is_admin());

create table public.community_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  event_type text not null check (event_type in ('webinar', 'in_person', 'online')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_or_link text not null, -- a URL for webinar/online, a physical address for in_person
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_events_published_starts_idx
  on public.community_events(is_published, starts_at);

alter table public.community_events enable row level security;

create policy "community_events_select_public" on public.community_events
  for select using (is_published or public.is_admin());
create policy "community_events_write_admin" on public.community_events
  for insert with check (public.is_admin());
create policy "community_events_update_admin" on public.community_events
  for update using (public.is_admin());
create policy "community_events_delete_admin" on public.community_events
  for delete using (public.is_admin());

create table public.community_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('publisher', 'business', 'marketing')),
  question text not null,
  asked_by_name text,
  asked_by_email text, -- optional, for a follow-up — never shown publicly
  answer text,
  status text not null default 'pending'
    check (status in ('pending', 'answered', 'published')),
  admin_notes text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index community_questions_status_idx on public.community_questions(status);
create index community_questions_category_idx on public.community_questions(category);

alter table public.community_questions enable row level security;

-- Anyone can ask; only a published (admin-answered, admin-approved)
-- question is publicly visible — a pending or answered-but-unpublished
-- one stays admin-only, same shape as a moderation queue.
create policy "community_questions_insert_public" on public.community_questions
  for insert with check (true);
create policy "community_questions_select_published_or_admin" on public.community_questions
  for select using (status = 'published' or public.is_admin());
create policy "community_questions_update_admin" on public.community_questions
  for update using (public.is_admin());
create policy "community_questions_delete_admin" on public.community_questions
  for delete using (public.is_admin());
