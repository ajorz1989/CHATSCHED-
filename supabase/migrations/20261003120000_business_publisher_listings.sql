-- Business-created publisher listings.
--
-- A business that has paid its activation fee (business_subscriptions.status
-- = 'active') can create ONE publisher listing from its dashboard. Channels
-- that need no manual verification go live on the browse page immediately;
-- social-media and the high-trust channels (verification_required) are
-- created as pending_review and go through the normal admin verification,
-- because enforce_publisher_channel_verification refuses to approve them
-- otherwise.
--
-- Businesses cannot buy Publisher Network activation (publisher-subscribe
-- rejects non-publisher roles), so the business fee also covers accepting
-- bookings on the business's own listing: publisher_is_activated() treats a
-- creation_source='business' listing as activated while its owner's business
-- activation is active.
--
-- Also fixes a latent mismatch: publisher_subscriptions.publisher_id
-- references profiles(id) (the USER id), but several gates joined it to
-- publishers.id. The helper keys on publishers.user_id.

alter table public.publishers drop constraint if exists publishers_creation_source_check;
alter table public.publishers add constraint publishers_creation_source_check
  check (creation_source = any (array['standard','admin','aj_creations','business']));

-- One business-created listing per account.
create unique index if not exists publishers_one_business_listing_per_user
  on public.publishers (user_id) where creation_source = 'business';

create or replace function public.publisher_is_activated(p_publisher_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.publishers p
    where p.id = p_publisher_id
      and (
        exists (select 1 from public.publisher_subscriptions ps
                where ps.publisher_id = p.user_id and ps.status = 'active')
        or (p.creation_source = 'business'
            and exists (select 1 from public.business_subscriptions bs
                        where bs.business_id = p.user_id and bs.status = 'active'))
      )
  );
$$;
revoke all on function public.publisher_is_activated(uuid) from public;
grant execute on function public.publisher_is_activated(uuid) to authenticated;

-- Same check for "the signed-in user" (used by browse-side RLS).
create or replace function public.current_user_has_activated_listing()
returns boolean
language sql stable security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.publishers p
    where p.user_id = auth.uid()
      and p.status = 'approved' and p.verified = true
      and public.publisher_is_activated(p.id)
  );
$$;
revoke all on function public.current_user_has_activated_listing() from public;
grant execute on function public.current_user_has_activated_listing() to authenticated;

-- ---- Gate: opportunities visible to activated publishers --------------------
drop policy if exists opportunities_select_open_to_publishers on public.opportunities;
create policy opportunities_select_open_to_publishers on public.opportunities
  for select using (
    status = 'open'
    and (expires_at is null or expires_at > now())
    and (application_deadline is null or application_deadline > now())
    and public.current_user_has_activated_listing()
  );

-- ---- Gate: applying to an opportunity ---------------------------------------
-- A business must never apply to its own opportunity.
drop policy if exists opportunity_applications_insert_publisher on public.opportunity_applications;
create policy opportunity_applications_insert_publisher on public.opportunity_applications
  for insert with check (
    exists (
      select 1 from public.publishers p
      where p.id = opportunity_applications.publisher_id
        and p.user_id = auth.uid()
        and p.status = 'approved' and p.verified = true
        and public.publisher_is_activated(p.id)
    )
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_applications.opportunity_id
        and o.status = 'open'
        and (o.expires_at is null or o.expires_at > now())
        and (o.application_deadline is null or o.application_deadline > now())
        and o.business_id <> auth.uid()
    )
  );

