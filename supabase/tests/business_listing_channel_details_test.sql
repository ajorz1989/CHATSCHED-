-- Rolled-back test for 20261004180000_business_listing_channel_details.sql
--
-- Run in the Supabase SQL editor AFTER applying the migration. It creates
-- throw-away users, calls create_business_publisher_listing() as each of them
-- (simulating auth.uid() through request.jwt.claims), checks the results, and
-- ends with RAISE EXCEPTION so NOTHING is saved. The exception message is the
-- report: look for "ALL PASS" or a list of "FAIL" lines.
--
-- Not run by the author: the Supabase connector cancelled writes in this
-- session, so this script has not been executed against the real database.

do $$
declare
  r jsonb;
  report text := '';
  fails int := 0;
  v_users uuid[] := array(select gen_random_uuid() from generate_series(1, 12));
  i int;
  v_pub public.publishers%rowtype;
begin
  -- fixtures: 12 business accounts with an active business subscription
  for i in 1..12 loop
    insert into auth.users (id, email) values (v_users[i], 'bl-test-' || i || '@example.test');
    update public.profiles set role = 'business', phone = '+27110000000' where id = v_users[i];
    insert into public.business_subscriptions (business_id, status) values (v_users[i], 'active')
      on conflict (business_id) do update set status = 'active';
  end loop;

  -- helper: run the RPC as user n and return result or error text
  -- (inline because a DO block cannot define functions)

  -- 1. website with metadata: pending, followers taken from visitors, engagement forced to 0
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[1]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object(
      'name','Test Site','channel_slug','website','category','Retail','city','Cape Town','province','Western Cape',
      'price_per_post',500,'followers',1,'engagement',9,
      'channel_metadata', jsonb_build_object('monthlyUniqueVisitors', 12000, 'domain','example.test','niche','test')));
    select * into v_pub from public.publishers where id = (r->>'id')::uuid;
    if (r->>'live')::boolean is not false then fails := fails + 1; report := report || E'\nFAIL 1a website must not be live'; else report := report || E'\nok   1a website waits for review'; end if;
    if v_pub.followers <> 12000 then fails := fails + 1; report := report || E'\nFAIL 1b followers should be 12000, got ' || v_pub.followers; else report := report || E'\nok   1b followers taken from visitors'; end if;
    if v_pub.engagement <> 0 then fails := fails + 1; report := report || E'\nFAIL 1c engagement should be 0'; else report := report || E'\nok   1c engagement zeroed'; end if;
    if v_pub.channel_metadata->>'monthlyUniqueVisitors' <> '12000' then fails := fails + 1; report := report || E'\nFAIL 1d metadata not stored'; else report := report || E'\nok   1d metadata stored'; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL 1 raised: ' || sqlerrm;
  end;

  -- 2. website with no metadata is rejected
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[2], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[2]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object(
      'name','No Meta','channel_slug','website','category','Retail','city','Cape Town','province','Western Cape','price_per_post',500));
    fails := fails + 1; report := report || E'\nFAIL 2 website without metadata was accepted';
  exception when others then report := report || E'\nok   2 website without metadata rejected: ' || sqlerrm;
  end;

  -- 3. community without authorityConfirmed rejected
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[3], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[3]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object(
      'name','Hall','channel_slug','community','category','Community','city','Cape Town','province','Western Cape','price_per_post',300,
      'channel_metadata', jsonb_build_object('memberCount', 400)));
    fails := fails + 1; report := report || E'\nFAIL 3 community without authority flag accepted';
  exception when others then report := report || E'\nok   3 community without authority flag rejected: ' || sqlerrm;
  end;

  -- 4. community with the flag: pending, followers = 0
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[4], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[4]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object(
      'name','Hall 2','channel_slug','community','category','Community','city','Cape Town','province','Western Cape','price_per_post',300,
      'followers', 1,
      'channel_metadata', jsonb_build_object('memberCount', 400, 'authorityConfirmed', true)));
    select * into v_pub from public.publishers where id = (r->>'id')::uuid;
    if v_pub.followers <> 0 then fails := fails + 1; report := report || E'\nFAIL 4a followers should be 0, got ' || v_pub.followers; else report := report || E'\nok   4a authority followers forced to 0'; end if;
    if v_pub.status <> 'pending_review' or v_pub.verified then fails := fails + 1; report := report || E'\nFAIL 4b community must be pending'; else report := report || E'\nok   4b community pending'; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL 4 raised: ' || sqlerrm;
  end;

  -- 5. radio uses weeklyListeners for followers
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[5], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[5]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object(
      'name','Radio X','channel_slug','radio','category','Media','city','Cape Town','province','Western Cape','price_per_post',800,
      'channel_metadata', jsonb_build_object('weeklyListeners', 3500, 'stationName','Radio X')));
    select * into v_pub from public.publishers where id = (r->>'id')::uuid;
    if v_pub.followers <> 3500 or (r->>'live')::boolean then fails := fails + 1; report := report || E'\nFAIL 5 radio followers/live wrong'; else report := report || E'\nok   5 radio followers from weeklyListeners, not live'; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL 5 raised: ' || sqlerrm;
  end;

  -- 6. social media without links rejected; with link accepted and pending
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[6], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[6]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object(
      'name','Social A','channel_slug','social-media','category','Retail','city','Cape Town','province','Western Cape','price_per_post',200,'followers',5000));
    fails := fails + 1; report := report || E'\nFAIL 6a social without links accepted';
  exception when others then report := report || E'\nok   6a social without links rejected';
  end;
  begin
    r := public.create_business_publisher_listing(jsonb_build_object(
      'name','Social A','channel_slug','social-media','category','Retail','city','Cape Town','province','Western Cape','price_per_post',200,
      'followers',5000,'engagement',4.5,'monthly_reach',20000,'platforms', jsonb_build_array('Instagram'),
      'social_verification_links', jsonb_build_array(jsonb_build_object('platform','instagram','url','https://instagram.com/x'))));
    select * into v_pub from public.publishers where id = (r->>'id')::uuid;
    if v_pub.engagement <> 4.5 or v_pub.monthly_reach <> 20000 or (r->>'live')::boolean then fails := fails + 1; report := report || E'\nFAIL 6b social values wrong'; else report := report || E'\nok   6b social keeps engagement/reach, pending'; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL 6b raised: ' || sqlerrm;
  end;

  -- 7. non-business account rejected
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[7], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[7]::text, true);
  update public.profiles set role = 'publisher' where id = v_users[7];
  begin
    r := public.create_business_publisher_listing(jsonb_build_object('name','Nope','channel_slug','website','category','Retail','city','a','province','b','price_per_post',100));
    fails := fails + 1; report := report || E'\nFAIL 7 publisher role accepted';
  exception when others then report := report || E'\nok   7 non-business rejected';
  end;

  -- 8. oversized / non-object metadata rejected
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[8], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[8]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object('name','Bad','channel_slug','website','category','Retail','city','a','province','b','price_per_post',100,
      'channel_metadata', to_jsonb('a string'::text)));
    fails := fails + 1; report := report || E'\nFAIL 8a string metadata accepted';
  exception when others then report := report || E'\nok   8a non-object metadata rejected';
  end;

  -- 9. second listing on the same account rejected
  perform set_config('request.jwt.claims', json_build_object('sub', v_users[1], 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_users[1]::text, true);
  begin
    r := public.create_business_publisher_listing(jsonb_build_object('name','Again','channel_slug','website','category','Retail','city','a','province','b','price_per_post',100,
      'channel_metadata', jsonb_build_object('monthlyUniqueVisitors', 9000)));
    fails := fails + 1; report := report || E'\nFAIL 9 second listing accepted';
  exception when others then report := report || E'\nok   9 second listing rejected';
  end;

  raise exception E'RESULT (rolled back, nothing saved): % %', case when fails = 0 then 'ALL PASS' else fails || ' FAILED' end, report;
end $$;
