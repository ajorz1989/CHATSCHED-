-- ChatSched — Phase 68 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase67_relationship_history.sql.
--
-- Opportunity feed + reverse marketplace (brief sections 9-10, queued
-- since PIVOT_PHASE1_AUDIT.md, explicitly deferred by
-- PHASE11_RELATIONSHIP_HISTORY_DELIVERY.md as its own pass rather than a
-- rushed half of that phase). Flips the marketplace's normal direction:
-- everywhere else, a business browses publishers and starts a specific
-- request. Here, a business posts what it needs without picking anyone,
-- and publishers apply.
--
-- ── Why this doesn't invent a third booking table ───────────────────────
-- Accepting an application does not create an "opportunity booking" —
-- it creates an ordinary requests/channel_requests row, exactly the
-- insert a business creating their first request would use (same
-- publisher_id/business_id/campaign_message/budget shape for `requests`,
-- same channel_slug/creator_id/business_id/campaign_message/
-- advertising_method/proposed_amount shape for `channel_requests` —
-- copied directly from BusinessPublisherRelationships.tsx's Run Again,
-- schema_phase67). Which table depends on the *publisher's* channel_slug,
-- same "no need to check both" reasoning Run Again already established.
-- Once created, that booking is a completely normal one — compliance,
-- deliverables, messaging, payment, everything already built for it
-- applies with no special-casing anywhere else in this schema.
--
-- ── Why this doesn't reuse channel_requests' own accept/decline state
--    machine ──────────────────────────────────────────────────────────
-- channel_requests already has a mature, trigger-enforced status
-- machine (schema_phase17/32/56 and others), built for "a business
-- targeted one specific creator." Reusing it here would mean either
-- fabricating a fake channel_request per applicant (creating real rows
-- for applications that get declined, which is exactly the kind of
-- table-abuse this schema has avoided everywhere else) or bolting a
-- second meaning onto an already-complex state machine. A new, much
-- smaller table for applications, converted into a real booking only on
-- acceptance, keeps both concerns simple.

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  brief text not null,
  -- Nullable: a business can target one channel type or leave it open to
  -- any. Not a foreign key to a channels table — same free-standing text
  -- check every other channel_slug column in this schema already uses.
  channel_slug text check (channel_slug in ('social-media', 'influencer', 'website', 'podcast', 'radio')),
  budget_min numeric check (budget_min is null or budget_min >= 0),
  budget_max numeric check (budget_max is null or budget_max >= 0),
  status text not null default 'open' check (status in ('open', 'filled', 'closed', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_budget_range check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create index opportunities_business_id_idx on public.opportunities(business_id);
create index opportunities_open_idx on public.opportunities(channel_slug) where status = 'open';

create table public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  message text not null,
  -- Nullable, only meaningful once accepted into a non-social-media
  -- channel_request (its advertising_method is not null — see below).
  -- The publisher fills this in, not the business: they're the one who
  -- knows what they're actually proposing to do (a podcast mention vs.
  -- three Instagram stories aren't interchangeable), and the opportunity
  -- itself might not even specify a single channel type yet.
  advertising_method text,
  proposed_amount numeric check (proposed_amount is null or proposed_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, publisher_id)
);

create index opportunity_applications_opportunity_id_idx on public.opportunity_applications(opportunity_id);
create index opportunity_applications_publisher_id_idx on public.opportunity_applications(publisher_id);

alter table public.opportunities enable row level security;
alter table public.opportunity_applications enable row level security;

-- ── opportunities RLS ────────────────────────────────────────────────────

-- Open opportunities are visible to any approved publisher (the feed),
-- the owning business sees their own regardless of status, admin sees
-- everything. Not gated to a specific channel_slug match at the RLS
-- layer — narrowing to "opportunities for my channel" is a feed filter,
-- same as Browse.tsx already filters publishers client-side rather than
-- hiding rows the viewer isn't allowed to see at all.
create policy opportunities_select_open_to_publishers
  on public.opportunities for select
  using (
    status = 'open'
    and exists (select 1 from public.publishers where user_id = auth.uid() and status = 'approved')
  );

create policy opportunities_select_own_business
  on public.opportunities for select
  using (business_id = auth.uid());

create policy opportunities_select_admin
  on public.opportunities for select
  using (public.is_admin());

create policy opportunities_insert_own
  on public.opportunities for insert
  with check (business_id = auth.uid());

-- A business can edit or close/cancel their own posting. Not restricted
-- to specific status values here — same "policy permissive, trigger is
-- the real gate on anything that needs one" shape as elsewhere, and the
-- one transition that genuinely needs a trigger (-> filled) is driven by
-- accepting an application below, not by a business editing this row
-- directly.
create policy opportunities_update_own_business
  on public.opportunities for update
  using (business_id = auth.uid())
  with check (business_id = auth.uid());

create policy opportunities_update_admin
  on public.opportunities for update
  using (public.is_admin());

-- ── opportunity_applications RLS ─────────────────────────────────────────

create policy opportunity_applications_select_own_publisher
  on public.opportunity_applications for select
  using (exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid()));

