-- ChatSched — Phase 101 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase100_chatsched_tools.sql.
--
-- Ports CHATSCHED_BUSINESS_VALUE_OPPORTUNITIES_ENGINE_AUDIT.md's build
-- (originally shipped in a separate branch as "Phase 81" — this codebase
-- had already used that number for schema_phase81_prevent_role_escalation.sql,
-- so this migration is renumbered to 101, the next free slot after
-- schema_phase100_chatsched_tools.sql) onto this branch's own, further-
-- evolved opportunity-marketplace stack:
--
--   - schema_phase69_opportunity_multi_accept.sql (publishers_needed)
--   - schema_phase80_opportunities_all_channels.sql (all 12 channels)
--   - schema_phase81_prevent_role_escalation.sql (this branch's own
--     handle_new_user()/role-escalation fix — redefined again below,
--     carrying its whitelist logic forward unchanged, not replaced)
--   - schema_phase86_once_off_activation_pricing.sql (current
--     opportunities_insert_own / opportunity_applications_insert_publisher,
--     both already subscription-gated — tightened further below rather
--     than being dropped and redefined from the pre-subscription version)
--   - schema_phase89_atomic_opportunity_acceptance.sql
--     (accept_opportunity_application()) — untouched; still the only
--     path that turns an accepted application into a booking.
--
-- Additive only: new nullable columns, one widened status check, and
-- narrower (not looser) RLS on top of what's already there. No existing
-- opportunity/application/profile row is invalidated.

-- ── 1. `profiles` additions ──────────────────────────────────────────────

alter table public.profiles
  add column if not exists business_type text,
  add column if not exists opportunity_preferences text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_business_type_check;
alter table public.profiles
  add constraint profiles_business_type_check check (
    business_type is null or business_type in (
      'Educational Institution / School',
      'Retail / SMME',
      'Event Organizer',
      'Corporate Brand',
      'Venue Owner',
      'Non-profit / Community Organisation',
      'Sports Club / Organisation',
      'Media / Publisher',
      'Other'
    )
  );

comment on column public.profiles.business_type is
  'Controlled business-type taxonomy for the Opportunities Engine — kept
   alongside the free-text industry column (schema.sql), which stays for
   broader industry description. Publisher accounts leave this null.';

comment on column public.profiles.opportunity_preferences is
  'Business-only. Free-text opportunity interests the UI populates from a
   controlled per-business_type list (see Register.tsx / Dashboard.tsx),
   stored as plain text rather than a foreign-keyed catalogue table —
   same reasoning as opportunities.opportunity_type below.';

-- ── 2. `opportunities` additions ─────────────────────────────────────────

alter table public.opportunities
  add column if not exists opportunity_type text,
  add column if not exists target_province text,
  add column if not exists target_city text,
  add column if not exists target_audience text;

comment on column public.opportunities.opportunity_type is
  'Free text at the database level — the UI supplies a controlled
   catalogue (see BusinessOpportunities.tsx), same as the rest of this
   schema''s channel-specific text fields. If ChatSched later needs
   admin-managed categories, add an opportunity_types catalogue table
   rather than another hardcoded frontend list.';

comment on column public.opportunities.target_province is
  'Intentionally separate from the business''s own profile.province —
   lets a Cape Town business, for example, target a Gauteng campaign
   without changing its company profile.';

create index if not exists opportunities_open_type_idx
  on public.opportunities(opportunity_type) where status = 'open';
create index if not exists opportunities_open_location_idx
  on public.opportunities(target_province, target_city) where status = 'open';

-- ── 3. Opportunity lifecycle: allow a `draft` status ─────────────────────
-- draft -> open -> filled / closed / cancelled. Every existing row is
-- already one of the four statuses this constraint already allowed, so
-- widening it is non-breaking.

alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.opportunities
  add constraint opportunities_status_check
  check (status in ('draft', 'open', 'filled', 'closed', 'cancelled'));

