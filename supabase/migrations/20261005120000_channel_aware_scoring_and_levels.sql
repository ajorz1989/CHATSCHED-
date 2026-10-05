-- Channel-aware scoring and levels (audit Step 5).
--
-- Before:
--   * Levels (rising/verified/premium/elite) were decided from publishers.followers
--     alone, so authority channels (followers = 0) could never get a level and a
--     podcast was judged on the follower scale.
--   * 30 of the 100 score points were engagement %, which only social media and
--     influencer have; every other channel scored 0 there.
--   * Completion record / response time / reviews only looked at the older
--     `requests` table, never `channel_requests`.
--   * The refresh ran as whoever triggered it. For a business leaving a review or
--     completing a booking, trg_enforce_publisher_self_update rejected the write
--     ("You can only update your own listing"), failing the review/booking itself;
--     for the listing owner it silently reverted the new numbers. Scores only ever
--     updated from admin/system sessions.
--   * Scores were only calculated when a booking or review happened, so a new
--     listing sat at score 0 / no level.
--
-- Now:
--   * Each channel has its own audience number ("lead number") and its own
--     rising/verified/premium/elite ladder (see listing_audience()). The level
--     rules other than the number are unchanged: verified also needs a verified
--     phone and 6+ months, elite also needs identity verified.
--   * Score: social/influencer unchanged (engagement 30 + followers 5). Every other
--     channel gets 35 points from its lead number on its own ladder: 0 below
--     "rising", 20% at "rising", rising smoothly (log scale) to 100% at "elite".
--     Delivery record (25) and reviews (20) as before; parts with no data yet are
--     left out, not counted against the listing.
--   * Delivery record and response time count channel_requests as well.
--   * Trust score gains +15 for confirmed ownership (code check for social /
--     influencer / website, proof-verified for authority channels). Podcast and
--     radio have no ownership check yet, so that part is left out for them.
--   * The refresh now works for any caller (a flag lets only the five computed
--     columns change), and also runs when a listing is created or approved or its
--     audience / verification fields change, and when a channel booking completes.
--   * Existing listings with a hand-set score are NOT recalculated by this
--     migration; only listings never scored (score 0 and trust 0) are filled in.
--
-- Safe to run twice.

-- ── 1. Helpers ───────────────────────────────────────────────────────────

create or replace function public._meta_num(p_meta jsonb, p_key text)
returns numeric
language sql immutable
as $$
  select case when p_meta is not null and jsonb_typeof(p_meta) = 'object'
                and (p_meta->>p_key) ~ '^[0-9]+(\.[0-9]+)?$'
              then nullif((p_meta->>p_key)::numeric, 0)
         end;
$$;

-- The audience number a channel is judged on, and that channel's level ladder
-- {rising, verified, premium, elite}. Mirrors src/lib/leadAudience.ts.
create or replace function public.listing_audience(
  p_channel text, p_meta jsonb, p_followers integer,
  out lead numeric, out ladder numeric[]
)
language plpgsql immutable
as $$
begin
  lead := null; ladder := null;
  case p_channel
    when 'social-media', 'influencer' then
      lead := nullif(p_followers, 0);            ladder := array[3000, 5000, 20000, 100000];
    when 'podcast' then
      lead := coalesce(public._meta_num(p_meta, 'averageDownloadsPerEpisode'), nullif(p_followers, 0));
      ladder := array[500, 2000, 10000, 50000];
    when 'website' then
      lead := coalesce(public._meta_num(p_meta, 'monthlyUniqueVisitors'), nullif(p_followers, 0));
      ladder := array[3000, 10000, 50000, 250000];
    when 'radio' then
      lead := coalesce(public._meta_num(p_meta, 'weeklyListeners'), public._meta_num(p_meta, 'averageDailyListenership'), nullif(p_followers, 0));
      ladder := array[2000, 10000, 50000, 250000];
    when 'events' then
      lead := public._meta_num(p_meta, 'typicalAttendance');          ladder := array[100, 500, 2500, 10000];
    when 'sports' then
      lead := public._meta_num(p_meta, 'averageMatchdayAttendance');  ladder := array[100, 500, 2500, 10000];
    when 'community' then
      lead := public._meta_num(p_meta, 'memberCount');                ladder := array[300, 1000, 5000, 25000];
    when 'associations' then
      lead := public._meta_num(p_meta, 'memberCount');                ladder := array[100, 500, 2500, 10000];
    when 'restaurants' then
      lead := public._meta_num(p_meta, 'estimatedDailyCovers');       ladder := array[30, 100, 300, 800];
    when 'in-venue-screens' then
      lead := public._meta_num(p_meta, 'estimatedFootfallPerNight');  ladder := array[100, 500, 2000, 8000];
    when 'transport' then
      if public._meta_num(p_meta, 'estimatedDailyPassengers') is not null then
        lead := public._meta_num(p_meta, 'estimatedDailyPassengers'); ladder := array[200, 1000, 5000, 20000];
      else
        lead := public._meta_num(p_meta, 'vehicleCount');             ladder := array[3, 10, 50, 200];
      end if;
    when 'informal-retail' then
      lead := public._meta_num(p_meta, 'estimatedDailyFootTraffic');  ladder := array[50, 150, 500, 1500];
    else
      null;
  end case;