-- ---- Gate: accepting an application ----------------------------------------
create or replace function public.accept_opportunity_application(p_application_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_app public.opportunity_applications%rowtype; v_opp public.opportunities%rowtype; v_publisher public.publishers%rowtype; v_accepted_count integer; v_amount numeric; v_request_id uuid; v_channel_request_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','not authenticated'); end if;
  select * into v_app from public.opportunity_applications where id=p_application_id for update;
  if not found then return jsonb_build_object('ok',false,'error','application not found'); end if;
  select * into v_opp from public.opportunities where id=v_app.opportunity_id for update;
  if not found then return jsonb_build_object('ok',false,'error','opportunity not found'); end if;
  if auth.uid()<>v_opp.business_id and not public.is_admin() then return jsonb_build_object('ok',false,'error','not your opportunity'); end if;
  if not public.is_admin() then
    if not exists(select 1 from public.profiles where id=auth.uid() and role='business' and business_verified=true) then return jsonb_build_object('ok',false,'error','business not verified'); end if;
    if not exists(select 1 from public.business_subscriptions where business_id=auth.uid() and status='active') then return jsonb_build_object('ok',false,'error','business activation required'); end if;
  end if;
  if v_app.status<>'pending' then return jsonb_build_object('ok',false,'error','application is not pending'); end if;
  if v_opp.status<>'open' then return jsonb_build_object('ok',false,'error','opportunity is no longer open'); end if;
  if v_opp.application_deadline is not null and v_opp.application_deadline<=now() then return jsonb_build_object('ok',false,'error','application deadline has passed'); end if;
  select * into v_publisher from public.publishers where id=v_app.publisher_id for share;
  if not found then return jsonb_build_object('ok',false,'error','publisher not found'); end if;
  if v_publisher.user_id is not null and v_publisher.user_id = v_opp.business_id then return jsonb_build_object('ok',false,'error','a business cannot book its own listing'); end if;
  if not public.is_admin() and (v_publisher.status<>'approved' or v_publisher.verified<>true) then return jsonb_build_object('ok',false,'error','publisher is not verified'); end if;
  if not public.is_admin() and not public.publisher_is_activated(v_publisher.id) then return jsonb_build_object('ok',false,'error','publisher activation required'); end if;
  if v_opp.channel_slug is not null and v_publisher.channel_slug<>v_opp.channel_slug then return jsonb_build_object('ok',false,'error','publisher channel does not match this opportunity'); end if;
  select count(*) into v_accepted_count from public.opportunity_applications where opportunity_id=v_opp.id and status='accepted';
  if v_accepted_count>=v_opp.publishers_needed then return jsonb_build_object('ok',false,'error','opportunity is already fully booked'); end if;
  v_amount:=coalesce(v_app.proposed_amount,v_opp.budget_max,v_opp.budget_min,0);
  if v_publisher.channel_slug='social-media' then
    insert into public.requests(publisher_id,business_id,campaign_message,budget)
    values(v_app.publisher_id,v_opp.business_id,v_app.message,nullif(v_amount,0))
    returning id into v_request_id;
  else
    insert into public.channel_requests(channel_slug,creator_id,business_id,campaign_message,advertising_method,proposed_amount)
    values(v_publisher.channel_slug,v_app.publisher_id,v_opp.business_id,v_app.message,coalesce(v_app.advertising_method,v_opp.title),v_amount)
    returning id into v_channel_request_id;
  end if;
  update public.opportunity_applications set status='accepted',updated_at=now() where id=p_application_id;
  return jsonb_build_object('ok',true,'booking_table',case when v_request_id is not null then 'requests' else 'channel_requests' end,'booking_id',coalesce(v_request_id,v_channel_request_id));
end; $function$;

-- ---- Gate: responding to a booking request ----------------------------------
-- (only the subscription check changes; everything else is as it was)
create or replace function public.enforce_channel_request_transition()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
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

  if is_creator and old.status in ('pending') and new.status in ('awaiting_payment', 'countered') then
    if not exists (
      select 1 from public.publishers p
      where p.id = old.creator_id and public.publisher_is_activated(p.id)
    ) then
      raise exception 'An active Publisher Network subscription (or business activation for your own listing) is required to respond to new requests.';
    end if;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'awaiting_payment' then
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'declined' then
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'countered' then
    if new.counter_amount is null or new.counter_amount <= 0 then
      raise exception 'A counter-offer needs a real amount.';
    end if;
    new.countered_at := now();
    return new;
  end if;

  if is_business and old.status = 'countered' and new.status = 'awaiting_payment' then
    new.responded_at := now();
    new.proposed_amount := old.counter_amount;
    return new;
  end if;

  if is_business and old.status = 'countered' and new.status = 'cancelled' then
    return new;
  end if;

  if is_creator and old.status = 'paid' and new.status = 'live' then
    if not exists (
      select 1 from public.content_approvals ca
      where ca.channel_request_id = old.id and ca.status in ('approved', 'published')
    ) then
      raise exception 'Content must be approved before this can go live — see the Content Approval panel.';
    end if;
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
$function$;

-- ---- Self-booking guard ------------------------------------------------------
-- A business can never book its own listing (it would be both sides of the
-- sale and could farm ratings/completions).
create or replace function public.block_self_booking()
returns trigger
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare v_owner uuid;
begin
  if tg_table_name = 'requests' then
    select user_id into v_owner from public.publishers where id = new.publisher_id;
  else
    select user_id into v_owner from public.publishers where id = new.creator_id;
  end if;
  if v_owner is not null and v_owner = new.business_id then
    raise exception 'You cannot book your own listing.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_self_booking on public.requests;
create trigger trg_block_self_booking before insert on public.requests
  for each row execute function public.block_self_booking();
drop trigger if exists trg_block_self_booking on public.channel_requests;
create trigger trg_block_self_booking before insert on public.channel_requests
  for each row execute function public.block_self_booking();

-- ---- The creation RPC ---------------------------------------------------------
create or replace function public.create_business_publisher_listing(p_listing jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_channel text := coalesce(nullif(trim(p_listing->>'channel_slug'), ''), 'social-media');
  v_requires_verification boolean;
  v_live boolean;
  v_name text := nullif(trim(p_listing->>'name'), '');
  v_price numeric := nullif(p_listing->>'price_per_post', '')::numeric;
  v_platforms text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_listing->'platforms', '[]'::jsonb))), '{}');
  v_languages text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_listing->'languages', '[]'::jsonb))), '{}');
  v_placements text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_listing->'placement_types', '[]'::jsonb))), '{}');
  v_formats text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_listing->'accepted_ad_formats', '[]'::jsonb))), '{}');
  v_links jsonb := coalesce(p_listing->'social_verification_links', '[]'::jsonb);
  v_initials text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Log in first.'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.role <> 'business' then
    raise exception 'Only business accounts can create a listing this way.';
  end if;
  if not exists (select 1 from public.business_subscriptions where business_id = v_uid and status = 'active') then
    raise exception 'Activate your business account first — the activation fee unlocks creating a publisher listing.';
  end if;
  if exists (select 1 from public.publishers where user_id = v_uid) then
    raise exception 'You already have a publisher listing on this account.';
  end if;

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Give your listing a name (2–80 characters).';
  end if;
  if v_price is null or v_price < 50 then raise exception 'Price must be at least R50.'; end if;
  if v_price > 1000000 then raise exception 'That price looks wrong.'; end if;
  if nullif(trim(p_listing->>'city'), '') is null or nullif(trim(p_listing->>'province'), '') is null then
    raise exception 'City and province are required.';
  end if;
  if nullif(trim(p_listing->>'category'), '') is null then raise exception 'Pick a category.'; end if;
  if char_length(coalesce(p_listing->>'bio', '')) > 1500 or char_length(coalesce(p_listing->>'audience', '')) > 1500 then
    raise exception 'Bio and audience descriptions are limited to 1500 characters.';
  end if;

  select c.verification_required into v_requires_verification from public.channels c where c.slug = v_channel;
  if not found then raise exception 'Unknown channel.'; end if;

  -- Live immediately only where the platform's own verification rules allow it.
  v_live := not coalesce(v_requires_verification, false) and v_channel <> 'social-media';

  if v_channel = 'social-media' and (jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) > 6) then
    raise exception 'Social links must be a list of up to 6.';
  end if;

  v_initials := upper(left(regexp_replace(v_name, '[^[:alnum:] ]', '', 'g'), 1)
    || coalesce(left(nullif(split_part(regexp_replace(v_name, '[^[:alnum:] ]', '', 'g'), ' ', 2), ''), 1), ''));

  insert into public.publishers (
    name, city, province, suburb, category, platforms, followers, engagement, price_per_post,
    bio, audience, initials, user_id, email, mobile_number, languages, business_name,
    status, verified, channel_slug, placement_types, accepted_ad_formats,
    profile_image_url, creation_source, social_verification_links, channel_metadata
  ) values (
    v_name, trim(p_listing->>'city'), trim(p_listing->>'province'), nullif(trim(p_listing->>'suburb'), ''),
    trim(p_listing->>'category'), v_platforms,
    greatest(coalesce(nullif(p_listing->>'followers', '')::int, 0), 0),
    greatest(coalesce(nullif(p_listing->>'engagement', '')::numeric, 0), 0),
    v_price,
    coalesce(p_listing->>'bio', ''), coalesce(p_listing->>'audience', ''), v_initials, v_uid,
    (select email from auth.users where id = v_uid), nullif(trim(coalesce(p_listing->>'mobile_number', v_profile.phone)), ''),
    v_languages, coalesce(v_profile.company_name, v_name),
    case when v_live then 'approved' else 'pending_review' end,
    v_live,
    v_channel, nullif(v_placements, '{}'), nullif(v_formats, '{}'),
    nullif(trim(p_listing->>'profile_image_url'), ''), 'business', v_links,
    coalesce(p_listing->'channel_metadata', '{}'::jsonb)
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'live', v_live,
    'status', case when v_live then 'approved' else 'pending_review' end);
end;
$$;
revoke all on function public.create_business_publisher_listing(jsonb) from public;
grant execute on function public.create_business_publisher_listing(jsonb) to authenticated;