-- A verified business may explicitly publish their own draft. Not wired
-- into the current business posting flow (BusinessOpportunities.tsx
-- posts straight to 'open', same as before this migration) — provided
-- for a future draft-first workflow without requiring a second schema
-- change to add it later.
create or replace function public.publish_opportunity(p_opportunity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_verified boolean;
  v_updated boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select business_verified into v_business_verified
    from public.profiles where id = auth.uid() and role = 'business';

  if not coalesce(v_business_verified, false) then
    return jsonb_build_object('ok', false, 'error', 'business not verified');
  end if;

  update public.opportunities
     set status = 'open', updated_at = now()
   where id = p_opportunity_id
     and business_id = auth.uid()
     and status = 'draft'
  returning true into v_updated;

  if not coalesce(v_updated, false) then
    return jsonb_build_object('ok', false, 'error', 'no matching draft opportunity');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.publish_opportunity(uuid) from public;
grant execute on function public.publish_opportunity(uuid) to authenticated;

-- ── 4. Signup provisioning: carry business_type / opportunity_preferences
--       through handle_new_user() ───────────────────────────────────────
-- Fourth redefinition of this function (schema.sql -> schema_phase5.sql
-- -> schema_phase7.sql -> schema_phase81_prevent_role_escalation.sql ->
-- here). The role whitelist from schema_phase81_prevent_role_escalation.sql
-- is carried over completely unchanged — only business_type and
-- opportunity_preferences are newly captured, and only when the safe
-- (post-whitelist) role is 'business'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  safe_role text;
  v_opportunity_preferences text[];
begin
  -- Same whitelist as schema_phase81_prevent_role_escalation.sql: only
  -- 'business' and 'publisher' are ever creatable from signup metadata.
  if requested_role = 'publisher' then
    safe_role := 'publisher';
  else
    safe_role := 'business';
  end if;

  if new.raw_user_meta_data ? 'opportunity_preferences' then
    select coalesce(array_agg(value), '{}')
      into v_opportunity_preferences
      from jsonb_array_elements_text(new.raw_user_meta_data -> 'opportunity_preferences');
  else
    v_opportunity_preferences := '{}';
  end if;

  insert into public.profiles (
    id, role, full_name, company_name, phone, email_verified,
    business_type, opportunity_preferences
  )
  values (
    new.id,
    safe_role,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone',
    new.email_confirmed_at is not null,
    case when safe_role = 'business' then new.raw_user_meta_data ->> 'business_type' else null end,
    case when safe_role = 'business' then v_opportunity_preferences else '{}' end
  );
  return new;
end;
$$;

-- ── 5. RLS tightening ─────────────────────────────────────────────────
-- All four policies below are replaced in place with a narrower version
-- of themselves — every existing condition is kept, this only adds the
-- verification requirement the audit called for. Nothing here loosens
-- access relative to schema_phase86_once_off_activation_pricing.sql.

-- 5.1 A business may insert an opportunity only when verified, in
--     addition to the existing active-subscription requirement.
drop policy if exists "opportunities_insert_own" on public.opportunities;
create policy opportunities_insert_own
  on public.opportunities for insert
  with check (
    business_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'business' and business_verified = true
    )
    and exists (
      select 1 from public.business_subscriptions
      where business_id = auth.uid() and status = 'active'
    )
  );

-- 5.2 A business may only edit their own opportunity while verified —
--     protects the new edit flow (BusinessOpportunities.tsx) at the
--     database layer, not just in the UI.
drop policy if exists "opportunities_update_own_business" on public.opportunities;
create policy opportunities_update_own_business
  on public.opportunities for update
  using (
    business_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'business' and business_verified = true
    )
  )
  with check (business_id = auth.uid());

-- 5.3 The open-opportunity feed is restricted to a verified, approved
--     publisher — was approved-only before this migration.
drop policy if exists "opportunities_select_open_to_publishers" on public.opportunities;
create policy opportunities_select_open_to_publishers
  on public.opportunities for select
  using (
    status = 'open'
    and exists (
      select 1 from public.publishers
      where user_id = auth.uid() and status = 'approved' and verified = true
    )
  );

-- 5.4 Applying requires the same verified + approved publisher state, on
--     top of the existing open-opportunity and active-subscription checks.
drop policy if exists "opportunity_applications_insert_publisher" on public.opportunity_applications;
create policy opportunity_applications_insert_publisher
  on public.opportunity_applications for insert
  with check (
    exists (
      select 1 from public.publishers
      where id = publisher_id and user_id = auth.uid() and status = 'approved' and verified = true
    )
    and exists (select 1 from public.opportunities where id = opportunity_id and status = 'open')
    and exists (
      select 1 from public.publisher_subscriptions
      where publisher_id = auth.uid() and status = 'active'
    )
  );
