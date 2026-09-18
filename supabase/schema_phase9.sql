-- ChatSched — Phase 9 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase7.sql.
-- NOTE: this file used to say "after schema_phase8.sql" — no phase8 file
-- exists in this repo, so either that phase made no schema changes, or its
-- migration was applied directly and never committed here. Before running
-- this against a fresh database, confirm nothing else was expected between
-- phase7 and here (nothing in this codebase currently depends on it).
-- Adds two columns for the comparison tool's "campaign success" column.
--
-- Why columns and not a query: requests_select_own_or_admin (schema.sql)
-- only lets a business see requests where it is the business_id. A
-- comparison tool needs a publisher's success rate across every business
-- they've worked with, not just the viewer's own history with them — and
-- RLS can't return "the count, but not whose requests they were" from the
-- requests table itself. calculate_publisher_score() already computes
-- exactly this ratio internally; this just also stores the raw counts it
-- was already calculating, on the publisher row, which is already public
-- once approved (publishers_select_approved_or_own_or_admin, phase5).

alter table public.publishers
  add column completed_campaigns integer not null default 0,
  add column resolved_campaigns integer not null default 0;

create or replace function public.refresh_publisher_scores(p_publisher_id uuid)
returns void language plpgsql as $$
declare
  v_completed integer;
  v_resolved integer;
begin
  select count(*) filter (where status = 'completed'),
         count(*) filter (where status in ('completed', 'declined'))
    into v_completed, v_resolved
    from public.requests where publisher_id = p_publisher_id;

  update public.publishers
     set trust_score = public.calculate_trust_score(p_publisher_id),
         publisher_score = public.calculate_publisher_score(p_publisher_id),
         level = public.assign_publisher_level(p_publisher_id),
         completed_campaigns = v_completed,
         resolved_campaigns = v_resolved
   where id = p_publisher_id;
end;
$$;

-- Backfill: existing publishers won't get these two columns populated
-- until their next review or request completion fires a refresh, which
-- could be a long wait for anyone with real campaign history already on
-- file. Run it once for everyone now instead.
do $$
declare
  r record;
begin
  for r in select id from public.publishers loop
    perform public.refresh_publisher_scores(r.id);
  end loop;
end;
$$;
