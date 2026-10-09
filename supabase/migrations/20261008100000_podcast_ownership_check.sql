-- Podcast ownership check (audit Step 4, podcast part).
--
-- Before: a podcast listing could be approved on self-reported details alone.
-- Now it cannot be approved until its owner has put their ChatSched code (the same
-- CS-XXXXX code social, influencer and website publishers use) in the show
-- description or an episode's notes, and the verify-podcast-ownership edge
-- function (or an admin) has confirmed it. The listing must also carry the show's
-- RSS feed address (channel_metadata.showUrl) so there is something to check.
--
-- Reuses the existing columns (social_verification_code / social_verification_confirmed*),
-- so nothing needs adding to the self-update whitelist. Existing approved listings
-- are untouched: the checks only run when a listing is being approved. Pending
-- podcast applications now need the check before an admin can approve them.
--
-- The trust score also counts the confirmed check (+15, same as social / influencer /
-- website) for podcasts from the next refresh of each listing.
--
-- Safe to run twice (create or replace).

create or replace function public.enforce_publisher_channel_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_requires_verification boolean := false;
  v_needs_links boolean := false;
  v_needs_ownership_code boolean := false;
  v_requires_check boolean := false;
  v_checks_valid boolean := false;
  v_proof_valid boolean := false;
begin
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  select coalesce(c.verification_required, false)
    into v_requires_verification
  from public.channels c
  where c.slug = new.channel_slug;

  v_needs_links := new.channel_slug in ('social-media', 'influencer');
  v_needs_ownership_code := new.channel_slug in ('social-media', 'influencer', 'website', 'podcast');

  v_requires_check :=
    v_requires_verification
    and (
      (tg_op = 'INSERT' and (new.status = 'approved' or new.verified = true))
      or (
        tg_op = 'UPDATE'
        and (
          (old.status is distinct from 'approved' and new.status = 'approved')
          or (old.verified is distinct from true and new.verified = true)
          or (
            old.channel_slug is distinct from new.channel_slug
            and (new.status = 'approved' or new.verified = true)
          )
        )
      )
    );

  if v_requires_check then
    select exists (
      select 1
      from public.publisher_verification_checks vc
      where vc.publisher_id = new.id
        and vc.channel_slug = new.channel_slug
        and vc.checks_total > 0
        and cardinality(vc.checks_confirmed) = vc.checks_total
        and cardinality(
          array(
            select distinct x
            from unnest(vc.checks_confirmed) as u(x)
          )
        ) = vc.checks_total
    )
    into v_checks_valid;

    select
      coalesce(array_length(new.verification_proof_urls, 1), 0) > 0
      and not exists (
        select 1
        from unnest(coalesce(new.verification_proof_urls, '{}'::text[])) as submitted(path)
        where not exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'publisher-verification-proof'
            and o.name = submitted.path
        )
      )
    into v_proof_valid;

    if not v_checks_valid then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification is incomplete. Every required verification check must be confirmed before this publisher can be approved or verified.';
    end if;

    if not v_proof_valid then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification requires at least one uploaded verification evidence file before this publisher can be approved or verified.';
    end if;
  end if;

  if v_needs_ownership_code and (
    (tg_op = 'INSERT' and (new.status = 'approved' or new.verified = true))
    or (
      tg_op = 'UPDATE'
      and (
        (old.status is distinct from 'approved' and new.status = 'approved')
        or (old.verified is distinct from true and new.verified = true)
      )
    )
  ) then
    if v_needs_links then
      if jsonb_typeof(new.social_verification_links) <> 'array'
         or jsonb_array_length(new.social_verification_links) = 0 then
        raise exception using
          errcode = '23514',
          message = 'This listing needs at least one public profile URL before it can be verified.';
      end if;

      if exists (
        select 1
        from jsonb_array_elements(new.social_verification_links) as link
        where coalesce(link->>'platform', '') = ''
           or coalesce(link->>'url', '') = ''
           or (link->>'url') !~* '^https?://'
      ) then
        raise exception using
          errcode = '23514',
          message = 'Every verification link must include a platform and a valid http or https URL.';
      end if;
    end if;

    if new.channel_slug = 'website'
       and nullif(trim(coalesce(new.channel_metadata->>'domain', '')), '') is null then
      raise exception using
        errcode = '23514',
        message = 'Website verification requires the website domain to be filled in on the listing.';
    end if;

    if new.channel_slug = 'podcast'
       and nullif(trim(coalesce(new.channel_metadata->>'showUrl', '')), '') is null then
      raise exception using
        errcode = '23514',
        message = 'Podcast verification requires the show (RSS feed) address to be filled in on the listing.';
    end if;

    if not coalesce(new.social_verification_confirmed, false) then
      raise exception using
        errcode = '23514',
        message = 'Ownership of this listing must be confirmed (code found on the profile, website or podcast feed) before approval.';
    end if;
  end if;

  return new;
end;
$$;


