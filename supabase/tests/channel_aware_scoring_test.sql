-- Rolled-back test for 20261005120000_channel_aware_scoring_and_levels.sql
--
-- Run in the Supabase SQL editor AFTER applying the migration. Creates throw-away
-- users and listings, checks levels / scores / the refresh fix, and ends with
-- RAISE EXCEPTION so NOTHING is saved. The exception message is the report:
-- "ALL PASS" (or "n FAILED") and then a before/after table for every approved
-- listing (stored values vs what the new rules give, read-only).
--
-- Status: the migration is applied in production. The connector cancels this
-- test (it writes temporary rows), so it has to be run in the SQL editor; only
-- section 6 (the before/after table) has been run so far, as a plain select.

do $$
declare
  report text := '';
  fails int := 0;
  u_owner uuid := gen_random_uuid();
  u_biz   uuid := gen_random_uuid();
  u_other uuid := gen_random_uuid();
  p uuid;
  v_level text;
  v_score int;
  v_pub public.publishers%rowtype;
  r record;
  c record;
  v_cr uuid;
  lad numeric[];
  lead_v numeric;
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  insert into auth.users (id, email) values
    (u_owner, 'sc2-owner@example.test'), (u_biz, 'sc2-biz@example.test'), (u_other, 'sc2-other@example.test');

  -- 1. lead number and ladder per channel -----------------------------------
  for c in select * from (values
    ('podcast',          '{"averageDownloadsPerEpisode": 600}'::jsonb, 0, 600::numeric,   500::numeric),
    ('website',          '{"monthlyUniqueVisitors": 12000}',           0, 12000,          3000),
    ('radio',            '{"weeklyListeners": 4000}',                  0, 4000,           2000),
    ('radio',            '{"averageDailyListenership": 900}',          0, 900,            2000),
    ('events',           '{"typicalAttendance": 250}',                 0, 250,            100),
    ('sports',           '{"averageMatchdayAttendance": 300}',         0, 300,            100),
    ('community',        '{"memberCount": 800}',                       0, 800,            300),
    ('associations',     '{"memberCount": 150}',                       0, 150,            100),
    ('restaurants',      '{"estimatedDailyCovers": 60}',               0, 60,             30),
    ('in-venue-screens', '{"estimatedFootfallPerNight": 700}',         0, 700,            100),
    ('transport',        '{"estimatedDailyPassengers": 900}',          0, 900,            200),
    ('transport',        '{"vehicleCount": 12}',                       0, 12,             3),
    ('informal-retail',  '{"estimatedDailyFootTraffic": 120}',         0, 120,            50),
    ('social-media',     '{}',                                         5000, 5000,        3000),
    ('website',          '{}',                                         7000, 7000,        3000)   -- legacy: falls back to stored followers
  ) as t(ch, meta, fol, want_lead, want_first)
  loop
    select a.lead, a.ladder into lead_v, lad from public.listing_audience(c.ch, c.meta, c.fol) a;
    if lead_v = c.want_lead and lad[1] = c.want_first then
      report := report || E'\nok   1 ' || c.ch || ' lead=' || lead_v;
    else
      fails := fails + 1; report := report || E'\nFAIL 1 ' || c.ch || ' got lead=' || coalesce(lead_v::text,'null') || ' first=' || coalesce(lad[1]::text,'null');
    end if;
  end loop;
  select a.lead into lead_v from public.listing_audience('sports', '{}', 0) a;
  if lead_v is null then report := report || E'\nok   1 sports without attendance has no lead number';
  else fails := fails + 1; report := report || E'\nFAIL 1 sports without attendance got ' || lead_v; end if;
  select a.lead into lead_v from public.listing_audience('community', '{"memberCount": "lots"}', 0) a;
  if lead_v is null then report := report || E'\nok   1 junk value ignored';
  else fails := fails + 1; report := report || E'\nFAIL 1 junk value used'; end if;

  -- 2. levels ---------------------------------------------------------------
  for c in select * from (values
    ('website',    '{"monthlyUniqueVisitors": 2999}'::jsonb, 'approved', false, false, 0,  null::text),
    ('website',    '{"monthlyUniqueVisitors": 3000}',        'approved', false, false, 0,  'rising'),
    ('website',    '{"monthlyUniqueVisitors": 12000}',       'approved', true,  false, 12, 'verified'),
    ('website',    '{"monthlyUniqueVisitors": 12000}',       'approved', false, false, 12, 'rising'),
    ('website',    '{"monthlyUniqueVisitors": 60000}',       'approved', false, false, 0,  'premium'),
    ('website',    '{"monthlyUniqueVisitors": 300000}',      'approved', false, false, 0,  'premium'),
    ('website',    '{"monthlyUniqueVisitors": 300000}',      'approved', false, true,  0,  'elite'),
    ('website',    '{"monthlyUniqueVisitors": 60000}',       'pending_review', false, false, 0, null),
    ('podcast',    '{"averageDownloadsPerEpisode": 600}',    'approved', false, false, 0,  'rising'),
    ('radio',      '{"weeklyListeners": 1999}',              'approved', false, false, 0,  null),
    ('radio',      '{"weeklyListeners": 2000}',              'approved', false, false, 0,  'rising'),
    ('community',  '{"memberCount": 5000}',                  'approved', false, false, 0,  'premium'),
    ('restaurants','{"estimatedDailyCovers": 800}',          'approved', false, true,  0,  'elite'),
    ('transport',  '{"vehicleCount": 60}',                   'approved', false, false, 0,  'premium'),
    ('sports',     '{}',                                     'approved', false, false, 0,  null)
  ) as t(ch, meta, st, phone, ident, age, want)
  loop
    p := gen_random_uuid();
    insert into public.publishers (id, user_id, name, category, channel_slug, city, province, status, price_per_post, channel_metadata, phone_verified, identity_verified, account_age_months)
      values (p, u_other, 'Lvl ' || c.ch, 'Retail', c.ch, 'Cape Town', 'Western Cape', c.st, 500, c.meta, c.phone, c.ident, c.age);
    select level into v_level from public.publishers where id = p;   -- set by the new insert trigger
    if v_level is not distinct from c.want then
      report := report || E'\nok   2 ' || c.ch || ' ' || c.meta::text || ' ' || c.st || ' -> ' || coalesce(v_level, 'no level');
    else
      fails := fails + 1; report := report || E'\nFAIL 2 ' || c.ch || ' ' || c.meta::text || ' ' || c.st || ' want ' || coalesce(c.want,'none') || ' got ' || coalesce(v_level,'none');
    end if;
    delete from public.publishers where id = p;
  end loop;

  -- 3. scores ---------------------------------------------------------------
  for c in select * from (values
    ('website', '{"monthlyUniqueVisitors": 3000}'::jsonb,   0::numeric, 0::int, 20),
    ('website', '{"monthlyUniqueVisitors": 250000}',        0, 0, 100),
    ('website', '{"monthlyUniqueVisitors": 2000}',          0, 0, 0),
    ('social-media', '{}',                                  5, 20000, 46)       -- (5/10*30 + 0.2*5) / 35
  ) as t(ch, meta, eng, fol, want)
  loop
    p := gen_random_uuid();
    insert into public.publishers (id, user_id, name, category, channel_slug, city, province, status, price_per_post, channel_metadata, engagement, followers)
      values (p, u_other, 'Scr ' || c.ch, 'Retail', c.ch, 'Cape Town', 'Western Cape', 'approved', 500, c.meta, c.eng, c.fol);
    select publisher_score into v_score from public.publishers where id = p;
    if v_score = c.want then report := report || E'\nok   3 ' || c.ch || ' ' || c.meta::text || ' score ' || v_score;
    else fails := fails + 1; report := report || E'\nFAIL 3 ' || c.ch || ' ' || c.meta::text || ' want ' || c.want || ' got ' || coalesce(v_score::text,'null'); end if;
    delete from public.publishers where id = p;
  end loop;

  -- 4. refresh works for a non-owner and an owner; owner cannot write scores ---
  p := gen_random_uuid();
  insert into public.publishers (id, user_id, name, category, channel_slug, city, province, status, price_per_post, channel_metadata)
    values (p, u_owner, 'Refresh Probe', 'Retail', 'website', 'Cape Town', 'Western Cape', 'approved', 500, '{"monthlyUniqueVisitors": 12000}');
  update public.publishers set level = null, publisher_score = 0, trust_score = 0 where id = p;   -- blank it (postgres session)

  perform set_config('request.jwt.claims', json_build_object('sub', u_biz, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_biz::text, true);
  begin
    perform public.refresh_publisher_scores(p);
    select * into v_pub from public.publishers where id = p;
    if v_pub.level = 'rising' and v_pub.publisher_score > 0 then report := report || E'\nok   4a refresh by a non-owner (e.g. a business leaving a review) works';
    else fails := fails + 1; report := report || E'\nFAIL 4a level=' || coalesce(v_pub.level,'null') || ' score=' || v_pub.publisher_score; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL 4a raised: ' || sqlerrm;
  end;

  begin
    update public.publishers set price_per_post = 99999 where id = p;
    fails := fails + 1; report := report || E'\nFAIL 4b a non-owner changed a listing';
  exception when others then report := report || E'\nok   4b a non-owner still cannot edit a listing: ' || sqlerrm;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  begin
    update public.publishers set publisher_score = 100, trust_score = 100, level = 'elite' where id = p;
    select * into v_pub from public.publishers where id = p;
    if v_pub.level = 'elite' or v_pub.publisher_score = 100 or v_pub.trust_score = 100 then
      fails := fails + 1; report := report || E'\nFAIL 4c owner wrote their own score/level';
    else report := report || E'\nok   4c owner cannot write their own score or level'; end if;
  exception when others then report := report || E'\nok   4c owner write to score refused: ' || sqlerrm;
  end;

  -- 5. a channel booking finishing refreshes the delivery record ---------------
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
      values (gen_random_uuid(), 'website', p, u_biz, 'test', 'Banner', 500) returning id into v_cr;
    update public.channel_requests set status = 'completed' where id = v_cr;
    select * into v_pub from public.publishers where id = p;
    if v_pub.completed_campaigns = 1 and v_pub.resolved_campaigns = 1 then report := report || E'\nok   5a completed channel booking counted';
    else fails := fails + 1; report := report || E'\nFAIL 5a completed=' || v_pub.completed_campaigns || ' resolved=' || v_pub.resolved_campaigns; end if;

    insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
      values (gen_random_uuid(), 'website', p, u_biz, 'test2', 'Banner', 500) returning id into v_cr;
    update public.channel_requests set status = 'cancelled', cancelled_by = 'business' where id = v_cr;
    select * into v_pub from public.publishers where id = p;
    if v_pub.resolved_campaigns = 1 then report := report || E'\nok   5b a booking the business cancelled is not held against the creator';
    else fails := fails + 1; report := report || E'\nFAIL 5b resolved=' || v_pub.resolved_campaigns; end if;

    insert into public.channel_requests (id, channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
      values (gen_random_uuid(), 'website', p, u_biz, 'test3', 'Banner', 500) returning id into v_cr;
    update public.channel_requests set status = 'cancelled', cancelled_by = 'creator' where id = v_cr;
    select * into v_pub from public.publishers where id = p;
    if v_pub.resolved_campaigns = 2 and v_pub.completed_campaigns = 1 then report := report || E'\nok   5c a booking the creator cancelled counts against them';
    else fails := fails + 1; report := report || E'\nFAIL 5c resolved=' || v_pub.resolved_campaigns || ' completed=' || v_pub.completed_campaigns; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL 5 raised: ' || sqlerrm;
  end;

  -- 6. before / after table for every approved listing (read-only) ------------
  report := report || E'\n\nBEFORE/AFTER (stored value -> value the new rules give on the next refresh)';
  for r in
    select name, channel_slug, level, publisher_score, trust_score,
           public.assign_publisher_level(id) as n_level,
           public.calculate_publisher_score(id) as n_score,
           public.calculate_trust_score(id) as n_trust
      from public.publishers where status = 'approved' and name not like 'Refresh Probe'
      order by channel_slug, name
  loop
    report := report || E'\n' || rpad(r.name, 32) || rpad(r.channel_slug, 14)
      || 'level ' || rpad(coalesce(r.level,'-'), 9) || '-> ' || rpad(coalesce(r.n_level,'-'), 9)
      || 'score ' || lpad(coalesce(r.publisher_score::text,'-'), 3) || ' -> ' || lpad(r.n_score::text, 3)
      || '  trust ' || lpad(coalesce(r.trust_score::text,'-'), 3) || ' -> ' || lpad(r.n_trust::text, 3);
  end loop;

  raise exception E'RESULT (rolled back, nothing saved): % %', case when fails = 0 then 'ALL PASS' else fails || ' FAILED' end, report;
end $$;
