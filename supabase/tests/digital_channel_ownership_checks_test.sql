-- Rolled-back test for 20261005000000_digital_channel_ownership_checks.sql
--
-- Run in the Supabase SQL editor AFTER applying the migration. Creates
-- throw-away users and listings, tries to approve them as an admin (and to
-- self-approve as an owner), and ends with RAISE EXCEPTION so NOTHING is saved.
-- The exception message is the report: look for "ALL PASS" or "FAIL" lines.
--
-- Not run by the author (no database access from the build environment).

do $$
declare
  report text := '';
  fails int := 0;
  u_admin uuid := gen_random_uuid();
  u_web   uuid := gen_random_uuid();
  u_web2  uuid := gen_random_uuid();
  u_inf   uuid := gen_random_uuid();
  u_pod   uuid := gen_random_uuid();
  p_web   uuid := gen_random_uuid();
  p_web2  uuid := gen_random_uuid();
  p_inf   uuid := gen_random_uuid();
  p_pod   uuid := gen_random_uuid();
  v_code  text;
  v_pub   public.publishers%rowtype;
  v_msg   text;
begin
  -- fixtures (as the database owner, no logged-in user)
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  insert into auth.users (id, email) values
    (u_admin, 'own-admin@example.test'), (u_web, 'own-web@example.test'), (u_web2, 'own-web2@example.test'),
    (u_inf, 'own-inf@example.test'), (u_pod, 'own-pod@example.test');
  update public.profiles set role = 'admin' where id = u_admin;

  insert into public.publishers (id, user_id, name, category, channel_slug, city, province, status, channel_metadata, price_per_post) values
    (p_web,  u_web,  'Site One',   'Retail', 'website',    'Cape Town', 'Western Cape', 'pending_review', '{"domain":"siteone.co.za"}', 500),
    (p_web2, u_web2, 'Site Two',   'Retail', 'website',    'Cape Town', 'Western Cape', 'pending_review', '{}', 500),
    (p_inf,  u_inf,  'Creator',    'Retail', 'influencer', 'Cape Town', 'Western Cape', 'pending_review', '{}', 500),
    (p_pod,  u_pod,  'Pod',        'Media',  'podcast',    'Cape Town', 'Western Cape', 'pending_review', '{}', 500);

  -- A. admin cannot approve an unconfirmed website
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  begin
    perform public.approve_publisher_application(p_web, '{}');
    fails := fails + 1; report := report || E'\nFAIL A unconfirmed website was approved';
  exception when others then
    if sqlerrm ilike '%ownership%' then report := report || E'\nok   A unconfirmed website refused: ' || sqlerrm;
    else fails := fails + 1; report := report || E'\nFAIL A wrong error: ' || sqlerrm; end if;
  end;

  -- B. the owner can generate a code
  perform set_config('request.jwt.claims', json_build_object('sub', u_web, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_web::text, true);
  begin
    v_code := public.generate_social_verification_code(p_web);
    if v_code ~ '^CS-[0-9A-F]{5}$' then report := report || E'\nok   B owner got code ' || v_code;
    else fails := fails + 1; report := report || E'\nFAIL B odd code: ' || coalesce(v_code, 'null'); end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL B raised: ' || sqlerrm;
  end;

  -- C. the owner cannot mark themselves confirmed
  begin
    update public.publishers set social_verification_confirmed = true where id = p_web;
    fails := fails + 1; report := report || E'\nFAIL C owner self-confirmed';
  exception when others then report := report || E'\nok   C owner cannot self-confirm';
  end;

  -- H. the owner cannot self-approve an unconfirmed website either
  begin
    update public.publishers set status = 'approved' where id = p_web;
    fails := fails + 1; report := report || E'\nFAIL H owner self-approved';
  exception when others then report := report || E'\nok   H owner cannot self-approve: ' || sqlerrm;
  end;

  -- D. admin confirms, then approval works and marks it verified
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  begin
    perform public.confirm_social_verification(p_web, true);
    perform public.approve_publisher_application(p_web, '{}');
    select * into v_pub from public.publishers where id = p_web;
    if v_pub.status = 'approved' and v_pub.verified then report := report || E'\nok   D confirmed website approved and verified';
    else fails := fails + 1; report := report || E'\nFAIL D status=' || v_pub.status || ' verified=' || v_pub.verified; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL D raised: ' || sqlerrm;
  end;

  -- I. a new code resets the confirmation
  perform set_config('request.jwt.claims', json_build_object('sub', u_web, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_web::text, true);
  begin
    perform public.generate_social_verification_code(p_web);
    select * into v_pub from public.publishers where id = p_web;
    if not v_pub.social_verification_confirmed then report := report || E'\nok   I new code cleared the confirmation';
    else fails := fails + 1; report := report || E'\nFAIL I confirmation survived a new code'; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL I raised: ' || sqlerrm;
  end;

  -- E. confirmed website with no domain on the listing is refused
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  begin
    perform public.confirm_social_verification(p_web2, true);
    perform public.approve_publisher_application(p_web2, '{}');
    fails := fails + 1; report := report || E'\nFAIL E website without domain approved';
  exception when others then
    if sqlerrm ilike '%domain%' then report := report || E'\nok   E website without domain refused';
    else fails := fails + 1; report := report || E'\nFAIL E wrong error: ' || sqlerrm; end if;
  end;

  -- F. influencer: confirmed but no profile link is refused; with a link it is approved
  begin
    perform public.confirm_social_verification(p_inf, true);
    perform public.approve_publisher_application(p_inf, '{}');
    fails := fails + 1; report := report || E'\nFAIL F1 influencer without link approved';
  exception when others then
    if sqlerrm ilike '%profile url%' then report := report || E'\nok   F1 influencer without link refused';
    else fails := fails + 1; report := report || E'\nFAIL F1 wrong error: ' || sqlerrm; end if;
  end;
  begin
    perform public.confirm_social_verification(p_inf, true);
    update public.publishers set social_verification_links = '[{"platform":"instagram","url":"https://instagram.com/x"}]'::jsonb where id = p_inf;
    perform public.approve_publisher_application(p_inf, '{}');
    select * into v_pub from public.publishers where id = p_inf;
    if v_pub.status = 'approved' and v_pub.verified then report := report || E'\nok   F2 influencer with link and confirmation approved';
    else fails := fails + 1; report := report || E'\nFAIL F2 status=' || v_pub.status; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL F2 raised: ' || sqlerrm;
  end;

  -- G. podcast is unchanged: no ownership requirement yet
  begin
    perform public.approve_publisher_application(p_pod, '{}');
    select * into v_pub from public.publishers where id = p_pod;
    if v_pub.status = 'approved' then report := report || E'\nok   G podcast approval unchanged';
    else fails := fails + 1; report := report || E'\nFAIL G podcast status=' || v_pub.status; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL G raised: ' || sqlerrm;
  end;

  v_msg := case when fails = 0 then 'ALL PASS' else fails || ' FAILED' end;
  raise exception E'RESULT (rolled back, nothing saved): % %', v_msg, report;
end $$;
