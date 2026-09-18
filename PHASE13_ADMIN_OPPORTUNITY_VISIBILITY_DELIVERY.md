# Agency Pivot — Admin Opportunity Visibility Delivery

Builds on everything through `PHASE12_OPPORTUNITY_MARKETPLACE_DELIVERY.md`.
Closes the one item that report named as still missing: "No admin
visibility into opportunities/applications."

## No new migration needed

Checked the RLS in `schema_phase68_opportunity_marketplace.sql` before
writing anything — `opportunities_select_admin`,
`opportunities_update_admin`, `opportunity_applications_select_admin`,
and `opportunity_applications_update_admin` already exist. Admin already
had full database-level read/write access to both tables; the entire gap
was UI. This phase is purely additive at the application layer.

## Scope call: visibility + light moderation, not participation

`opportunity_applications_update_admin` technically lets admin accept or
decline an application on a business's behalf, same as it lets admin do
almost anything else on these tables. Deliberately didn't build that
into the admin UI. Which applicant a business picks is exactly the kind
of decision that's always been theirs for a direct request too — admin
being *able* to override that at the RLS layer (for genuine edge cases,
support tickets, whatever) isn't the same as the admin UI *offering* it
as a routine action. The one write action this phase does add is
cancelling a problematic posting — moderation, not picking winners.
Mirrors `AdminMessageSafety`'s own framing: monitor and moderate, don't
do the thing on someone else's behalf just because the database allows
it.

## What's built

**`src/pages/AdminOpportunities.tsx`** — new admin tab, same
self-contained pattern as every tab since `AdminChannelRequests`: status
filter chips with counts, expandable opportunity cards showing the
brief and every application underneath (publisher, message, proposed
method/amount, status), and a "Cancel this posting" action for
open/filled opportunities that logs to the audit trail via
`log_admin_action` — the same one Phase 7 built a viewer for.

One resolution detail worth naming: `opportunities.business_id`
references `auth.users(id)`, not `public.profiles(id)`, so a PostgREST
embed can't auto-join it to a business name — same situation
`AdminCampaigns.tsx`/`AdminLeads.tsx` already hit and solved the same
way (a separate plain query, resolved client-side by id), not a new
pattern invented here. `opportunity_applications.publisher_id` *is* a
real `public.publishers` FK, so that embed works directly.

**Wired into `Admin.tsx`**: new `"opportunities"` tab, same three-line
addition (type union, tab list, render switch) every prior admin tab
has used.

## Toolchain

Same standing limitation as every phase originating in this sandbox: no
network egress, so `npm ci`/`build`/`test`/`lint` couldn't run here.
Verified: brace/paren/div balance on both touched files (the one
apparent div mismatch in `Admin.tsx` is four pre-existing self-closing
`<div />` tags elsewhere in that large file, confirmed by count before
concluding it wasn't something this phase introduced), and an isolated
`tsc --noEmit` pass, clean. Needs a real `npm run build && npm test` and
a live Postgres run before merging.

## Not done / still open

- **No bulk creation on `CreateRequestForClient.tsx`** — still open
  since Phase 8, named again in Phase 12's own "Next" as one of two
  candidates. Untouched by this phase.
- **No opportunity editing UI** for a business beyond closing/cancelling
  — Phase 12's own note, unrelated to what this phase adds.
- **Never run against real Postgres.**

## Next

The bulk-creation gap on `CreateRequestForClient.tsx` is the one
concrete, named, still-open item left from the last several reports —
worth picking up next unless something else is actually blocking real
usage first.
