-- Rolled-back test for 20261008100000_podcast_ownership_check.sql
--
-- Run in the Supabase SQL editor AFTER applying the migration. Creates throw-away
-- users and listings, tries to approve them as an admin (and to self-approve /
-- self-confirm as an owner), and ends with RAISE EXCEPTION so NOTHING is saved.
-- The exception message is the report: look for "ALL PASS" or "FAIL" lines.

do $$
declare
  report text := '';
  fails int := 0;
  u_admin uuid := gen_random_uuid();
  u_pod   uuid := gen_random_uuid();
  u_pod2  uuid := gen_random_uuid();
  u_rad   uuid := gen_random_uuid();
  p_pod   uuid := gen_random_uuid();
  p_pod2  uuid := gen_random_uuid();
  p_rad   uuid := gen_random_uuid();
  v_code  text;
  v_pub   public.publishers%rowtype;
  t_before int;
  t_after  int;
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  insert into auth.users (id, email) values
    (u_admin, 'pod-admin@example.test'), (u_pod, 'pod-1@example.test'), (u_pod2, 'pod-2@example.test'), (u_rad, 'pod-rad@example.test');
  update public.profiles set role = 'admin' where id = u_admin;

  insert into public.publishers (id, user_id, name, category, channel_slug, city, province, status, channel_metadata, price_per_post) values
    (p_pod,  u_pod,  'Show One', 'Media', 'podcast', 'Cape Town', 'Western Cape', 'pending_review', '{"showUrl":"https://feeds.example-podcasts.co.za/one.xml"}', 500),
    (p_pod2, u_pod2, 'Show Two', 'Media', 'podcast', 'Cape Town', 'Western Cape', 'pending_review', '{}', 500),
    (p_rad,  u_rad,  'Radio',    'Media', 'radio',   'Cape Town', 'Western Cape', 'pending_review', '{}', 500);

  -- A. admin cannot approve an unconfirmed podcast
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  begin
    perform public.approve_publisher_application(p_pod, '{}');
    fails := fails + 1; report := report || E'\nFAIL A unconfirmed podcast was approved';
  exception when others then
    if sqlerrm ilike '%ownership%' then report := report || E'\nok   A unconfirmed podcast refused: ' || sqlerrm;
    else fails := fails + 1; report := report || E'\nFAIL A wrong error: ' || sqlerrm; end if;
  end;

  -- B. the owner can generate a code
  perform set_config('request.jwt.claims', json_build_object('sub', u_pod, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_pod::text, true);
  begin
    v_code := public.generate_social_verification_code(p_pod);
    if v_code ~ '^CS-[0-9A-F]{5}$' then report := report || E'\nok   B owner got code ' || v_code;
    else fails := fails + 1; report := report || E'\nFAIL B odd code: ' || coalesce(v_code, 'null'); end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL B raised: ' || sqlerrm;
  end;

  -- C. the owner cannot mark themselves confirmed
  begin
    update public.publishers set social_verification_confirmed = true where id = p_pod;
    fails := fails + 1; report := report || E'\nFAIL C owner self-confirmed';
  exception when others then report := report || E'\nok   C owner cannot self-confirm';
  end;

  -- D. the owner cannot self-approve an unconfirmed podcast
  begin
    update public.publishers set status = 'approved' where id = p_pod;
    fails := fails + 1; report := report || E'\nFAIL D owner self-approved';
  exception when others then report := report || E'\nok   D owner cannot self-approve: ' || sqlerrm;
  end;

  -- E. confirmed but no show address is refused
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  begin
    perform public.confirm_social_verification(p_pod2, true);
    perform public.approve_publisher_application(p_pod2, '{}');
    fails := fails + 1; report := report || E'\nFAIL E podcast without show address approved';
  exception when others then
    if sqlerrm ilike '%show%' then report := report || E'\nok   E podcast without show address refused';
    else fails := fails + 1; report := report || E'\nFAIL E wrong error: ' || sqlerrm; end if;
  end;

  -- F. confirmed + show address: approved and verified; trust score counts the check
  begin
    select public.calculate_trust_score(p_pod) into t_before;
    perform public.confirm_social_verification(p_pod, true);
    select public.calculate_trust_score(p_pod) into t_after;
    if t_after > t_before then report := report || E'\nok   F1 trust score rose ' || t_before || ' -> ' || t_after || ' once confirmed';
    else fails := fails + 1; report := report || E'\nFAIL F1 trust ' || t_before || ' -> ' || t_after; end if;
    perform public.approve_publisher_application(p_pod, '{}');
    select * into v_pub from public.publishers where id = p_pod;
    if v_pub.status = 'approved' and v_pub.verified then report := report || E'\nok   F2 confirmed podcast approved and verified';
    else fails := fails + 1; report := report || E'\nFAIL F2 status=' || v_pub.status || ' verified=' || v_pub.verified; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL F raised: ' || sqlerrm;
  end;

  -- G. a new code resets the confirmation (owner)
  perform set_config('request.jwt.claims', json_build_object('sub', u_pod, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_pod::text, true);
  begin
    perform public.generate_social_verification_code(p_pod);
    select * into v_pub from public.publishers where id = p_pod;
    if not v_pub.social_verification_confirmed then report := report || E'\nok   G new code cleared the confirmation';
    else fails := fails + 1; report := report || E'\nFAIL G confirmation survived a new code'; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL G raised: ' || sqlerrm;
  end;

  -- H. radio is unchanged: no ownership requirement yet
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  begin
    perform public.approve_publisher_application(p_rad, '{}');
    select * into v_pub from public.publishers where id = p_rad;
    if v_pub.status = 'approved' then report := report || E'\nok   H radio approval unchanged';
    else fails := fails + 1; report := report || E'\nFAIL H radio status=' || v_pub.status; end if;
  exception when others then fails := fails + 1; report := report || E'\nFAIL H raised: ' || sqlerrm;
  end;

  raise exception E'RESULT (rolled back, nothing saved): % %', case when fails = 0 then 'ALL PASS' else fails || ' FAILED' end, report;
end $$;
