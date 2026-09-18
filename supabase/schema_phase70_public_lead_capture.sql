-- ChatSched — Phase 70 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase69_opportunity_multi_accept.sql.
--
-- Brand/homepage pivot: "Build My Campaign" needs a real destination, not
-- a link to an existing page repurposed to look like one. agency_leads
-- (schema_phase59) already has everything this needs — business_id was
-- deliberately left nullable back then specifically for "a lead can exist
-- before anyone's signed up" — but the table has been admin-only RLS
-- since the day it was created, because until now nothing outside
-- /admin ever tried to write to it.
--
-- One new policy, additive: agency_leads_admin_only (schema_phase59)
-- still governs every other operation. This adds insert only, and only
-- for anonymous/self-reported submissions — no read access, no update,
-- no delete. A business filling out the homepage form can't see anyone
-- else's lead, or even their own after submitting it; confirmation is
-- client-side ("we'll be in touch"), not a receipt they can look up.
--
-- No spam protection beyond basic required fields, which is a real,
-- named gap, not an oversight — see the delivery report.

create policy "agency_leads_public_insert" on public.agency_leads
  for insert
  with check (stage = 'new' and campaign_manager_id is null);
