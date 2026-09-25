-- ChatSched — Opportunities Engine v2
-- Canonical migration for the completed reverse-marketplace engine.
-- Builds on phases 68/69/80/86/89/101 without creating a parallel booking system.

create table if not exists public.opportunity_types (
  slug text primary key,
  label text not null,
  description text not null default '',
  suggested_channel_slug text references public.channels(slug),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunity_types enable row level security;

drop policy if exists opportunity_types_select_public on public.opportunity_types;
create policy opportunity_types_select_public
  on public.opportunity_types for select
  to anon, authenticated
  using (active = true or public.is_admin());

drop policy if exists opportunity_types_admin_write on public.opportunity_types;
create policy opportunity_types_admin_write
  on public.opportunity_types for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.opportunity_types to anon, authenticated;

insert into public.opportunity_types (slug, label, description, suggested_channel_slug, sort_order)
values
  ('newsletter-sponsorship', 'Newsletter Sponsorship', 'Sponsor a newsletter or subscriber communication.', 'website', 10),
  ('school-partnership', 'School Partnership', 'Sponsor a school, learner programme, newsletter or school event.', 'events', 20),
  ('event-sponsorship', 'Event Sponsorship', 'Sponsor an event, activation or local gathering.', 'events', 30),
  ('in-venue-screen-display', 'In-Venue Screen Display', 'Buy branded visibility on an in-venue digital screen.', 'in-venue-screens', 40),
  ('influencer-product-placement', 'Influencer Product Placement', 'Place a product or brand into creator content.', 'influencer', 50),
  ('radio-podcast-spot', 'Radio / Podcast Spot', 'Book a radio or podcast advertising placement.', 'radio', 60),
  ('sports-sponsorship', 'Sports Sponsorship', 'Sponsor a club, team, tournament or sports audience.', 'sports', 70),
  ('website-advertising', 'Website Advertising', 'Place advertising on a relevant website.', 'website', 80),
  ('community-sponsorship', 'Community Sponsorship', 'Support a community organisation, initiative or audience.', 'community', 90),
  ('social-media-promotion', 'Social Media Promotion', 'Commission social media promotion from a verified publisher.', 'social-media', 100),
  ('restaurant-promotion', 'Restaurant Promotion', 'Reach diners through restaurant-based advertising inventory.', 'restaurants', 110),
  ('transport-advertising', 'Transport Advertising', 'Advertise through transport-related inventory.', 'transport', 120),
  ('association-sponsorship', 'Association Sponsorship', 'Sponsor an association, member network or professional audience.', 'associations', 130),
  ('retail-promotion', 'Retail Promotion', 'Promote a product or offer through retail-facing inventory.', 'informal-retail', 140),
  ('brand-partnership', 'Brand Partnership', 'Create a broader sponsored partnership across a publisher or channel.', null, 150)
on conflict (slug) do update
set label = excluded.label,
    description = excluded.description,
    suggested_channel_slug = excluded.suggested_channel_slug,
    sort_order = excluded.sort_order,
    updated_at = now();

alter table public.opportunities
  add column if not exists application_deadline timestamptz,
  add column if not exists campaign_start_at timestamptz,
  add column if not exists campaign_end_at timestamptz,
  add column if not exists deliverables text,
  add column if not exists publisher_requirements text,
  add column if not exists match_keywords text[] not null default '{}';

alter table public.opportunities drop constraint if exists opportunities_campaign_dates_check;
alter table public.opportunities
  add constraint opportunities_campaign_dates_check
  check (
    campaign_end_at is null
    or campaign_start_at is null
    or campaign_start_at <= campaign_end_at
  );

alter table public.opportunities drop constraint if exists opportunities_deadline_expiry_check;
alter table public.opportunities
  add constraint opportunities_deadline_expiry_check
  check (
    application_deadline is null
    or expires_at is null
    or application_deadline <= expires_at
  );

alter table public.opportunities drop constraint if exists opportunities_opportunity_type_fkey;
alter table public.opportunities
  add constraint opportunities_opportunity_type_fkey
  foreign key (opportunity_type) references public.opportunity_types(slug);

create index if not exists opportunities_open_deadline_idx
  on public.opportunities(application_deadline)
  where status = 'open';

create index if not exists opportunities_open_channel_idx
  on public.opportunities(channel_slug)
  where status = 'open';

create index if not exists opportunities_open_keywords_gin_idx
  on public.opportunities using gin(match_keywords)
  where status = 'open';

create index if not exists opportunity_applications_status_idx
  on public.opportunity_applications(opportunity_id, status);

create or replace function public.expire_opportunities()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.opportunities
       set status = 'closed',
           updated_at = now()
     where status = 'open'
       and expires_at is not null
       and expires_at <= now()
     returning id
  )
  select count(*) into v_count from expired;

  return coalesce(v_count, 0);