end;
$$;

-- ── 2. Level ─────────────────────────────────────────────────────────────

create or replace function public.assign_publisher_level(p_publisher_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_publisher public.publishers%rowtype;
  v_lead numeric;
  v_ladder numeric[];
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found or v_publisher.status <> 'approved' then return null; end if;

  select a.lead, a.ladder into v_lead, v_ladder
    from public.listing_audience(v_publisher.channel_slug, v_publisher.channel_metadata, v_publisher.followers) a;
  if v_lead is null or v_ladder is null then return null; end if;

  if v_lead >= v_ladder[4] and v_publisher.identity_verified then
    return 'elite';
  elsif v_lead >= v_ladder[3] then
    return 'premium';
  elsif v_lead >= v_ladder[2] and v_publisher.phone_verified
        and coalesce(v_publisher.account_age_months, 0) >= 6 then
    return 'verified';
  elsif v_lead >= v_ladder[1] then
    return 'rising';
  else
    return null;
  end if;
end;
$$;

-- ── 3. Delivery record (both booking tables) ─────────────────────────────

create or replace function public._publisher_delivery_counts(p_publisher_id uuid, out completed integer, out resolved integer)
language plpgsql stable security definer
set search_path = public
as $$
declare c1 integer; r1 integer; c2 integer; r2 integer;
begin
  select count(*) filter (where status = 'completed'),
         count(*) filter (where status in ('completed', 'declined'))
    into c1, r1 from public.requests where publisher_id = p_publisher_id;
  -- A channel booking the creator cancelled counts against them; one the
  -- business or an admin cancelled does not.
  select count(*) filter (where status = 'completed'),
         count(*) filter (where status in ('completed', 'declined')
                          or (status = 'cancelled' and cancelled_by = 'creator'))
    into c2, r2 from public.channel_requests where creator_id = p_publisher_id;
  completed := coalesce(c1, 0) + coalesce(c2, 0);
  resolved  := coalesce(r1, 0) + coalesce(r2, 0);
end;
$$;

-- ── 4. Publisher score ───────────────────────────────────────────────────

create or replace function public.calculate_publisher_score(p_publisher_id uuid)
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
  v_lead numeric;
  v_ladder numeric[];
  v_factor numeric;
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found then return 0; end if;

  if v_publisher.channel_slug in ('social-media', 'influencer') or v_publisher.channel_slug is null then
    -- unchanged for the two channels that have engagement
    v_available := v_available + 30;
    v_weighted := v_weighted + least(coalesce(v_publisher.engagement, 0) / 10.0, 1) * 30;
    v_available := v_available + 5;
    v_weighted := v_weighted + least(coalesce(v_publisher.followers, 0) / 100000.0, 1) * 5;
  else
    select a.lead, a.ladder into v_lead, v_ladder
      from public.listing_audience(v_publisher.channel_slug, v_publisher.channel_metadata, v_publisher.followers) a;
    if v_lead is not null and v_ladder is not null then
      v_available := v_available + 35;
      if v_lead >= v_ladder[1] then
        v_factor := 0.2 + 0.8 * least(1, greatest(0,
          (ln(v_lead) - ln(v_ladder[1])) / (ln(v_ladder[4]) - ln(v_ladder[1]))));
        v_weighted := v_weighted + v_factor * 35;
      end if;
    end if;
  end if;

  select d.completed, d.resolved into v_completed, v_resolved from public._publisher_delivery_counts(p_publisher_id) d;
  if coalesce(v_resolved, 0) > 0 then
    v_available := v_available + 25;
    v_weighted := v_weighted + (v_completed::numeric / v_resolved) * 25;
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
    v_weighted := v_weighted + (v_review_avg / 5.0) * 20;
  end if;

  if v_available = 0 then return 0; end if;
  return round(least(v_weighted / v_available * 100, 100));
end;
$$;

-- ── 5. Trust score ───────────────────────────────────────────────────────

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

  -- Ownership confirmed: code check (social / influencer / website) or the
  -- proof checklist (authority channels). Podcast and radio have none yet.
  if v_publisher.channel_slug in ('social-media', 'influencer', 'website') then
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

-- ── 6. Refresh: works for any caller ─────────────────────────────────────

create or replace function public.refresh_publisher_scores(p_publisher_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_completed integer;
  v_resolved integer;
begin
  select d.completed, d.resolved into v_completed, v_resolved from public._publisher_delivery_counts(p_publisher_id) d;

  -- Tell trg_enforce_publisher_self_update this write is the system's own score
  -- refresh, so a business or owner who merely triggered it is not rejected (or
  -- silently reverted). The flag only lets the five computed columns change.
  perform set_config('chatsched.score_refresh', 'on', true);
  update public.publishers
     set trust_score = public.calculate_trust_score(p_publisher_id),
         publisher_score = public.calculate_publisher_score(p_publisher_id),
         level = public.assign_publisher_level(p_publisher_id),
         completed_campaigns = v_completed,
         resolved_campaigns = v_resolved
   where id = p_publisher_id;
  perform set_config('chatsched.score_refresh', '', true);
end;
$$;

revoke execute on function public.refresh_publisher_scores(uuid) from public, anon;
grant execute on function public.refresh_publisher_scores(uuid) to authenticated, service_role;

create or replace function public.enforce_publisher_self_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_price numeric;
  new_placement_types text[];
  new_accepted_ad_formats text[];
  new_name text;
  new_category text;
  new_province text;
  new_city text;
  new_suburb text;
  new_bio text;
  new_audience text;
  new_mobile_number text;
  new_business_name text;
  new_company_registration text;
  new_vat_number text;
  new_intro_video_url text;
  new_portfolio_images text[];
  new_profile_image_url text;
  new_social_verification_links jsonb;
  new_social_verification_code text;
  new_social_verification_code_generated_at timestamptz;
  new_social_verification_confirmed boolean;
  new_social_verification_confirmed_at timestamptz;
  new_social_verification_confirmed_by uuid;
  s_trust smallint;
  s_score smallint;
  s_level text;
  s_completed integer;
  s_resolved integer;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  -- System score refresh (refresh_publisher_scores): only the computed columns
  -- may change, whoever triggered it.
  if coalesce(current_setting('chatsched.score_refresh', true), '') = 'on' then
    s_trust := new.trust_score; s_score := new.publisher_score; s_level := new.level;
    s_completed := new.completed_campaigns; s_resolved := new.resolved_campaigns;
    new := old;
    new.trust_score := s_trust; new.publisher_score := s_score; new.level := s_level;
    new.completed_campaigns := s_completed; new.resolved_campaigns := s_resolved;
    return new;
  end if;

  if old.user_id is null or old.user_id <> auth.uid() then
    raise exception 'You can only update your own listing.';
  end if;

  new_price := new.price_per_post;
  if new_price is null or new_price < 50 then
    raise exception 'Price must be at least R50.';
  end if;

  new_placement_types := new.placement_types;
  new_accepted_ad_formats := new.accepted_ad_formats;

  new_name := coalesce(nullif(trim(new.name), ''), old.name);
  new_category := coalesce(new.category, old.category);
  new_province := coalesce(nullif(trim(new.province), ''), old.province);
  new_city := coalesce(nullif(trim(new.city), ''), old.city);
  new_suburb := new.suburb;
  new_bio := new.bio;
  new_audience := new.audience;
  new_mobile_number := new.mobile_number;
  new_business_name := new.business_name;
  new_company_registration := new.company_registration;
  new_vat_number := new.vat_number;
  new_intro_video_url := new.intro_video_url;
  new_portfolio_images := new.portfolio_images;
  new_profile_image_url := new.profile_image_url;
  new_social_verification_links := new.social_verification_links;
  new_social_verification_code := new.social_verification_code;
  new_social_verification_code_generated_at := new.social_verification_code_generated_at;
  new_social_verification_confirmed := new.social_verification_confirmed;
  new_social_verification_confirmed_at := new.social_verification_confirmed_at;
  new_social_verification_confirmed_by := new.social_verification_confirmed_by;

  new := old;
  new.price_per_post := new_price;
  new.placement_types := new_placement_types;
  new.accepted_ad_formats := new_accepted_ad_formats;
  new.name := new_name;
  new.category := new_category;
  new.province := new_province;
  new.city := new_city;
  new.suburb := new_suburb;
  new.bio := new_bio;
  new.audience := new_audience;
  new.mobile_number := new_mobile_number;
  new.business_name := new_business_name;
  new.company_registration := new_company_registration;
  new.vat_number := new_vat_number;
  new.intro_video_url := new_intro_video_url;
  new.portfolio_images := new_portfolio_images;
  new.profile_image_url := new_profile_image_url;
  new.social_verification_links := new_social_verification_links;
  new.social_verification_code := new_social_verification_code;
  new.social_verification_code_generated_at := new_social_verification_code_generated_at;
  new.social_verification_confirmed := new_social_verification_confirmed;
  new.social_verification_confirmed_at := new_social_verification_confirmed_at;
  new.social_verification_confirmed_by := new_social_verification_confirmed_by;
  return new;
end;
$$;

-- ── 7. When scores are refreshed ─────────────────────────────────────────

-- A listing is created, approved, or one of the fields the score reads changes.
-- (UPDATE OF lists the columns named in the SET clause, so the refresh's own
-- write to the score columns does not fire this again.)
create or replace function public.trg_refresh_scores_on_publisher()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.refresh_publisher_scores(new.id);
  return null;
end;
$$;

drop trigger if exists trg_publisher_score_refresh on public.publishers;
create trigger trg_publisher_score_refresh
  after insert or update of status, verified, followers, engagement, channel_slug, channel_metadata,
    social_verification_confirmed, email_verified, phone_verified, identity_verified, account_age_months
  on public.publishers
  for each row execute function public.trg_refresh_scores_on_publisher();

-- A channel booking finishes, is declined, is cancelled, or gets a response.
create or replace function public.trg_refresh_scores_on_channel_request()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if (old.status is distinct from new.status and new.status in ('completed', 'declined', 'cancelled'))
     or old.responded_at is distinct from new.responded_at then
    perform public.refresh_publisher_scores(new.creator_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_channel_request_score_refresh on public.channel_requests;
create trigger trg_channel_request_score_refresh
  after update on public.channel_requests
  for each row execute function public.trg_refresh_scores_on_channel_request();

-- Make the existing request/review triggers run with the same permissions.
alter function public.trg_refresh_scores_on_request() security definer set search_path = public;
alter function public.trg_refresh_scores_on_review() security definer set search_path = public;

-- ── 8. Fill in listings that have never been scored (leave hand-set ones) ──

do $$
declare r record;
begin
  for r in select id from public.publishers where coalesce(publisher_score, 0) = 0 and coalesce(trust_score, 0) = 0 loop
    perform public.refresh_publisher_scores(r.id);
  end loop;
end $$;
