# Agency Pivot — Managed Campaign Workflow Delivery (Agency Core, part 2)

Builds on `PIVOT_PHASE1_AUDIT.md` through `PHASE5_AGENCY_CRM_DELIVERY.md`.
Resolves the open question from that last report: does a managed campaign
wrap `requests`/`channel_requests`, or stand alone? Wrapped — reasoning
below and in `schema_phase60_agency_campaigns.sql`'s header.

## What "wrap" means concretely

`agency_campaigns` is a thin orchestration record — client, manager,
brief, budget, dates, and a **deliberately coarse** status. The brief's
14-stage pipeline (Lead → Qualified → Proposal → Payment → Planning →
Inventory Reserved → Creative → Client Approval → Publisher Execution →
Publication → Proof → Tracking → Reporting → Renewal) collapses to eight
states here: `draft / proposed / payment_pending / planning / in_progress
/ reporting / completed / cancelled`. Everything from Creative through
Tracking is real, already-tested detail that lives per-request —
deliverables, content approval, compliance, proof, tracking — and stays
there. Duplicating it as a second status on `agency_campaigns` would
just drift from what the linked requests actually show within a week.

Linking is a nullable `agency_campaign_id` on `requests` and
`channel_requests` (additive, doesn't touch either table's own state
machine or existing RLS — a business whose request is part of a managed
campaign still only ever sees their own request, exactly as before).

## What's built

**Schema** — `supabase/schema_phase60_agency_campaigns.sql`:
- `agency_campaigns` table, admin-only RLS (same posture as
  `agency_leads`/`agency_clients` — internal, no participant grant).
- `agency_campaign_id` added to `requests` and `channel_requests`.
- `agency_campaign_totals(campaign_id)` — linked request count, paid
  count, total spend, live across both settlement paths. `requests` uses
  each request's *latest* payment attempt (a `lateral join` picking the
  newest row per request) rather than summing every attempt — retried
  failed payments would otherwise double-count. `channel_requests` reads
  its own `proposed_amount`/`paid_at` directly, same as
  `agency_client_totals()` in Phase 5.

**Admin UI** — `AdminCampaigns.tsx`, new "Campaigns" tab, same
self-contained pattern as every tab since Phase 3: create a campaign for
an existing client, set status/manager inline, expand to see the live
totals and a linkable list of that client's existing requests/
channel_requests (already linked ones show "Linked" and can be
unlinked; unlinked ones show "Link").

**Types** — `AgencyCampaign`, `AgencyCampaignTotals`, `LinkableRequest`
in `types.ts`.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — unchanged from Phase 5, nothing regressed |

## Not done / still open — this is the bigger list this time

This phase is the entity and the link, not the full brief section 12/13.
Specifically not attempted, in roughly the order I'd tackle them:

- **Admin can't create a request *on behalf of* a client.** Linking only
  works on requests/channel_requests the business already created
  through the normal self-service flow. The brief's Layer 1 promise —
  "the business should NOT need to independently contact publishers" —
  isn't fully true yet; ChatSched can organize and report on what a
  client requested, not originate it for them. This needs either a new
  admin-side insert path on two mature, RLS-sensitive tables, or an edge
  function acting on the business's behalf — real design work I didn't
  want to fold into the same phase as the entity itself.
- **No client/business-facing view.** Everything this phase built is
  admin-only, matching Phase 5's CRM. The brief's Campaign Command Centre
  (section 13) is explicitly two-sided ("Businesses should see..."). Held
  off deliberately — sequenced after homepage/brand repositioning in the
  audit's build order, since a business-facing campaign view is more
  useful once there's a brand narrative explaining why a business would
  want one.
- **No package pricing / client payment collection for the campaign as a
  whole.** A client currently still pays per linked request, same as
  self-service — there's no "pay ChatSched one number for the whole
  campaign" flow. Ties to campaign packages (brief section 19) and
  extends the margin work Phase 4 already started; genuinely a separate
  phase.
- **`status` is manual, not auto-advanced.** No trigger moves a campaign
  from `payment_pending` to `planning` when its linked requests are all
  paid, even though `agency_campaign_totals()` has the data to know
  that. Same reasoning as every status field since Phase 2 — admin
  drives explicit transitions, nothing auto-advances anything in this
  codebase yet, and I didn't want to be the first without live Postgres
  to test the trigger against.
- **Never run against real Postgres**, the `lateral join` in
  `agency_campaign_totals()` included — the one piece of SQL this phase
  that's structurally new rather than a repeat of Phase 5's pattern, so
  worth double-checking first once there's a real database to check it
  against.

## Next

Whichever of the two open items above matters more for actually running
a managed campaign end to end: admin-side request creation (so ChatSched
can act *for* a client, not just organize what they already did
themselves), or the client-facing view (so a managed client can see
what's happening without asking). Both are real gaps; which one blocks
you first is worth deciding rather than guessing.
