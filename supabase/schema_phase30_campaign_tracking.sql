-- ChatSched — Phase 30 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
-- Purely additive — nothing here removes a column, table, or row that's
-- already there.
--
-- What this adds: real campaign tracking. A business turns any campaign —
-- one booked through ChatSched (a `requests` or `channel_requests` row) or
-- a link they just want to track on its own — into a `campaigns` row with
-- a short redirect URL (chatsched.com/t/<slug>) and a UTM-tagged version of
-- their own destination URL, then watches clicks/visits/leads/conversions
-- come in against it.
--
-- ── Why two tables and two SECURITY DEFINER functions ───────────────────
-- `campaigns` and `campaign_events` are both locked down to "owner or admin
-- only" for SELECT — a business's destination URL and traffic numbers are
-- theirs, not public. But the whole point of a tracking link is that
-- strangers (people who were never going to log in) click it, and the
-- business's own website (a different origin entirely, no ChatSched
-- session) needs to report visits/leads/conversions back. Rather than
-- opening a wide "anyone can insert" policy on campaign_events — which
-- would let anyone stuff fake events into any campaign_id they can guess —
-- both paths go through a narrow, validated SECURITY DEFINER function
-- instead (same pattern as is_admin() / enforce_channel_request_transition()
-- elsewhere in this schema):
--   • resolve_campaign_link(slug)  — looks the slug up, logs the 'click'
--     itself, and hands back only the destination + UTM fields. This is
--     what /t/:slug calls before redirecting.
--   • track_campaign_event(slug, event_type, …) — logs a visit/lead/
--     conversion against a slug. This is what the embed snippet on the
--     business's own site calls.
-- Both are granted to `anon`, so they work from a logged-out browser on
-- chatsched.com or on the business's own domain — but neither exposes a
-- row ID, an owner, or lets the caller pick an arbitrary campaign_id
-- directly, and an unknown/archived slug just returns nothing rather than
-- raising (so a bad slug can't be used to fingerprint which slugs exist).

-- ── campaigns ─────────────────────────────────────────────────────────
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Optional link back to the ChatSched booking this campaign is tracking.
  -- Same either-or shape as disputes.request_id/channel_request_id, except
  -- here BOTH may also be null — a business can track a link that has
  -- nothing to do with a ChatSched booking at all (e.g. their own Facebook
  -- ad, tagged with ?utm_source=chatsched purely for their own records).
  request_id uuid references public.requests(id) on delete set null,
  channel_request_id uuid references public.channel_requests(id) on delete set null,
  name text not null,
  -- Short code used in the redirect URL: chatsched.com/t/<slug>.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  -- Where a click ultimately lands. Must be a real absolute URL — the
  -- redirect page refuses to forward anywhere else.
  destination_url text not null check (destination_url ~ '^https?://'),
  utm_source text not null default 'chatsched',
  utm_medium text not null default 'referral',
  utm_campaign text not null,
  utm_content text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  constraint campaigns_one_campaign_ref check (
    not (request_id is not null and channel_request_id is not null)
  )
);

create index campaigns_owner_id_idx on public.campaigns(owner_id);
create index campaigns_request_id_idx on public.campaigns(request_id) where request_id is not null;
create index campaigns_channel_request_id_idx on public.campaigns(channel_request_id) where channel_request_id is not null;

comment on table public.campaigns is
  'One row per tracking link a business creates. Locked to owner/admin for
   SELECT/INSERT/UPDATE/DELETE — the public-facing redirect and event
   logging paths go through resolve_campaign_link()/track_campaign_event()
   below instead of touching this table directly.';

alter table public.campaigns enable row level security;

create policy "campaigns_select_owner" on public.campaigns
  for select using (owner_id = auth.uid() or public.is_admin());

create policy "campaigns_insert_owner" on public.campaigns
  for insert with check (owner_id = auth.uid());

create policy "campaigns_update_owner" on public.campaigns
  for update using (owner_id = auth.uid() or public.is_admin());

create policy "campaigns_delete_owner" on public.campaigns
  for delete using (owner_id = auth.uid() or public.is_admin());

