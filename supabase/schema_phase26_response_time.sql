-- ChatSched — Phase 26 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase25_disputes.sql.
--
-- Response-time badges ("Usually responds within 4 hours") on publisher
-- cards/profiles. The underlying data (channel_requests.created_at /
-- responded_at) is private — RLS on channel_requests only lets a business
-- see its own requests and a creator see theirs (channel_requests_select_
-- participant in schema_phase17_channel_marketplace.sql). A badge shown to
-- every browsing visitor can't query that table directly without leaking
-- who requested what from whom.
--
-- So this follows the same pattern as trust_score/publisher_score already
-- on publishers: a trigger recomputes a *public, aggregate-only* number
-- (average hours to respond, and how many responses that average is built
-- from) and stores it on the publisher's own row, which publishers_select_*
-- already allows anyone to read. No individual request is ever exposed —
-- only the rolled-up average.

alter table public.publishers
  add column avg_response_hours numeric,
  add column response_count integer not null default 0;

comment on column public.publishers.avg_response_hours is
  'Average hours between a channel_requests campaign being submitted and this
   creator responding (approve or decline) — recomputed by
   update_publisher_response_stats() whenever a request they own gets a new
   responded_at. Only ever an aggregate; no individual request is exposed.';

create or replace function public.update_publisher_response_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg_hours numeric;
  v_count integer;
begin
  -- Only recompute when responded_at was just set/changed — most updates to
  -- a channel_request (payment, going live, completion) don't touch it, so
  -- this stays a no-op for the vast majority of writes to this table.
  if new.responded_at is null or new.responded_at is not distinct from old.responded_at then
    return new;
  end if;

  select avg(extract(epoch from (responded_at - created_at)) / 3600.0), count(*)
    into v_avg_hours, v_count
    from public.channel_requests
    where creator_id = new.creator_id and responded_at is not null;

  update public.publishers
    set avg_response_hours = v_avg_hours, response_count = coalesce(v_count, 0)
    where id = new.creator_id;

  return new;
end;
$$;

drop trigger if exists trg_update_publisher_response_stats on public.channel_requests;
create trigger trg_update_publisher_response_stats
  after update of responded_at on public.channel_requests
  for each row execute function public.update_publisher_response_stats();
