-- ChatSched — Phase 47 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase46_careers.sql.
--
-- /work-with-us — a wider, lower-commitment intake than /careers. Careers
-- (Phase 45) is for people applying to join the team; this is for anyone
-- who wants to work WITH ChatSched without necessarily being hired —
-- freelancers, creators, sales reps, community managers, and the more
-- traditional roles (dev/design/sales/marketing) alongside them, plus
-- internships. Deliberately its own table rather than reusing
-- career_applications: the category list here doesn't map 1:1 onto job
-- roles, the attachment is optional (a freelancer's or creator's link is
-- often enough on its own), and admin wants to read this as "which
-- category is this pipeline actually attracting", not review it as a
-- hiring queue with interview scheduling.

create table public.work_with_us_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  category text not null check (category in (
    'developers', 'designers', 'sales', 'marketing', 'creators',
    'community_managers', 'sales_representatives', 'freelancers', 'internships'
  )),
  location text not null,
  message text not null, -- what they want to do with/for ChatSched
  portfolio_url text,
  linkedin_url text,
  attachment_path text, -- optional — a freelancer/creator often just links out instead
  attachment_filename text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'archived')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index work_with_us_category_idx on public.work_with_us_applications(category);
create index work_with_us_status_idx on public.work_with_us_applications(status);
create index work_with_us_created_at_idx on public.work_with_us_applications(created_at desc);

alter table public.work_with_us_applications enable row level security;

-- Same "anyone can submit, only admins can read" shape as contact_messages
-- and career_applications.
create policy "work_with_us_insert_public" on public.work_with_us_applications
  for insert with check (true);
create policy "work_with_us_select_admin" on public.work_with_us_applications
  for select using (public.is_admin());
create policy "work_with_us_update_admin" on public.work_with_us_applications
  for update using (public.is_admin());

-- ── work-with-us-attachments bucket (optional, same shape as career-cvs) ──

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-with-us-attachments', 'work-with-us-attachments', false, 5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = false;

-- Path convention: applications/{timestamp}-{random}.{ext} — no
-- auth.uid() available, same reasoning as career-cvs (schema_phase46).
create policy work_with_us_attachments_insert_public
  on storage.objects for insert
  with check (bucket_id = 'work-with-us-attachments');

create policy work_with_us_attachments_select_admin
  on storage.objects for select
  using (bucket_id = 'work-with-us-attachments' and public.is_admin());

create policy work_with_us_attachments_delete_admin
  on storage.objects for delete
  using (bucket_id = 'work-with-us-attachments' and public.is_admin());
