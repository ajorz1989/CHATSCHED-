# Agency Pivot — Campaign Status Auto-Advance Delivery

Builds on `PIVOT_PHASE1_AUDIT.md` through `PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md`.
Closes the one item that report named directly rather than just listed:
**"`status` is manual, not auto-advanced"** — no trigger moved a campaign
from `payment_pending` to `planning` when its linked requests were all
paid, and the report said why it stopped short: no live Postgres to test
a trigger against. Same limitation here — still true, see "Not done."

**Revised since first delivered, three times now.** First pass: this
delivery's own "Not done" — no viewer for the audit log entries it
writes — got built. Second pass: that viewer's own "Not done" — 200-row
window, one filter, no export — got closed too, minus read-only, which
stayed on purpose. Third pass, this one: one of the six manual campaign
transitions got a real signal after all (`in_progress` → `reporting`,
on verified proof — see "The second auto-advance" below, and the
argument for why the other five still don't have one), plus the audit
viewer's pagination cursor got hardened against a same-timestamp edge
case.

## Scope: only payment_pending → planning

That's the one transition the original note names, and the only one with
an unambiguous signal. The other six (`draft`→`proposed`,
`planning`→`in_progress`, `in_progress`→`reporting`, →`completed`,
→`cancelled`, `proposed`→either direction) aren't derivable from anything
in this schema — "in_progress becoming reporting" is a judgment call
about where the campaign actually is, the same reason
`agency_campaigns.status` was deliberately coarse to begin with
(`schema_phase60`'s own header). Auto-advancing those would mean
inventing criteria nobody asked for. They stay manual.

## What's built

**Schema** — `supabase/schema_phase62_agency_campaign_auto_advance.sql`:

- `maybe_advance_agency_campaign(p_campaign_id)` — the shared check:
  is this campaign `payment_pending`, and are all its linked requests +
  channel_requests now paid? If so, advance it and write one
  `admin_audit_log` row (`admin_id` null — system-originated, not a
  specific admin's action; that column already allows null).
- Four trigger points, all calling that one function rather than
  duplicating the check:
  - `payments` → status becomes `paid` (the case the original note
    describes).
  - `requests.agency_campaign_id` → gets set (an already-paid request
    linked to a campaign *after* the fact — the "Link" button in
    `AdminCampaigns.tsx`). Easy to miss since it's not the case the
    note described, but it's the same underlying condition becoming
    true at a different moment.
  - `channel_requests` → either `paid_at` or `agency_campaign_id`
    changes, one trigger covering both since they're columns on the
    same row here (unlike `requests`, where payment status lives on a
    separate table).
- A one-time backfill `do` block at the end, for any campaign that was
  already fully paid *before* this migration existed to catch it —
  otherwise it would sit on `payment_pending` forever, since nothing
  about it changes again to re-trigger the four triggers above. Safe to
  re-run; the shared function no-ops for anything not currently
  `payment_pending`.

**UI** — one line in `AdminCampaigns.tsx`, shown only when a campaign's
status is `payment_pending`: "Moves to Planning automatically once every
linked request above is paid." Placed right next to the paid-count that
drives it, so it doesn't read as unexplained magic later.

## Admin audit log viewer

`src/pages/AdminAuditLog.tsx`, new "Audit Log" tab in `Admin.tsx`.
`admin_audit_log` (`schema_phase15_audit_log.sql`) has existed since
Phase 15 with zero frontend surface — checking what it actually contains
before building this turned up real, if quiet, usage: deliverable
verification (Phase 54), compliance rule/proof/review decisions (Phase
39), self-service phone verification (`verify-otp`), and now this
phase's campaign auto-advances. None of it had ever been visible except
by querying the table directly.

Deliberately generic rather than one card layout per action type: some
action strings are built dynamically (`'proof_' || p_status`,
`'compliance_review_' || p_status`), so a switch statement enumerating
known actions would already be incomplete on day one and stale the next
time any part of the codebase calls `log_admin_action()` for something
new. Instead: humanize the raw `action` string, render `detail` as
generic key/value pairs, and resolve `admin_id` to a name via
`profiles` — or "System" for the null case, which `verify-otp` and this
phase's own trigger both use on purpose for non-admin-originated
entries. One filter (by action, options built from whatever's actually
in the loaded page rather than a hardcoded list), most recent 200
entries — the first genuinely audit-log-shaped table in this codebase
distinct from a review queue, so a light cap felt more honest than
assuming pilot volume applies the same way it does to compliance
reviews or flagged messages.

Added `AdminAuditLogEntry` to `types.ts` — first frontend type for this
table.

**Pagination, date-range filter, export (second pass).** All three named
directly in this doc's own first "Not done" entry:

- **Pagination** — keyset, not offset: "Load more" fetches the next 200
  older than the oldest row already on screen (`created_at` as the
  cursor), rather than a page number. A new entry arriving mid-session
  can shift an offset-paginated list and duplicate or skip a row; a
  keyset cursor can't.
- **Date-range filter** — sits alongside the action filter, both applied
  server-side (`.gte`/`.lte`/`.eq` on the query, not a client-side
  `.filter()` on whatever happened to already be loaded). Needed for the
  action filter too once pagination existed: filtering a 200-row loaded
  page client-side would hide older matching entries that were never
  fetched. The action *options* list is a separate, unfiltered,
  unpaginated query (`select action` with no limit) precisely so
  narrowing by date or by another action doesn't shrink the dropdown's
  own choices.
- **Export** — reused `ExportCsvButton`/`csvExport.ts` rather than
  building a new export path; same convention every other admin tab
  since Phase 3 already uses (`buildMessageRows`, `buildAuditLogRows`
  now alongside it). Exports whatever's currently loaded and filtered,
  same "what's on screen" semantics as every existing CSV export in this
  codebase — not a separate full-dataset query.

**Read-only did not change, on purpose.** It was listed in the same
disclosure line as the three items above, but it isn't a gap the same
way pagination or export were — `schema_phase15_audit_log.sql`'s own
comment already treats immutability as the point: nothing about a log
that can be edited from its own viewer still functions as an audit
trail. Nothing here adds a write path.

## Why the trigger doesn't call `agency_campaign_totals()`

That function (`schema_phase60`) is admin-only by design — `raise
exception 'Admin access required'` for anyone else. A payment being
marked paid almost never happens in an authenticated-admin session (a
business's own checkout, `payfast-notify`'s service-role client) —
calling an admin-gated function from inside a payment trigger would
raise and abort the payment confirmation this is meant to react to.
`maybe_advance_agency_campaign()` re-implements the same "latest payment
per request, union `channel_requests`' own `paid_at`" query directly,
deliberately duplicated rather than shared — same duplicate-with-a-
comment precedent as the launch-credit math
(`PHASE2_SUBSCRIPTIONS_DELIVERY.md`) and the message-safety pattern sets
(`PHASE3_MESSAGE_SAFETY_DELIVERY.md`). If `agency_campaign_totals()`'s
query ever changes, this needs updating by hand alongside it — flagged
in both places' comments.

## The second auto-advance: in_progress → reporting

Before building anything, I went through all six remaining manual
transitions and argued each one out rather than picking one to build:
`draft`→`proposed` and `proposed`→`payment_pending` are sales/acceptance
moments with no data trace at all; `planning`→`in_progress` has no clean
single moment to hang a trigger on; `reporting`→`completed` has nothing
tracking whether a report was actually finished; `→cancelled` I'd argue
should never auto-fire regardless of what signal existed, given the
consequences of getting it wrong unattended. `in_progress`→`reporting`
was the one genuinely arguable case — proof verification exists and is
plausible, but it's itself a manual admin decision, so this chains one
manual step into automatically triggering the next rather than deriving
something from an independent fact. Confirmed as wanted before building
it.

**Schema** — `supabase/schema_phase63_campaign_reporting_auto_advance.sql`:

- `maybe_advance_agency_campaign_to_reporting(p_campaign_id)` — same
  shape as Phase 62's function: checks the campaign is `in_progress`,
  checks every linked booking is satisfied, advances and logs if so.
  "Satisfied" means the booking's *latest* `campaign_proof` submission
  (bookings can have more than one, e.g. a resubmission after rejection)
  is `verified` — same latest-attempt convention `agency_campaign_totals()`
  already applies to payments, applied here so an old rejected attempt
  can't permanently block a booking that was later fixed and approved —
  **or** its `campaign_compliance` record is `not_eligible`, which I'm
  reading as "nothing to verify for this one." That reading isn't stated
  anywhere else in the schema; worth confirming, easy to change if wrong.
- Three trigger points: `campaign_proof` status becoming `verified`,
  `campaign_compliance` status becoming `not_eligible`, and the two
  Phase 62 link-triggers extended to also check this transition (an
  already-verified booking can get linked to an `in_progress` campaign
  after the fact, same shape as Phase 62's own "link after already paid"
  case).
- Same one-time backfill pattern as Phase 62, for any campaign already
  fully verified before this migration existed.
- Same reasoning as Phase 62 for staying self-contained rather than
  calling `agency_campaign_totals()` or another admin-gated function —
  the link-triggered path can still fire from a non-admin context even
  though proof review itself is admin-only.

**UI** — the equivalent one-line hint added for `in_progress` in
`AdminCampaigns.tsx`, next to the existing `payment_pending` one.

## Audit log pagination — composite keyset cursor

`AdminAuditLog.tsx` now orders and cursors on `(created_at, id)` instead
of `created_at` alone. Two entries sharing an exact timestamp at a page
boundary could previously have duplicated or been skipped depending on
which side of the single-column cursor they landed on — named as a known
limitation when the pagination first shipped, closed here by adding `id`
as the sort/seek tiebreaker (`created_at.lt.X,and(created_at.eq.X,id.lt.Y)`
via `.or()`), rather than left as an accepted gap.



| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — unchanged across both revisions. Nothing in any of the three deliveries in this doc has a pure-function TS side to test: the auto-advance logic lives entirely in the trigger, and the audit viewer (read, filter, paginate, export) is UI/query wiring with no branching worth isolating into a tested unit. |

## Not done / still open

- **Never run against real Postgres.** The same standing limitation
  since Phase 6 — now covering two auto-advance functions and five
  trigger points instead of one and four, so more surface than ever to
  treat as "should be right" rather than "confirmed right."
- **Five of six campaign status transitions are still manual**,
  deliberately, each with its own stated reason above rather than one
  blanket "not derivable yet" — worth re-reading if the underlying data
  changes (e.g. if `reporting`→`completed` ever gets something to check
  against, that argument specifically would need revisiting, not the
  other four).
- **CSV export is "what's loaded," not "everything matching the
  filter."** Same convention every other export in this codebase already
  uses — exporting a date range wider than what's been paged in means
  loading it first.

## Next

Same two open items PHASE6 left, unchanged by either fix in this doc:
admin-side request creation on behalf of a client, or the client-facing
view (already underway separately —
`schema_phase61_managed_campaign_client_view.sql` is already in this
codebase as of this delivery).
