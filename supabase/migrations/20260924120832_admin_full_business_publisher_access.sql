-- Admin-only access to business and publisher operational surfaces.
-- Applied to production as migration version 20260924120832.

create policy "saved_searches_admin_all"
on public.saved_searches
for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "opportunities_insert_admin"
on public.opportunities
for insert
to authenticated
with check (is_admin());

create policy "opportunity_applications_insert_admin"
on public.opportunity_applications
for insert
to authenticated
with check (is_admin());
