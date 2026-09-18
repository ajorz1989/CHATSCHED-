-- Phase 75: two more channels — Transport Media, Informal Retail
--
-- Same mechanism as schema_phase74: no new tables. The `channels` table
-- that migration created already has exactly the shape a new channel
-- needs (slug, name, category, active, verification_required); this is
-- an insert into it, not a schema change, plus widening the category
-- CHECK to admit two category values that didn't exist yet.

alter table public.channels drop constraint if exists channels_category_check;
alter table public.channels
  add constraint channels_category_check
  check (category in ('digital', 'broadcast', 'sports', 'events', 'community', 'transport', 'informal-retail'));

insert into public.channels (slug, name, category, active, verification_required, sort_order) values
  ('transport',        'Minibus Taxi & Transport Media', 'transport',        false, true, 8),
  ('informal-retail',  'Spaza Shops & Township Traders',  'informal-retail',  false, true, 9)
on conflict (slug) do nothing;

-- Same widening as schema_phase74 did for publishers/channel_requests —
-- the FK against channels(slug) already added there needs nothing further
-- here, since it references the table by slug, not a fixed list. Nothing
-- to alter on those two tables this time; this migration exists only to
-- seed the two new channel rows and their category values.
