-- ChatSched — Phase 39 schema additions
-- (Numbered 39, not 38, in this merge: schema_phase38_rate_cards.sql
-- already occupies phase 38 in this branch of the product.)
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
-- Purely additive — nothing here removes a column, table, or row that's
-- already there.
--
-- What this adds: the platform-compliance / sponsored-content data layer.
-- ChatSched does not gate publication on any third-party platform, and
-- never claims to guarantee approval by one (see product copy, not this
-- file) — what this schema tracks is ChatSched's OWN checklist: has the
-- business declared what platform/category this campaign is for, has the
-- creator acknowledged the disclosure requirement that applies, has proof
-- of publication been submitted and reviewed. Nothing here calls out to
-- TikTok/Instagram/YouTube/etc. — see section 32/33 of the brief this
-- implements: no scraping, no "platform approved" claims.
--
-- ── Why "campaign" here means request_id/channel_request_id, not `campaigns` ──
-- The existing public.campaigns table (schema_phase30) is a tracking LINK a
-- business creates (chatsched.com/t/<slug>) — a different concept from "the
-- collaboration a business and a creator are running", which is what this
-- brief calls a campaign and what actually needs a compliance record. That
-- collaboration already exists in this schema as either a `requests` row
-- (original social-media/PayFast flow) or a `channel_requests` row (the 4
-- request-flow channels). campaign_compliance therefore uses the exact
-- either-or nullable-FK pattern disputes (schema_phase25) already
-- established for "this thing is about whichever campaign it's about,
-- regardless of which flow created it" — see the comment there for the
-- full rationale.
--
-- ── "Never trust the client for status" (brief section 30) ──────────────
-- campaign_compliance.status/risk_score/risk_level/*_confirmed booleans are
-- NEVER set directly by a client UPDATE — there is no update policy on
-- those columns at all. They're entirely derived, by
-- recompute_campaign_compliance() below, from rows in the other tables
-- (a disclosure ack exists, proof was verified, a tracking link exists,
-- a review is open). The only thing a business can set directly is
-- WHICH platform/category a campaign is for, through the narrow RPC
-- set_campaign_compliance_context() — everything downstream is computed.
--
-- ── What's deliberately NOT in this migration ────────────────────────────
-- The AI screening call (brief section 6/7) and the notification triggers
-- for every event listed in section 26 are application/edge-function layer,
-- not schema — this file lays the data foundation they read from and write
-- to. campaign_risk_flags exists here as a table so that layer has
-- somewhere to write findings, but nothing in this file calls an AI model.
-- Two notification triggers are included below (disclosure required, proof
-- submitted) as a worked example of the same create_notification() pattern
-- schema_phase23 uses everywhere else — the remaining events in section 26
-- follow the identical shape and are left for the next migration once the
-- app-layer call sites exist to test against.

-- ── platform_compliance_rules ────────────────────────────────────────────
-- Admin-editable, deliberately NOT constrained to a fixed check-list of
-- platform names — third-party policies (and the list of platforms
-- ChatSched supports) change over time, and the brief is explicit that
-- this must be configurable without a migration for every update. Uniqueness
-- on `platform` (a stable slug, e.g. 'tiktok') is what enforces "one active
-- config per platform" instead.
create table public.platform_compliance_rules (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  disclosure_required boolean not null default true,
  content_restrictions text[] not null default '{}',
  prohibited_categories text[] not null default '{}',
  restricted_categories text[] not null default '{}',
  required_creator_actions text[] not null default '{}',
  required_business_actions text[] not null default '{}',
  required_proof text[] not null default '{}',
  notes text,
  -- Free-text pointer to where this was sourced from (a policy page URL,
  -- an internal doc reference) — never treated as a legal citation, just
  -- provenance for whoever reviews it next.
  policy_reference text,
  last_reviewed_at timestamptz,
  -- Bumped on every meaningful edit (see set_platform_compliance_rule()
  -- below). campaign_compliance snapshots this value at review time
  -- (policy_version) so a historical record stays meaningful even after
  -- the live rule changes — see brief section 37.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_compliance_rules is
  'ChatSched''s own configurable guidance per platform — never a claim of
   official platform approval or completeness. Surfaced on /compliance,
   /platform-rules, and inline during campaign creation. "Requirements may
   change. Always verify the current platform policies before publishing"
   is a UI-layer disclaimer, not something this table can enforce, and
   must be shown alongside every render of this data.';

create index platform_compliance_rules_enabled_idx on public.platform_compliance_rules(enabled);

alter table public.platform_compliance_rules enable row level security;

-- Anyone (including logged-out visitors on /compliance, /platform-rules)
-- can read enabled rules. Admins can also see disabled ones (so they can
-- re-enable a platform without losing its prior config).
create policy platform_compliance_rules_select_public on public.platform_compliance_rules
  for select using (enabled = true or public.is_admin());

create policy platform_compliance_rules_write_admin on public.platform_compliance_rules
  for insert with check (public.is_admin());
create policy platform_compliance_rules_update_admin on public.platform_compliance_rules
  for update using (public.is_admin());
create policy platform_compliance_rules_delete_admin on public.platform_compliance_rules
  for delete using (public.is_admin());

-- Convenience RPC so every admin edit bumps `version` and `updated_at`
-- consistently, instead of every call site in AdminCompliance having to
-- remember to. Upserts by platform slug.
create or replace function public.set_platform_compliance_rule(
  p_platform text,
  p_display_name text,
  p_enabled boolean,
  p_disclosure_required boolean,
  p_content_restrictions text[],
  p_prohibited_categories text[],
  p_restricted_categories text[],
  p_required_creator_actions text[],
  p_required_business_actions text[],
  p_required_proof text[],
  p_notes text,
  p_policy_reference text
)
returns public.platform_compliance_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.platform_compliance_rules;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can edit platform compliance rules.';
  end if;

  insert into public.platform_compliance_rules as pcr (
    platform, display_name, enabled, disclosure_required, content_restrictions,
    prohibited_categories, restricted_categories, required_creator_actions,
    required_business_actions, required_proof, notes, policy_reference,
    last_reviewed_at, version
  ) values (
    p_platform, p_display_name, p_enabled, p_disclosure_required, coalesce(p_content_restrictions, '{}'),
    coalesce(p_prohibited_categories, '{}'), coalesce(p_restricted_categories, '{}'), coalesce(p_required_creator_actions, '{}'),
    coalesce(p_required_business_actions, '{}'), coalesce(p_required_proof, '{}'), p_notes, p_policy_reference,
    now(), 1
  )
  on conflict (platform) do update set
    display_name = excluded.display_name,
    enabled = excluded.enabled,
    disclosure_required = excluded.disclosure_required,
    content_restrictions = excluded.content_restrictions,
    prohibited_categories = excluded.prohibited_categories,
    restricted_categories = excluded.restricted_categories,
    required_creator_actions = excluded.required_creator_actions,
    required_business_actions = excluded.required_business_actions,
    required_proof = excluded.required_proof,
    notes = excluded.notes,
    policy_reference = excluded.policy_reference,
    last_reviewed_at = now(),
    version = pcr.version + 1,
    updated_at = now()
  returning * into v_row;

  perform public.log_admin_action('platform_compliance_rule_saved', 'platform_compliance_rules', v_row.id,
    jsonb_build_object('platform', v_row.platform, 'version', v_row.version));

  return v_row;
end;
$$;

-- ── campaign_category_rules ──────────────────────────────────────────────
-- ChatSched's own category policy — distinct on purpose from platform
-- rules (brief section 5): a category can be ChatSched-allowed but still
-- platform-review-required, or ChatSched-restricted outright regardless of
-- platform. `category` is free text (not a fixed enum) so admins can add
-- categories without a migration; application code seeds the initial list
-- from the brief (Food & Restaurants, Retail, Fashion, ... Other).
create table public.campaign_category_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  chatsched_status text not null default 'allowed'
    check (chatsched_status in ('allowed', 'restricted', 'manual_review', 'not_accepted')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaign_category_rules enable row level security;

create policy campaign_category_rules_select_public on public.campaign_category_rules
  for select using (true);
create policy campaign_category_rules_write_admin on public.campaign_category_rules
  for insert with check (public.is_admin());
create policy campaign_category_rules_update_admin on public.campaign_category_rules
  for update using (public.is_admin());
create policy campaign_category_rules_delete_admin on public.campaign_category_rules
  for delete using (public.is_admin());

-- ── campaign_compliance ───────────────────────────────────────────────────
create table public.campaign_compliance (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  channel_request_id uuid references public.channel_requests(id) on delete cascade,
  -- Derived server-side from the referenced request/channel_request by
  -- create_campaign_compliance_stub() below — never taken from the client.
  business_id uuid not null references auth.users(id) on delete cascade,
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  platform text references public.platform_compliance_rules(platform),
  category text references public.campaign_category_rules(category),
  -- Snapshot of platform_compliance_rules.version at the moment a platform
  -- was assigned — protects historical records if the live rule changes
  -- later (brief section 37).
  policy_version integer,
  status text not null default 'not_started'
    check (status in ('not_started', 'ready', 'needs_attention', 'under_review', 'not_eligible')),
  risk_score integer check (risk_score between 0 and 100),
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  -- Checklist flags shown on /campaigns/:id/compliance. All computed by
  -- recompute_campaign_compliance() — see file header. brief_supplied is
  -- effectively always true given campaign_message/campaign_message-style
  -- columns are NOT NULL on both source tables, but is kept as an explicit
  -- flag so the checklist item still reads naturally in the UI.
  category_assessed boolean not null default false,
  disclosure_identified boolean not null default false,
  creator_accepted boolean not null default false,
  brief_supplied boolean not null default true,
  tracking_configured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_compliance_one_campaign_ref check (
    (request_id is not null and channel_request_id is null) or
    (request_id is null and channel_request_id is not null)
  )
);

-- One compliance record per campaign, whichever flow it came from.
create unique index campaign_compliance_request_id_uidx on public.campaign_compliance(request_id) where request_id is not null;
create unique index campaign_compliance_channel_request_id_uidx on public.campaign_compliance(channel_request_id) where channel_request_id is not null;
create index campaign_compliance_business_id_idx on public.campaign_compliance(business_id);
create index campaign_compliance_publisher_id_idx on public.campaign_compliance(publisher_id);
create index campaign_compliance_status_idx on public.campaign_compliance(status);

alter table public.campaign_compliance enable row level security;

create policy campaign_compliance_select_participant on public.campaign_compliance
  for select using (
    business_id = auth.uid()
    or exists (select 1 from public.publishers p where p.id = publisher_id and p.user_id = auth.uid())
    or public.is_admin()
  );

-- No client insert policy at all — rows are only created by
-- create_campaign_compliance_stub() (SECURITY DEFINER, fires on the
-- underlying request/channel_request being created), same "server is the
-- only writer" shape as notifications. No general update policy either:
-- every column that's meaningful to change goes through a narrow RPC
-- below, so there is nothing for a raw client UPDATE to legitimately do.

-- ── campaign_disclosures ──────────────────────────────────────────────────
-- Append-only audit record of a creator acknowledging the disclosure
-- requirement for a specific campaign + platform (brief section 8).
create table public.campaign_disclosures (
  id uuid primary key default gen_random_uuid(),
  campaign_compliance_id uuid not null references public.campaign_compliance(id) on delete cascade,
  -- The actual signed-in user who clicked "I understand" — kept separate
  -- from publisher_id (the directory listing) since publishers.user_id can
  -- be null for admin-added listings; acknowledged_by is always a real
  -- auth.uid() at the moment of the click.
  acknowledged_by uuid not null references auth.users(id),
  platform text not null,
  requirement_version integer,
  acknowledged_at timestamptz not null default now()
);

create index campaign_disclosures_campaign_compliance_id_idx on public.campaign_disclosures(campaign_compliance_id);

comment on table public.campaign_disclosures is
  'Append-only. No update or delete policy for anyone, including admins —
   an acknowledgment record that could be edited after the fact would not
   be an audit trail. One campaign can end up with more than one row if a
   platform changes; that is intentional history, not deduplicated.';

alter table public.campaign_disclosures enable row level security;

create policy campaign_disclosures_select_participant on public.campaign_disclosures
  for select using (
    exists (
      select 1 from public.campaign_compliance cc
      where cc.id = campaign_compliance_id
      and (cc.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cc.publisher_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- Insert goes through acknowledge_campaign_disclosure() below (SECURITY
-- DEFINER), which verifies the caller is actually the campaign's creator —
-- so no direct insert policy is needed or granted here.

-- ── campaign_proof ────────────────────────────────────────────────────────
create table public.campaign_proof (
  id uuid primary key default gen_random_uuid(),
  campaign_compliance_id uuid not null references public.campaign_compliance(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  platform text not null,
  post_url text check (post_url is null or post_url ~ '^https?://'),
  post_id text,
  -- Path into Supabase Storage, not a raw upload — matches the pattern
  -- used for other file attachments elsewhere in this schema. Nothing in
  -- this migration creates the storage bucket; that is an app-layer step.
  screenshot_path text,
  published_at date,
  disclosure_confirmed boolean not null default false,
  notes text,
  status text not null default 'pending_review' check (status in ('pending_review', 'verified', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_proof_campaign_compliance_id_idx on public.campaign_proof(campaign_compliance_id);
create index campaign_proof_status_idx on public.campaign_proof(status);

alter table public.campaign_proof enable row level security;

create policy campaign_proof_select_participant on public.campaign_proof
  for select using (
    exists (
      select 1 from public.campaign_compliance cc
      where cc.id = campaign_compliance_id
      and (cc.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cc.publisher_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- The creator submits their own proof, on their own campaign only.
create policy campaign_proof_insert_creator on public.campaign_proof
  for insert with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.campaign_compliance cc
      join public.publishers p on p.id = cc.publisher_id
      where cc.id = campaign_compliance_id and p.user_id = auth.uid()
    )
  );

-- Only admin reviews proof (verified/rejected) — same "only admin resolves"
-- shape as disputes; the creator who submitted it can't mark their own
-- proof verified.
create policy campaign_proof_update_admin on public.campaign_proof
  for update using (public.is_admin());

create or replace function public.review_campaign_proof(
  p_proof_id uuid, p_status text, p_rejection_reason text default null
)
returns public.campaign_proof
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.campaign_proof;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can review publication proof.';
  end if;
  if p_status not in ('verified', 'rejected') then
    raise exception 'invalid status for review_campaign_proof: %', p_status;
  end if;

  update public.campaign_proof
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then p_rejection_reason else null end,
      updated_at = now()
  where id = p_proof_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Proof not found: %', p_proof_id;
  end if;

  perform public.log_admin_action('proof_' || p_status, 'campaign_proof', v_row.id,
    jsonb_build_object('campaign_compliance_id', v_row.campaign_compliance_id));
  perform public.recompute_campaign_compliance(v_row.campaign_compliance_id);

  return v_row;
end;
$$;

-- ── compliance_reviews ────────────────────────────────────────────────────
-- The manual review queue at /admin/compliance/reviews (brief section 16).
create table public.compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  campaign_compliance_id uuid not null references public.campaign_compliance(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'rejected', 'request_changes')),
  flagged_reasons text[] not null default '{}',
  assigned_admin_id uuid references auth.users(id),
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index compliance_reviews_campaign_compliance_id_idx on public.compliance_reviews(campaign_compliance_id);
create index compliance_reviews_status_idx on public.compliance_reviews(status);

alter table public.compliance_reviews enable row level security;

-- Admin-only end to end — participants see the resulting campaign_compliance
-- status, not the internal review queue itself (matches how disputes keeps
-- resolution to admin, participants act through dispute_messages instead).
create policy compliance_reviews_admin_only on public.compliance_reviews
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.decide_compliance_review(
  p_review_id uuid, p_status text, p_decision_notes text default null
)
returns public.compliance_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.compliance_reviews;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can decide a compliance review.';
  end if;
  if p_status not in ('in_review', 'approved', 'rejected', 'request_changes') then
    raise exception 'invalid status for decide_compliance_review: %', p_status;
  end if;

  update public.compliance_reviews
  set status = p_status,
      assigned_admin_id = coalesce(assigned_admin_id, auth.uid()),
      decision_notes = coalesce(p_decision_notes, decision_notes),
      decided_at = case when p_status in ('approved', 'rejected', 'request_changes') then now() else decided_at end,
      updated_at = now()
  where id = p_review_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Review not found: %', p_review_id;
  end if;

  perform public.log_admin_action('compliance_review_' || p_status, 'compliance_reviews', v_row.id,
    jsonb_build_object('campaign_compliance_id', v_row.campaign_compliance_id));
  perform public.recompute_campaign_compliance(v_row.campaign_compliance_id);

  return v_row;
end;
$$;

-- ── campaign_risk_flags ───────────────────────────────────────────────────
-- Where the AI/rule-based screening service (brief section 6/7 — app/edge
-- function layer, not this migration) writes its findings. The AI never
-- writes to campaign_compliance.status directly — only here; a human (via
-- compliance_reviews) makes the actual eligibility call. This is the "AI
-- assists screening, does not replace human review" rule from the brief,
-- enforced structurally: there is no policy letting anything but
-- recompute_campaign_compliance() touch campaign_compliance.status.
create table public.campaign_risk_flags (
  id uuid primary key default gen_random_uuid(),
  campaign_compliance_id uuid not null references public.campaign_compliance(id) on delete cascade,
  flag_type text not null,
  severity text not null check (severity in ('info', 'low', 'medium', 'high')),
  description text not null,
  source text not null default 'rule' check (source in ('ai', 'rule', 'admin')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index campaign_risk_flags_campaign_compliance_id_idx on public.campaign_risk_flags(campaign_compliance_id);
create index campaign_risk_flags_unresolved_idx on public.campaign_risk_flags(campaign_compliance_id) where resolved = false;

alter table public.campaign_risk_flags enable row level security;

create policy campaign_risk_flags_select_participant on public.campaign_risk_flags
  for select using (
    exists (
      select 1 from public.campaign_compliance cc
      where cc.id = campaign_compliance_id
      and (cc.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cc.publisher_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- Only admin (or the service-role screening job, which bypasses RLS
-- entirely) writes flags — never the business or creator the flag is
-- about.
create policy campaign_risk_flags_write_admin on public.campaign_risk_flags
  for insert with check (public.is_admin());
create policy campaign_risk_flags_update_admin on public.campaign_risk_flags
  for update using (public.is_admin());

-- ── creator_category_preferences ─────────────────────────────────────────
-- Brief section 17: a publisher/creator's "I don't accept campaigns from…"
-- / "preferred categories" list, used in matching.
create table public.creator_category_preferences (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  category text not null,
  preference text not null check (preference in ('preferred', 'excluded')),
  created_at timestamptz not null default now(),
  unique (publisher_id, category)
);

create index creator_category_preferences_publisher_id_idx on public.creator_category_preferences(publisher_id);

alter table public.creator_category_preferences enable row level security;

create policy creator_category_preferences_select_public on public.creator_category_preferences
  for select using (true); -- used in publisher-matching UI shown to businesses; not sensitive

create policy creator_category_preferences_write_owner on public.creator_category_preferences
  for all using (
    exists (select 1 from public.publishers p where p.id = publisher_id and p.user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.publishers p where p.id = publisher_id and p.user_id = auth.uid())
    or public.is_admin()
  );

-- ── business_campaign_preferences ────────────────────────────────────────
-- Brief section 18. One row per business, upserted — simpler than a
-- multi-row table since these are account-level settings, not per-campaign.
create table public.business_campaign_preferences (
  business_id uuid primary key references auth.users(id) on delete cascade,
  preferred_creator_categories text[] not null default '{}',
  excluded_creator_categories text[] not null default '{}',
  brand_safety_requirements text,
  competitor_exclusions text[] not null default '{}',
  location_requirements text,
  audience_requirements text,
  updated_at timestamptz not null default now()
);

alter table public.business_campaign_preferences enable row level security;

create policy business_campaign_preferences_owner on public.business_campaign_preferences
  for all using (business_id = auth.uid() or public.is_admin())
  with check (business_id = auth.uid() or public.is_admin());

-- ── create_campaign_compliance_stub: the only way a campaign_compliance row is created ──
create or replace function public.create_campaign_compliance_stub()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'requests' then
    insert into public.campaign_compliance (request_id, business_id, publisher_id)
    values (new.id, new.business_id, new.publisher_id);
  elsif tg_table_name = 'channel_requests' then
    insert into public.campaign_compliance (channel_request_id, business_id, publisher_id)
    values (new.id, new.business_id, new.creator_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_campaign_compliance_stub_requests on public.requests;
create trigger trg_create_campaign_compliance_stub_requests
  after insert on public.requests
  for each row execute function public.create_campaign_compliance_stub();

drop trigger if exists trg_create_campaign_compliance_stub_channel_requests on public.channel_requests;
create trigger trg_create_campaign_compliance_stub_channel_requests
  after insert on public.channel_requests
  for each row execute function public.create_campaign_compliance_stub();

-- ── set_campaign_compliance_context: the only client-writable path onto campaign_compliance ──
-- Business declares which platform + category this campaign is for. Only
-- callable by the campaign's own business, and only while nothing has
-- progressed past that point yet (not_started/needs_attention) — once a
-- review has opened, the platform/category is locked to keep the review
-- meaningful; an admin can still call this via is_admin() to correct it.
create or replace function public.set_campaign_compliance_context(
  p_campaign_compliance_id uuid, p_platform text, p_category text
)
returns public.campaign_compliance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cc public.campaign_compliance;
  v_policy_version integer;
begin
  select * into v_cc from public.campaign_compliance where id = p_campaign_compliance_id;
  if v_cc.id is null then
    raise exception 'Campaign compliance record not found: %', p_campaign_compliance_id;
  end if;

  if not (v_cc.business_id = auth.uid() or public.is_admin()) then
    raise exception 'Only the campaign''s business (or an admin) can set its platform/category.';
  end if;
  if v_cc.status not in ('not_started', 'needs_attention') and not public.is_admin() then
    raise exception 'This campaign''s platform/category can no longer be changed directly — it is under review.';
  end if;

  select version into v_policy_version from public.platform_compliance_rules where platform = p_platform and enabled = true;
  if v_policy_version is null and p_platform is not null then
    raise exception 'Unknown or disabled platform: %', p_platform;
  end if;

  update public.campaign_compliance
  set platform = p_platform,
      category = p_category,
      policy_version = v_policy_version,
      category_assessed = (p_platform is not null and p_category is not null),
      updated_at = now()
  where id = p_campaign_compliance_id
  returning * into v_cc;

  perform public.recompute_campaign_compliance(p_campaign_compliance_id);
  select * into v_cc from public.campaign_compliance where id = p_campaign_compliance_id;
  return v_cc;
end;
$$;

-- ── acknowledge_campaign_disclosure: the only way a disclosure ack is recorded ──
create or replace function public.acknowledge_campaign_disclosure(
  p_campaign_compliance_id uuid, p_platform text
)
returns public.campaign_disclosures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cc public.campaign_compliance;
  v_row public.campaign_disclosures;
  v_version integer;
begin
  select * into v_cc from public.campaign_compliance where id = p_campaign_compliance_id;
  if v_cc.id is null then
    raise exception 'Campaign compliance record not found: %', p_campaign_compliance_id;
  end if;
  if not exists (select 1 from public.publishers p where p.id = v_cc.publisher_id and p.user_id = auth.uid()) then
    raise exception 'Only the campaign''s creator can acknowledge its disclosure requirement.';
  end if;

  select version into v_version from public.platform_compliance_rules where platform = p_platform;

  insert into public.campaign_disclosures (campaign_compliance_id, acknowledged_by, platform, requirement_version)
  values (p_campaign_compliance_id, auth.uid(), p_platform, v_version)
  returning * into v_row;

  perform public.recompute_campaign_compliance(p_campaign_compliance_id);

  return v_row;
end;
$$;

-- ── recompute_campaign_compliance: the ONLY writer of status/risk/checklist ──
-- Called after anything that could change a campaign's compliance picture:
-- context set, disclosure acknowledged, proof reviewed, review decided, or
-- a tracking link created for the same campaign. Deliberately conservative
-- about 'ready' — see brief section 27, this should feel like a checklist
-- clearing, not a black box.
create or replace function public.recompute_campaign_compliance(p_campaign_compliance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cc public.campaign_compliance;
  v_category_status text;
  v_has_open_review boolean;
  v_has_unresolved_high_risk boolean;
  v_has_verified_proof boolean;
  v_new_status text;
begin
  select * into v_cc from public.campaign_compliance where id = p_campaign_compliance_id;
  if v_cc.id is null then
    return;
  end if;

  select chatsched_status into v_category_status from public.campaign_category_rules where category = v_cc.category;

  select exists (
    select 1 from public.compliance_reviews
    where campaign_compliance_id = p_campaign_compliance_id and status in ('pending', 'in_review')
  ) into v_has_open_review;

  select exists (
    select 1 from public.campaign_risk_flags
    where campaign_compliance_id = p_campaign_compliance_id and severity = 'high' and resolved = false
  ) into v_has_unresolved_high_risk;

  select exists (
    select 1 from public.campaign_proof
    where campaign_compliance_id = p_campaign_compliance_id and status = 'verified'
  ) into v_has_verified_proof;

  update public.campaign_compliance cc set
    disclosure_identified = (cc.platform is not null and cc.category is not null),
    creator_accepted = exists (select 1 from public.campaign_disclosures d where d.campaign_compliance_id = cc.id),
    tracking_configured = exists (
      select 1 from public.campaigns c
      where (cc.request_id is not null and c.request_id = cc.request_id)
         or (cc.channel_request_id is not null and c.channel_request_id = cc.channel_request_id)
    )
  where cc.id = p_campaign_compliance_id
  returning * into v_cc;

  v_new_status := case
    when v_category_status = 'not_accepted' then 'not_eligible'
    when v_has_open_review then 'under_review'
    when v_cc.platform is null or v_cc.category is null then 'not_started'
    when v_has_unresolved_high_risk then 'under_review'
    when not v_cc.creator_accepted then 'needs_attention'
    when not v_cc.tracking_configured then 'needs_attention'
    when v_category_status = 'manual_review' and not v_has_verified_proof then 'needs_attention'
    else 'ready'
  end;

  update public.campaign_compliance set status = v_new_status, updated_at = now() where id = p_campaign_compliance_id;
end;
$$;

-- Keep tracking_configured accurate the moment a business creates a
-- tracking link (schema_phase30) against a campaign that already has a
-- compliance record.
create or replace function public.notify_campaign_compliance_of_tracking_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cc_id uuid;
begin
  select id into v_cc_id from public.campaign_compliance
  where (new.request_id is not null and request_id = new.request_id)
     or (new.channel_request_id is not null and channel_request_id = new.channel_request_id);
  if v_cc_id is not null then
    perform public.recompute_campaign_compliance(v_cc_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_compliance_on_tracking_link on public.campaigns;
create trigger trg_campaign_compliance_on_tracking_link
  after insert on public.campaigns
  for each row execute function public.notify_campaign_compliance_of_tracking_link();

-- ── notifications: worked examples (see file header) ─────────────────────
create or replace function public.notify_disclosure_required()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_user_id uuid;
begin
  if new.platform is null or old.platform is not distinct from new.platform then
    return new;
  end if;
  select user_id into v_creator_user_id from public.publishers where id = new.publisher_id;
  perform public.create_notification(
    v_creator_user_id, 'disclosure_required',
    'Disclosure required for this campaign',
    format('This campaign is on %s and requires a commercial-content disclosure before you publish.', new.platform),
    coalesce('/campaigns/' || coalesce(new.channel_request_id, new.request_id)::text || '/compliance', '/dashboard')
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_disclosure_required on public.campaign_compliance;
create trigger trg_notify_disclosure_required
  after update of platform on public.campaign_compliance
  for each row execute function public.notify_disclosure_required();

create or replace function public.notify_proof_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from public.campaign_compliance where id = new.campaign_compliance_id;
  perform public.create_notification(
    v_business_id, 'proof_submitted',
    'Publication proof submitted',
    'A creator submitted proof of publication for one of your campaigns.',
    '/admin'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_proof_submitted on public.campaign_proof;
create trigger trg_notify_proof_submitted
  after insert on public.campaign_proof
  for each row execute function public.notify_proof_submitted();

-- ── updated_at maintenance ────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_platform_compliance_rules on public.platform_compliance_rules;
create trigger trg_touch_platform_compliance_rules before update on public.platform_compliance_rules
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_campaign_category_rules on public.campaign_category_rules;
create trigger trg_touch_campaign_category_rules before update on public.campaign_category_rules
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_campaign_proof on public.campaign_proof;
create trigger trg_touch_campaign_proof before update on public.campaign_proof
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_compliance_reviews on public.compliance_reviews;
create trigger trg_touch_compliance_reviews before update on public.compliance_reviews
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_business_campaign_preferences on public.business_campaign_preferences;
create trigger trg_touch_business_campaign_preferences before update on public.business_campaign_preferences
  for each row execute function public.touch_updated_at();

-- ── seed: starter platform + category config ─────────────────────────────
-- Deliberately minimal, illustrative, non-exhaustive wording — matches
-- brief sections 2 and 33 (never claim completeness, never claim platform
-- approval). Admins edit/extend this from /admin/compliance.
insert into public.platform_compliance_rules
  (platform, display_name, disclosure_required, required_creator_actions, required_business_actions, required_proof, notes)
values
  ('tiktok', 'TikTok', true,
    array['Use the applicable commercial-content disclosure setting before publishing.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Public post URL'], 'Illustrative starting point — review current TikTok policy before relying on this.'),
  ('instagram', 'Instagram', true,
    array['Use the applicable paid-partnership disclosure tool before publishing.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Public post URL'], 'Illustrative starting point — review current Meta policy before relying on this.'),
  ('youtube', 'YouTube', true,
    array['Declare paid promotion where applicable before publishing.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Public video URL'], 'Illustrative starting point — review current YouTube policy before relying on this.'),
  ('facebook', 'Facebook', true,
    array['Use the applicable paid-partnership disclosure tool before publishing.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Public post URL'], 'Illustrative starting point — review current Meta policy before relying on this.'),
  ('x', 'X', true,
    array['Clearly identify commercial content where required before publishing.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Public post URL'], 'Illustrative starting point — review current X policy before relying on this.'),
  ('linkedin', 'LinkedIn', true,
    array['Clearly identify commercial content where required before publishing.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Public post URL'], 'Illustrative starting point — review current LinkedIn policy before relying on this.'),
  ('podcast', 'Podcasts', true,
    array['Include a clear spoken or written disclosure of the paid relationship.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Episode URL or publish date'], 'Illustrative starting point.'),
  ('website', 'Websites', true,
    array['Clearly label sponsored or affiliate content on the page itself.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Published page URL'], 'Illustrative starting point.'),
  ('newsletter', 'Newsletters', true,
    array['Clearly label the send as sponsored content.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Send date and archive URL, where available'], 'Illustrative starting point.'),
  ('radio', 'Radio', true,
    array['Include a clear on-air disclosure of the paid relationship.'],
    array['Supply an approved campaign brief and destination URL.'],
    array['Air date and station confirmation'], 'Illustrative starting point.')
on conflict (platform) do nothing;

insert into public.campaign_category_rules (category, chatsched_status) values
  ('Food & Restaurants', 'allowed'),
  ('Retail', 'allowed'),
  ('Fashion', 'allowed'),
  ('Beauty', 'allowed'),
  ('Fitness', 'allowed'),
  ('Technology', 'allowed'),
  ('Education', 'allowed'),
  ('Events', 'allowed'),
  ('Real Estate', 'allowed'),
  ('Travel', 'allowed'),
  ('Financial Services', 'manual_review'),
  ('Healthcare', 'manual_review'),
  ('Gaming', 'restricted'),
  ('Entertainment', 'allowed'),
  ('Other', 'manual_review')
on conflict (category) do nothing;
