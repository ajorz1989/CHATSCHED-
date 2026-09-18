-- ChatSched — Phase 63 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase62_agency_campaign_auto_advance.sql.
--
-- Adds the one auto-advance transition confirmed as worth building from
-- the five/six left manual in Phase 62: in_progress -> reporting, once
-- every linked request/channel_request's proof is verified (or the
-- booking is marked not_eligible for compliance, since there's nothing
-- to verify for it). The other five stay manual — no signal existed for
-- them, unchanged from Phase 62's reasoning.
--
-- ── What "verified" means here ────────────────────────────────────────
-- campaign_proof (schema_phase39_compliance.sql) links to a booking
-- indirectly, through campaign_compliance (request_id/channel_request_id
-- -> campaign_compliance, 1:1, then campaign_compliance -> campaign_proof,
-- 1:many — a booking can have more than one proof submission, e.g. a
-- resubmission after rejection). "Verified" means the LATEST proof
-- submission for that booking's compliance record is status = 'verified'
-- — same latest-attempt convention agency_campaign_totals() already uses
-- for payments (schema_phase60), applied here for the same reason: an
-- old rejected attempt shouldn't permanently block a booking that was
-- later resubmitted and approved.
--
-- A booking whose campaign_compliance.status is 'not_eligible' counts as
-- satisfied without any proof at all — that status means compliance
-- doesn't apply to it, so there's nothing to verify. This is an
-- interpretation, not something stated anywhere else in the schema —
-- worth confirming if it doesn't match intent, easy to change (drop the
-- `when cc.status = 'not_eligible' then true` branch below).
--
-- A booking with no campaign_compliance row at all counts as NOT
-- satisfied (the conservative direction) rather than being silently
-- excluded from the count — create_campaign_compliance_stub() fires on
-- every request/channel_request so this shouldn't happen in practice,
-- but an under-advance is a far smaller problem than an over-advance if
-- it somehow does.
--
-- Same reasoning as Phase 62 for why this doesn't call
-- agency_campaign_totals() or any other admin-gated function: proof
-- getting verified happens from an admin's own session
-- (review_campaign_proof() is itself admin-only), so that part would be
-- fine here specifically — but the *linking* trigger path (an
-- already-verified booking getting linked to a campaign) can still fire
-- from a non-admin context, so the shared function stays
-- security definer and self-contained either way, for the same reason
-- Phase 62's did.

