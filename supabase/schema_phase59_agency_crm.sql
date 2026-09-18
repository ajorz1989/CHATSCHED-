-- ChatSched — Phase 59 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase58_message_safety_patterns.sql.
--
-- Agency Core, part 1: the lead pipeline (/admin "Leads" tab) and the
-- client CRM (/admin "Clients" tab) — sections 25/26 of the pivot brief.
-- Deliberately NOT included here: the managed-campaign workflow itself
-- (lead → qualified → proposal → payment → planning → ... → renewal),
-- campaign packages, or agency margin tracking for managed campaigns.
-- Those need an actual `agency_campaigns` entity, which is a big enough
-- design surface (does it wrap `requests`/`channel_requests`, or is it
-- its own thing that spawns them?) to deserve its own migration rather
-- than being guessed at alongside the CRM foundation. See
-- PHASE5_AGENCY_CRM_DELIVERY.md for the reasoning and what's next.
--
-- ── The campaign-manager role decision ──────────────────────────────────
-- PHASE4_MARGIN_ECONOMICS_DELIVERY.md flagged this as the one open
-- question before Agency Core could start: is a campaign manager a new
-- profiles.role, or an admin with an assignment layered on top? Going
-- with the latter — campaign_manager_id below references profiles(id)
-- and is expected to be an admin account, not a new role or RLS tier.
-- Reasoning: ChatSched is solo-founder right now, so "who's the assigned
-- manager" is an accountability/display field (the brief's own words:
-- "Businesses should know who is responsible for their campaign where
-- appropriate"), not yet a real permission boundary — nobody needs to be
-- restricted to seeing only their assigned clients today. Introducing a
-- new role means a new RLS surface across every agency table, untestable
-- against real Postgres in this sandbox, to solve a problem that doesn't
-- exist yet. If/when ChatSched hires a second person who genuinely
-- shouldn't see every client, that's a natural follow-up migration:
-- add 'campaign_manager' to profiles' role check, and change every
-- `using (public.is_admin())` below to also check
-- `campaign_manager_id = auth.uid()`. Not enforced by a CHECK constraint
-- that campaign_manager_id actually IS an admin (Postgres CHECK can't
-- reference another table) — the admin-only UI only ever offers admin
-- accounts, so this is an application-level convention, not a
-- database-level guarantee, same honesty standard as other
-- app-level-only invariants noted elsewhere in this repo.

create table public.agency_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  -- Nullable — a lead can exist before anyone's signed up (cold outreach,
  -- a referral), and gets linked once/if they create an account.
  business_id uuid references public.profiles(id) on delete set null,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'campaign', 'renewal')),
  source text,
  estimated_value numeric check (estimated_value >= 0),
  campaign_manager_id uuid references public.profiles(id) on delete set null,
  notes text,
  next_action text,
  next_action_due timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agency_leads_stage_idx on public.agency_leads(stage);
create index agency_leads_campaign_manager_id_idx on public.agency_leads(campaign_manager_id);

create table public.agency_clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.profiles(id) on delete cascade,
  -- Distinguishes an ordinary self-service marketplace business (the
  -- vast majority of `profiles` rows — never touched by this table) from
  -- one ChatSched is actively managing. A row existing here at all
  -- already means "someone at ChatSched is tracking this relationship" —
  -- service_level says how deep that involvement goes, matching the
  -- brief's self-service/assisted/managed service levels.
  service_level text not null default 'self_service'
    check (service_level in ('self_service', 'assisted', 'managed')),
  campaign_manager_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.agency_leads(id) on delete set null,
  renewal_status text not null default 'none'
    check (renewal_status in ('none', 'upcoming', 'due', 'overdue', 'renewed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agency_clients_campaign_manager_id_idx on public.agency_clients(campaign_manager_id);

-- Deliberately no lifetime-spend or campaign-count column on
-- agency_clients — that's real, already-existing data on
-- payments/channel_requests, and a stored copy would just be one more
-- thing to keep in sync (and drift from) rather than a source of truth.
-- agency_client_totals() below computes it live, same reasoning
-- PHASE4_MARGIN_ECONOMICS_DELIVERY.md gives for not storing
-- commission/MRR figures either.

alter table public.agency_leads enable row level security;
alter table public.agency_clients enable row level security;

-- Both tables are ChatSched's own internal sales/account data — no
-- business or publisher participant to grant select to, unlike every
-- other table in this repo. Admin-only, full stop, same posture the
-- pivot brief demands for agency margin data specifically ("must never
-- be visible to businesses or publishers") applied here too since a
-- lead's estimated_value and a client's notes are exactly that kind of
-- internal-only information.
create policy agency_leads_admin_only on public.agency_leads
  for all using (public.is_admin()) with check (public.is_admin());

create policy agency_clients_admin_only on public.agency_clients
  for all using (public.is_admin()) with check (public.is_admin());

-- Lifetime spend + campaign count + last campaign date for one business,
-- summed across BOTH settlement paths — same fix
-- PHASE4_MARGIN_ECONOMICS_DELIVERY.md applied to the Analytics overview,
-- applied here so the Clients tab doesn't reintroduce the exact bug that
-- phase found (undercounting by only reading `payments`).
create or replace function public.agency_client_totals(p_business_id uuid)
returns table (lifetime_spend numeric, campaign_count integer, last_campaign_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    coalesce(sum(amount), 0) as lifetime_spend,
    count(*)::integer as campaign_count,
    max(paid_at) as last_campaign_at
  from (
    select amount, paid_at from public.payments
    where business_id = p_business_id and status = 'paid'
    union all
    select proposed_amount as amount, paid_at from public.channel_requests
    where business_id = p_business_id and paid_at is not null
  ) combined;
end;
$$;

comment on function public.agency_client_totals is
  'Admin-only. Sums both settlement paths (payments for the original
   social-media/PayFast flow, channel_requests for the 4 newer channels) —
   see analytics_get_overview in analytics_functions.sql for the same fix
   applied to the platform-wide totals.';

-- No updated_at trigger, matching every other table added since
-- schema_phase55 — every writer sets it explicitly.
