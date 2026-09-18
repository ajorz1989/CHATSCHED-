-- ChatSched — Phase 64 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase63_campaign_reporting_auto_advance.sql.
--
-- Closes the last item both PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md
-- and PHASE7_CAMPAIGN_AUTO_ADVANCE_DELIVERY.md independently listed as
-- still open: admin couldn't create a request/channel_request on a
-- client's behalf, only link ones the business had already created
-- themselves. Confirmed by reading both tables' actual insert policies —
-- both are strictly `auth.uid() = business_id`, no admin path in either.
--
-- Numbered 64, not 61: this codebase's real phase 61 turned out to be
-- schema_phase61_managed_campaign_client_view.sql, built in parallel
-- elsewhere while this was in progress under the same number in a
-- different copy of the zip. Renumbered rather than risk two different
-- "phase 61" migrations landing in the same database — see the delivery
-- report for this phase for the full note on why.
--
-- Additive, not a replacement: Postgres RLS combines multiple permissive
-- policies for the same command with OR, so this sits alongside
-- `requests_insert_own` / `channel_requests_insert_business` rather than
-- touching either. A business creating their own request is completely
-- unaffected. Mirrors `requests_update_admin`, which already does this
-- same "separate admin-only policy, additive" shape for updates.

create policy "requests_insert_admin" on public.requests
  for insert with check (public.is_admin());

-- Same status = 'pending' constraint the business-side policy already
-- enforces — admin's new power here is *who initiates*, not skipping the
-- creator's own accept/decline/counter. The creator still goes through
-- the exact same workflow either way.
create policy "channel_requests_insert_admin" on public.channel_requests
  for insert with check (public.is_admin() and status = 'pending');
