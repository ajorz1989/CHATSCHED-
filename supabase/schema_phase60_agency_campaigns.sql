-- ChatSched — Phase 60 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase59_agency_crm.sql.
--
-- Agency Core, part 2: the managed-campaign workflow (pivot brief section
-- 12) and its Command Centre (section 13, scaled down — see
-- PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md for exactly what "scaled down"
-- means).
--
-- ── The wrap-vs-stand-alone decision ─────────────────────────────────────
-- PHASE5_AGENCY_CRM_DELIVERY.md flagged this as the question before this
-- phase could start. Wrapping: agency_campaigns is a thin orchestration
-- layer — client, manager, brief, budget, a small status set — and the
-- actual execution (deliverables, content approval, compliance, proof,
-- tracking) stays exactly where it already lives, on `requests` and
-- `channel_requests`, now taggable with a nullable agency_campaign_id.
-- Reasoning: that machinery is real, tested (well — compiled and
-- unit-tested; still never run against live Postgres, same standing
-- limitation as everything else), and used daily by the self-service
-- side. A parallel state machine on agency_campaigns duplicating
-- creative/approval/publication/proof would drift from the per-request
-- reality within a week. So agency_campaigns.status below is
-- deliberately coarse — draft/proposed/payment_pending/planning/
-- in_progress/reporting/completed/cancelled — collapsing the brief's
-- Creative/Client Approval/Publisher Execution/Publication/Proof/
-- Tracking into a single "in_progress, see the linked requests for
-- what's actually happening" phase, rather than a second copy of detail
-- that already exists per-request.

create table public.agency_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  campaign_manager_id uuid references public.profiles(id) on delete set null,
  name text not null,
  objective text,
  brief text,
  target_audience text,
  -- The proposed number, set at the Proposal stage — not the same as
  -- actual spend, which is agency_campaign_totals() below, computed live
  -- from whatever requests/channel_requests end up linked. They're
  -- expected to be close, not identical — a campaign can come in under
  -- or over the number it was proposed at.
  budget numeric check (budget >= 0),
  start_date date,
  end_date date,
  status text not null default 'draft'
    check (status in ('draft', 'proposed', 'payment_pending', 'planning', 'in_progress', 'reporting', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agency_campaigns_client_id_idx on public.agency_campaigns(client_id);
create index agency_campaigns_status_idx on public.agency_campaigns(status);

alter table public.requests add column if not exists agency_campaign_id uuid references public.agency_campaigns(id) on delete set null;
alter table public.channel_requests add column if not exists agency_campaign_id uuid references public.agency_campaigns(id) on delete set null;
create index if not exists requests_agency_campaign_id_idx on public.requests(agency_campaign_id) where agency_campaign_id is not null;
create index if not exists channel_requests_agency_campaign_id_idx on public.channel_requests(agency_campaign_id) where agency_campaign_id is not null;

alter table public.agency_campaigns enable row level security;

-- Admin-only, same as agency_leads/agency_clients — no business-facing
-- read yet. The brief's Campaign Command Centre (section 13) is
-- explicitly business-facing too ("Businesses should see..."), and this
-- phase deliberately doesn't build that half — see "Not done" in
-- PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md for why admin-first, not an
-- oversight.
create policy agency_campaigns_admin_only on public.agency_campaigns
  for all using (public.is_admin()) with check (public.is_admin());

-- Linking requests.agency_campaign_id / channel_requests.agency_campaign_id
-- doesn't need new RLS — both tables' existing select/update policies
-- (business sees own, publisher sees own, admin sees all) apply exactly
-- as before regardless of whether this column is set. A business whose
-- request happens to be part of a managed campaign still only sees their
-- own request, same as always — they don't get visibility into
-- agency_campaigns itself, or into other requests linked to the same one.

-- Live rollup for one campaign: how many requests are linked, how many
-- are actually paid, and total spend — summed across both settlement
-- paths (payments for the original flow via requests.id, channel_requests
-- paying for itself directly), same reasoning as agency_client_totals()
-- in schema_phase59. Nothing here is stored on agency_campaigns itself —
-- same "compute live, don't duplicate" choice made everywhere since
-- Phase 4's GMV fix.
create or replace function public.agency_campaign_totals(p_campaign_id uuid)
returns table (linked_requests integer, paid_requests integer, total_spend numeric)
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

comment on function public.agency_campaign_totals is
  'Admin-only. One campaign''s linked-request count, paid count, and
   total spend, live across both settlement paths. requests uses its
   latest payment attempt (same "latest, not sum" reasoning payfast-checkout
   already uses for retries); channel_requests pays for itself directly.';

-- No updated_at trigger, matching every table since schema_phase55 —
-- every writer sets it explicitly.
