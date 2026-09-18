-- ChatSched — Phase 61 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase60_agency_campaigns.sql.
--
-- The client/business-facing half of the Campaign Command Centre (pivot
-- brief section 13) — the piece PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md
-- deliberately left for a follow-up phase, having built the admin side
-- only. A managed client currently has zero visibility into the fact
-- ChatSched is running a campaign for them beyond whatever a campaign
-- manager tells them outside the product.
--
-- ── Why RPCs, not a new SELECT policy on agency_campaigns ──────────────
-- agency_campaigns' own columns (name/objective/brief/target_audience/
-- budget/dates/status) are all things a client should see — nothing
-- there is the internal-only kind of field agency_leads/agency_clients
-- were built admin-only to protect (estimated_value, sales notes,
-- lead source). A plain "business can select their own campaigns"
-- policy would probably be fine on THIS table specifically.
--
-- Went with RPCs anyway, for two reasons that aren't about this table's
-- own columns:
-- 1. campaign_manager_id needs resolving to a display name, and
--    `profiles` has no general "read anyone's name" policy — a client
--    reading their manager's name would otherwise need a new, broader
--    profiles policy. A security-definer RPC that returns only
--    `full_name` (nothing else off `profiles`) is a narrower grant than
--    opening that table up.
-- 2. Consistency with agency_client_totals()/agency_campaign_totals()
--    (schema_phase59/60) — both already return a computed,
--    intentionally-narrow shape rather than exposing raw table access,
--    and a client-facing equivalent should read the same way rather
--    than being the one place in this migration set that works
--    differently.
--
-- Deliberately NOT exposed to the client here: agency_clients itself
-- (service_level, renewal_status, internal notes) and agency_leads
-- (pipeline stage, estimated_value, source) — both stay exactly as
-- admin-only as schema_phase59 built them. A client sees their
-- campaigns, not ChatSched's internal account record of them.

-- One managed client's campaigns, client-safe projection + the manager's
-- display name resolved server-side.
create or replace function public.get_my_managed_campaigns()
returns table (
  id uuid,
  name text,
  objective text,
  brief text,
  target_audience text,
  budget numeric,
  start_date date,
  end_date date,
  status text,
  campaign_manager_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    ac.id, ac.name, ac.objective, ac.brief, ac.target_audience, ac.budget,
    ac.start_date, ac.end_date, ac.status,
    mgr.full_name as campaign_manager_name,
    ac.created_at
  from public.agency_campaigns ac
  join public.agency_clients cl on cl.id = ac.client_id
  left join public.profiles mgr on mgr.id = ac.campaign_manager_id
  where cl.business_id = auth.uid()
  order by ac.created_at desc;
end;
$$;

comment on function public.get_my_managed_campaigns is
  'Client-facing. The calling business''s own managed campaigns — see
   this file''s header for why this is an RPC with a narrow projection
   rather than a SELECT policy on agency_campaigns.';

-- One campaign's rollup, same combined-both-flows math as
-- agency_campaign_totals() (schema_phase60) but gated on "the caller
-- owns this campaign" instead of admin — genuinely two different actors
-- asking a structurally identical question, not a refactor of the
-- admin one (which stays admin-only, untouched).
create or replace function public.get_my_managed_campaign_totals(p_campaign_id uuid)
returns table (linked_requests integer, paid_requests integer, total_spend numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.agency_campaigns ac
    join public.agency_clients cl on cl.id = ac.client_id
    where ac.id = p_campaign_id and cl.business_id = auth.uid()
  ) then
    raise exception 'Not your campaign';
  end if;

  return query
  select
    count(*)::integer as linked_requests,
    count(*) filter (where is_paid)::integer as paid_requests,
    coalesce(sum(amount) filter (where is_paid), 0) as total_spend
  from (
    select
      p.amount,
      (p.status = 'paid') as is_paid
    from public.requests r
    left join lateral (
      select amount, status
      from public.payments
      where request_id = r.id
      order by created_at desc
      limit 1
    ) p on true
    where r.agency_campaign_id = p_campaign_id
    union all
    select
      cr.proposed_amount as amount,
      (cr.paid_at is not null) as is_paid
    from public.channel_requests cr
    where cr.agency_campaign_id = p_campaign_id
  ) combined;
end;
$$;

comment on function public.get_my_managed_campaign_totals is
  'Client-facing. Same rollup as agency_campaign_totals(), gated on
   campaign ownership instead of admin.';

-- The linked bookings themselves — just enough to render a list and
-- link into the existing /campaigns/:id workspace, which already has its
-- own correct participant RLS (getWorkspaceCampaign in
-- src/lib/campaignWorkspace.ts) for the actual detail. Not duplicating
-- that page's data here on purpose.
create or replace function public.get_my_managed_campaign_bookings(p_campaign_id uuid)
returns table (
  id uuid,
  kind text,
  status text,
  amount numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.agency_campaigns ac
    join public.agency_clients cl on cl.id = ac.client_id
    where ac.id = p_campaign_id and cl.business_id = auth.uid()
  ) then
    raise exception 'Not your campaign';
  end if;

  return query
  select r.id, 'request'::text as kind, r.status, r.agreed_amount as amount, r.created_at
  from public.requests r
  where r.agency_campaign_id = p_campaign_id
  union all
  select cr.id, 'channel_request'::text as kind, cr.status, cr.proposed_amount as amount, cr.created_at
  from public.channel_requests cr
  where cr.agency_campaign_id = p_campaign_id
  order by created_at desc;
end;
$$;

comment on function public.get_my_managed_campaign_bookings is
  'Client-facing. Lists a managed campaign''s linked requests/channel_requests
   at just enough detail to link into /campaigns/:id for the real thing.';
