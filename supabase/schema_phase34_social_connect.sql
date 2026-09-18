-- ChatSched — Phase 34 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- Backs the "Connect your social account" onboarding step: real OAuth
-- against each platform's official API (YouTube, Facebook Pages,
-- Instagram, TikTok — see supabase/DEPLOY.md's "Social account connect"
-- section for exactly why those four and not the rest of the PLATFORMS
-- list, and for the developer-app setup each one needs before this works).

-- Raw OAuth tokens. Deliberately NO RLS policies below beyond enabling RLS
-- itself — that means nobody can read or write this table through the
-- normal client, not even the publisher who owns the connection. Every
-- access goes through an Edge Function using the service role key
-- (social-oauth-callback to write, summarize-publisher-audience to read).
-- This is a decision, not an oversight: an access token is a credential,
-- and credentials don't belong in anything a browser can query directly.
create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'facebook_page', 'instagram', 'tiktok')),
  platform_user_id text not null,
  platform_username text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  -- Who authorized this — usually the publisher's own account, but keeping
  -- it separate from publisher_id in case a business ever connects on
  -- behalf of a publisher they manage (not built yet, just not foreclosed).
  connected_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publisher_id, platform)
);
alter table public.social_connections enable row level security;
comment on table public.social_connections is
  'No RLS policies on purpose — service_role only. See the comment above the CREATE TABLE.';

-- The non-sensitive, publicly-relevant numbers pulled FROM a connection
-- above — safe to show on a profile, and deliberately kept in a separate
-- table from the tokens so "what's shown publicly" and "what's a secret"
-- can never be confused by a future query.
create table public.publisher_platform_stats (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  platform text not null,
  follower_count integer not null default 0,
  platform_username text,
  avatar_url text,
  synced_at timestamptz not null default now(),
  unique (publisher_id, platform)
);
alter table public.publisher_platform_stats enable row level security;

create policy "Anyone can view publisher platform stats"
  on public.publisher_platform_stats for select
  using (true);
-- No insert/update/delete policy — writes only via service_role (the
-- callback function), same reasoning as social_connections above, just
-- with read access opened up since this half genuinely is public data.

alter table public.publishers add column if not exists ai_audience_summary text;
alter table public.publishers add column if not exists ai_audience_summary_generated_at timestamptz;

create index if not exists social_connections_publisher_id_idx on public.social_connections(publisher_id);
create index if not exists publisher_platform_stats_publisher_id_idx on public.publisher_platform_stats(publisher_id);
