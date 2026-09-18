-- ChatSched — Phase 104 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase103_content_studio_activation_tier.sql.
--
-- Profile photo/logo for publishers — audit finding: the Publisher type
-- has never had an image field at all. Every card, every profile page,
-- every dashboard header renders a two-letter initials badge on a CSS
-- gradient, for every publisher, with no way to change that. For a
-- marketplace whose whole pitch is "see the real creator/channel before
-- you book", that's the single highest-leverage visual fix available.
--
-- Follows the exact same shape as schema_phase27_portfolio.sql's
-- portfolio-images bucket: real upload, small hard cap enforced by the
-- bucket itself (not just client-side), own-folder RLS.

-- ── profile-images bucket ────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy profile_images_select_public
  on storage.objects for select
  using (bucket_id = 'profile-images');

-- Same "{auth.uid()}/{filename}" own-folder convention as portfolio-images.
create policy profile_images_insert_own_folder
  on storage.objects for insert
  with check (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy profile_images_delete_own_folder
  on storage.objects for delete
  using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- A publisher only ever has one profile photo — replacing it means
-- deleting the old object, not accumulating one per upload the way
-- portfolio does. update is required for that overwrite-in-place path
-- (upsert: true from the client) as well as delete-then-clear.
create policy profile_images_update_own_folder
  on storage.objects for update
  using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── publishers column ────────────────────────────────────────────────────

alter table public.publishers
  add column profile_image_url text;

comment on column public.publishers.profile_image_url is
  'Public URL of the publisher''s profile photo/logo in the profile-images
   storage bucket (2MB cap enforced by the bucket itself). Null falls back
   to the existing initials-on-swatch avatar everywhere it is rendered.';

-- ── publishers_public view: add the new column ───────────────────────────
-- Same view schema_phase82 built, plus profile_image_url — every other
-- column and the where clause are unchanged.

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
  status
from public.publishers
where status = 'approved';

comment on view public.publishers_public is
  'Safe public read surface for the marketplace directory — every column here is one the public-facing UI actually renders. Deliberately excludes email, mobile_number, business_name, company_registration, vat_number, admin_notes, rejected_reason, reviewed_at, payout_method, payout_details, payout_account_verified_at, authenticity_risk, authenticity_notes, authenticity_checked_at, email_verified, phone_verified, identity_verified, account_age_months, and posting_frequency. Query this instead of public.publishers for any public/marketplace-browsing read; use the base table only for a publisher''s own row (auth.uid() = user_id) or from an admin session.';

grant select on public.publishers_public to anon, authenticated;

-- ── enforce_publisher_self_update(): extend the self-serve whitelist ────
-- Latest version per schema_phase27_portfolio.sql — same "derive what's
-- allowed, reset everything else, reassign the whitelisted fields" shape,
-- with profile_image_url added alongside the other content fields a
-- publisher already manages themselves (bio, portfolio_images, etc.).
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
  return new;
end;
$$;

-- Trigger already exists (schema_phase18_creator_pricing.sql) and points at
-- this same function name, so no drop/recreate needed here.
