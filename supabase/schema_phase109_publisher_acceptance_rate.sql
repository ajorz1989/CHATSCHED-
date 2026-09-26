-- ChatSched — Phase 109 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase108_sars_invoice_fields.sql.
--
-- Acceptance rate ("accepts 80% of requests") for the Publisher Profile
-- page, alongside the existing avg_response_hours stat. Same reasoning as
-- schema_phase26_response_time.sql: individual request rows are private
-- (requests_select_own_or_admin / channel_requests_select_participant), so
-- a rate shown to every browsing visitor can't query those tables
-- directly. This follows the identical pattern — a trigger recomputes a
-- public, aggregate-only number and stores it on the publisher's own row,
-- which publishers_public already exposes. No individual request status
-- is ever exposed, only the rolled-up percentage.
--
-- Unlike avg_response_hours (which only ever populates for the 12
-- request-flow channels, since only channel_requests has a responded_at
-- column), this covers BOTH request tables: public.requests (the
-- 'directory' bookingFlow — social-media, still the original/largest
-- cohort of publishers) and public.channel_requests (the 'request'
-- bookingFlow — every other channel). A given publisher only ever
-- accumulates rows in one of the two depending on channel_slug, but
-- summing both costs nothing and means the same function/columns work
-- for either without a channel-slug branch.

alter table public.publishers
  add column acceptance_rate numeric,
  add column acceptance_sample_size integer not null default 0;

comment on column public.publishers.acceptance_rate is
  'Percentage (0-100) of this publisher''s responded requests that were
   accepted rather than declined, summed across public.requests
   (contacted/confirmed/completed = accepted, declined = declined,
   pending excluded) and public.channel_requests
   (awaiting_payment/payment_submitted/paid/live/completed = accepted,
   declined = declined, pending/cancelled excluded — cancelled means the
   business withdrew before the creator ever responded, not a decline).
   Null until there is at least one responded request. Recomputed by
   recompute_publisher_acceptance_rate() on every status change to a
   request or channel_request this publisher owns. Aggregate only — see
   file header.';

comment on column public.publishers.acceptance_sample_size is
  'How many responded requests acceptance_rate is computed from. Worth
   hiding the rate in the UI below some minimum (e.g. < 3) rather than
   showing what''s really just a 1-for-1 or 2-for-2.';

create or replace function public.recompute_publisher_acceptance_rate(p_publisher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted integer;
  v_declined integer;
  v_total integer;
begin
  select
    count(*) filter (where status in ('contacted', 'confirmed', 'completed')),
    count(*) filter (where status = 'declined')
    into v_accepted, v_declined
    from public.requests
    where publisher_id = p_publisher_id;

  v_accepted := v_accepted + coalesce((
    select count(*) filter (where status in (
      'awaiting_payment', 'payment_submitted', 'paid', 'live', 'completed'
    ))
    from public.channel_requests
    where creator_id = p_publisher_id
  ), 0);
  v_declined := v_declined + coalesce((
    select count(*) filter (where status = 'declined')
    from public.channel_requests
    where creator_id = p_publisher_id
  ), 0);

  v_total := v_accepted + v_declined;

  update public.publishers
    set acceptance_rate = case when v_total > 0 then round(100.0 * v_accepted / v_total) else null end,
        acceptance_sample_size = v_total
    where id = p_publisher_id;
end;
$$;

create or replace function public.trg_requests_acceptance_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.recompute_publisher_acceptance_rate(new.publisher_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_update_acceptance_rate on public.requests;
create trigger trg_requests_update_acceptance_rate
  after update of status on public.requests
  for each row execute function public.trg_requests_acceptance_rate();

create or replace function public.trg_channel_requests_acceptance_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.recompute_publisher_acceptance_rate(new.creator_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_channel_requests_update_acceptance_rate on public.channel_requests;
create trigger trg_channel_requests_update_acceptance_rate
  after update of status on public.channel_requests
  for each row execute function public.trg_channel_requests_acceptance_rate();

-- Backfill every existing publisher once, so the numbers reflect history
-- immediately rather than sitting null until each one's next status change.
do $$
declare
  r record;
begin
  for r in select id from public.publishers loop
    perform public.recompute_publisher_acceptance_rate(r.id);
  end loop;
end $$;

-- Expose the two new columns on the public directory view, same set as
-- avg_response_hours/response_count already there (schema_phase82 /
-- schema_phase26). New columns MUST be appended at the end of the select
-- list — `create or replace view` only allows adding columns after the
-- existing ones; inserting them in the middle errors with "cannot change
-- name of view column X to Y" because Postgres matches by position.
create or replace view public.publishers_public as
select
  id, user_id, name, city, province, suburb, category, platforms,
  placement_types, accepted_ad_formats, channel_slug, channel_metadata,
  followers, engagement, price_per_post, rating, reviews, verified, bio,
  audience, initials, swatch, created_at, languages, level, trust_score,
  publisher_score, avg_response_hours, response_count, last_active_at,
  ai_audience_summary, ai_audience_summary_generated_at, intro_video_url,
  portfolio_images, profile_image_url, featured, featured_until,
  completed_campaigns, resolved_campaigns, status,
  acceptance_rate, acceptance_sample_size
from public.publishers
where status = 'approved';