create or replace function public.approve_publisher_application(
  p_publisher_id uuid,
  p_checks_confirmed text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_channel_slug text;
  v_requires_verification boolean := false;
  v_needs_links boolean := false;
  v_needs_ownership_code boolean := false;
  v_social_links jsonb;
  v_confirmed boolean;
  v_domain text;
  v_show_url text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve publisher applications.';
  end if;

  select
    p.channel_slug,
    coalesce(c.verification_required, false),
    (p.channel_slug in ('social-media', 'influencer')),
    (p.channel_slug in ('social-media', 'influencer', 'website', 'podcast')),
    p.social_verification_links,
    p.social_verification_confirmed,
    nullif(trim(coalesce(p.channel_metadata->>'domain', '')), ''),
    nullif(trim(coalesce(p.channel_metadata->>'showUrl', '')), '')
  into
    v_channel_slug,
    v_requires_verification,
    v_needs_links,
    v_needs_ownership_code,
    v_social_links,
    v_confirmed,
    v_domain,
    v_show_url
  from public.publishers p
  left join public.channels c on c.slug = p.channel_slug
  where p.id = p_publisher_id;

  if v_channel_slug is null then
    raise exception 'Publisher application not found.';
  end if;

  if v_requires_verification then
    if cardinality(coalesce(p_checks_confirmed, '{}')) = 0 then
      raise exception 'All high-trust verification checks must be confirmed before approval.';
    end if;

    insert into public.publisher_verification_checks (
      publisher_id,
      channel_slug,
      checks_confirmed,
      checks_total,
      updated_by,
      updated_at
    )
    values (
      p_publisher_id,
      v_channel_slug,
      p_checks_confirmed,
      cardinality(p_checks_confirmed),
      auth.uid(),
      now()
    )
    on conflict (publisher_id) do update
      set channel_slug = excluded.channel_slug,
          checks_confirmed = excluded.checks_confirmed,
          checks_total = excluded.checks_total,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
  end if;

  if v_needs_ownership_code then
    if v_needs_links and (jsonb_typeof(v_social_links) <> 'array' or jsonb_array_length(v_social_links) = 0) then
      raise exception 'This listing needs at least one public profile URL before it can be verified.';
    end if;
    if v_channel_slug = 'website' and v_domain is null then
      raise exception 'Website verification requires the website domain to be filled in on the listing.';
    end if;
    if v_channel_slug = 'podcast' and v_show_url is null then
      raise exception 'Podcast verification requires the show (RSS feed) address to be filled in on the listing.';
    end if;
    if not coalesce(v_confirmed, false) then
      raise exception 'Ownership of this listing must be confirmed (code found on the profile, website or podcast feed) before approval.';
    end if;
  end if;

  update public.publishers
  set
    status = 'approved',
    verified = case when v_requires_verification or v_needs_ownership_code then true else verified end,
    reviewed_at = now(),
    rejected_reason = null
  where id = p_publisher_id;
end;
$$;

revoke execute on function public.approve_publisher_application(uuid, text[]) from public, anon, authenticated;
grant execute on function public.approve_publisher_application(uuid, text[]) to authenticated;

create or replace function public.calculate_trust_score(p_publisher_id uuid)
returns smallint
language plpgsql security definer
set search_path = public
as $$
declare
  v_publisher public.publishers%rowtype;
  v_weighted numeric := 0;
  v_available numeric := 0;
  v_review_avg numeric;
  v_completed integer;
  v_resolved integer;
  v_avg_response_hours numeric;
  v_authority constant text[] := array['sports','events','community','associations','restaurants','in-venue-screens','transport','informal-retail'];
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found then return 0; end if;

  v_available := v_available + 10;
  if v_publisher.email_verified then v_weighted := v_weighted + 10; end if;

  v_available := v_available + 10;
  if v_publisher.phone_verified then v_weighted := v_weighted + 10; end if;

  v_available := v_available + 15;
  if v_publisher.identity_verified then v_weighted := v_weighted + 15; end if;

  v_available := v_available + 10;
  if coalesce(v_publisher.account_age_months, 0) >= 6 then v_weighted := v_weighted + 10; end if;

  -- Ownership confirmed: code check (social / influencer / website / podcast) or the
  -- proof checklist (authority channels). Radio has none yet.
  if v_publisher.channel_slug in ('social-media', 'influencer', 'website', 'podcast') then
    v_available := v_available + 15;
    if coalesce(v_publisher.social_verification_confirmed, false) then v_weighted := v_weighted + 15; end if;
  elsif v_publisher.channel_slug = any (v_authority) then
    v_available := v_available + 15;
    if coalesce(v_publisher.verified, false) then v_weighted := v_weighted + 15; end if;
  end if;

  select avg(coalesce(
      (communication_rating + professionalism_rating + quality_rating + timeliness_rating + value_rating) / 5.0,
      rating
    ))
    into v_review_avg
    from public.reviews
    where publisher_id = p_publisher_id and author_role = 'business';
  if v_review_avg is not null then
    v_available := v_available + 20;
    v_weighted := v_weighted + least(v_review_avg / 5.0, 1) * 20;
  end if;

  select d.completed, d.resolved into v_completed, v_resolved from public._publisher_delivery_counts(p_publisher_id) d;
  if v_completed > 0 then
    v_available := v_available + 20;
    v_weighted := v_weighted + least(v_completed, 10) * 2;
  end if;

  select avg(h) into v_avg_response_hours from (
    select extract(epoch from (first_contacted_at - created_at)) / 3600 as h
      from public.requests where publisher_id = p_publisher_id and first_contacted_at is not null
    union all
    select extract(epoch from (responded_at - created_at)) / 3600
      from public.channel_requests where creator_id = p_publisher_id and responded_at is not null
  ) t;
  if v_avg_response_hours is not null then
    v_available := v_available + 10;
    v_weighted := v_weighted + greatest(0, least(1, (48 - v_avg_response_hours) / 48)) * 10;
  end if;

  if v_available = 0 then return 0; end if;
  return round(least(v_weighted / v_available * 100, 100));
end;
$$;