end;
$$;

revoke execute on function public.expire_opportunities() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'expire-open-opportunities'
  ) then
    perform cron.schedule(
      'expire-open-opportunities',
      '*/15 * * * *',
      'select public.expire_opportunities();'
    );
  end if;
end $$;

create or replace function public.enforce_opportunity_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if old.business_id <> auth.uid() or new.business_id <> old.business_id then
    new.business_id := old.business_id;
  end if;

  if old.status in ('filled', 'closed', 'cancelled') then
    new.status := old.status;
  elsif new.status = 'filled' then
    new.status := old.status;
  elsif old.status = 'open' and new.status = 'draft' then
    new.status := old.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_opportunity_update on public.opportunities;
create trigger trg_enforce_opportunity_update
before update on public.opportunities
for each row execute function public.enforce_opportunity_update();

drop policy if exists "opportunities_insert_own" on public.opportunities;
create policy opportunities_insert_own
  on public.opportunities for insert
  to authenticated
  with check (
    business_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'business'
        and business_verified = true
    )
    and exists (
      select 1
      from public.business_subscriptions
      where business_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "opportunities_update_own_business" on public.opportunities;
create policy opportunities_update_own_business
  on public.opportunities for update
  to authenticated
  using (
    business_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'business'
        and business_verified = true
    )
    and exists (
      select 1
      from public.business_subscriptions
      where business_id = auth.uid() and status = 'active'
    )
  )
  with check (business_id = auth.uid());

drop policy if exists "opportunities_select_open_to_publishers" on public.opportunities;
create policy opportunities_select_open_to_publishers
  on public.opportunities for select
  to authenticated
  using (
    status = 'open'
    and (expires_at is null or expires_at > now())
    and (application_deadline is null or application_deadline > now())
    and exists (
      select 1
      from public.publishers p
      join public.publisher_subscriptions ps on ps.publisher_id = p.id
      where p.user_id = auth.uid()
        and p.status = 'approved'
        and p.verified = true
        and ps.status = 'active'
    )
  );

drop policy if exists "opportunity_applications_insert_publisher" on public.opportunity_applications;
create policy opportunity_applications_insert_publisher
  on public.opportunity_applications for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.publishers p
      join public.publisher_subscriptions ps on ps.publisher_id = p.id
      where p.id = publisher_id
        and p.user_id = auth.uid()
        and p.status = 'approved'
        and p.verified = true
        and ps.status = 'active'
    )
    and exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_id
        and o.status = 'open'
        and (o.expires_at is null or o.expires_at > now())
        and (o.application_deadline is null or o.application_deadline > now())
    )
  );

drop policy if exists "opportunity_applications_update_business" on public.opportunity_applications;
create policy opportunity_applications_update_business
  on public.opportunity_applications for update
  to authenticated
  using (
    exists (
      select 1
      from public.opportunities o
      join public.profiles p on p.id = o.business_id
      join public.business_subscriptions bs on bs.business_id = o.business_id
      where o.id = opportunity_id
        and o.business_id = auth.uid()
        and p.role = 'business'
        and p.business_verified = true
        and bs.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.business_id = auth.uid()
    )
  );

