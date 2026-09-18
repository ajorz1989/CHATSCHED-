-- ChatSched — Phase 5 schema additions
-- Run once in the Supabase SQL editor, AFTER schema.sql, schema_phase2.sql,
-- and schema_phase3.sql. Purely additive — nothing here removes a column,
-- table, or row that's already there.
--
-- What this adds: publishers can now create their own account and apply
-- (previously "email us and we'll add your page" — see the old
-- Register.tsx), every application sits in pending_review until an admin
-- approves it, four publisher tiers, a trust score and a publisher score
-- built only from data that's actually real, and the reviews table can now
-- hold a publisher's review of a business, not just a business's review of
-- a publisher.
--
-- Two constraint names below (profiles_role_check, reviews_request_id_key)
-- are Postgres's standard auto-generated names for an unnamed column CHECK
-- and an unnamed single-column UNIQUE — very likely correct, but if either
-- DROP CONSTRAINT errors with "does not exist", run this first to get the
-- real name and swap it in:
--   select conname from pg_constraint where conrelid = 'public.<table>'::regclass;

-- ── profiles: publishers are now a real account type ──────────────────
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('business', 'admin', 'publisher'));

-- handle_new_user() previously always defaulted new signups to 'business'.
-- The new Register.tsx publisher tab passes role in signUp() metadata —
-- read it here, with the same fallback as before if it's absent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, company_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'business'),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

-- ── publishers: application fields, status, level, scores ─────────────
-- followers, engagement, category, platforms, bio, audience, price_per_post,
-- rating, reviews and verified already exist from schema.sql — reused
-- as-is below rather than duplicated under new names.
alter table public.publishers
  add column user_id uuid references auth.users(id) on delete set null,
  add column email text,
  add column mobile_number text,
  add column monthly_reach integer,
  add column languages text[] not null default '{}',
  add column account_age_months integer,
  add column posting_frequency text,
  add column business_name text,
  add column company_registration text,
  add column vat_number text,
  add column status text not null default 'approved'
    check (status in ('pending_review', 'approved', 'rejected', 'suspended')),
  add column level text
    check (level in ('rising', 'verified', 'premium', 'elite')),
  add column trust_score smallint not null default 0,
  add column publisher_score smallint not null default 0,
  add column email_verified boolean not null default false,
  add column phone_verified boolean not null default false,
  add column identity_verified boolean not null default false,
  add column admin_notes text,
  add column rejected_reason text,
  add column reviewed_at timestamptz;

comment on column public.publishers.status is
  'Every row you''ve added by hand through /admin defaults to approved (that''s what the column default is for) since you already vetted them yourself. New self-serve applications explicitly insert pending_review — see the Register.tsx publisher tab and the RLS policy below.';
comment on column public.publishers.user_id is
  'Null for anything added the old way through /admin — they''re not linked to a login. Set only when a publisher signs up and applies themselves. Letting an existing admin-added listing be "claimed" by a real login later is a nice follow-up, not something this migration does.';

-- ── reviews: allow a publisher's review of a business too ─────────────
-- Previously exactly one review per request, always business → publisher.
-- Now up to two: business → publisher (as before) and publisher → business
-- (new — usable once a publisher has an account linked via publishers.user_id).
alter table public.reviews
  add column author_role text not null default 'business'
    check (author_role in ('business', 'publisher')),
  add column communication_rating smallint check (communication_rating between 1 and 5),
  add column professionalism_rating smallint check (professionalism_rating between 1 and 5),
  add column quality_rating smallint check (quality_rating between 1 and 5),
  add column timeliness_rating smallint check (timeliness_rating between 1 and 5),
  add column value_rating smallint check (value_rating between 1 and 5);

alter table public.reviews drop constraint reviews_request_id_key;
alter table public.reviews add constraint reviews_request_author_unique
  unique (request_id, author_role);

create policy "reviews_insert_own_completed_publisher" on public.reviews
  for insert with check (
    author_role = 'publisher'
    and exists (
      select 1 from public.publishers p
      join public.requests r on r.publisher_id = p.id
      where p.user_id = auth.uid()
        and p.id = reviews.publisher_id
        and r.id = reviews.request_id
        and r.status = 'completed'
    )
  );

