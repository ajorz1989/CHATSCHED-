-- ChatSched — Phase 99 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase98_cross_party_contact_completeness.sql.
--
-- L2-05 (entitlement/pricing model consistency) — found while sweeping
-- the codebase for stale references to the pre-phase86 commission rate
-- (12%/88%) after that rate changed to 8%/92%. Everywhere else already
-- follows the pattern analytics_functions.sql documents explicitly:
-- never duplicate the commission rate in SQL — return the raw
-- gross amount and let src/lib/constants.ts's PLATFORM_COMMISSION_RATE/
-- PUBLISHER_SHARE do the math client-side, specifically so the rate
-- can't drift between a SQL copy and the TS one. One function didn't
-- follow it: my_business_relationships() (schema_phase67), which
-- hardcoded `* 0.88` directly in the query, with its own comment
-- correctly warning "keep in sync if the commission rate ever
-- changes" — and then it changed (schema_phase86, 12%->8%) without this
-- being updated. Since schema_phase86 shipped, every publisher's
-- lifetime "total earned" figure on /publisher/relationships
-- (PublisherRelationships.tsx) has been showing 88% of gross booking
-- value instead of the correct 92% — understated, not overstated, but
-- still simply wrong, and it would drift again the next time the rate
-- changes for the same reason it drifted this time.
--
-- Fix follows the same pattern as everywhere else, not just a patched
-- number: return the raw gross figure (renamed total_spent, matching
-- the sibling function my_publisher_relationships' own naming for the
-- symmetric case) and let the caller multiply by PUBLISHER_SHARE — see
-- src/pages/PublisherRelationships.tsx.
create or replace function public.my_business_relationships()
returns table (
  business_id uuid,
  business_name text,
  campaign_count integer,
  total_spent numeric,
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
    coalesce(sum(combined.amount), 0) as total_spent,
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

comment on function public.my_business_relationships is
  'Self-scoped (auth.uid()), not admin-gated — a publisher''s own paid
   history with each business. Powers /publisher/relationships.
   total_spent is the raw gross booking amount, NOT net of commission —
   multiply by PUBLISHER_SHARE (src/lib/constants.ts) client-side to get
   what the publisher actually earned, same pattern
   analytics_functions.sql uses for every other commission-derived
   figure. Previously computed a publisher''s net earnings directly in
   SQL with a hardcoded 0.88 multiplier that went stale the one time the
   commission rate changed (schema_phase99, see that file''s comment).';
