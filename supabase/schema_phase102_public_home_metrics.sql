-- ChatSched — Phase 102 public homepage metrics
-- Aggregate-only RPC for the public homepage. It exposes no user/payment rows.

create or replace function public.get_home_public_metrics()
returns table (
  businesses bigint,
  publishers bigint,
  paid_out_zar numeric
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles where role = 'business'),
    (select count(*) from public.publishers_public),
    coalesce((select round(sum(amount * (1 - 0.12)), 2) from public.payments where status = 'paid' and payout_status = 'paid'), 0);
$$;

revoke all on function public.get_home_public_metrics() from public;
grant execute on function public.get_home_public_metrics() to anon, authenticated;
