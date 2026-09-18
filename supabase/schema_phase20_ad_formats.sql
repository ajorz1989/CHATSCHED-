-- ChatSched — Phase 20 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase19_placement_types.sql.
--
-- Adds accepted_ad_formats to publishers: for the 4 request-flow channels
-- (website, radio, influencer, podcast) only — which of that channel's
-- standard advertising methods (see advertisingMethods on each channel
-- module, src/channels/*/index.ts) this creator has agreed to run. Set on
-- that channel's Creator Application form (PublisherApply.tsx) and
-- editable afterwards from the Creator Dashboard (AdFormatsPanel in
-- PublisherDashboardView.tsx). ChannelRequestForm.tsx filters the
-- business-facing format dropdown down to this list when it's set,
-- falling back to the channel's full standard list otherwise.

alter table public.publishers
  add column if not exists accepted_ad_formats text[];

-- Extend the existing self-update trigger (schema_phase18_creator_pricing.sql,
-- schema_phase19_placement_types.sql) so a non-admin owner can now also
-- change accepted_ad_formats, alongside price_per_post and placement_types —
-- everything else on the row is still reset to its stored value.
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

  -- A self-serve owner may only ever change price_per_post,
  -- placement_types, and accepted_ad_formats. Reset every other column to
  -- its stored value rather than maintaining an explicit column allowlist
  -- that would silently go stale the next time publishers gains a column.
  new := old;
  new.price_per_post := new_price;
  new.placement_types := new_placement_types;
  new.accepted_ad_formats := new_accepted_ad_formats;
  return new;
end;
$$;

-- Trigger already exists (schema_phase18_creator_pricing.sql) and points at
-- this same function name, so no drop/recreate needed here.
