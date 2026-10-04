-- ChatSched — Phase 115: free sign-up + Premium access (R199/month)
-- NOT APPLIED. Run after schema_phase114. No business or creator has ever
-- paid an activation fee (confirmed by AJ), so there is no money to unwind.
--
-- What changes
--   1. Booking is free to start: a business no longer needs an active
--      "business activation" to send a request (requests / channel_requests).
--      Creators already don't need one to accept (schema_phase113).
--   2. Premium access (R199/month, PayFast recurring) is the only paid
--      tier. It unlocks the Opportunities job board and the Marketing Suite,
--      for businesses AND creators. It reuses business_subscriptions /
--      publisher_subscriptions as the access records (status 'active' while
--      paid), with a current_period_end that payfast-notify extends on every
--      monthly payment so an unpaid month lapses by itself.
--   3. publisher_is_activated() / current_user_has_activated_listing() now
--      mean "the listing's owner has Premium access".
--   4. Launch credit is switched off: its RPCs are dropped. The tables are
--      kept (empty) so nothing else breaks and history is not destroyed.
--
-- NOT covered here (flagged for AJ): the accept-application RPC from
--   schema_phase110 still checks business_subscriptions / publisher_subscriptions
--   status directly (and joins publisher_subscriptions on publishers.id where
--   the table is keyed by user id). It needs its own follow-up phase once we
--   agree what accepting an application should require.

-- ── 1. Recurring-billing columns phase86 removed ────────────────────────
alter table public.business_subscriptions
  add column if not exists current_period_end timestamptz,
  add column if not exists payfast_token text;
alter table public.publisher_subscriptions
  add column if not exists current_period_end timestamptz,
  add column if not exists payfast_token text;

comment on table public.business_subscriptions is
  'Premium access (R199/month via PayFast) for a business. status = active while paid; current_period_end is pushed forward by payfast-notify on each monthly payment. Replaces the retired R399 once-off activation (schema_phase115).';
comment on table public.publisher_subscriptions is
  'Premium access (R199/month via PayFast) for a creator. status = active while paid; current_period_end is pushed forward by payfast-notify on each monthly payment. Replaces the retired R199 once-off activation (schema_phase115).';

-- ── 2. One definition of "has Premium access right now" ────────────────
create or replace function public.premium_is_active(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.business_subscriptions bs
    where bs.business_id = p_user_id and bs.status = 'active'
      and (bs.current_period_end is null or bs.current_period_end > now())
  ) or exists (
    select 1 from public.publisher_subscriptions ps
    where ps.publisher_id = p_user_id and ps.status = 'active'
      and (ps.current_period_end is null or ps.current_period_end > now())
  );
$$;
revoke all on function public.premium_is_active(uuid) from public;
grant execute on function public.premium_is_active(uuid) to authenticated;

-- ── 3. Free booking ────────────────────────────────────────────────────
drop policy if exists "requests_insert_own" on public.requests;
create policy "requests_insert_own" on public.requests
  for insert with check (auth.uid() = business_id);

drop policy if exists "channel_requests_insert_business" on public.channel_requests;
create policy "channel_requests_insert_business" on public.channel_requests
  for insert with check (auth.uid() = business_id and status = 'pending');

-- ── 4. Premium gates for the job board ─────────────────────────────────
drop policy if exists opportunities_insert_own on public.opportunities;
create policy opportunities_insert_own on public.opportunities
  for insert with check (
    business_id = auth.uid()
    and public.premium_is_active(auth.uid())
  );

create or replace function public.publisher_is_activated(p_publisher_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.publishers p
    where p.id = p_publisher_id
      and public.premium_is_active(p.user_id)
  );
$$;
revoke all on function public.publisher_is_activated(uuid) from public;
grant execute on function public.publisher_is_activated(uuid) to authenticated;

create or replace function public.current_user_has_activated_listing()
returns boolean
language sql stable security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.publishers p
    where p.user_id = auth.uid()
      and p.status = 'approved' and p.verified = true
      and public.publisher_is_activated(p.id)
  );
$$;
revoke all on function public.current_user_has_activated_listing() from public;
grant execute on function public.current_user_has_activated_listing() to authenticated;

-- opportunity_applications_insert_publisher (schema_phase 20261003120000)
-- already calls publisher_is_activated(), so it now means Premium.

-- ── 5. Launch credit is retired ────────────────────────────────────────
drop function if exists public.reserve_launch_credit_for_payment(uuid);
drop function if exists public.confirm_launch_credit_redemption(uuid);
drop function if exists public.release_launch_credit_redemption(uuid);
