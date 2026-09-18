-- ChatSched — Phase 11 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase9.sql.
-- NOTE: this file used to say "after schema_phase10.sql" — no phase10 file
-- exists in this repo; see the same note at the top of schema_phase9.sql.
-- The earnings dashboard needs "response time," which every schema file
-- back to phase5 has explicitly excluded from trust_score as untracked.
-- This finally tracks it for real — a timestamp, not a guess — and once
-- it exists, calculate_trust_score picks up the "Fast Response" 10 points
-- it was always missing.
--
-- Everything else the dashboard needs (weekly/monthly/projected earnings,
-- pending requests, completed campaigns, avg. campaign value, acceptance
-- rate) is computed client-side from requests + payments the publisher
-- dashboard already fetches — no new columns needed for those.

alter table public.requests add column first_contacted_at timestamptz;

-- Fires the first time a request leaves 'pending', whichever status it
-- moves to — contacted, confirmed, or straight to declined all count as
-- "someone responded." Guarded so a later update can't overwrite it.
create or replace function public.trg_set_first_contacted()
returns trigger language plpgsql as $$
begin
  if new.status <> 'pending' and old.status = 'pending' and new.first_contacted_at is null then
    new.first_contacted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_first_contacted on public.requests;
create trigger trg_requests_first_contacted
  before update on public.requests
  for each row execute function public.trg_set_first_contacted();

-- Existing requests that already left pending before this migration have
-- no way to get a real first_contacted_at — there was nothing recording
-- it at the time. They stay null rather than being backfilled with a
-- guess; response-time stats only reflect requests handled from here on.

create or replace function public.calculate_trust_score(p_publisher_id uuid)
returns smallint language plpgsql as $$
declare
  v_publisher public.publishers%rowtype;
  v_weighted numeric := 0;
  v_available numeric := 0;
  v_review_avg numeric;
  v_completed integer;
  v_avg_response_hours numeric;
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

  -- Falls back to the old single `rating` column for reviews left before
  -- this migration, so pre-existing review history still counts instead
  -- of quietly dropping to zero.
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

  select count(*) into v_completed from public.requests
    where publisher_id = p_publisher_id and status = 'completed';
  if v_completed > 0 then
    v_available := v_available + 20;
    v_weighted := v_weighted + least(v_completed, 10) * 2;
  end if;

  -- Fast Response: full marks at 0 hours, scaling down to zero at 48+
  -- hours. That 48-hour line is a judgment call, not anything the brief
  -- specified — easy to retune once you've seen a real spread of times.
  select avg(extract(epoch from (first_contacted_at - created_at)) / 3600)
    into v_avg_response_hours
    from public.requests
    where publisher_id = p_publisher_id and first_contacted_at is not null;
  if v_avg_response_hours is not null then
    v_available := v_available + 10;
    v_weighted := v_weighted + greatest(0, least(1, (48 - v_avg_response_hours) / 48)) * 10;
  end if;

  if v_available = 0 then return 0; end if;
  return round(least(v_weighted / v_available * 100, 100));
end;
$$;

-- Was completion-only; now also refreshes when a request gets its first
-- response, since that's what the Fast Response weight above depends on.
create or replace function public.trg_refresh_scores_on_request()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status
     and (new.status = 'completed' or new.first_contacted_at is distinct from old.first_contacted_at) then
    perform public.refresh_publisher_scores(new.publisher_id);
  end if;
  return new;
end;
$$;