-- ── campaign_events ───────────────────────────────────────────────────
create table public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  event_type text not null check (event_type in ('click', 'visit', 'lead', 'conversion')),
  -- Optional rand value for a 'conversion' (e.g. order total) — never
  -- required, never assumed to be in any particular currency here.
  value numeric,
  meta jsonb not null default '{}'::jsonb,
  referrer text,
  -- A random id the business's own site generates and stores itself
  -- (localStorage/cookie) — NOT an IP address or any other directly
  -- identifying value, kept intentionally out of this table for POPIA
  -- reasons. Good enough to de-duplicate obvious double-fires, not
  -- intended as a precise unique-visitor count.
  visitor_id text,
  created_at timestamptz not null default now()
);

create index campaign_events_campaign_id_idx on public.campaign_events(campaign_id);
create index campaign_events_campaign_id_type_idx on public.campaign_events(campaign_id, event_type);
create index campaign_events_created_at_idx on public.campaign_events(created_at);

comment on table public.campaign_events is
  'Append-only. Deliberately has NO insert policy for anon/authenticated —
   every row is written by resolve_campaign_link() or track_campaign_event()
   (both SECURITY DEFINER, so they bypass RLS on insert), never directly by
   a client. SELECT is owner/admin-only, same as campaigns.';

alter table public.campaign_events enable row level security;

create policy "campaign_events_select_owner" on public.campaign_events
  for select using (
    exists (select 1 from public.campaigns c where c.id = campaign_events.campaign_id and c.owner_id = auth.uid())
    or public.is_admin()
  );

-- ── campaign_stats: per-campaign rollup ──────────────────────────────
-- security_invoker means this view runs with the *querying user's* RLS,
-- not the view owner's — so it's exactly as locked-down as querying
-- campaigns/campaign_events directly would be, with no separate grant
-- needed beyond the usual `select` on the view itself.
create or replace view public.campaign_stats
with (security_invoker = true) as
select
  c.id as campaign_id,
  c.owner_id,
  c.slug,
  c.name,
  c.status,
  count(*) filter (where e.event_type = 'click') as clicks,
  count(*) filter (where e.event_type = 'visit') as visits,
  count(*) filter (where e.event_type = 'lead') as leads,
  count(*) filter (where e.event_type = 'conversion') as conversions,
  coalesce(sum(e.value) filter (where e.event_type = 'conversion'), 0) as conversion_value,
  max(e.created_at) as last_event_at
from public.campaigns c
left join public.campaign_events e on e.campaign_id = c.id
group by c.id;

-- ── resolve_campaign_link: what /t/:slug calls ───────────────────────
create or replace function public.resolve_campaign_link(
  p_slug text,
  p_referrer text default null,
  p_visitor_id text default null
)
returns table (
  destination_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
begin
  select * into v_campaign from public.campaigns c where c.slug = p_slug and c.status = 'active';
  if not found then
    return; -- empty result set — the redirect page shows "link not active"
  end if;

  insert into public.campaign_events (campaign_id, event_type, referrer, visitor_id)
  values (v_campaign.id, 'click', p_referrer, p_visitor_id);

  return query select
    v_campaign.destination_url,
    v_campaign.utm_source,
    v_campaign.utm_medium,
    v_campaign.utm_campaign,
    v_campaign.utm_content;
end;
$$;

grant execute on function public.resolve_campaign_link(text, text, text) to anon, authenticated;

-- ── track_campaign_event: what the embed snippet calls ───────────────
-- Called from the business's own site (a different origin, no ChatSched
-- session) to report a visit/lead/conversion against a campaign slug.
-- 'click' is deliberately excluded here — clicks only ever come from
-- resolve_campaign_link(), so this function can't be used to inflate a
-- campaign's click count from outside the redirect flow.
create or replace function public.track_campaign_event(
  p_slug text,
  p_event_type text,
  p_value numeric default null,
  p_meta jsonb default '{}'::jsonb,
  p_referrer text default null,
  p_visitor_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  if p_event_type not in ('visit', 'lead', 'conversion') then
    raise exception 'invalid event_type for track_campaign_event: %', p_event_type;
  end if;

  select id into v_campaign_id from public.campaigns where slug = p_slug and status = 'active';
  if v_campaign_id is null then
    return; -- unknown/paused/archived slug — silently no-op, don't leak which slugs exist
  end if;

  insert into public.campaign_events (campaign_id, event_type, value, meta, referrer, visitor_id)
  values (v_campaign_id, p_event_type, p_value, coalesce(p_meta, '{}'::jsonb), p_referrer, p_visitor_id);
end;
$$;

grant execute on function public.track_campaign_event(text, text, numeric, jsonb, text, text) to anon, authenticated;
