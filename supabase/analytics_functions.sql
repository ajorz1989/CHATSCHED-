-- Analytics RPCs for admin dashboard
-- Returns overview metrics and time series for GMV, requests, approvals, and growth.
--
-- Margin/economics pass (added alongside the agency-pivot subscriptions in
-- schema_phase55_subscriptions.sql): fixes a real completeness gap found
-- while extending this file rather than a fresh read of the brief —
-- GMV/requests here only ever queried `payments`/`requests`, which is the
-- ORIGINAL social-media/PayFast flow. The 4 newer channels
-- (influencer/website/podcast/radio) settle entirely on
-- `channel_requests` itself (proposed_amount + paid_at — see
-- schema_phase17_channel_marketplace.sql's own comment on why: no PayFast
-- checkout on that path, so no payments row ever gets written for it) and
-- have been invisible to every number on this dashboard since phase17
-- shipped. Every function below now sums both. `total_gmv` and the 'gmv'
-- time-series/segment metrics are corrected in place (not renamed) since
-- an incomplete "GMV" is simply wrong, not a different, narrower thing
-- worth preserving under the same name — same reasoning applies to
-- request counts. Commission-rate and subscription-price math is
-- deliberately NOT done here — those live once, in
-- src/lib/constants.ts (PLATFORM_COMMISSION_RATE,
-- PUBLISHER_SUBSCRIPTION_PRICE, BUSINESS_SUBSCRIPTION_PRICE), and
-- AdminAnalytics.tsx multiplies the raw counts/GMV this file returns by
-- those — so the rate can't drift between a SQL copy and the TS one.

