-- Business-created listings: accept and validate real channel details, and
-- stop going live on unchecked numbers.
--
-- Before: create_business_publisher_listing() took one generic "followers"
-- number and no channel details, so a business website listing showed
-- "followers" and the profile fell back to the generic view; and every
-- channel without manual verification (website, podcast, radio, influencer)
-- went live immediately on a self-reported number.
--
-- Now:
--   * p_listing->'channel_metadata' (the same shape the publisher application
--     saves; see src/lib/channelOnboardingSchemas.ts) is validated and stored.
--   * The channel's lead number must be present for channels that have one
--     (visitors, downloads, weekly listeners, attendance, members, covers,
--     footfall, vehicles, daily customers).
--   * Authority channels (sports, events, community, associations, restaurants,
--     in-venue-screens, transport, informal-retail) must carry
--     authorityConfirmed = true; their publishers.followers is forced to 0.
--   * Digital channels (podcast, website, radio) take publishers.followers from
--     the metadata lead number, so the two cannot disagree.
--   * engagement / monthly_reach are only kept for social-media and influencer.
--   * Nothing goes live immediately any more: social-media, influencer,
--     podcast, website and radio wait for an ownership check (admin review
--     today; automated checks come with the ownership-check work), and the
--     proof-required channels still go through verification as before.
--
-- Safe to run twice (create or replace). Does not change who is allowed to
-- create a listing (still: business role + active business_subscriptions row,
-- one listing per account).

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
  v_meta jsonb := coalesce(p_listing->'channel_metadata', '{}'::jsonb);
  v_authority_channels constant text[] := array['sports','events','community','associations','restaurants','in-venue-screens','transport','informal-retail'];
  v_ownership_check_channels constant text[] := array['social-media','influencer','podcast','website','radio'];
  v_lead_key text;
  v_lead_raw text;
  v_lead numeric;
  v_followers integer;
  v_engagement numeric;
  v_reach integer;
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

  -- ---- channel_metadata: shape and the channel's lead number -----------------
  if jsonb_typeof(v_meta) <> 'object' then
    raise exception 'Channel details must be an object.';
  end if;
  if octet_length(v_meta::text) > 20000 then
    raise exception 'Channel details are too large.';
  end if;

  v_lead_key := case v_channel
    when 'podcast'          then 'averageDownloadsPerEpisode'
    when 'website'          then 'monthlyUniqueVisitors'
    when 'radio'            then 'weeklyListeners'
    when 'events'           then 'typicalAttendance'
    when 'community'        then 'memberCount'
    when 'associations'     then 'memberCount'
    when 'restaurants'      then 'estimatedDailyCovers'
    when 'in-venue-screens' then 'estimatedFootfallPerNight'
    when 'transport'        then 'vehicleCount'
    when 'informal-retail'  then 'estimatedDailyFootTraffic'
    else null   -- social-media, influencer (followers) and sports (attendance is optional)
  end;

  if v_lead_key is not null then
    v_lead_raw := v_meta->>v_lead_key;
    if v_lead_raw is null or v_lead_raw !~ '^[0-9]+(\.[0-9]+)?$' then
      raise exception 'Add the % for this channel (a number greater than 0).', v_lead_key;
    end if;
    v_lead := v_lead_raw::numeric;
    if v_lead <= 0 or v_lead > 2000000000 then
      raise exception 'The % for this channel must be greater than 0.', v_lead_key;
    end if;
  end if;

  if v_channel = any (v_authority_channels) then
    if coalesce(v_meta->>'authorityConfirmed', '') <> 'true' then
      raise exception 'Confirm that you own or run this and can sell advertising on it.';
    end if;
  end if;

  if v_channel = 'social-media' and (jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) = 0 or jsonb_array_length(v_links) > 6) then
    raise exception 'Social media listings need 1 to 6 public profile links.';
  end if;
  if v_channel <> 'social-media' and (jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) > 6) then
    raise exception 'Social links must be a list of up to 6.';
  end if;

  -- ---- numbers stored on the listing ------------------------------------------
  -- Authority channels have no audience figure to type: the real size lives in
  -- channel_metadata. Digital channels take their headline number from it so
  -- the two cannot disagree. Everything else keeps the figure the business gave.
  if v_channel = any (v_authority_channels) then
    v_followers := 0;
  elsif v_channel in ('podcast','website','radio') then
    v_followers := least(v_lead, 2000000000)::integer;
  else
    v_followers := greatest(coalesce(nullif(p_listing->>'followers', '')::integer, 0), 0);
    if v_followers <= 0 then
      raise exception 'Add your follower count.';
    end if;
  end if;

  -- Engagement and monthly reach only mean something for social media and influencers.
  if v_channel in ('social-media','influencer') then
    v_engagement := least(greatest(coalesce(nullif(p_listing->>'engagement', '')::numeric, 0), 0), 100);
    v_reach := nullif(p_listing->>'monthly_reach', '')::integer;
    if v_reach is not null and v_reach < 0 then v_reach := null; end if;
  else
    v_engagement := 0;
    v_reach := null;
  end if;

  -- Nothing goes live on numbers nobody has checked: digital channels wait for
  -- an ownership check, and verification_required channels for their proof.
  v_live := not coalesce(v_requires_verification, false) and not (v_channel = any (v_ownership_check_channels));

  v_initials := upper(left(regexp_replace(v_name, '[^[:alnum:] ]', '', 'g'), 1)
    || coalesce(left(nullif(split_part(regexp_replace(v_name, '[^[:alnum:] ]', '', 'g'), ' ', 2), ''), 1), ''));

  insert into public.publishers (
    name, city, province, suburb, category, platforms, followers, engagement, monthly_reach, price_per_post,
    bio, audience, initials, user_id, email, mobile_number, languages, business_name,
    status, verified, channel_slug, placement_types, accepted_ad_formats,
    profile_image_url, creation_source, social_verification_links, channel_metadata
  ) values (
    v_name, trim(p_listing->>'city'), trim(p_listing->>'province'), nullif(trim(p_listing->>'suburb'), ''),
    trim(p_listing->>'category'), v_platforms, v_followers, v_engagement, v_reach,
    v_price,
    coalesce(p_listing->>'bio', ''), coalesce(p_listing->>'audience', ''), v_initials, v_uid,
    (select email from auth.users where id = v_uid), nullif(trim(coalesce(p_listing->>'mobile_number', v_profile.phone)), ''),
    v_languages, coalesce(v_profile.company_name, v_name),
    case when v_live then 'approved' else 'pending_review' end,
    v_live,
    v_channel, nullif(v_placements, '{}'), nullif(v_formats, '{}'),
    nullif(trim(p_listing->>'profile_image_url'), ''), 'business', v_links,
    v_meta
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'live', v_live,
    'status', case when v_live then 'approved' else 'pending_review' end);
end;
$$;
revoke all on function public.create_business_publisher_listing(jsonb) from public;
grant execute on function public.create_business_publisher_listing(jsonb) to authenticated;
