-- ChatSched — Phase 116: lock down the functions added in phases 113-115
-- APPLIED to production (hbqobuecjrxhlfgfhdud) on 2026-10-05, after the
-- Supabase security advisor flagged them.

alter function public.booking_breakdown(bigint) set search_path = public, pg_catalog;

-- Callable only by signed-in users (each also checks auth.uid()/is_admin() inside).
revoke execute on function public.cancel_channel_request(uuid, text) from anon, public;
revoke execute on function public.mark_refund_paid_out(uuid) from anon, public;
revoke execute on function public.admin_booking_revenue() from anon, public;
revoke execute on function public.premium_is_active(uuid) from anon, public;
grant execute on function public.cancel_channel_request(uuid, text) to authenticated;
grant execute on function public.mark_refund_paid_out(uuid) to authenticated;
grant execute on function public.admin_booking_revenue() to authenticated;
grant execute on function public.premium_is_active(uuid) to authenticated;

-- Trigger functions are never meant to be called as RPCs.
revoke execute on function public.snapshot_channel_request_payment() from anon, authenticated, public;
revoke execute on function public.protect_cancellation_columns() from anon, authenticated, public;
