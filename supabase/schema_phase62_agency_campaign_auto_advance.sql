-- ChatSched — Phase 62 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase61_managed_campaign_client_view.sql.
--
-- Closes the one "not done" item named directly:
-- PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md — "`status` is manual, not
-- auto-advanced... No trigger moves a campaign from payment_pending to
-- planning when its linked requests are all paid... I didn't want to be
-- the first without live Postgres to test the trigger against." Same
-- standing limitation here — still no live Postgres to test this
-- against, see "Not done" below.
--
-- ── Scope: only payment_pending -> planning ──────────────────────────────
-- That's the one transition the original note names, and it's the one
-- with an unambiguous signal (every linked request paid). The other six
-- transitions (draft->proposed, planning->in_progress,
-- in_progress->reporting, ->completed, ->cancelled, and proposed-> either
-- direction) don't have an equivalent unambiguous trigger anywhere in
-- this schema — "in_progress" becoming "reporting" isn't derivable from
-- payment status, it's a judgment call about where the campaign actually
-- is, same as agency_campaigns.status being deliberately coarse in the
-- first place (see schema_phase60's own header). Auto-advancing those
-- would mean inventing criteria nobody asked for. They stay manual,
-- same reasoning as every other status field since Phase 2.
--
-- ── Two ways a campaign can reach "fully paid" ───────────────────────────
-- 1. A request/channel_request already linked to the campaign gets paid
--    (the case the original note describes).
-- 2. An already-paid request/channel_request gets linked to a
--    payment_pending campaign after the fact (AdminCampaigns.tsx's
--    "Link" button on an existing request) — less obvious, but the same
--    underlying condition ("every linked request is paid") becomes true
--    at that moment too, so it needs the same check.
-- Four trigger points cover both paths across both settlement types;
-- all four call the one shared function below rather than duplicating
-- the "is everything paid" query four times.
--
-- ── Why this can't just call agency_campaign_totals() ────────────────────
-- That function (schema_phase60) is admin-only by design — it raises for
-- any non-admin caller. A payment being marked paid almost never happens
-- in an authenticated-admin session (a business's own checkout,
-- payfast-notify's service-role client) — calling an admin-gated
-- function from inside a payment trigger would raise and abort the very
-- payment confirmation this is meant to react to. So
-- maybe_advance_agency_campaign() below re-implements the same "latest
-- payment per request, union channel_requests' own paid_at" query
-- directly, deliberately duplicated rather than shared, same
-- duplicate-with-a-comment precedent as the launch-credit math
-- (PHASE2_SUBSCRIPTIONS_DELIVERY.md) and the message-safety patterns
-- (PHASE3_MESSAGE_SAFETY_DELIVERY.md) — if agency_campaign_totals()'s
-- query ever changes, this needs updating by hand alongside it.

create or replace function public.maybe_advance_agency_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_linked integer;
  v_paid integer;
begin
  select status into v_status from public.agency_campaigns where id = p_campaign_id;

  -- Only meaningful from payment_pending. A no-op for every other status
  -- (including a repeat call after it's already advanced) rather than an
  -- error, since every trigger below calls this unconditionally and
  -- shouldn't need to know or care what state the campaign is in first.
  if v_status is distinct from 'payment_pending' then
    return;
  end if;

  select count(*), count(*) filter (where is_paid)
  into v_linked, v_paid
  from (
    select (p.status = 'paid') as is_paid
    from public.requests r
    left join lateral (
      select status
      from public.payments
      where request_id = r.id
      order by created_at desc
      limit 1
    ) p on true
    where r.agency_campaign_id = p_campaign_id
    union all
    select (cr.paid_at is not null) as is_paid
    from public.channel_requests cr
    where cr.agency_campaign_id = p_campaign_id
  ) combined;

  -- A campaign with nothing linked yet has "0 of 0 paid" — vacuously
  -- "all paid", but not a reason to advance anything.
  if v_linked = 0 or v_paid < v_linked then
    return;
  end if;

  update public.agency_campaigns
  set status = 'planning', updated_at = now()
  where id = p_campaign_id and status = 'payment_pending';

  if found then
    insert into public.admin_audit_log(admin_id, action, target_table, target_id, detail)
    values (
      null, -- system-originated, not a specific admin's action — admin_audit_log.admin_id already allows null
      'agency_campaign_status_auto_advanced',
      'agency_campaigns',
      p_campaign_id,
      jsonb_build_object(
        'from_status', 'payment_pending',
        'to_status', 'planning',
        'reason', 'all linked requests paid',
        'linked_requests', v_linked
      )
    );
  end if;
end;
$$;

comment on function public.maybe_advance_agency_campaign is
  'Advances one campaign from payment_pending to planning once every
   request/channel_request linked to it is paid. Only that transition —
   see this migration''s header for why the other six stay manual.
   security definer: needs to read payments/requests/channel_requests and
   write agency_campaigns/admin_audit_log regardless of who triggered it,
   which is almost never an authenticated admin. Logs to admin_audit_log
   with admin_id null rather than a new table for one event type.';

-- Path 1a: a payment attempt (requests' settlement path) becomes paid.
create or replace function public.trg_payments_advance_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select agency_campaign_id into v_campaign_id
  from public.requests where id = new.request_id;

  if v_campaign_id is not null then
    perform public.maybe_advance_agency_campaign(v_campaign_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payments_advance_campaign on public.payments;
create trigger trg_payments_advance_campaign
  after insert or update of status on public.payments
  for each row
  when (new.status = 'paid')
  execute function public.trg_payments_advance_campaign();

-- Path 1b: an already-paid request gets linked to a campaign after the
-- fact (AdminCampaigns.tsx's "Link" button).
create or replace function public.trg_requests_advance_campaign_on_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.maybe_advance_agency_campaign(new.agency_campaign_id);
  return new;
end;
$$;

drop trigger if exists trg_requests_advance_campaign_on_link on public.requests;
create trigger trg_requests_advance_campaign_on_link
  after insert or update of agency_campaign_id on public.requests
  for each row
  when (new.agency_campaign_id is not null)
  execute function public.trg_requests_advance_campaign_on_link();

-- Path 2: channel_requests' own direct settlement — covers both "paid_at
-- gets set on an already-linked request" and "an already-paid request
-- gets linked" in one trigger, since both live as columns on the same
-- row here (unlike requests, where payment status lives on a separate
-- table).
create or replace function public.trg_channel_requests_advance_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.maybe_advance_agency_campaign(new.agency_campaign_id);
  return new;
end;
$$;

drop trigger if exists trg_channel_requests_advance_campaign on public.channel_requests;
create trigger trg_channel_requests_advance_campaign
  after insert or update of paid_at, agency_campaign_id on public.channel_requests
  for each row
  when (new.paid_at is not null and new.agency_campaign_id is not null)
  execute function public.trg_channel_requests_advance_campaign();

-- One-time catch-up: the four triggers above only fire on new events
-- going forward. A campaign that was already fully paid before this
-- migration ran would otherwise stay stuck on payment_pending forever —
-- nothing about it changes again to re-trigger the check. Safe to run
-- more than once: maybe_advance_agency_campaign() is a no-op for
-- anything that isn't currently payment_pending.
do $$
declare
  v_campaign_id uuid;
begin
  for v_campaign_id in select id from public.agency_campaigns where status = 'payment_pending' loop
    perform public.maybe_advance_agency_campaign(v_campaign_id);
  end loop;
end $$;
