-- ChatSched — Phase 27 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase26_response_time.sql.
--
-- Video/portfolio on publisher profiles — deliberately built to cost almost
-- nothing on free-tier hosting:
--
-- 1. "Intro video" is a LINK, not an upload. A publisher pastes their
--    existing YouTube/Vimeo/TikTok/Instagram video URL and it embeds on
--    their profile (see videoEmbed.ts) — the video itself lives on
--    YouTube/TikTok's own CDN. Zero storage cost, zero bandwidth cost,
--    and it's the format creators already have their best content in
--    anyway. There is deliberately no self-hosted video upload path.
--
-- 2. "Portfolio" is real image uploads (past campaign creatives) — small
--    enough that self-hosting a handful is reasonable even on Supabase's
--    free storage tier, capped hard: max 5 images, 3MB each, images only.
--    The size/type cap is enforced by the STORAGE BUCKET ITSELF
--    (file_size_limit + allowed_mime_types below) — not just client-side
--    validation, which a determined user could bypass by calling the
--    Storage API directly.

-- ── portfolio-images bucket ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-images', 'portfolio-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read — these are public profile assets, same visibility as the
-- publisher directory itself.
create policy portfolio_images_select_public
  on storage.objects for select
  using (bucket_id = 'portfolio-images');

-- A publisher may only write into a path starting with their own user id
-- (enforced convention: {auth.uid()}/{filename}) — the standard Supabase
-- Storage RLS pattern for "users can only touch their own folder".
create policy portfolio_images_insert_own_folder
  on storage.objects for insert
  with check (bucket_id = 'portfolio-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy portfolio_images_delete_own_folder
  on storage.objects for delete
  using (bucket_id = 'portfolio-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── publishers columns ───────────────────────────────────────────────────

alter table public.publishers
  add column intro_video_url text,
  add column portfolio_images text[] not null default '{}',
  add constraint portfolio_images_max_5 check (array_length(portfolio_images, 1) is null or array_length(portfolio_images, 1) <= 5);

comment on column public.publishers.intro_video_url is
  'A YouTube/Vimeo/TikTok/Instagram video URL the publisher already has —
   never a self-hosted file. See videoEmbed.ts for how each platform embeds.';
comment on column public.publishers.portfolio_images is
  'Public URLs of up to 5 images in the portfolio-images storage bucket
   (3MB/image cap enforced by the bucket itself, not just client-side).';

-- Extend the same self-update trigger from schema_phase18/19/20/21 so a
-- publisher can set these two new fields on their own row, same "derive
-- what's allowed, reset everything else" shape as before.
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
  return new;
end;
$$;

-- Trigger already exists (schema_phase18_creator_pricing.sql) and points at
-- this same function name, so no drop/recreate needed here.
