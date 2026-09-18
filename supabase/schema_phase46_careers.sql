-- ChatSched — Phase 46 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase44_platform_rules_content.sql.
--
-- Careers page (/careers) + admin review queue (/admin/careers).
--
-- Applicants are anonymous, unauthenticated visitors — same posture as
-- contact_messages (schema.sql): anyone can insert, only admins can read.
-- The CV file follows the same "public insert, admin-only select" shape
-- but through a storage bucket instead of a table, because there's no
-- auth.uid() available to scope an {auth.uid()}/{filename} folder the way
-- portfolio-images does — applicants aren't logged in. Deliberately a
-- PRIVATE bucket like campaign-proof-screenshots (schema_phase40), not a
-- public one like portfolio-images: a CV is personal information tied to
-- one application, not a public-facing asset, so reading it back requires
-- a signed URL issued only to a caller who already passes is_admin().

create table public.career_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role text not null, -- free text: the role they're applying for, or "General application" — there's no fixed open-roles list to pick from
  cv_path text not null, -- storage path within the career-cvs bucket
  cv_filename text not null, -- original filename, for a sensible download name
  portfolio_url text,
  linkedin_url text,
  location text not null,
  cover_letter text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'interview', 'offer', 'hired', 'rejected')),
  interview_date timestamptz, -- optional, admin-set once status reaches 'interview'
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index career_applications_status_idx on public.career_applications(status);
create index career_applications_created_at_idx on public.career_applications(created_at desc);

alter table public.career_applications enable row level security;

-- Anyone can submit an application, only admins can read the queue back —
-- identical shape to contact_messages' two policies above.
create policy "career_applications_insert_public" on public.career_applications
  for insert with check (true);
create policy "career_applications_select_admin" on public.career_applications
  for select using (public.is_admin());
create policy "career_applications_update_admin" on public.career_applications
  for update using (public.is_admin());

-- ── career-cvs bucket ────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'career-cvs', 'career-cvs', false, 5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = false;

-- Path convention: applications/{timestamp}-{random}.{ext} — not
-- {auth.uid()}/{filename} like portfolio-images, since the applicant has
-- no session. Anyone can write (same trust boundary as the public insert
-- on career_applications itself — a bad actor can upload a junk file, but
-- can't read anyone else's), only admins can read.
create policy career_cvs_insert_public
  on storage.objects for insert
  with check (bucket_id = 'career-cvs');

create policy career_cvs_select_admin
  on storage.objects for select
  using (bucket_id = 'career-cvs' and public.is_admin());

create policy career_cvs_delete_admin
  on storage.objects for delete
  using (bucket_id = 'career-cvs' and public.is_admin());
