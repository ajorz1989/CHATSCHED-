drop function if exists public.get_home_public_metrics();

create or replace function public.get_home_public_metrics()
returns table(
  verified_publishers bigint,
  new_publishers_this_month bigint,
  completed_bookings bigint
)
language sql
security definer
set search_path = public, pg_catalog
as $function$
  select
    (select count(*) from public.publishers_public where verified = true),
    (select count(*) from public.publishers_public where created_at >= date_trunc('month', now())),
    (select count(*) from public.requests where status = 'completed');
$function$;

revoke all on function public.get_home_public_metrics() from public, anon, authenticated;
grant execute on function public.get_home_public_metrics() to anon, authenticated;
