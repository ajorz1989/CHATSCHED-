-- ChatSched — Phase 19 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase18_creator_pricing.sql.
--
-- Adds placement_types to publishers: which social media post formats a
-- creator offers (Story, Feed post, Short-form video, Dedicated video,
-- Carousel, Bio link). Set on the Social Media Creator Application form
-- (PublisherApply.tsx) and editable afterwards from the Creator Dashboard
-- (PlacementTypesPanel in PublisherDashboardView.tsx). Only meaningful for
-- the social-media channel — other channels leave this null.

alter table public.publishers
  add column if not exists placement_types text[];

-- Extend the existing self-update trigger (schema_phase18_creator_pricing.sql)
-- so a non-admin owner can now also change placement_types, alongside
-- price_per_post — everything else on the row is still reset to its stored
-- value, same as before this migration.
create or replace function public.enforce_publisher_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_price numeric;
  new_placement_types text[];
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

  -- A self-serve owner may only ever change price_per_post and
  -- placement_types. Reset every other column to its stored value rather
  -- than maintaining an explicit column allowlist that would silently go
  -- stale the next time publishers gains a column.
  new := old;
  new.price_per_post := new_price;
  new.placement_types := new_placement_types;
  return new;
end;
$$;

-- Trigger already exists (schema_phase18_creator_pricing.sql) and points at
-- this same function name, so no drop/recreate needed here.