create or replace function public.analytics_get_overview(p_start timestamptz, p_end timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_gmv numeric := 0;
  v_total_paid_payments bigint := 0;
  v_total_requests bigint := 0;
  v_paid_requests bigint := 0;
  v_channel_gmv numeric := 0;
  v_paid_channel_requests bigint := 0;
  v_total_channel_requests bigint := 0;
  v_new_publishers bigint := 0;
  v_new_businesses bigint := 0;
  v_applications bigint := 0;
  v_approved_applications bigint := 0;
  v_avg_order_value numeric := 0;
  -- Margin/economics additions.
  -- once-off activation pass (item 10, schema_phase86): active/failed
  -- replace active/past_due/grace_period/suspended — a once-off payment
  -- either landed or it didn't, there's no lapse state to count anymore.
  v_active_publisher_subs bigint := 0;
  v_active_business_subs bigint := 0;
  v_failed_publisher_subs bigint := 0;
  v_failed_business_subs bigint := 0;
  v_credit_granted numeric := 0;
  v_credit_redeemed numeric := 0;
  v_credit_outstanding numeric := 0;
  v_credit_applied_in_period numeric := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  -- GMV: sum of payments with status 'paid' in the period (original flow)
  select coalesce(sum(payments.amount),0), coalesce(count(*) ,0)
    into v_total_gmv, v_total_paid_payments
  from public.payments
  where payments.status = 'paid' and payments.created_at >= p_start and payments.created_at <= p_end;

  -- GMV: channel_requests settled in the period (the 4 newer channels —
  -- proposed_amount already reflects any accepted counter-offer, see
  -- schema_phase35_counter_offer.sql)
  select coalesce(sum(cr.proposed_amount),0), coalesce(count(*),0)
    into v_channel_gmv, v_paid_channel_requests
  from public.channel_requests cr
  where cr.paid_at is not null and cr.paid_at >= p_start and cr.paid_at <= p_end;

  select count(*) into v_total_channel_requests from public.channel_requests where created_at >= p_start and created_at <= p_end;

  -- total_gmv now means what it says: every rand that's actually been
  -- paid across BOTH marketplace flows in the period.
  v_total_gmv := v_total_gmv + v_channel_gmv;

  -- Requests and paid requests (original flow)
  select count(*) into v_total_requests from public.requests where created_at >= p_start and created_at <= p_end;

  select count(distinct requests.id) into v_paid_requests
    from public.payments
    join public.requests on payments.request_id = requests.id
    where payments.status = 'paid' and payments.created_at >= p_start and payments.created_at <= p_end;

  -- Average order value (GMV / paid engagements, both flows combined)
  if (v_paid_requests + v_paid_channel_requests) > 0 then
    v_avg_order_value := v_total_gmv / (v_paid_requests + v_paid_channel_requests);
  else
    v_avg_order_value := 0;
  end if;

  -- New publishers and new business profiles
  select count(*) into v_new_publishers from public.publishers where created_at >= p_start and created_at <= p_end;
  select count(*) into v_new_businesses from public.profiles where role = 'business' and created_at >= p_start and created_at <= p_end;

  -- Publisher applications approvals (assumes publishers.status exists and was set)
  select count(*) into v_applications from public.publishers where created_at >= p_start and created_at <= p_end;
  select count(*) into v_approved_applications from public.publishers where status = 'approved' and created_at >= p_start and created_at <= p_end;

  -- Subscriptions — current snapshot (not period-scoped: "how many active
  -- members right now" is the useful question, not "how many became
  -- active within this date range"). Raw counts only; price
  -- multiplication happens client-side against constants.ts.
  -- "active" now means "paid the once-off activation fee" (schema_phase86)
  -- — there's no recurring lapse left to distinguish past_due/grace_period/
  -- suspended from, so those three collapse into a single "failed" count.
  select count(*) into v_active_publisher_subs from public.publisher_subscriptions where status = 'active';
  select count(*) into v_active_business_subs from public.business_subscriptions where status = 'active';
  select count(*) into v_failed_publisher_subs from public.publisher_subscriptions where status = 'failed';
  select count(*) into v_failed_business_subs from public.business_subscriptions where status = 'failed';

  -- Launch credit — granted/redeemed/outstanding are current totals (a
  -- standing liability, not a period flow); credit_applied_in_period is
  -- the one period-scoped figure, since it's the actual discount against
  -- this period's revenue.
  select coalesce(sum(amount),0), coalesce(sum(amount - remaining),0), coalesce(sum(remaining),0)
    into v_credit_granted, v_credit_redeemed, v_credit_outstanding
  from public.business_launch_credits;

  select coalesce(sum(credit_applied),0) into v_credit_applied_in_period
  from public.payments
  where status = 'paid' and created_at >= p_start and created_at <= p_end;

  return jsonb_build_object(
    'ok', true,
    'total_gmv', v_total_gmv,
    'total_paid_payments', v_total_paid_payments,
    'total_requests', v_total_requests + v_total_channel_requests,
    'paid_requests', v_paid_requests + v_paid_channel_requests,
    'channel_gmv', v_channel_gmv,
    'paid_channel_requests', v_paid_channel_requests,
    'avg_order_value', v_avg_order_value,
    'new_publishers', v_new_publishers,
    'new_businesses', v_new_businesses,
    'applications', v_applications,
    'approved_applications', v_approved_applications,
    'active_publisher_subs', v_active_publisher_subs,
    'active_business_subs', v_active_business_subs,
    'failed_publisher_subs', v_failed_publisher_subs,
    'failed_business_subs', v_failed_business_subs,
    'credit_granted', v_credit_granted,
    'credit_redeemed', v_credit_redeemed,
    'credit_outstanding', v_credit_outstanding,
    'credit_applied_in_period', v_credit_applied_in_period
  );
end;
$$;

-- Time series: returns a jsonb array of {ts, value} for the requested metric and interval
create or replace function public.analytics_time_series(p_metric text, p_interval text, p_start timestamptz, p_end timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step interval;
  rec record;
  v_rows jsonb := '[]'::jsonb;
  v_ts timestamptz;
  v_val numeric;
  v_series record;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  if p_interval = 'day' then
    v_step := '1 day'::interval;
  elsif p_interval = 'week' then
    v_step := '1 week'::interval;
  elsif p_interval = 'month' then
    v_step := '1 month'::interval;
  else
    v_step := '1 day'::interval;
  end if;

  for v_ts in select generate_series(date_trunc('day', p_start), date_trunc('day', p_end), v_step) as ts loop
    if p_metric = 'gmv' then
      select coalesce(sum(payments.amount),0) into v_val
      from public.payments
      where payments.status = 'paid' and payments.created_at >= v_ts and payments.created_at < v_ts + v_step;
      -- Combined with channel_requests below — see this file's header
      -- comment on why 'gmv' means both flows now, not just payments.
      v_val := v_val + coalesce((
        select sum(cr.proposed_amount) from public.channel_requests cr
        where cr.paid_at is not null and cr.paid_at >= v_ts and cr.paid_at < v_ts + v_step
      ), 0);
    elsif p_metric = 'requests' then
      select count(*) into v_val from public.requests where requests.created_at >= v_ts and requests.created_at < v_ts + v_step;
      v_val := v_val + coalesce((
        select count(*) from public.channel_requests cr where cr.created_at >= v_ts and cr.created_at < v_ts + v_step
      ), 0);
    elsif p_metric = 'paid_requests' then
      select count(distinct requests.id) into v_val
      from public.payments
      join public.requests on payments.request_id = requests.id
      where payments.status = 'paid' and payments.created_at >= v_ts and payments.created_at < v_ts + v_step;
      v_val := v_val + coalesce((
        select count(*) from public.channel_requests cr
        where cr.paid_at is not null and cr.paid_at >= v_ts and cr.paid_at < v_ts + v_step
      ), 0);
    elsif p_metric = 'new_publishers' then
      select count(*) into v_val from public.publishers where created_at >= v_ts and created_at < v_ts + v_step;
    elsif p_metric = 'new_businesses' then
      select count(*) into v_val from public.profiles where role = 'business' and created_at >= v_ts and created_at < v_ts + v_step;
    elsif p_metric = 'approvals' then
      select count(*) into v_val from public.publishers where status = 'approved' and created_at >= v_ts and created_at < v_ts + v_step;
    else
      v_val := 0;
    end if;

    v_rows := v_rows || jsonb_build_object('ts', v_ts, 'value', v_val);
  end loop;

  return jsonb_build_object('ok', true, 'series', v_rows);
end;
$$;

-- Segmented top lists (e.g., top publishers by GMV or requests). Returns jsonb array of {id, label, value}
create or replace function public.analytics_segmented_by(p_kind text, p_start timestamptz, p_end timestamptz, p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  rec record;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  if p_kind = 'publisher_gmv' then
    for rec in
      select pub.id, pub.name, coalesce(sum(combined.amount),0) as total
      from (
        select requests.publisher_id as pid, payments.amount as amount
        from public.payments
        join public.requests on payments.request_id = requests.id
        where payments.status = 'paid' and payments.created_at >= p_start and payments.created_at <= p_end
        union all
        select cr.creator_id as pid, cr.proposed_amount as amount
        from public.channel_requests cr
        where cr.paid_at is not null and cr.paid_at >= p_start and cr.paid_at <= p_end
      ) combined
      join public.publishers pub on pub.id = combined.pid
      group by pub.id, pub.name
      order by total desc
      limit p_limit
    loop
      v_rows := v_rows || jsonb_build_object('id', rec.id, 'label', rec.name, 'value', rec.total);
    end loop;
  elsif p_kind = 'publisher_requests' then
    for rec in
      select pub.id, pub.name, count(combined.*) as cnt
      from (
        select publisher_id as pid from public.requests where created_at >= p_start and created_at <= p_end
        union all
        select creator_id as pid from public.channel_requests where created_at >= p_start and created_at <= p_end
      ) combined
      join public.publishers pub on pub.id = combined.pid
      group by pub.id, pub.name
      order by cnt desc
      limit p_limit
    loop
      v_rows := v_rows || jsonb_build_object('id', rec.id, 'label', rec.name, 'value', rec.cnt);
    end loop;
  else
    -- default empty
    v_rows := '[]'::jsonb;
  end if;

  return jsonb_build_object('ok', true, 'items', v_rows);
end;
$$;
