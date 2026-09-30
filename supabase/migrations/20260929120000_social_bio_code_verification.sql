-- ChatSched — replace the OAuth "Connect social accounts" step with a
-- bio-code + screenshot verification an admin confirms by hand.
-- Live migration: 20260929120000_social_bio_code_verification
--
-- Why: the four OAuth apps behind ConnectSocialAccounts.tsx (YouTube,
-- Facebook Pages, Instagram, TikTok — schema_phase34_social_connect.sql)
-- each need their own platform app-review before a real publisher can use
-- them, so the button has never worked for anyone outside a test user.
-- It also only ever covers those four surfaces — never WhatsApp Channels,
-- Facebook Groups, X, LinkedIn, or a personal Instagram account, which is
-- exactly the audience this marketplace is meant to include. Discussed
-- with the platform owner directly (chat, 2026-09-29) and agreed: replace
-- it with something that needs no developer-app approval and works on
-- every platform — a one-time code the publisher posts in their own bio,
-- plus a screenshot of their own native analytics, both checked by an
-- admin. That's a stronger ownership proof than OAuth ever gave anyway —
-- OAuth proves someone logged in with valid credentials, not that the
-- follower numbers it imports are real; this proves the applicant
-- controls the specific public profile they claim, on any platform.
--
-- social_verification_links (jsonb, migration 20260926000132) already
-- holds the self-reported profile URLs an admin manually reviews — that
-- half is kept as-is. This migration adds the missing "prove you actually
-- own it" half: a per-publisher code plus an admin-only confirmation
-- flag, gating the same trg_enforce_publisher_channel_verification
-- trigger that already blocks approval without a submitted URL.
--
-- verification_proof_urls / the publisher-verification-proof bucket
-- (schema_phase97) are reused as-is for the analytics screenshot, rather
-- than a new column or bucket — that column was already generic (keyed by
-- publisher_id, not by channel), just previously only populated by
-- high-trust physical-placement channels.
--
-- social_connections / publisher_platform_stats (schema_phase34) are left
-- in place, per this project's additive-migrations-only convention — see
-- README/DEPLOY.md conventions notes. They're simply unused going
-- forward; nothing reads or writes them after this migration, since
-- ConnectSocialAccounts.tsx, social-oauth-start and social-oauth-callback
-- are deleted in this same change. ai_audience_summary now reads from
-- publisher-entered fields (followers/engagement/monthly_reach) and
-- social_verification_links instead of publisher_platform_stats — see
-- supabase/functions/summarize-publisher-audience/index.ts.

alter table public.publishers
  add column if not exists social_verification_code text,
  add column if not exists social_verification_code_generated_at timestamptz,
  add column if not exists social_verification_confirmed boolean not null default false,
  add column if not exists social_verification_confirmed_at timestamptz,
  add column if not exists social_verification_confirmed_by uuid references public.profiles(id);

comment on column public.publishers.social_verification_code is
  'A short code (e.g. CS-7K3P9) the publisher is asked to place in their public bio/description for ~24h, as proof they control the profile listed in social_verification_links. Generated via generate_social_verification_code(), never written directly by the client.';
comment on column public.publishers.social_verification_confirmed is
  'Set only by an admin (confirm_social_verification()), after checking the code is live in the publisher''s bio and reviewing their uploaded analytics screenshot (verification_proof_urls). Distinct from publishers.verified, which also covers email/phone verification unrelated to social ownership.';

create index if not exists publishers_social_verification_confirmed_idx
  on public.publishers(social_verification_confirmed) where channel_slug = 'social-media';