-- ── score calculation ───────────────────────────────────────────────
-- Both scores are built only from categories with real data behind them
-- right now (per the brief's "no fake data" rule). Response-time tracking
-- and a dispute/flag system don't exist yet, so "Fast Response" and "No
-- Disputes" are left out of trust_score entirely for now rather than
-- assumed full marks — same for "Response Time" and "Audience Quality" in
-- publisher_score. Each function normalises against only the weight that's
-- currently trackable, so a publisher with zero reviews isn't quietly
-- penalised or padded — add the missing pieces into the weighted sum once
-- you're tracking the real thing.

create or replace function public.calculate_trust_score(p_publisher_id uuid)
returns smallint language plpgsql as $$
declare
  v_publisher public.publishers%rowtype;
  v_weighted numeric := 0;
  v_available numeric := 0;
  v_review_avg numeric;
  v_completed integer;
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found then return 0; end if;

  v_available := v_available + 10;
  if v_publisher.email_verified then v_weighted := v_weighted + 10; end if;

  v_available := v_available + 10;
  if v_publisher.phone_verified then v_weighted := v_weighted + 10; end if;

  v_available := v_available + 15;
  if v_publisher.identity_verified then v_weighted := v_weighted + 15; end if;

  v_available := v_available + 10;
  if coalesce(v_publisher.account_age_months, 0) >= 6 then v_weighted := v_weighted + 10; end if;

  -- Falls back to the old single `rating` column for reviews left before
  -- this migration, so pre-existing review history still counts instead
  -- of quietly dropping to zero.
  select avg(coalesce(
      (communication_rating + professionalism_rating + quality_rating + timeliness_rating + value_rating) / 5.0,
      rating
    ))
    into v_review_avg
    from public.reviews
    where publisher_id = p_publisher_id and author_role = 'business';
  if v_review_avg is not null then
    v_available := v_available + 20;
    v_weighted := v_weighted + least(v_review_avg / 5.0, 1) * 20;
  end if;

  select count(*) into v_completed from public.requests
    where publisher_id = p_publisher_id and status = 'completed';
  if v_completed > 0 then
    v_available := v_available + 20;
    v_weighted := v_weighted + least(v_completed, 10) * 2;
  end if;

  if v_available = 0 then return 0; end if;
  return round(least(v_weighted / v_available * 100, 100));
end;
$$;

create or replace function public.calculate_publisher_score(p_publisher_id uuid)
returns smallint language plpgsql as $$
declare
  v_publisher public.publishers%rowtype;
  v_weighted numeric := 0;
  v_available numeric := 0;
  v_review_avg numeric;
  v_completed integer;
  v_resolved integer;
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found then return 0; end if;

  v_available := v_available + 30;
  v_weighted := v_weighted + least(coalesce(v_publisher.engagement, 0) / 10.0, 1) * 30;

  select count(*) filter (where status = 'completed'),
         count(*) filter (where status in ('completed', 'declined'))
    into v_completed, v_resolved
    from public.requests where publisher_id = p_publisher_id;
  if coalesce(v_resolved, 0) > 0 then
    v_available := v_available + 25;
    v_weighted := v_weighted + (v_completed::numeric / v_resolved) * 25;
  end if;

  select avg(coalesce(
      (communication_rating + professionalism_rating + quality_rating + timeliness_rating + value_rating) / 5.0,
      rating
    ))
    into v_review_avg
    from public.reviews
    where publisher_id = p_publisher_id and author_role = 'business';
  if v_review_avg is not null then
    v_available := v_available + 20;
    v_weighted := v_weighted + (v_review_avg / 5.0) * 20;
  end if;

  v_available := v_available + 5;
  v_weighted := v_weighted + least(coalesce(v_publisher.followers, 0) / 100000.0, 1) * 5;

  if v_available = 0 then return 0; end if;
  return round(least(v_weighted / v_available * 100, 100));
end;
$$;

-- Premium and Elite currently gate on followers (plus identity for Elite)
-- alone — the brief's softer bars (review quality, response time, campaign
-- history) aren't hard-gated here since most publishers won't have that
-- data yet. Use admin_notes plus a manual status override in /admin for
-- anyone who clears the follower bar but isn't ready in practice.
create or replace function public.assign_publisher_level(p_publisher_id uuid)
returns text language plpgsql as $$
declare
  v_publisher public.publishers%rowtype;
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found or v_publisher.status <> 'approved' then return null; end if;

  if v_publisher.followers >= 100000 and v_publisher.identity_verified then
    return 'elite';
  elsif v_publisher.followers >= 20000 then
    return 'premium';
  elsif v_publisher.followers >= 5000 and v_publisher.phone_verified
        and coalesce(v_publisher.account_age_months, 0) >= 6 then
    return 'verified';
  elsif v_publisher.followers >= 3000 then
    return 'rising';
  else
    return null;
  end if;
end;
$$;

create or replace function public.refresh_publisher_scores(p_publisher_id uuid)
returns void language plpgsql as $$
begin
  update public.publishers
     set trust_score = public.calculate_trust_score(p_publisher_id),
         publisher_score = public.calculate_publisher_score(p_publisher_id),
         level = public.assign_publisher_level(p_publisher_id)
   where id = p_publisher_id;
end;
$$;

create or replace function public.trg_refresh_scores_on_review()
returns trigger language plpgsql as $$
begin
  perform public.refresh_publisher_scores(new.publisher_id);
  return new;
end;
$$;

drop trigger if exists trg_review_score_refresh on public.reviews;
create trigger trg_review_score_refresh
  after insert or update on public.reviews
  for each row execute function public.trg_refresh_scores_on_review();

create or replace function public.trg_refresh_scores_on_request()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    perform public.refresh_publisher_scores(new.publisher_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_request_score_refresh on public.requests;
create trigger trg_request_score_refresh
  after update on public.requests
  for each row execute function public.trg_refresh_scores_on_request();

-- ── RLS: publishers ─────────────────────────────────────────────────
-- publishers_select_public is currently `using (true)` — every publisher,
-- regardless of review status, is publicly visible right now. Replacing
-- it is the actual mechanism that hides pending/rejected/suspended
-- applications from the public directory.
drop policy "publishers_select_public" on public.publishers;

create policy "publishers_select_approved_or_own_or_admin" on public.publishers
  for select using (
    status = 'approved' or auth.uid() = user_id or public.is_admin()
  );

-- publishers_insert_admin (existing) still covers adding a listing by hand
-- from /admin. This is the new path: a publisher applying for themselves,
-- always landing in pending_review — they can't self-approve.
create policy "publishers_insert_own_application" on public.publishers
  for insert with check (
    auth.uid() = user_id and status = 'pending_review'
  );
