-- ChatSched — Phase 94 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase93_realtime_channel_requests.sql.
--
-- Introduces the two internal-staff roles PHASE5_AGENCY_CRM_DELIVERY.md
-- flagged as a deliberate follow-up rather than day-one scope:
-- `campaign_manager` (schema_phase59_agency_crm.sql's own comment names
-- this exact next step — "add 'campaign_manager' to profiles' role
-- check") and `publisher_manager`, its mirror on the publisher/supply
-- side for the same Publisher Manager assignment work.
--
-- Scope is deliberately narrow — just the role and the assignment
-- column, not a permissions rewrite:
--   1. `campaign_manager` / `publisher_manager` added to
--      profiles_role_check, alongside the existing
--      business/admin/publisher values.
--   2. `publisher_manager_id` added to `agency_leads` and
--      `agency_campaigns`, mirroring the existing `campaign_manager_id`
--      column both tables already carry (schema_phase59/60) — same
--      shape: nullable, references profiles(id), set null on delete, so
--      unassigning or deleting a manager never cascades into deleting
--      the lead/campaign itself.
--
-- Deliberately NOT done here (out of scope for this migration):
--   - No RLS policy on any table is widened to also accept
--     `campaign_manager_id = auth.uid()` or
--     `publisher_manager_id = auth.uid()` in place of/alongside
--     `public.is_admin()`. Every existing agency-table policy stays
--     exactly as admin-only as it is today. Until that widening lands,
--     a profile promoted to campaign_manager/publisher_manager can be
--     *assigned* to leads/campaigns and shown in the UI, but does not
--     yet gain any actual data-access permission beyond what a plain
--     'business'/'publisher' role already has — these two roles are
--     currently just labels + an assignment column, not a new
--     permission tier. Confirmed intentional, not an oversight, per the
--     "not yet a real permission boundary" framing in
--     PHASE5_AGENCY_CRM_DELIVERY.md/schema_phase59_agency_crm.sql — the
--     RLS work is real follow-up work, tracked separately, not silently
--     assumed done by this migration.
--   - `handle_new_user()` (schema.sql → schema_phase5.sql →
--     schema_phase7.sql → schema_phase81_prevent_role_escalation.sql) is
--     NOT touched. It already whitelists signup role to only
--     'business'/'publisher', falling back to 'business' for anything
--     else — so it already refuses 'campaign_manager'/'publisher_manager'
--     exactly as it already refuses 'admin'. Nothing to change: these
--     two roles, like admin, are never signup-creatable, only
--     assignable via the same manual SQL-editor promotion path below.
--   - trg_prevent_role_change (schema_phase81_prevent_role_escalation.sql)
--     is NOT touched either. It resets `role` to its old value whenever
--     the acting session is a real logged-in non-admin
--     (`auth.uid() is not null and not public.is_admin()`), and leaves
--     the `auth.uid() is null` (trusted SQL-editor / service-role) path
--     untouched. That's exactly the path the promotion instructions
--     below rely on, so this migration's approach is fully compatible
--     with the existing trigger, no conflict, no update needed.

-- ── 1. Widen profiles_role_check ─────────────────────────────────────────
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('business', 'admin', 'publisher', 'campaign_manager', 'publisher_manager'));

-- ── 2. publisher_manager_id, mirroring the existing campaign_manager_id ──
alter table public.agency_leads
  add column if not exists publisher_manager_id uuid references public.profiles(id) on delete set null;
create index if not exists agency_leads_publisher_manager_id_idx on public.agency_leads(publisher_manager_id);

alter table public.agency_campaigns
  add column if not exists publisher_manager_id uuid references public.profiles(id) on delete set null;
create index if not exists agency_campaigns_publisher_manager_id_idx on public.agency_campaigns(publisher_manager_id);

-- ── Promoting an account to one of these roles ───────────────────────────
-- Same manual pattern as the existing "Making yourself an admin" note at
-- the bottom of schema.sql — run as yourself in the Supabase SQL editor
-- (auth.uid() is null there, so trg_prevent_role_change doesn't block it):
--   update public.profiles set role = 'campaign_manager' where id = 'paste-uuid-here';
--   update public.profiles set role = 'publisher_manager' where id = 'paste-uuid-here';
-- Then assign them to a lead/campaign from the admin UI once that UI
-- exists (tracked separately — see MERGE_STATUS_AND_HANDOFF.md,
-- AdminLeads.tsx / AdminCampaigns.tsx).