create policy opportunity_applications_select_opportunity_owner
  on public.opportunity_applications for select
  using (exists (select 1 from public.opportunities where id = opportunity_id and business_id = auth.uid()));

create policy opportunity_applications_select_admin
  on public.opportunity_applications for select
  using (public.is_admin());

-- A publisher can apply to any currently-open opportunity — checked here
-- via a subquery rather than trusting the client, same shape as
-- channel_requests_insert_admin (schema_phase64) embedding its own
-- status check in the WITH CHECK.
create policy opportunity_applications_insert_publisher
  on public.opportunity_applications for insert
  with check (
    exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid() and status = 'approved')
    and exists (select 1 from public.opportunities where id = opportunity_id and status = 'open')
  );

-- A publisher can edit or withdraw their own application while it's
-- still pending — enforce_opportunity_application_update() below is the
-- real gate on exactly what "edit" is allowed to touch once it isn't.
create policy opportunity_applications_update_publisher
  on public.opportunity_applications for update
  using (exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid()));

-- The business can accept or decline applications to their own
-- opportunity. Same permissive-policy-plus-trigger shape: this doesn't
-- restrict which columns a business's update can touch at the RLS
-- layer, because enforce_opportunity_application_update() (below) resets
-- message/proposed_amount to their stored values whenever the caller
-- isn't the applying publisher — a business accepting an application
-- can't quietly rewrite what the publisher actually offered.
create policy opportunity_applications_update_business
  on public.opportunity_applications for update
  using (exists (select 1 from public.opportunities where id = opportunity_id and business_id = auth.uid()));

create policy opportunity_applications_update_admin
  on public.opportunity_applications for update
  using (public.is_admin());

-- ── Column-level lockdown on updates ─────────────────────────────────────
-- Same enforce_*_self_update shape used throughout this schema
-- (notifications, publishers, others): the policies above are
-- deliberately permissive about which *rows* an update can touch, and
-- this trigger is the real gate on which *columns* actually change,
-- depending on who's making the change.
create or replace function public.enforce_opportunity_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_publisher boolean;
begin
  if auth.uid() is null then
    return new; -- trusted server-side context
  end if;

  select exists(select 1 from public.publishers where id = new.publisher_id and user_id = auth.uid())
  into v_is_publisher;

  if v_is_publisher then
    -- The applying publisher can edit their own message/amount, or
    -- withdraw — but only while still pending, and can't grant
    -- themselves acceptance.
    if old.status is distinct from 'pending' then
      new := old;
      return new;
    end if;
    if new.status not in ('pending', 'withdrawn') then
      new.status := old.status;
    end if;
  else
    -- The business (or admin) driving this update can only touch
    -- status, and only pending -> accepted/declined. message,
    -- proposed_amount, and advertising_method are the publisher's own
    -- words, not the business's to rewrite.
    new.message := old.message;
    new.proposed_amount := old.proposed_amount;
    new.advertising_method := old.advertising_method;
    if old.status is distinct from 'pending' or new.status not in ('accepted', 'declined') then
      new.status := old.status;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_opportunity_application_update on public.opportunity_applications;