-- ── Generation: publisher-callable, but the code itself and the reset
-- behaviour below both need to happen atomically server-side rather than
-- as a plain client .update() (weak client-side randomness aside, a raw
-- update could set a confirmed-sounding value or skip resetting
-- confirmation on regenerate). Same reasoning as every other stateful
-- action in this codebase going through an RPC rather than a bare table
-- write (approve_publisher_application, refresh_publisher_scores, etc).
create or replace function public.generate_social_verification_code(p_publisher_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_owner uuid;
  v_code text;
begin
  select user_id into v_owner from public.publishers where id = p_publisher_id;
  if v_owner is null then
    raise exception 'Publisher not found.';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Not your listing.';
  end if;

  -- CS-XXXXX, uppercase base36 from random bytes — short enough to type
  -- into a bio field, long enough that guessing it isn't a realistic path
  -- to a false-positive verification.
  v_code := 'CS-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 5));

  update public.publishers
  set
    social_verification_code = v_code,
    social_verification_code_generated_at = now(),
    -- Regenerating retires any prior confirmation — the code an admin
    -- last checked is no longer the one live in the bio, so a stale
    -- "confirmed" would be a false trust signal, not a convenience.
    social_verification_confirmed = false,
    social_verification_confirmed_at = null,
    social_verification_confirmed_by = null
  where id = p_publisher_id;

  return v_code;
end;
$$;

revoke execute on function public.generate_social_verification_code(uuid) from public, anon;
grant execute on function public.generate_social_verification_code(uuid) to authenticated;

-- ── Confirmation: admin-only. Mirrors approve_publisher_application's own
-- is_admin() guard shape exactly.
create or replace function public.confirm_social_verification(p_publisher_id uuid, p_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can confirm social verification.';
  end if;

  update public.publishers
  set
    social_verification_confirmed = p_confirmed,
    social_verification_confirmed_at = case when p_confirmed then now() else null end,
    social_verification_confirmed_by = case when p_confirmed then auth.uid() else null end
  where id = p_publisher_id;
end;
$$;

revoke execute on function public.confirm_social_verification(uuid, boolean) from public, anon;
grant execute on function public.confirm_social_verification(uuid, boolean) to authenticated;

-- ── Defence in depth, same "enforced twice, deliberately" posture as
-- phase18's enforce_publisher_self_update: the RPCs above are the
-- intended path, this trigger is what actually stops a non-admin from
-- getting the same result by writing to the columns directly (the
-- publisher already has a general publishers_update_own UPDATE policy
-- from phase18, which is row-level, not column-level — Postgres RLS has
-- no per-column grant, so this is the only real backstop).
create or replace function public.enforce_social_verification_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  -- Only block a CHANGE that requires admin authority — comparing against
  -- old, not just inspecting new, matters here: once a publisher is
  -- verified, an ordinary unrelated update (e.g. editing their bio) still
  -- carries the existing confirmed=true value forward on new (Postgres
  -- fills unspecified columns from old), and a naive "is new.confirmed
  -- true?" check would wrongly block that unrelated edit forever. Two
  -- transitions must both stay legal for a non-admin: no-op (old = new,
  -- whatever it is), and generate_social_verification_code()'s own reset
  -- to false/null. What must stay blocked: a non-admin flipping it TO
  -- true, or writing a non-null confirmed_at/confirmed_by, either of
  -- which only a real admin confirmation should ever produce.
  if new.social_verification_confirmed is distinct from old.social_verification_confirmed
     and coalesce(new.social_verification_confirmed, false) = true then
    raise exception using
      errcode = '42501',
      message = 'Social verification can only be confirmed by a ChatSched admin.';
  end if;

  if (
    new.social_verification_confirmed_at is distinct from old.social_verification_confirmed_at
    or new.social_verification_confirmed_by is distinct from old.social_verification_confirmed_by
  ) and (
    new.social_verification_confirmed_at is not null
    or new.social_verification_confirmed_by is not null
  ) then
    raise exception using
      errcode = '42501',
      message = 'Social verification can only be confirmed by a ChatSched admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_social_verification_self_update on public.publishers;
create trigger trg_enforce_social_verification_self_update
  before update on public.publishers
  for each row
  execute function public.enforce_social_verification_self_update();

-- ── Raise the Social Media approval bar: a submitted URL used to be
-- enough (enforce_publisher_channel_verification, migration
-- 20260926000132). Now that a stronger check exists, require it — an
-- admin confirming the code is genuinely live is what this whole
-- migration is for; leaving the old bar in place would make the new
-- fields decorative.
create or replace function public.enforce_publisher_channel_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_requires_verification boolean := false;
  v_is_social boolean := false;
  v_requires_check boolean := false;
  v_checks_valid boolean := false;
  v_has_proof boolean := false;
  v_is_becoming_approved boolean := false;
begin
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  select coalesce(c.verification_required, false)
    into v_requires_verification
  from public.channels c
  where c.slug = new.channel_slug;

  v_is_social := new.channel_slug = 'social-media';

  v_is_becoming_approved :=
    (tg_op = 'INSERT' and (new.status = 'approved' or new.verified = true))
    or (
      tg_op = 'UPDATE'
      and (
        (old.status is distinct from 'approved' and new.status = 'approved')
        or (old.verified is distinct from true and new.verified = true)
        or (
          old.channel_slug is distinct from new.channel_slug
          and (new.status = 'approved' or new.verified = true)
        )
      )
    );

  v_requires_check := v_requires_verification and v_is_becoming_approved;

  if v_requires_check then
    select exists (
      select 1
      from public.publisher_verification_checks vc
      where vc.publisher_id = new.id
        and vc.channel_slug = new.channel_slug
        and vc.checks_total > 0
        and cardinality(vc.checks_confirmed) = vc.checks_total
        and cardinality(
          array(
            select distinct x
            from unnest(vc.checks_confirmed) as u(x)
          )
        ) = vc.checks_total
    )
    into v_checks_valid;

    v_has_proof := coalesce(array_length(new.verification_proof_urls, 1), 0) > 0;

    if not v_checks_valid then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification is incomplete. Every required verification check must be confirmed before this publisher can be approved or verified.';
    end if;

    if not v_has_proof then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification requires at least one verification evidence file before this publisher can be approved or verified.';
    end if;
  end if;

  if v_is_social and v_is_becoming_approved then
    if jsonb_typeof(new.social_verification_links) <> 'array'
       or jsonb_array_length(new.social_verification_links) = 0 then
      raise exception using
        errcode = '23514',
        message = 'Social Media verification requires at least one public social profile URL.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(new.social_verification_links) as link
      where coalesce(link->>'platform', '') = ''
         or coalesce(link->>'url', '') = ''
         or (link->>'url') !~* '^https?://'
    ) then
      raise exception using
        errcode = '23514',
        message = 'Every Social Media verification link must include a platform and a valid http or https URL.';
    end if;

    -- The new bar: an admin must have confirmed the bio code and
    -- screenshot for the *current* code (confirmation is reset by
    -- generate_social_verification_code on every regenerate, so this
    -- can't be stale).
    if not coalesce(new.social_verification_confirmed, false) then
      raise exception using
        errcode = '23514',
        message = 'Social Media verification requires an admin to confirm the bio verification code before approval.';
    end if;
  end if;

  return new;
end;
$$;

-- approve_publisher_application: needs a real edit, not just the trigger
-- above. That trigger opens with `if public.is_admin() ... then return
-- new`, which is correct for its actual job — stopping a NON-admin write
-- from reaching status='approved'/verified=true through some other path
-- (none currently exists: publishers_update_own's whitelist, above,
-- never lets a publisher touch status or verified at all) — but it also
-- means the trigger's checks are bypassed for every REAL approval, since
-- approve_publisher_application() only runs under an admin session by its
-- own is_admin() guard below. So the social_verification_confirmed
-- requirement has to be enforced here, inside the function that actually
-- executes, or it's decorative. While here: the same was already true of
-- the social_verification_links (URL) check — it had no function-level
-- enforcement either, only the trigger (dead for this path) and a
-- client-side check in Admin.tsx's handleApproveClick(), which is real
-- protection against the UI but not against a direct RPC call. Both are
-- added below, following the exact shape the existing v_requires_verification
-- branch already uses for high-trust channels.
create or replace function public.approve_publisher_application(
  p_publisher_id uuid,
  p_checks_confirmed text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_channel_slug text;
  v_requires_verification boolean := false;
  v_is_social boolean := false;
  v_social_links jsonb;
  v_social_confirmed boolean;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve publisher applications.';
  end if;

  select
    p.channel_slug,
    coalesce(c.verification_required, false),
    (p.channel_slug = 'social-media'),
    p.social_verification_links,
    p.social_verification_confirmed
  into
    v_channel_slug,
    v_requires_verification,
    v_is_social,
    v_social_links,
    v_social_confirmed
  from public.publishers p
  left join public.channels c on c.slug = p.channel_slug
  where p.id = p_publisher_id;

  if v_channel_slug is null then
    raise exception 'Publisher application not found.';
  end if;

  if v_requires_verification then
    if cardinality(coalesce(p_checks_confirmed, '{}')) = 0 then
      raise exception 'All high-trust verification checks must be confirmed before approval.';
    end if;

    insert into public.publisher_verification_checks (
      publisher_id,
      channel_slug,
      checks_confirmed,
      checks_total,
      updated_by,
      updated_at
    )
    values (
      p_publisher_id,
      v_channel_slug,
      p_checks_confirmed,
      cardinality(p_checks_confirmed),
      auth.uid(),
      now()
    )
    on conflict (publisher_id) do update
      set channel_slug = excluded.channel_slug,
          checks_confirmed = excluded.checks_confirmed,
          checks_total = excluded.checks_total,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
  end if;

  if v_is_social then
    if jsonb_typeof(v_social_links) <> 'array' or jsonb_array_length(v_social_links) = 0 then
      raise exception 'Social Media verification requires at least one public social profile URL.';
    end if;
    if not coalesce(v_social_confirmed, false) then
      raise exception 'Social Media verification requires an admin to confirm the bio verification code before approval.';
    end if;
  end if;

  update public.publishers
  set
    status = 'approved',
    verified = case when v_requires_verification or v_is_social then true else verified end,
    reviewed_at = now(),
    rejected_reason = null
  where id = p_publisher_id;
end;
$$;

revoke execute on function public.approve_publisher_application(uuid, text[]) from public, anon, authenticated;
grant execute on function public.approve_publisher_application(uuid, text[]) to authenticated;

-- ── enforce_publisher_self_update(): extend the self-serve whitelist ────
-- Without this, a real, silent bug: this trigger (schema_phase104, latest
-- version) runs `new := old` then reassigns only its own whitelisted
-- fields, for ANY update statement on this table regardless of who issued
-- it — including from inside generate_social_verification_code() above,
-- since a normal trigger fires for every UPDATE no matter the calling
-- function's SECURITY DEFINER context (auth.uid() still resolves to the
-- real calling publisher, not the function owner, so this trigger's own
-- is_admin()-or-null bypass would NOT apply to a publisher's own call).
-- Without adding the new columns here, a publisher calling
-- generate_social_verification_code() would get back a code that looks
-- like it saved (no exception raised) but is silently reverted to its old
-- value by this trigger within the same statement. social_verification_links
-- is added too — it was never in this whitelist at all, so publishers could
-- only ever set it once, at application INSERT time; this lets them
-- add/edit profile links from the dashboard afterwards, which the new
-- verification panel needs.
create or replace function public.enforce_publisher_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_price numeric;
  new_placement_types text[];
  new_accepted_ad_formats text[];
  new_name text;
  new_category text;
  new_province text;
  new_city text;
  new_suburb text;
  new_bio text;
  new_audience text;
  new_mobile_number text;
  new_business_name text;
  new_company_registration text;
  new_vat_number text;
  new_intro_video_url text;
  new_portfolio_images text[];
  new_profile_image_url text;
  new_social_verification_links jsonb;
  new_social_verification_code text;
  new_social_verification_code_generated_at timestamptz;
  new_social_verification_confirmed boolean;
  new_social_verification_confirmed_at timestamptz;
  new_social_verification_confirmed_by uuid;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if old.user_id is null or old.user_id <> auth.uid() then
    raise exception 'You can only update your own listing.';
  end if;

  new_price := new.price_per_post;
  if new_price is null or new_price < 50 then
    raise exception 'Price must be at least R50.';
  end if;

  new_placement_types := new.placement_types;
  new_accepted_ad_formats := new.accepted_ad_formats;

  new_name := coalesce(nullif(trim(new.name), ''), old.name);
  new_category := coalesce(new.category, old.category);
  new_province := coalesce(nullif(trim(new.province), ''), old.province);
  new_city := coalesce(nullif(trim(new.city), ''), old.city);
  new_suburb := new.suburb;
  new_bio := new.bio;
  new_audience := new.audience;
  new_mobile_number := new.mobile_number;
  new_business_name := new.business_name;
  new_company_registration := new.company_registration;
  new_vat_number := new.vat_number;
  new_intro_video_url := new.intro_video_url;
  new_portfolio_images := new.portfolio_images;
  new_profile_image_url := new.profile_image_url;
  -- Whatever's already on `new` at this point in the trigger chain — the
  -- caller's own client update, or a value another BEFORE trigger earlier
  -- in the chain (alphabetically: trg_enforce_publisher_channel_verification
  -- runs before trg_enforce_publisher_self_update) already set. Capturing
  -- it here and reassigning after `new := old` is what makes it survive.
  new_social_verification_links := new.social_verification_links;
  new_social_verification_code := new.social_verification_code;
  new_social_verification_code_generated_at := new.social_verification_code_generated_at;
  new_social_verification_confirmed := new.social_verification_confirmed;
  new_social_verification_confirmed_at := new.social_verification_confirmed_at;
  new_social_verification_confirmed_by := new.social_verification_confirmed_by;

  new := old;
  new.price_per_post := new_price;
  new.placement_types := new_placement_types;
  new.accepted_ad_formats := new_accepted_ad_formats;
  new.name := new_name;
  new.category := new_category;
  new.province := new_province;
  new.city := new_city;
  new.suburb := new_suburb;
  new.bio := new_bio;
  new.audience := new_audience;
  new.mobile_number := new_mobile_number;
  new.business_name := new_business_name;
  new.company_registration := new_company_registration;
  new.vat_number := new_vat_number;
  new.intro_video_url := new_intro_video_url;
  new.portfolio_images := new_portfolio_images;
  new.profile_image_url := new_profile_image_url;
  new.social_verification_links := new_social_verification_links;
  new.social_verification_code := new_social_verification_code;
  new.social_verification_code_generated_at := new_social_verification_code_generated_at;
  new.social_verification_confirmed := new_social_verification_confirmed;
  new.social_verification_confirmed_at := new_social_verification_confirmed_at;
  new.social_verification_confirmed_by := new_social_verification_confirmed_by;
  return new;
end;
$$;

-- Trigger already exists (schema_phase18_creator_pricing.sql) and points at
-- this same function name, so no drop/recreate needed here.

-- Note on trigger ordering: Postgres fires same-event triggers in name
-- order. trg_enforce_publisher_channel_verification,
-- trg_enforce_publisher_self_update, and
-- trg_enforce_social_verification_self_update all fire before-update, in
-- that alphabetical order — channel_verification's checks run against
-- whatever `new` already holds (the raw client/RPC values, unmodified by
-- the other two triggers, since it runs first), which is what we want:
-- it's validating the actual intended new state, not a value some other
-- trigger already normalized.

-- ── publishers_public: expose the one new column a business browsing the
-- directory should actually see — whether Social Media verification was
-- confirmed. Not the code itself (irrelevant once posted, and no reason
-- to hand out the exact string), not confirmed_at/confirmed_by (internal
-- admin detail). Every other column below is copied from
-- schema_phase104_publisher_profile_image.sql's own view unchanged.
create or replace view public.publishers_public
with (security_invoker = false)
as
select
  id,
  user_id,
  name,
  city,
  province,
  suburb,
  category,
  platforms,
  placement_types,
  accepted_ad_formats,
  channel_slug,
  channel_metadata,
  followers,
  engagement,
  price_per_post,
  rating,
  reviews,
  verified,
  bio,
  audience,
  initials,
  swatch,
  created_at,
  languages,
  level,
  trust_score,
  publisher_score,
  avg_response_hours,
  response_count,
  last_active_at,
  ai_audience_summary,
  ai_audience_summary_generated_at,
  intro_video_url,
  portfolio_images,
  profile_image_url,
  featured,
  featured_until,
  completed_campaigns,
  resolved_campaigns,
  status,
  social_verification_confirmed
from public.publishers
where status = 'approved';

comment on view public.publishers_public is
  'Safe public read surface for the marketplace directory — every column here is one the public-facing UI actually renders. Deliberately excludes email, mobile_number, business_name, company_registration, vat_number, admin_notes, rejected_reason, reviewed_at, payout_method, payout_details, payout_account_verified_at, authenticity_risk, authenticity_notes, authenticity_checked_at, email_verified, phone_verified, identity_verified, account_age_months, posting_frequency, social_verification_links, social_verification_code, social_verification_code_generated_at, social_verification_confirmed_at, and social_verification_confirmed_by. Query this instead of public.publishers for any public/marketplace-browsing read; use the base table only for a publisher''s own row (auth.uid() = user_id) or from an admin session.';

grant select on public.publishers_public to anon, authenticated;

