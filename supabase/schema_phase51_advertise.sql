-- ChatSched — Phase 51 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase50_transparency.sql.
--
-- /advertise — "Advertise With ChatSched". Distinct from every other
-- table added so far: those all sold access TO the platform (partnering,
-- publishing, working, applying). This one sells the platform's OWN
-- traffic and audience AS inventory — a business buying a banner slot,
-- a newsletter mention, a featured directory placement, a sponsored
-- article, or a broader brand partnership with ChatSched itself, not
-- with a publisher on the marketplace. Kept as its own table rather than
-- folded into partner_applications (Phase 47/48): the "category" there is
-- the applicant's own industry, and "partner_type" is a functional role
-- in the partner program — neither fits "which ad product on
-- chatsched.com does this business want to buy".

create table public.advertise_inquiries (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  product text not null check (product in (
    'website_advertising', 'newsletter_sponsorship', 'featured_placement',
    'sponsored_article', 'brand_partnership'
  )),
  budget_range text, -- free text — e.g. "R5,000–R10,000/mo" — no fixed rate card yet
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'in_discussion', 'active', 'declined')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index advertise_inquiries_product_idx on public.advertise_inquiries(product);
create index advertise_inquiries_status_idx on public.advertise_inquiries(status);
create index advertise_inquiries_created_at_idx on public.advertise_inquiries(created_at desc);

alter table public.advertise_inquiries enable row level security;

-- Same "anyone can submit, only admins can read" shape as every other
-- public intake form in this schema.
create policy "advertise_inquiries_insert_public" on public.advertise_inquiries
  for insert with check (true);
create policy "advertise_inquiries_select_admin" on public.advertise_inquiries
  for select using (public.is_admin());
create policy "advertise_inquiries_update_admin" on public.advertise_inquiries
  for update using (public.is_admin());
