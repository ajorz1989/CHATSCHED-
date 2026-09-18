-- ChatSched — Phase 65 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase64_admin_request_creation.sql.
--
-- "No package pricing / client payment collection for the campaign as a
-- whole" — the last item on PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md's "Not
-- done" list, still open after Phase 7 (client view + auto-advance) and
-- Phase 8 (admin request creation).
--
-- Numbering note: this was first drafted as schema_phase62 against a
-- pre-Phase-7 snapshot, before PHASE8_ADMIN_REQUEST_CREATION_DELIVERY.md's
-- own report surfaced that phase62/63 were already claimed
-- (agency_campaign_auto_advance / campaign_reporting_auto_advance) and
-- phase64 (admin_request_creation) had landed on top of both. Discarded
-- that draft entirely rather than renumber-and-hope — rebuilt from a
-- fresh read of this exact zip's actual phase64 state, same discipline
-- Phase 8's own report used when it hit the identical problem one
-- number earlier.
--
-- ── Scope call: one price on one campaign, not a reusable package catalog ──
-- The pivot brief's "campaign packages" reads as a bigger idea — a
-- catalog of named, reusable tiers a campaign manager picks from.
-- Building that catalog is a real, separate design surface with almost
-- nothing to go on beyond a one-line mention. What's unambiguous and
-- buildable now: a single price on a single agency_campaigns row, paid
-- once, instead of the client paying per linked request. A reusable
-- package catalog can layer on top of this later (a package_id FK and a
-- template table) without touching what's built here.
--
-- ── Payment mechanism: manual EFT, not a new PayFast integration ───────
-- channel_requests already deliberately uses manual bank transfer +
-- admin confirmation instead of PayFast, specifically because "the
-- payment mechanics genuinely differ" for that kind of relationship
-- (schema_phase17_channel_marketplace.sql's own words). A managed agency
-- client is at least as high-touch as that. Building a THIRD payment
-- rail (after PayFast checkout and PayFast subscriptions) as new,
-- never-run Deno edge-function code carries real risk for something
-- core-financial, with no way to test it against a live PayFast sandbox
-- from this environment. Reusing the exact submit-then-admin-confirms
-- shape channel_requests already has, applied to one field set on
-- agency_campaigns instead of a whole new table, keeps this additive and
-- low-risk.
--
-- ── Interaction with Phase 7's auto-advance, deliberately not touched ──
-- maybe_advance_agency_campaign() (schema_phase62_agency_campaign_auto_advance.sql)
-- moves payment_pending -> planning based on every LINKED
-- request/channel_request being paid. A package-priced campaign's
-- individual bookings may never show as paid at that level — the client
-- paid the package, not each booking — so that trigger simply won't fire
-- for a package-priced campaign, and will silently keep no-op'ing
-- (it's a no-op for anything not currently payment_pending, by its own
-- design, so this is safe, just inert here). Rather than editing that
-- function to also check package_payment_status — modifying another
-- phase's carefully-scoped, untested-against-real-Postgres trigger logic
-- without being able to verify it — AdminCampaigns.tsx's package-payment
-- confirmation action advances status to 'planning' itself, client-side,
-- in the same action, when the campaign is still payment_pending. Same
-- end state, zero risk to the existing trigger.

alter table public.agency_campaigns add column if not exists package_price numeric check (package_price is null or package_price >= 0);
alter table public.agency_campaigns add column if not exists package_payment_status text not null default 'unpaid'
  check (package_payment_status in ('unpaid', 'payment_submitted', 'paid'));
alter table public.agency_campaigns add column if not exists package_payment_reference text;
alter table public.agency_campaigns add column if not exists package_payment_submitted_at timestamptz;
alter table public.agency_campaigns add column if not exists package_paid_at timestamptz;

-- Client submits "I've made this payment" — the one narrow write a
-- non-admin gets on agency_campaigns, touching only these four fields
-- (not a raw UPDATE policy, which would need a trigger to fence which
-- columns a non-admin can touch — same "RPC over policy" reasoning
-- schema_phase61_managed_campaign_client_view.sql's header already
-- gives). Admin confirming receipt stays a plain UPDATE from
-- AdminCampaigns.tsx — admin already has full write access via
-- agency_campaigns_admin_only (schema_phase60), so that side needs no
-- new RPC.
create or replace function public.submit_managed_campaign_package_payment(p_campaign_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package_price numeric;
  v_status text;
begin
  select ac.package_price, ac.package_payment_status into v_package_price, v_status
  from public.agency_campaigns ac
  join public.agency_clients cl on cl.id = ac.client_id
  where ac.id = p_campaign_id and cl.business_id = auth.uid();

  if not found then
    raise exception 'Not your campaign';
  end if;
  if v_package_price is null then
    raise exception 'This campaign isn''t package-priced';
  end if;
  if v_status = 'paid' then
    raise exception 'Already paid';
  end if;
  if coalesce(trim(p_reference), '') = '' then
    raise exception 'Add a payment reference so this can be matched to your transfer';
  end if;

  update public.agency_campaigns
  set package_payment_status = 'payment_submitted',
      package_payment_reference = p_reference,
      package_payment_submitted_at = now(),
      updated_at = now()
  where id = p_campaign_id;
end;
$$;

comment on function public.submit_managed_campaign_package_payment is
  'Client-facing. Marks a package-priced campaign''s payment as
   submitted (mirrors channel_requests'' business-submits/admin-confirms
   shape) — touches only the four package_payment_* fields, nothing else
   on the row.';

-- get_my_managed_campaigns (schema_phase61) needs the new fields —
-- additive to the return shape, everything else unchanged from that
-- migration. NOT a plain CREATE OR REPLACE, though: Postgres rejects
-- replacing a RETURNS TABLE function when the column list itself
-- changes shape (confirmed directly — "cannot change return type of
-- existing function... Row type defined by OUT parameters is
-- different"), so the old signature has to be dropped first. Safe to do
-- unconditionally: this doesn't change what schema_phase61 or this file
-- ever intended, it's the same end state either way, just expressed in
-- a way Postgres will actually accept.
drop function if exists public.get_my_managed_campaigns();

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
  created_at timestamptz,
  package_price numeric,
  package_payment_status text,
  package_payment_reference text,
  package_paid_at timestamptz
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
    ac.created_at,
    ac.package_price, ac.package_payment_status, ac.package_payment_reference, ac.package_paid_at
  from public.agency_campaigns ac
  join public.agency_clients cl on cl.id = ac.client_id
  left join public.profiles mgr on mgr.id = ac.campaign_manager_id
  where cl.business_id = auth.uid()
  order by ac.created_at desc;
end;
$$;
