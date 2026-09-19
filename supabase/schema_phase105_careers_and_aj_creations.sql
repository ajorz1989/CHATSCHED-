-- ChatSched — Phase 105 schema additions
-- Careers listings + job-linked applications + AJ: Creations audit source.
--
-- Append-only migration. Run AFTER schema_phase104_publisher_profile_image.sql.
--
-- Careers:
--   - public users can READ active listings only
--   - admins can read/write all listings
--   - draft/paused/closed jobs never leak through the public policy
--
-- Applications:
--   - existing career_applications are preserved
--   - career_id links an application to the job the applicant selected
--   - ON DELETE SET NULL preserves historical applications if a job is deleted
--
-- Publisher creation source:
--   - additive audit metadata so AJ: Creations can be distinguished from
--     normal admin-added and self-serve listings without changing publisher
--     identity or the existing browse schema.

create table if not exists public.careers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  job_title text not null,
  department text not null,
  location text not null,
  remote_type text not null default 'hybrid'
    check (remote_type in ('onsite', 'hybrid', 'remote')),
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contract', 'freelance', 'internship')),
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_currency text not null default 'ZAR',
  short_summary text not null default '',
  description text not null,
  responsibilities text[] not null default '{}',
  requirements text[] not null default '{}',
  nice_to_have text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'closed')),
  application_deadline date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists careers_status_sort_idx
  on public.careers(status, sort_order, created_at desc);

create index if not exists careers_deadline_idx
  on public.careers(application_deadline);

alter table public.careers enable row level security;

drop policy if exists careers_public_select_active on public.careers;
create policy careers_public_select_active
  on public.careers
  for select
  using (
    status = 'active'
    and (application_deadline is null or application_deadline >= current_date)
  );

drop policy if exists careers_admin_select_all on public.careers;
create policy careers_admin_select_all
  on public.careers
  for select
  using (public.is_admin());

drop policy if exists careers_admin_insert on public.careers;
create policy careers_admin_insert
  on public.careers
  for insert
  with check (public.is_admin());

drop policy if exists careers_admin_update on public.careers;
create policy careers_admin_update
  on public.careers
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists careers_admin_delete on public.careers;
create policy careers_admin_delete
  on public.careers
  for delete
  using (public.is_admin());

alter table public.career_applications
  add column if not exists career_id uuid references public.careers(id) on delete set null;

create index if not exists career_applications_career_id_idx
  on public.career_applications(career_id);

-- Optional metadata for admin-created publisher listings.
alter table public.publishers
  add column if not exists creation_source text not null default 'standard';

alter table public.publishers
  drop constraint if exists publishers_creation_source_check;

alter table public.publishers
  add constraint publishers_creation_source_check
  check (creation_source in ('standard', 'admin', 'aj_creations'));

comment on table public.careers is
  'ChatSched job listings. Public can read only currently active, non-expired listings; admins can manage all statuses.';

comment on column public.career_applications.career_id is
  'Optional link to the specific public careers listing selected by the applicant. Historical applications survive a deleted job because the relationship is SET NULL.';

comment on column public.publishers.creation_source is
  'Audit/source label for how a publisher listing was created. AJ: Creations uses aj_creations; normal self-serve listings remain standard; existing admin/manual listings remain standard unless explicitly migrated.';
