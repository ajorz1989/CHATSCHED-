-- Phase 74: channels reference table + Sports/Events/Community channels
--
-- Converts channel_slug from the hardcoded CHECK constraints in
-- schema_phase17 to a real reference table — this is the "configurable
-- channel definitions" the Universal Advertising Inventory Expansion doc
-- asks for in its own Section 38 ("do not hard-code channel-specific
-- business rules... create configurable channel definitions"), and it's
-- also what schema_phase17's own column comment already flagged as a
-- coupling problem ("keep this check constraint in sync with ChannelSlug").
--
-- Deliberately NOT the doc's own suggested inventory_owners /
-- advertising_inventory / inventory_pricing schema (its Sections 2-5).
-- Checked directly against this schema before writing anything: publishers
-- + publisher_rate_cards (schema_phase38) + channel_requests already ARE a
-- working "owner lists priced inventory, business books it" system —
-- subscription-gated (schema_phase71/73), compliance-integrated
-- (schema_phase39/44), proof-tracked, payment-integrated. Building a
-- second, parallel system for three more channels would be exactly the
-- duplication the expansion doc itself repeatedly says not to do. Sports,
-- Events, and Community are added as three more entries in the *existing*
-- channel-module architecture (src/channels/<slug>/index.ts) instead —
-- same publishers row per owner, same rate cards per priced item, same
-- channel_requests booking flow, same everything downstream of it.
--
-- New channels ship with active=false: this repo's own history is that
-- placeholder channels with no real supply were removed outright, not
-- left half-built (see the comment at the top of channelTypes.ts). Per
-- the expansion doc's own Section 80/57 ("do not launch publicly just
-- because it exists in code" / "do not create fake marketplace
-- inventory"), these three go live only once real owners are verified —
-- flip active (and the matching Vite flag) on then. The publisher
-- application form works today for any registered slug regardless of
-- active, via a direct link (e.g. /publisher-apply?channel=sports) — so
-- real owners can be onboarded quietly before the public flag flips.

create table public.channels (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  category text not null check (category in ('digital', 'broadcast', 'sports', 'events', 'community')),
  active boolean not null default true,
  verification_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.channels is
  'Reference table for every channel_slug value publishers/channel_requests
   can carry. active=false means "registered but not publicly launched" —
   applications and admin can still see/use it, marketing/browse pages
   (getEnabledChannels()) hide it until flipped on. Keep in sync with
   ChannelSlug in src/lib/channelTypes.ts — that union type still needs its
   own update for compile-time safety, this table only removes the
   schema-migration step from adding a channel, not the code-review step.';

insert into public.channels (slug, name, category, active, verification_required, sort_order) values
  ('social-media', 'Social Media',            'digital',   true,  false, 0),
  ('influencer',   'Influencer',               'digital',   true,  false, 1),
  ('podcast',      'Podcast Sponsorships',     'broadcast', true,  false, 2),
  ('website',      'Website Advertising',      'digital',   true,  false, 3),
  ('radio',        'Radio',                    'broadcast', true,  false, 4),
  ('sports',       'Sports Teams & Leagues',   'sports',    false, true,  5),
  ('events',       'Events & Tournaments',     'events',    false, true,  6),
  ('community',    'Community Groups',         'community', false, true,  7)
on conflict (slug) do nothing;

alter table public.channels enable row level security;

-- Public, same visibility as the channel modules themselves in the UI —
-- a channel's existence and metadata isn't sensitive, only which owners
-- and inventory sit inside it are access-controlled (unchanged, at the
-- publishers/channel_requests level).
create policy "channels_select_all" on public.channels for select using (true);

create policy "channels_admin_write" on public.channels for all
  using (public.is_admin())
  with check (public.is_admin());

-- Swap the hardcoded CHECK constraints (auto-named by Postgres from their
-- ALTER TABLE / CREATE TABLE origin in schema_phase17) for a real FK.
-- Drop-then-add, not an edit to schema_phase17 itself, per this repo's
-- additive-migration convention.
alter table public.publishers drop constraint if exists publishers_channel_slug_check;
alter table public.publishers
  add constraint publishers_channel_slug_fkey foreign key (channel_slug) references public.channels(slug);

alter table public.channel_requests drop constraint if exists channel_requests_channel_slug_check;
alter table public.channel_requests
  add constraint channel_requests_channel_slug_fkey foreign key (channel_slug) references public.channels(slug);

-- Per-channel structured fields that don't apply across every channel type
-- (sport/competition/season for sports; event date/venue for events;
-- community type/reach estimate for community) — one nullable jsonb column
-- rather than a new table per vertical, or nullable typed columns that are
-- meaningless for the other four channels. Free-form on purpose: the
-- expansion doc's own Section 21 says not to force incompatible metrics to
-- appear equivalent, which a rigid shared schema would do. Read by each
-- channel module's own UI (src/channels/<slug>/), not queried structurally
-- — if a field here ever needs to be searched/filtered on, that's the
-- signal to promote it to a real typed column, not before.
alter table public.publishers add column if not exists channel_metadata jsonb;

comment on column public.publishers.channel_metadata is
  'Per-channel structured fields — e.g. {"sport":"Football","competition":"ABC
   Regional League","season":"2026"} for sports, {"event_name":"Cape Town
   Business Expo","event_date":"2026-11-14","venue":"CTICC"} for events,
   {"community_type":"neighbourhood","reach_estimate":2000} for community.
   Null for the original five channels, which have no equivalent need yet.';
