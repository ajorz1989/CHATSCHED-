-- ChatSched — Phase 66 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase65_campaign_packages.sql.
--
-- The second of the two smaller polish items PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md
-- flagged and every phase since left open: a managed client currently
-- has to go check the dashboard to notice a campaign's status changed or
-- a new booking got linked to it. Every other status-change surface in
-- this app (content approval, deliverables, disputes, messages) already
-- notifies; this one didn't yet.
--
-- Fires on the plain UPDATE OF status regardless of what caused it —
-- an admin's manual change in AdminCampaigns.tsx, the auto-advance
-- trigger from schema_phase62/63, or the client-side status bump
-- schema_phase65's package-payment confirmation makes. One trigger,
-- same notification either way, since the business shouldn't need to
-- know or care which of those moved their campaign forward.

create or replace function public.notify_agency_campaign_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_label text;
begin
  if new.status = old.status then
    return new;
  end if;

  select cl.business_id into v_business_id
  from public.agency_clients cl
  where cl.id = new.client_id;

  if v_business_id is null then
    return new;
  end if;

  v_label := case new.status
    when 'draft' then 'being planned'
    when 'proposed' then 'proposed'
    when 'payment_pending' then 'awaiting payment'
    when 'planning' then 'in planning'
    when 'in_progress' then 'in progress'
    when 'reporting' then 'wrapping up'
    when 'completed' then 'completed'
    when 'cancelled' then 'cancelled'
    else new.status
  end;

  perform public.create_notification(
    v_business_id,
    'agency_campaign_status_change',
    format('%s is now %s', new.name, v_label),
    'See what''s changed on your dashboard.',
    '/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_agency_campaign_status_change on public.agency_campaigns;
create trigger trg_notify_agency_campaign_status_change
  after update of status on public.agency_campaigns
  for each row execute function public.notify_agency_campaign_status_change();

-- ── New booking linked to a managed campaign ────────────────────────────
-- Fires the moment agency_campaign_id goes from null (or a different
-- campaign) to a value — covers both AdminCampaigns.tsx's own "Link"
-- action and CreateRequestForClient.tsx (schema_phase64) setting it at
-- creation time in the same insert, since both are just an UPDATE/INSERT
-- of this one column either way.

create or replace function public.notify_booking_linked_to_agency_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_name text;
begin
  if new.agency_campaign_id is null then
    return new;
  end if;
  if old is not null and new.agency_campaign_id is not distinct from old.agency_campaign_id then
    return new;
  end if;

  select name into v_campaign_name from public.agency_campaigns where id = new.agency_campaign_id;
  if v_campaign_name is null then
    return new;
  end if;

  perform public.create_notification(
    new.business_id,
    'agency_campaign_status_change',
    format('A new booking was added to %s', v_campaign_name),
    'See it on your dashboard.',
    '/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_request_linked_to_agency_campaign on public.requests;
create trigger trg_notify_request_linked_to_agency_campaign
  after insert or update of agency_campaign_id on public.requests
  for each row execute function public.notify_booking_linked_to_agency_campaign();

drop trigger if exists trg_notify_channel_request_linked_to_agency_campaign on public.channel_requests;
create trigger trg_notify_channel_request_linked_to_agency_campaign
  after insert or update of agency_campaign_id on public.channel_requests
  for each row execute function public.notify_booking_linked_to_agency_campaign();
