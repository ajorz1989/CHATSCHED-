-- ChatSched — Phase 82 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase81_prevent_role_escalation.sql.
--
-- Fixes "Claude To fix 1..txt" item 6, CRITICAL — Public publisher rows
-- expose sensitive columns. Verified against the real source, not just
-- the finding's own description, before writing anything:
--
--   publishers_select_approved_or_own_or_admin (schema_phase5.sql):
--       for select using (status = 'approved' or auth.uid() = user_id or public.is_admin())
--   This is a ROW filter only. Once a row passes it (any status='approved'
--   row, for literally any caller — this policy has no `to authenticated`
--   restriction, so it applies to the `anon` role too), the ENTIRE row is
--   readable, including every sensitive column the table has accumulated
--   since schema_phase5.sql first added it:
--     email, mobile_number (schema_phase5.sql)
--     company_registration, vat_number (schema_phase5.sql)
--     admin_notes, rejected_reason (schema_phase5.sql)
--     payout_method, payout_details, payout_account_verified_at
--       (schema_payouts_phase1.sql)
--     authenticity_risk, authenticity_notes (schema_phase24_fraud_authenticity.sql)
--     business_name (schema_phase5.sql — grouped with company_registration/
--       vat_number as "sensitive business information")
--   None of this depends on which frontend file runs the query or what it
--   chooses to render — `GET /rest/v1/publishers?select=*&status=eq.approved`
--   from curl, with no session at all, returns every one of these columns
--   for every approved publisher today. Confirmed this is real by reading
--   the live policy text directly, not assumed from the finding.
--
-- Required fix (from the finding) is a safe view/RPC that only returns
-- marketplace-appropriate fields, so that's what this migration builds —
-- plus the two things actually necessary to close the hole without
-- breaking real functionality that turned out to depend on the current
-- policy (found by tracing every consumer, not assumed absent):
--
--   1. public.publishers_public — a view exposing only fields that are
--      genuinely used by the public-facing marketplace UI (checked
--      directly against every usePublishers() consumer — Browse.tsx,
--      Home.tsx, PublisherProfile.tsx, ComparePublishers.tsx, MediaKit.tsx,
--      MapView.tsx, the marketingSuite/* tools, AudienceFinder.tsx,
--      BuildMyCampaign.tsx, CaseStudies.tsx, SavedLists.tsx,
--      SavedSearches.tsx, Suburbs.tsx, Categories.tsx — plus
--      MarketplaceProfileView.tsx via PublisherProfile.tsx/
--      PublisherDashboardView.tsx, which is the one place channel_metadata
--      is actually read for display) — and explicitly never the fields
--      the finding names (payout details, admin notes, private contact
--      details, internal rejection details, sensitive business
--      information) plus a few more in the same spirit that no consumer
--      currently reads (email_verified/phone_verified/identity_verified,
--      authenticity_*, reviewed_at, account_age_months, posting_frequency).
--      Created here in the Supabase SQL editor, so it's owned by the
--      `postgres` role — an ordinary view's underlying-table access runs
--      as the VIEW OWNER by default (`security_invoker` defaults to
--      false), and `postgres` bypasses RLS entirely, so the view's own
--      `where status = 'approved'` is the only row filter that applies,
--      regardless of who queries the view. Explicit about this below
--      rather than relying on it silently, since it's the entire reason
--      the view can do what a table-level policy can't (restrict columns,
--      not just rows).
--
--   2. calculate_trust_score(), calculate_publisher_score(),
--      assign_publisher_level(), and refresh_publisher_scores() — none of
--      these were ever declared SECURITY DEFINER, so each runs with the
--      CALLING role's own RLS. That calling role is only ever an admin
--      session for the request-completion path (requests_update_admin is
--      admin-only) — but trg_refresh_scores_on_review fires `after insert
--      or update on public.reviews`, and reviews_insert_own_completed
--      (schema_phase2.sql) lets an ordinary BUSINESS insert a review after
--      their own completed request. That business is neither the
--      publisher's user_id nor an admin, so once
--      publishers_select_approved_or_own_or_admin's `status = 'approved'`
--      branch is narrowed below, that business's own review insert would
--      make calculate_trust_score()'s `select * from publishers where id =
--      ...` return nothing, and trust_score/publisher_score would
--      silently reset to 0 the next time anyone reviews a publisher. This
--      is real, found by tracing the actual trigger chain rather than
--      assumed — not something to introduce while fixing item 6. Making
--      these four SECURITY DEFINER (their bodies are unchanged; this is
--      only ever a security-context annotation) fixes it permanently:
--      the score-refresh machinery was never meant to depend on the
--      triggering session's own row visibility in the first place, it
--      already writes into columns (trust_score, publisher_score, level)
--      no ordinary user can otherwise touch directly.
--
--   3. publishers_select_approved_or_own_or_admin is narrowed to
--      publishers_select_own_or_admin — the `status = 'approved'` branch
--      is removed from the base table entirely. Public marketplace
--      browsing now exclusively goes through publishers_public (item 1
--      above); a logged-in publisher can still see their own row in full
--      (own branch), and admins still see everything (admin branch).
--      Traced every other RLS policy in the schema that references
--      `public.publishers` in a subquery (channel_requests, messages,
--      disputes, deliverables, content_approvals, campaign_compliance,
--      opportunity_applications, etc.) — every single one matches via
--      `p.user_id = auth.uid()`, the own-branch, never the approved-
--      branch, so none of them are affected by this narrowing.
--
-- Frontend files that queried publishers directly for public/marketplace
-- browsing (select("*") or a narrow select, always filtered to
-- status = 'approved', for a non-owner/non-admin audience) are updated in
-- this same change to query publishers_public instead:
--   src/hooks/usePublishers.ts, src/components/BusinessHomeSummary.tsx,
--   src/lib/recentlyViewed.ts, src/pages/ReachChecker.tsx,
--   src/pages/About.tsx, src/pages/Press.tsx
-- Every other file that touches `publishers` (PublisherDashboardView.tsx,
-- PortfolioManager.tsx, EarningsDashboard.tsx, OpportunityFeed.tsx,
-- CampaignCompliance.tsx, campaignWorkspace.ts, accountExport.ts,
-- PublisherApply.tsx — all own-row; Admin.tsx, AdminCampaigns.tsx,
-- CreateRequestForClient.tsx — all admin) is untouched: each already
-- matches the own-or-admin branch this migration keeps.

-- ── 1. calculate_trust_score(): now SECURITY DEFINER, body unchanged ────
-- Latest version per schema_phase11.sql (adds the Fast Response weight).
create or replace function public.calculate_trust_score(p_publisher_id uuid)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher public.publishers%rowtype;
  v_weighted numeric := 0;
  v_available numeric := 0;
  v_review_avg numeric;
  v_completed integer;
  v_avg_response_hours numeric;
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found then return 0; end if;

  v_available := v_available + 10;
  if v_publisher.email_verified then v_weighted := v_weighted + 10; end if;

  v_available := v_available + 10;
  if v_publisher.phone_verified then v_weighted := v_weighted + 10; end if;

  v_available := v_available + 15;
  if v_publisher.identity_verified then v_weighted := v_weighted + 15; end if;

  v_available := v_available + 10;
  if coalesce(v_publisher.account_age_months, 0) >= 6 then v_weighted := v_weighted + 10; end if;

  select avg(coalesce(
      (communication_rating + professionalism_rating + quality_rating + timeliness_rating + value_rating) / 5.0,
      rating
    ))
    into v_review_avg
    from public.reviews
    where publisher_id = p_publisher_id and author_role = 'business';
  if v_review_avg is not null then
    v_available := v_available + 20;
    v_weighted := v_weighted + least(v_review_avg / 5.0, 1) * 20;
  end if;

  select count(*) into v_completed from public.requests
    where publisher_id = p_publisher_id and status = 'completed';
  if v_completed > 0 then
    v_available := v_available + 20;
    v_weighted := v_weighted + least(v_completed, 10) * 2;
  end if;

  select avg(extract(epoch from (first_contacted_at - created_at)) / 3600)
    into v_avg_response_hours
    from public.requests
    where publisher_id = p_publisher_id and first_contacted_at is not null;
  if v_avg_response_hours is not null then
    v_available := v_available + 10;
    v_weighted := v_weighted + greatest(0, least(1, (48 - v_avg_response_hours) / 48)) * 10;
  end if;

  if v_available = 0 then return 0; end if;
  return round(least(v_weighted / v_available * 100, 100));
end;
$$;

-- ── 2. calculate_publisher_score(): now SECURITY DEFINER, body unchanged ─
-- Only ever defined once, in schema_phase5.sql.
create or replace function public.calculate_publisher_score(p_publisher_id uuid)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher public.publishers%rowtype;
  v_weighted numeric := 0;
  v_available numeric := 0;
  v_review_avg numeric;
  v_completed integer;
  v_resolved integer;
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found then return 0; end if;

  v_available := v_available + 30;
  v_weighted := v_weighted + least(coalesce(v_publisher.engagement, 0) / 10.0, 1) * 30;

  select count(*) filter (where status = 'completed'),
         count(*) filter (where status in ('completed', 'declined'))
    into v_completed, v_resolved
    from public.requests where publisher_id = p_publisher_id;
  if coalesce(v_resolved, 0) > 0 then
    v_available := v_available + 25;
    v_weighted := v_weighted + (v_completed::numeric / v_resolved) * 25;
  end if;

  select avg(coalesce(
      (communication_rating + professionalism_rating + quality_rating + timeliness_rating + value_rating) / 5.0,
      rating
    ))
    into v_review_avg
    from public.reviews
    where publisher_id = p_publisher_id and author_role = 'business';
  if v_review_avg is not null then
    v_available := v_available + 20;
    v_weighted := v_weighted + (v_review_avg / 5.0) * 20;
  end if;

  v_available := v_available + 5;
  v_weighted := v_weighted + least(coalesce(v_publisher.followers, 0) / 100000.0, 1) * 5;

  if v_available = 0 then return 0; end if;
  return round(least(v_weighted / v_available * 100, 100));
end;
$$;

-- ── 3. assign_publisher_level(): now SECURITY DEFINER, body unchanged ───
-- Only ever defined once, in schema_phase5.sql.
create or replace function public.assign_publisher_level(p_publisher_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher public.publishers%rowtype;
begin
  select * into v_publisher from public.publishers where id = p_publisher_id;
  if not found or v_publisher.status <> 'approved' then return null; end if;

  if v_publisher.followers >= 100000 and v_publisher.identity_verified then
    return 'elite';
  elsif v_publisher.followers >= 20000 then
    return 'premium';
  elsif v_publisher.followers >= 5000 and v_publisher.phone_verified
        and coalesce(v_publisher.account_age_months, 0) >= 6 then
    return 'verified';
  elsif v_publisher.followers >= 3000 then
    return 'rising';
  else
    return null;
  end if;
end;
$$;

-- ── 4. refresh_publisher_scores(): now SECURITY DEFINER, body unchanged ─
-- Latest version per schema_phase9.sql (adds completed_campaigns/resolved_campaigns).
create or replace function public.refresh_publisher_scores(p_publisher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

-- ── 5. The safe public view ──────────────────────────────────────────
-- security_invoker = false is the default (kept explicit here because
-- the entire fix depends on it) — reads run as this view's owner
-- (`postgres`, since this migration runs in the Supabase SQL editor),
-- which bypasses RLS on the underlying table entirely. The `where
-- status = 'approved'` below is therefore the ONLY row filter that
-- applies, for every querying role — there is no RLS fallback happening
-- underneath it.
create or replace view public.publishers_public
with (security_invoker = false)
as
select
  id,
  user_id,
  name,
  city,
  province,
  suburb,
  category,
  platforms,
  placement_types,
  accepted_ad_formats,
  channel_slug,
  channel_metadata,
  followers,
  engagement,
  price_per_post,
  rating,
  reviews,
  verified,
  bio,
  audience,
  initials,
  swatch,
  created_at,
  languages,
  level,
  trust_score,
  publisher_score,
  avg_response_hours,
  response_count,
  last_active_at,
  ai_audience_summary,
  ai_audience_summary_generated_at,
  intro_video_url,
  portfolio_images,
  featured,
  featured_until,
  completed_campaigns,
  resolved_campaigns,
  status
from public.publishers
where status = 'approved';

comment on view public.publishers_public is
  'Safe public read surface for the marketplace directory — every column here is one the public-facing UI actually renders. Deliberately excludes email, mobile_number, business_name, company_registration, vat_number, admin_notes, rejected_reason, reviewed_at, payout_method, payout_details, payout_account_verified_at, authenticity_risk, authenticity_notes, authenticity_checked_at, email_verified, phone_verified, identity_verified, account_age_months, and posting_frequency. Query this instead of public.publishers for any public/marketplace-browsing read; use the base table only for a publisher''s own row (auth.uid() = user_id) or from an admin session.';

grant select on public.publishers_public to anon, authenticated;

-- ── 6. Narrow the base table's SELECT policy ─────────────────────────
drop policy "publishers_select_approved_or_own_or_admin" on public.publishers;

create policy "publishers_select_own_or_admin" on public.publishers
  for select using (
    auth.uid() = user_id or public.is_admin()
  );
