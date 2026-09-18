-- ChatSched — Phase 7 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase6.sql.
-- Adds the business side of Part 9: fields to collect (province, city,
-- industry, website, Facebook, Instagram), three verification flags, and a
-- trigger that keeps a business from ever setting its own verification —
-- only an admin (or a trusted server-side path, like the email-sync
-- trigger below) can flip those three columns.

alter table public.profiles
  add column province text,
  add column city text,
  add column industry text,
  add column website text,
  add column facebook_url text,
  add column instagram_url text,
  add column email_verified boolean not null default false,
  add column phone_verified boolean not null default false,
  add column business_verified boolean not null default false;

-- Backfill: anyone who already confirmed their email before this migration
-- ran should start at Bronze immediately, not zero — otherwise every
-- existing account, including your own, would show as unverified.
update public.profiles pr
   set email_verified = true
  from auth.users u
 where u.id = pr.id and u.email_confirmed_at is not null;

-- handle_new_user() has been redefined twice already (schema_phase5.sql
-- added the role branch); this adds one more field, same safe
-- create-or-replace as before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, company_name, phone, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'business'),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone',
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

-- Covers the other case: email confirmation is required, so it isn't
-- confirmed yet at signup — this fires when they click the link later.
create or replace function public.sync_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles set email_verified = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_email_verified on auth.users;
create trigger trg_sync_email_verified
  after update on auth.users
  for each row execute function public.sync_email_verified();

-- Without this, profiles_update_own_or_admin (schema.sql) would let a
-- business set business_verified = true on itself with an ordinary
-- update() call — RLS controls which rows you can touch, not which
-- columns. auth.uid() is null for the trusted trigger above (it's not a
-- client session), so that path still goes through; any real logged-in
-- non-admin gets these three columns silently reset to what they were.
create or replace function public.prevent_self_verification()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.email_verified := old.email_verified;
    new.phone_verified := old.phone_verified;
    new.business_verified := old.business_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_verification on public.profiles;
create trigger trg_prevent_self_verification
  before update on public.profiles
  for each row execute function public.prevent_self_verification();