create or replace function public.accept_opportunity_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.opportunity_applications%rowtype;
  v_opp public.opportunities%rowtype;
  v_publisher public.publishers%rowtype;
  v_accepted_count integer;
  v_amount numeric;
  v_request_id uuid;
  v_channel_request_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select * into v_app
    from public.opportunity_applications
   where id = p_application_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'application not found');
  end if;

  select * into v_opp
    from public.opportunities
   where id = v_app.opportunity_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'opportunity not found');
  end if;

  if auth.uid() <> v_opp.business_id and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not your opportunity');
  end if;

  if not public.is_admin() then
    if not exists (
      select 1 from public.profiles
       where id = auth.uid() and role = 'business' and business_verified = true
    ) then
      return jsonb_build_object('ok', false, 'error', 'business not verified');
    end if;
    if not exists (
      select 1 from public.business_subscriptions
       where business_id = auth.uid() and status = 'active'
    ) then
      return jsonb_build_object('ok', false, 'error', 'business activation required');
    end if;
  end if;

  if v_app.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'application is not pending');
  end if;

  if v_opp.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'opportunity is no longer open');
  end if;

  if v_opp.application_deadline is not null and v_opp.application_deadline <= now() then
    return jsonb_build_object('ok', false, 'error', 'application deadline has passed');
  end if;

  select * into v_publisher
    from public.publishers
   where id = v_app.publisher_id
   for share;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'publisher not found');
  end if;

  if not public.is_admin() and (v_publisher.status <> 'approved' or v_publisher.verified <> true) then
    return jsonb_build_object('ok', false, 'error', 'publisher is not verified');
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.publisher_subscriptions
    where publisher_id = v_publisher.id and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'publisher activation required');
  end if;

  if v_opp.channel_slug is not null and v_publisher.channel_slug <> v_opp.channel_slug then
    return jsonb_build_object('ok', false, 'error', 'publisher channel does not match this opportunity');
  end if;

  select count(*) into v_accepted_count
    from public.opportunity_applications
   where opportunity_id = v_opp.id and status = 'accepted';

  if v_accepted_count >= v_opp.publishers_needed then
    return jsonb_build_object('ok', false, 'error', 'opportunity is already fully booked');
  end if;

  v_amount := coalesce(v_app.proposed_amount, v_opp.budget_max, v_opp.budget_min, 0);

  if v_publisher.channel_slug = 'social-media' then
    insert into public.requests (
      publisher_id, business_id, campaign_message, budget
    )
    values (
      v_app.publisher_id, v_opp.business_id, v_app.message, nullif(v_amount, 0)
    )
    returning id into v_request_id;
  else
    insert into public.channel_requests (
      channel_slug, creator_id, business_id, campaign_message,
      advertising_method, proposed_amount
    )
    values (
      v_publisher.channel_slug, v_app.publisher_id, v_opp.business_id,
      v_app.message, coalesce(v_app.advertising_method, v_opp.title), v_amount
    )
    returning id into v_channel_request_id;
  end if;

  update public.opportunity_applications
     set status = 'accepted', updated_at = now()
   where id = p_application_id;

  return jsonb_build_object(
    'ok', true,
    'booking_table', case when v_request_id is not null then 'requests' else 'channel_requests' end,
    'booking_id', coalesce(v_request_id, v_channel_request_id)
  );
end;
$$;

revoke execute on function public.accept_opportunity_application(uuid) from public, anon;
grant execute on function public.accept_opportunity_application(uuid) to authenticated;

create or replace function public.notify_new_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher record;
begin
  for v_publisher in
    select p.user_id
      from public.publishers p
      join public.publisher_subscriptions ps on ps.publisher_id = p.id
     where p.status = 'approved'
       and p.verified = true
       and ps.status = 'active'
       and (new.channel_slug is null or p.channel_slug = new.channel_slug)
  loop
    perform public.create_notification(
      v_publisher.user_id,
      'new_opportunity',
      'New opportunity posted',
      format('A business is looking for: %s', new.title),
      '/publisher/opportunities'
    );
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_new_opportunity() from public, anon, authenticated;

notify pgrst, 'reload schema';
