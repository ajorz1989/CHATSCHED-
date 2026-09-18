-- ChatSched — Phase 67 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase66_managed_campaign_notifications.sql.
--
-- Relationship history (pivot brief sections 29/30) — "publishers you've
-- worked with" for a business, "businesses you've worked with" for a
-- publisher. Both self-scoped RPCs (auth.uid()-gated, not admin-gated),
-- mirroring get_my_managed_campaigns() (schema_phase61) rather than the
-- admin-only agency_client_totals()/agency_campaign_totals() shape —
-- this is an ordinary user reading their own history, same posture as
-- that function.
--
-- "Worked with" means paid, not just requested — same reasoning
-- agency_client_totals() already applies: a declined or abandoned
-- request isn't a relationship. Both functions reuse the identical
-- "latest paid payment per request, union channel_requests' own
-- paid_at" query every totals function since Phase 5 has used — kept
-- duplicated rather than shared, same reasoning schema_phase62's header
-- gives for not calling an admin-gated function from a non-admin
-- context: these run for ordinary business/publisher users, and calling
-- an admin-only function from here would just raise and return nothing.

create or replace function public.my_publisher_relationships()
returns table (
  publisher_id uuid,
  publisher_name text,
  channel_slug text,
  city text,
  province text,
  campaign_count integer,
  total_spent numeric,
  last_campaign_at timestamptz,
  avg_rating numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    p.id as publisher_id,
    p.name as publisher_name,
    p.channel_slug::text,
    p.city,
    p.province,
    count(*)::integer as campaign_count,
    coalesce(sum(combined.amount), 0) as total_spent,
    max(combined.at) as last_campaign_at,
    (select avg(r.rating)::numeric from public.reviews r where r.publisher_id = p.id and r.business_id = auth.uid()) as avg_rating
  from (
    select r.publisher_id, pay.amount, pay.paid_at as at
    from public.requests r
    join lateral (
      select amount, paid_at from public.payments
      where request_id = r.id and status = 'paid'
      order by created_at desc limit 1
    ) pay on true
    where r.business_id = auth.uid()
    union all
    select cr.creator_id as publisher_id, cr.proposed_amount as amount, cr.paid_at as at
    from public.channel_requests cr
    where cr.business_id = auth.uid() and cr.paid_at is not null
  ) combined
  join public.publishers p on p.id = combined.publisher_id
  group by p.id, p.name, p.channel_slug, p.city, p.province
  order by max(combined.at) desc;
end;
$$;

create or replace function public.my_business_relationships()
returns table (
  business_id uuid,
  business_name text,
  campaign_count integer,
  total_earned numeric,
  last_campaign_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  select id into v_publisher_id from public.publishers where user_id = auth.uid();
  if v_publisher_id is null then
    return;
  end if;

  return query
  select
    combined.business_id,
    coalesce(prof.company_name, prof.full_name, 'Business') as business_name,
    count(*)::integer as campaign_count,
    -- 0.88 = 1 - PLATFORM_COMMISSION_RATE (constants.ts). Duplicated, not
    -- shared, same reasoning as every other cross-runtime constant since
    -- Phase 2 (MONTHLY_PRICE, applyLaunchCredit) — Postgres functions
    -- can't import a TS constant. Keep in sync if the commission rate
    -- ever changes.
    coalesce(sum(combined.amount * 0.88), 0) as total_earned,
    max(combined.at) as last_campaign_at
  from (
    select r.business_id, pay.amount, pay.paid_at as at
    from public.requests r
    join lateral (
      select amount, paid_at from public.payments
      where request_id = r.id and status = 'paid'
      order by created_at desc limit 1
    ) pay on true
    where r.publisher_id = v_publisher_id
    union all
    select cr.business_id, cr.proposed_amount as amount, cr.paid_at as at
    from public.channel_requests cr
    where cr.creator_id = v_publisher_id and cr.paid_at is not null
  ) combined
  join public.profiles prof on prof.id = combined.business_id
  group by combined.business_id, prof.company_name, prof.full_name
  order by max(combined.at) desc;
end;
$$;

comment on function public.my_publisher_relationships is
  'Self-scoped (auth.uid()), not admin-gated — a business''s own paid
   history with each publisher. Powers /business/publishers.';
comment on function public.my_business_relationships is
  'Self-scoped (auth.uid()), not admin-gated — a publisher''s own paid
   history with each business. Powers /publisher/relationships.';
