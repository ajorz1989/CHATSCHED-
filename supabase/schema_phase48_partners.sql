-- ChatSched — Phase 48 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase47_work_with_us.sql.
--
-- /partners — the ecosystem/referral & integration partner program.
-- Different shape from Careers (Phase 45) and Work With Us (Phase 46):
-- those are individual people; this is other BUSINESSES (agencies,
-- developers, payment providers, media organisations, etc.) applying to
-- partner with the platform itself — hence company_name/contact_name
-- split instead of a single name, an optional website instead of a
-- portfolio link, and a partnership-specific status pipeline (New →
-- Contacted → In Discussion → Active Partner → Declined) instead of a
-- hiring or triage one.

create table public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  category text not null check (category in (
    'marketing_agencies', 'web_developers', 'pr_agencies', 'photographers',
    'event_companies', 'payment_providers', 'software_companies',
    'creator_networks', 'media_organisations', 'business_associations'
  )),
  website text,
  message text not null, -- how they'd want to partner / what they'd bring
  status text not null default 'new'
    check (status in ('new', 'contacted', 'in_discussion', 'active', 'declined')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index partner_applications_category_idx on public.partner_applications(category);
create index partner_applications_status_idx on public.partner_applications(status);
create index partner_applications_created_at_idx on public.partner_applications(created_at desc);

alter table public.partner_applications enable row level security;

-- Same "anyone can submit, only admins can read" shape as every other
-- public intake form in this schema (contact_messages, career_applications,
-- work_with_us_applications).
create policy "partner_applications_insert_public" on public.partner_applications
  for insert with check (true);
create policy "partner_applications_select_admin" on public.partner_applications
  for select using (public.is_admin());
create policy "partner_applications_update_admin" on public.partner_applications
  for update using (public.is_admin());
