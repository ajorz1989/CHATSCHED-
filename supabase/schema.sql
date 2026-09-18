-- ChatSched — Phase 1 schema
-- Run once in Supabase: Project → SQL Editor → New query → paste this → Run.

create extension if not exists "pgcrypto";

-- One row per signed-up user. Businesses get 'business' by default;
-- see the bottom of this file for how to make yourself an admin.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'business' check (role in ('business', 'admin')),
  full_name text,
  company_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- The publisher directory. Publishers don't have accounts yet in Phase 1 —
-- this is managed from /admin — so there's no owner_id column here.
create table public.publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  province text not null,
  category text not null,
  platforms text[] not null default '{}',
  followers integer not null default 0,
  engagement numeric not null default 0,
  price_per_post numeric not null default 0,
  rating numeric,
  reviews integer not null default 0,
  verified boolean not null default false,
  bio text not null default '',
  audience text not null default '',
  initials text not null default '',
  swatch text not null default 'from-billboard-yellow to-billboard-yellowDeep',
  created_at timestamptz not null default now()
);

-- A business asking to book a publisher. This is the "concierge" flow —
-- an admin follows up and moves status along by hand for now.
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  business_id uuid not null references auth.users(id) on delete cascade,
  campaign_message text not null,
  budget numeric,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'confirmed', 'declined', 'completed')),
  created_at timestamptz not null default now()
);

-- The general Contact page — no login required to send one.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index requests_publisher_id_idx on public.requests(publisher_id);
create index requests_business_id_idx on public.requests(business_id);

-- Helper used inside RLS policies below. SECURITY DEFINER lets it read
-- public.profiles without triggering the recursive-policy problem you'd
-- hit if an admin policy queried profiles directly from inside itself.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile row on signup, using the metadata passed to
-- supabase.auth.signUp() from the Register page.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.publishers enable row level security;
alter table public.requests enable row level security;
alter table public.contact_messages enable row level security;

-- profiles: read/update your own; admins can read and update everyone's
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- publishers: anyone can browse; only admins can add/edit/remove listings
create policy "publishers_select_public" on public.publishers
  for select using (true);
create policy "publishers_insert_admin" on public.publishers
  for insert with check (public.is_admin());
create policy "publishers_update_admin" on public.publishers
  for update using (public.is_admin());
create policy "publishers_delete_admin" on public.publishers
  for delete using (public.is_admin());

-- requests: a business can create and read its own; admins can read/update all
create policy "requests_select_own_or_admin" on public.requests
  for select using (auth.uid() = business_id or public.is_admin());
create policy "requests_insert_own" on public.requests
  for insert with check (auth.uid() = business_id);
create policy "requests_update_admin" on public.requests
  for update using (public.is_admin());

-- contact_messages: anyone can submit, only admins can read them back
create policy "contact_insert_public" on public.contact_messages
  for insert with check (true);
create policy "contact_select_admin" on public.contact_messages
  for select using (public.is_admin());

-- ── Making yourself an admin ─────────────────────────────────────────
-- 1. Register a normal account through the site at /register.
-- 2. Supabase dashboard → Authentication → Users → copy your user's UUID.
-- 3. Run, with your own UUID:
--    update public.profiles set role = 'admin' where id = 'paste-uuid-here';
-- 4. Log out and back in on the site — you'll land on /admin instead of /dashboard.
