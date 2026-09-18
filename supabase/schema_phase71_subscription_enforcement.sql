-- ChatSched — Phase 71 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase70_public_lead_capture.sql.
--
-- Wires up isSubscriptionEnforcementEnabled() (schema_phase55/
-- featureFlags.ts) — confirmed decision, per
-- PHASE17_STATE_OF_THE_PIVOT_AUDIT.md, which flagged it as the one item
-- on that list that wasn't really an engineering gap: the billing was
-- always real, nothing ever required it.
--
-- ── A real numbering collision, not a hypothetical one ──────────────────
-- This was originally written as schema_phase70_subscription_enforcement.sql
-- against a base that didn't yet have the homepage-pivot phase's own
-- schema_phase70_public_lead_capture.sql. Renumbered to 71 rather than
-- risk two different "phase 70" migrations — same call PHASE10 made
-- (per PHASE11's own account of it) when it hit the equivalent collision
-- against schema_phase61. Exactly the kind of thing flagged as a risk of
-- running work in parallel against this codebase since the very first
-- audit; this is one more instance of it happening and resolving
-- cleanly, not a new problem.
--
-- ── What "usable" means ───────────────────────────────────────────────
-- status in ('active', 'grace_period') — exactly isSubscriptionUsable()
-- in src/lib/subscriptions.ts (Phase 2), mirrored here rather than
-- called, same cross-boundary duplication precedent as every other
-- SQL/TypeScript pair in this schema. Keep the two in sync by hand.
--
-- ── Why this is server-side and unconditional, not gated by the flag
--    itself ─────────────────────────────────────────────────────────
-- isSubscriptionEnforcementEnabled() is a Vite env var — it can't be
-- read from Postgres, so it was never going to be the thing deciding
-- whether these checks run. It's repurposed in the app layer (see this
-- delivery's notes) as a client-side "should the UI proactively explain
-- this before the user hits a raw error" switch, same shape as
-- isMessageSafetyPrescanEnabled() (schema_phase58) — real UX, not the
-- actual gate. If enforcement ever needs to come back off, that's a
-- migration reverting the checks below, not an env var.
--
-- ── What's gated, and what deliberately isn't ─────────────────────────
-- Only "start something new": a business creating a requests/
-- channel_requests/opportunities row, and a publisher accepting a
-- channel_requests booking or applying to an opportunity. Everything
-- about an *already-accepted* booking — messaging, proof, deliverables,
-- payment, decline — is untouched. A lapsed subscription shouldn't be
-- able to trap either side inside a booking they can no longer act on;
-- it should only stop *new* engagements. Declining is explicitly exempt
-- for the same reason.
--
-- The original "requests" table (social-media channel) has no
-- publisher-side accept action to gate at all — checked directly against
-- this exact zip (see the query this migration's own delivery notes
-- ran), that flow is still admin-mediated: requests_update_admin is the
-- only non-select/insert policy on that table anywhere in this schema.
-- Only its business-side insert needed a check.
--
-- Admin-initiated inserts (requests_insert_admin / channel_requests_
-- insert_admin, schema_phase64) are untouched — ChatSched creating a
-- booking on behalf of a managed client isn't the client's own
-- self-service subscription being exercised.
--
-- ── Interacts with the homepage-pivot phase's own copy ───────────────
-- schema_phase70's delivery note (this migration's immediate
-- predecessor) deliberately wrote several pages' subscription framing as
-- "exists, unlocks the full platform, but nothing is gated behind one
-- yet" — accurate at the time it shipped. This migration makes that
-- sentence false. Not fixed here — see this delivery's own notes for
-- exactly which copy now needs a second pass.

-- ── Business-side: requests ──────────────────────────────────────────
drop policy if exists "requests_insert_own" on public.requests;
create policy "requests_insert_own" on public.requests
  for insert with check (
    auth.uid() = business_id
    and exists (
      select 1 from public.business_subscriptions
      where business_id = auth.uid() and status in ('active', 'grace_period')
    )
  );

-- ── Business-side: channel_requests ──────────────────────────────────
drop policy if exists "channel_requests_insert_business" on public.channel_requests;
create policy "channel_requests_insert_business" on public.channel_requests
  for insert with check (
    auth.uid() = business_id and status = 'pending'
    and exists (
      select 1 from public.business_subscriptions
      where business_id = auth.uid() and status in ('active', 'grace_period')
    )
  );

-- ── Business-side: opportunities ─────────────────────────────────────
drop policy if exists "opportunities_insert_own" on public.opportunities;
create policy opportunities_insert_own
  on public.opportunities for insert
  with check (
    business_id = auth.uid()
    and exists (
      select 1 from public.business_subscriptions
      where business_id = auth.uid() and status in ('active', 'grace_period')
    )
  );

-- ── Publisher-side: applying to an opportunity ───────────────────────
drop policy if exists "opportunity_applications_insert_publisher" on public.opportunity_applications;
create policy opportunity_applications_insert_publisher
  on public.opportunity_applications for insert
  with check (
    exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid() and status = 'approved')
    and exists (select 1 from public.opportunities where id = opportunity_id and status = 'open')
    and exists (
      select 1 from public.publisher_subscriptions
      where publisher_id = auth.uid() and status in ('active', 'grace_period')
    )
  );

-- ── Publisher-side: accepting a channel_requests booking ────────────
-- Supersedes enforce_channel_request_transition() (schema_phase17) —
-- identical to that version except for the one added check on the
-- creator-accept branch. Declining is untouched, on purpose (see header).
create or replace function public.enforce_channel_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_creator boolean;
  is_business boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  is_business := (auth.uid() = old.business_id);
  is_creator := exists (
    select 1 from public.publishers p
    where p.id = old.creator_id and p.user_id = auth.uid()
  );

  if public.is_admin() then
    if old.status in ('declined', 'cancelled', 'completed') then
      raise exception 'This request is already closed.';
    end if;
    if new.status = 'paid' and old.status = 'payment_submitted' then
      new.paid_at := now();
      return new;
    end if;
    if new.status = 'completed' and old.status = 'live' then
      new.completed_at := now();
      return new;
    end if;
    if new.status in ('declined', 'cancelled') then
      return new;
    end if;
    raise exception 'That status change is not allowed for an admin.';
  end if;

  if is_creator and old.status = 'pending' and new.status = 'awaiting_payment' then
    if not exists (
      select 1 from public.publisher_subscriptions
      where publisher_id = auth.uid() and status in ('active', 'grace_period')
    ) then
      raise exception 'An active Publisher Network subscription is required to accept new requests.';
    end if;
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'declined' then
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'paid' and new.status = 'live' then
    new.live_at := now();
    return new;
  end if;

  if is_business and old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;

  if is_business and old.status = 'awaiting_payment' and new.status = 'payment_submitted' then
    new.payment_submitted_at := now();
    return new;
  end if;

  raise exception 'That status change is not allowed.';
end;
$$;
