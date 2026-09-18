-- Phase 76: Local Associations & Business Networks channel
--
-- Same mechanism as schema_phase75: no new table, an insert into the
-- `channels` table schema_phase74 created, plus widening its category
-- CHECK for one more value.

alter table public.channels drop constraint if exists channels_category_check;
alter table public.channels
  add constraint channels_category_check
  check (category in ('digital', 'broadcast', 'sports', 'events', 'community', 'transport', 'informal-retail', 'associations'));

insert into public.channels (slug, name, category, active, verification_required, sort_order) values
  ('associations', 'Local Associations & Business Networks', 'associations', false, true, 10)
on conflict (slug) do nothing;
