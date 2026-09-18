-- ChatSched — Phase 50 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase49_partner_types.sql.
--
-- /transparency — "average response time" and "campaign completion rate"
-- are meant to be REAL numbers, not illustrative placeholders (see
-- schema_phase44's header comment for why this codebase treats that
-- distinction as important). The requests table (schema.sql) had no
-- timestamp for when a publisher first responded — only created_at — so
-- there was nothing honest to compute a response-time metric from. This
-- migration adds one.
--
-- first_responded_at is set exactly once per request, by trigger, the
-- moment status first moves off 'pending' — not on every subsequent
-- status change — so it measures "how long until the publisher first
-- acted on this", not "how long until the whole thing finished".
-- Completion rate is a separate, simpler ratio (completed / total) that
-- doesn't need a new column at all.
--
-- The stats function is SECURITY DEFINER and returns ONLY the aggregate
-- row — no individual request, business, or publisher is exposed by it,
-- so it's safe to grant to anon despite the requests table itself being
-- locked down by RLS to the business/publisher/admin involved.

alter table public.requests
  add column first_responded_at timestamptz;

create or replace function public.set_first_responded_at()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' and new.first_responded_at is null then
    new.first_responded_at := now();
  end if;
  return new;
end;
$$;

create trigger requests_set_first_responded_at
  before update on public.requests
  for each row
  execute function public.set_first_responded_at();

create or replace function public.get_marketplace_transparency_stats()
returns table (
  total_requests bigint,
  completed_requests bigint,
  completion_rate numeric,
  responded_requests bigint,
  avg_response_hours numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) as total_requests,
    count(*) filter (where status = 'completed') as completed_requests,
    round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0), 1) as completion_rate,
    count(*) filter (where first_responded_at is not null) as responded_requests,
    round(
      avg(extract(epoch from (first_responded_at - created_at)) / 3600.0)
        filter (where first_responded_at is not null),
      1
    ) as avg_response_hours
  from public.requests;
$$;

grant execute on function public.get_marketplace_transparency_stats() to anon, authenticated;
