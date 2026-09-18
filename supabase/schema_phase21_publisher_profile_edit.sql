-- ChatSched — Phase 21 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase20_ad_formats.sql.
--
-- Lets an approved publisher/creator edit their own basic profile details
-- from the Creator Dashboard (ProfileEditPanel in PublisherDashboardView.tsx):
-- name, category, province, city, suburb, bio, audience, mobile_number,
-- business_name, company_registration, vat_number. Extends the same
-- self-update trigger introduced in schema_phase18_creator_pricing.sql and
-- widened since (schema_phase19_placement_types.sql,
-- schema_phase20_ad_formats.sql) — everything NOT explicitly listed below
-- (status, trust_score, publisher_score, verification flags, admin_notes,
-- featured, channel_slug, etc.) is still reset to its stored value, so this
-- keeps scoring and moderation fields admin-only.

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

  -- A self-serve owner may only ever change the columns explicitly listed
  -- here. Reset every other column to its stored value rather than
  -- maintaining an explicit allowlist of what to *block*, which would
  -- silently go stale (and expose new columns) the next time publishers
  -- gains one.
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
  return new;
end;
$$;

-- Trigger already exists (schema_phase18_creator_pricing.sql) and points at
-- this same function name, so no drop/recreate needed here.