create trigger trg_enforce_opportunity_application_update
  before update on public.opportunity_applications
  for each row execute function public.enforce_opportunity_application_update();

-- ── Accepting an application closes out the rest ─────────────────────────
-- Server-enforced consequence of one specific status change, same
-- "trigger is the source of truth" reasoning as every other state
-- machine in this schema — a business accepting one applicant shouldn't
-- require the client to also remember to decline every other one and
-- close the opportunity in two more round trips.
create or replace function public.close_out_accepted_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.opportunity_applications
    set status = 'declined', updated_at = now()
    where opportunity_id = new.opportunity_id
      and id <> new.id
      and status = 'pending';

    update public.opportunities
    set status = 'filled', updated_at = now()
    where id = new.opportunity_id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_close_out_accepted_opportunity on public.opportunity_applications;
create trigger trg_close_out_accepted_opportunity
  after update of status on public.opportunity_applications
  for each row
  when (new.status = 'accepted')
  execute function public.close_out_accepted_opportunity();

-- ── Notifications ─────────────────────────────────────────────────────
-- Same create_notification() helper every trigger since schema_phase23
-- uses, same "every notification is a trigger, not a client call site"
-- reasoning from that file's own header.

create or replace function public.notify_new_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher record;
begin
  -- Every approved publisher matching the target channel, or every
  -- approved publisher at all if the business left it open. Fine at
  -- pilot volume; a real-scale version of this would batch or digest
  -- rather than one row per matching publisher per posting.
  for v_publisher in
    select user_id from public.publishers
    where status = 'approved'
      and (new.channel_slug is null or channel_slug = new.channel_slug)
  loop
    perform public.create_notification(
      v_publisher.user_id, 'new_opportunity',
      'New opportunity posted',
      format('A business is looking for: %s', new.title),
      '/publisher/opportunities'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_opportunity on public.opportunities;
create trigger trg_notify_new_opportunity
  after insert on public.opportunities
  for each row
  when (new.status = 'open')
  execute function public.notify_new_opportunity();

create or replace function public.notify_new_opportunity_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_publisher_name text;
begin
  select business_id into v_business_id from public.opportunities where id = new.opportunity_id;
  select name into v_publisher_name from public.publishers where id = new.publisher_id;
  perform public.create_notification(
    v_business_id, 'new_opportunity_application',
    'New application to your opportunity',
    format('%s applied to your opportunity.', coalesce(v_publisher_name, 'A publisher')),
    '/business/opportunities'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_opportunity_application on public.opportunity_applications;
create trigger trg_notify_new_opportunity_application
  after insert on public.opportunity_applications
  for each row execute function public.notify_new_opportunity_application();

create or replace function public.notify_opportunity_application_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id uuid;
  v_title text;
begin
  if new.status = old.status then
    return new;
  end if;
  select user_id into v_recipient_id from public.publishers where id = new.publisher_id;
  if new.status = 'accepted' then
    v_title := 'Your application was accepted';
  elsif new.status = 'declined' then
    v_title := 'Your application was not selected';
  else
    return new; -- withdrawn is publisher-initiated, nothing to tell them
  end if;
  perform public.create_notification(
    v_recipient_id, 'opportunity_application_' || new.status, v_title,
    'Check the opportunity for details.', '/publisher/opportunities'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_opportunity_application_decision on public.opportunity_applications;
create trigger trg_notify_opportunity_application_decision
  after update of status on public.opportunity_applications
  for each row execute function public.notify_opportunity_application_decision();