create or replace function public.maybe_advance_agency_campaign_to_reporting(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_linked integer;
  v_satisfied integer;
begin
  select status into v_status from public.agency_campaigns where id = p_campaign_id;

  if v_status is distinct from 'in_progress' then
    return;
  end if;

  select count(*), count(*) filter (where is_satisfied)
  into v_linked, v_satisfied
  from (
    select case
      when cc.id is null then false
      when cc.status = 'not_eligible' then true
      else coalesce(latest_proof.status, 'pending_review') = 'verified'
    end as is_satisfied
    from public.requests r
    left join public.campaign_compliance cc on cc.request_id = r.id
    left join lateral (
      select status from public.campaign_proof
      where campaign_compliance_id = cc.id
      order by created_at desc
      limit 1
    ) latest_proof on true
    where r.agency_campaign_id = p_campaign_id

    union all

    select case
      when cc.id is null then false
      when cc.status = 'not_eligible' then true
      else coalesce(latest_proof.status, 'pending_review') = 'verified'
    end as is_satisfied
    from public.channel_requests cr
    left join public.campaign_compliance cc on cc.channel_request_id = cr.id
    left join lateral (
      select status from public.campaign_proof
      where campaign_compliance_id = cc.id
      order by created_at desc
      limit 1
    ) latest_proof on true
    where cr.agency_campaign_id = p_campaign_id
  ) combined;

  if v_linked = 0 or v_satisfied < v_linked then
    return;
  end if;

  update public.agency_campaigns
  set status = 'reporting', updated_at = now()
  where id = p_campaign_id and status = 'in_progress';

  if found then
    insert into public.admin_audit_log(admin_id, action, target_table, target_id, detail)
    values (
      null,
      'agency_campaign_status_auto_advanced',
      'agency_campaigns',
      p_campaign_id,
      jsonb_build_object(
        'from_status', 'in_progress',
        'to_status', 'reporting',
        'reason', 'all linked requests have verified proof or are not eligible',
        'linked_requests', v_linked
      )
    );
  end if;
end;
$$;

comment on function public.maybe_advance_agency_campaign_to_reporting is
  'Advances a campaign from in_progress to reporting once every linked
   booking''s latest proof submission is verified, or its compliance
   record is marked not_eligible. See this migration''s header for the
   "not_eligible counts as satisfied" and "latest, not all, proof
   attempts" interpretations — both worth confirming if they do not
   match intent.';

-- Path A: a proof submission becomes verified.
create or replace function public.trg_campaign_proof_advance_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select coalesce(r.agency_campaign_id, cr.agency_campaign_id) into v_campaign_id
  from public.campaign_compliance cc
  left join public.requests r on r.id = cc.request_id
  left join public.channel_requests cr on cr.id = cc.channel_request_id
  where cc.id = new.campaign_compliance_id;

  if v_campaign_id is not null then
    perform public.maybe_advance_agency_campaign_to_reporting(v_campaign_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_proof_advance_campaign on public.campaign_proof;
create trigger trg_campaign_proof_advance_campaign
  after insert or update of status on public.campaign_proof
  for each row
  when (new.status = 'verified')
  execute function public.trg_campaign_proof_advance_campaign();

-- Path B: a booking gets marked not_eligible for compliance (nothing
-- left to verify for it).
create or replace function public.trg_campaign_compliance_advance_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  if new.request_id is not null then
    select agency_campaign_id into v_campaign_id from public.requests where id = new.request_id;
  elsif new.channel_request_id is not null then
    select agency_campaign_id into v_campaign_id from public.channel_requests where id = new.channel_request_id;
  end if;

  if v_campaign_id is not null then
    perform public.maybe_advance_agency_campaign_to_reporting(v_campaign_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_compliance_advance_campaign on public.campaign_compliance;
create trigger trg_campaign_compliance_advance_campaign
  after update of status on public.campaign_compliance
  for each row
  when (new.status = 'not_eligible')
  execute function public.trg_campaign_compliance_advance_campaign();

-- Path C: the two Phase 62 "link after already satisfied" triggers get
-- extended to also check the reporting transition — an already-verified
-- booking can be linked to an in_progress campaign after the fact, same
-- as an already-paid one could be linked to a payment_pending campaign.
-- Both checks are cheap no-ops when the campaign isn't in the matching
-- status, so calling both unconditionally on every link event is fine.
create or replace function public.trg_requests_advance_campaign_on_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.maybe_advance_agency_campaign(new.agency_campaign_id);
  perform public.maybe_advance_agency_campaign_to_reporting(new.agency_campaign_id);
  return new;
end;
$$;

create or replace function public.trg_channel_requests_advance_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.maybe_advance_agency_campaign(new.agency_campaign_id);
  perform public.maybe_advance_agency_campaign_to_reporting(new.agency_campaign_id);
  return new;
end;
$$;

-- Triggers themselves are unchanged from Phase 62 (still fire on the
-- same columns, still point at the same function names) — replacing the
-- function bodies is enough, nothing to re-create here.

-- One-time catch-up, same reasoning as Phase 62's: any campaign already
-- fully verified before this migration ran would otherwise stay stuck on
-- in_progress forever.
do $$
declare
  v_campaign_id uuid;
begin
  for v_campaign_id in select id from public.agency_campaigns where status = 'in_progress' loop
    perform public.maybe_advance_agency_campaign_to_reporting(v_campaign_id);
  end loop;
end $$;
