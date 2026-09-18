# Agency Pivot — Agency CRM Delivery (Agency Core, part 1)

Builds on everything in this zip: `PIVOT_PHASE1_AUDIT.md` →
`PHASE2_SUBSCRIPTIONS_DELIVERY.md` → `PHASE3_MESSAGE_SAFETY_DELIVERY.md` →
`PHASE4_MARGIN_ECONOMICS_DELIVERY.md`. First: independently verified
Phase 3+4 as merged in this zip, since Phase 4's own report flagged its
build/lint/test as never actually run (no network access in that
sandbox). This one does have access — real results below, then the new
work.

## Verifying what arrived unverified

| Command | Result |
|---|---|
| `npm ci` | ✅ 545 packages, 0 vulnerabilities |
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — matches Phase 3's own count exactly, so nothing regressed in the merge |

Phase 4's margin/economics additions (the `analytics_functions.sql`
extensions, the GMV bug fix, `AdminAnalytics.tsx`'s new section) compile,
lint, and pass every existing test clean. Worth saying plainly since
that phase asked for it plainly: this is real confirmation, not just
carrying its claim forward.

One correction while I was in `AdminChannelRequests.tsx`, unrelated to
either phase: its own top comment still says "the creator handles
approve/decline/mark-live themselves" as the *whole* picture — true for
who has status authority, but Phase 3 added a real 3-way message thread
alongside that, so the comment undersold what's actually there now.
Didn't touch it — a stale comment isn't a bug, and it's not this phase's
work to correct, but flagging it since it briefly confused my own read of
what Phase 3 shipped.

## The open decision from Phase 4, resolved

`PHASE4_MARGIN_ECONOMICS_DELIVERY.md` flagged one question before Agency
Core could start: is a campaign manager a new `profiles.role`, or an
admin with an assignment layered on top?

**Going with admin + assignment.** `campaign_manager_id` on the new
tables below references `profiles(id)`, expected (by convention, not a
DB constraint — Postgres CHECK can't reference another table) to be an
admin account. Reasoning: ChatSched is solo-founder right now, so "who's
assigned" is an accountability/display field — the brief's own words are
"businesses should know who is responsible... where appropriate" — not
yet a real permission boundary nobody needs enforced today. A new role
means a new RLS surface across every agency table, untestable against
real Postgres in this sandbox, solving a problem that doesn't exist yet.
Full reasoning is in `schema_phase59_agency_crm.sql`'s header comment,
including exactly what'd need to change (`profiles.role`'s check
constraint, every `is_admin()`-only policy below) if this ever needs to
become a real permission boundary later.

## What's built

**Schema** — `supabase/schema_phase59_agency_crm.sql`:
- `agency_leads` — the pipeline (new/contacted/qualified/proposal/won/
  lost/campaign/renewal), source, estimated value, assigned manager,
  next action.
- `agency_clients` — the CRM record once ChatSched is actually managing
  a relationship. `service_level` (self_service/assisted/managed) — a
  row existing here at all already means someone's tracking it; most
  `profiles` rows never get one. `renewal_status`, notes, manager
  assignment, and a `lead_id` back-reference.
- Both admin-only RLS (`using (public.is_admin())`, no participant
  grant) — this is ChatSched's internal sales data, same posture the
  brief demands for agency margin data specifically, applied here since
  a lead's estimated value and a client's notes are exactly that kind of
  information.
- `agency_client_totals(business_id)` — lifetime spend, campaign count,
  last campaign date, computed live across **both** settlement paths
  (`payments` + `channel_requests`). Reuses the exact fix
  `PHASE4_MARGIN_ECONOMICS_DELIVERY.md` applied to the platform-wide GMV
  number — the same undercount bug would've reappeared here if I'd
  queried `payments` alone.

**Admin UI** — two new tabs in `Admin.tsx`, same self-contained pattern
as the last three additions (`AdminChannelRequests`/`AdminCompliance`/
`AdminMessageSafety`):
- **Leads** (`AdminLeads.tsx`) — filterable by stage, add-lead form,
  inline stage/manager assignment, "Convert to client" (creates the
  `agency_clients` row, links back via `lead_id`).
- **Clients** (`AdminClients.tsx`) — service level, assigned manager,
  renewal status, and the real lifetime-spend/campaign-count from
  `agency_client_totals()` — not a placeholder number.

**Types** — `AgencyLead`, `AgencyClient`, `AgencyClientTotals` in
`src/lib/types.ts`, matching the existing interface style.

**A deliberate simplification, flagged rather than silent:** both new
`profiles` foreign keys on `agency_leads` (`business_id` *and*
`campaign_manager_id`) create an embed ambiguity Supabase/PostgREST needs
a `!constraint_name` hint to resolve. I didn't use one — this codebase
has no existing example of that hint anywhere to confirm the exact
auto-generated constraint name against, and I can't test it against real
Postgres. Both admin components fetch admins as a plain list already (for
the assignment dropdown) and resolve names from that in memory instead —
same end result, zero risk of a silently-wrong join. If a future phase
wants a server-side join here, the constraint names Postgres would have
generated are `agency_leads_campaign_manager_id_fkey` and
`agency_clients_campaign_manager_id_fkey` (default naming for an inline
column-level FK) — worth confirming against the real schema before
relying on them.

## Not done / still open

- **No unit tests added this phase.** `subscriptions.ts` and
  `messageSafety.ts` earned tests because they're real pure logic;
  `AdminLeads`/`AdminClients` are mostly CRUD and static label maps —
  same reasoning `AdminChannelRequests`/`AdminCompliance` apparently
  followed (no dedicated test file for either beyond `AdminCompliance`'s
  one pure helper). Didn't want to manufacture a function to test just to
  have coverage.
- **Never run against real Postgres** — same standing limitation as
  every phase, `agency_client_totals()`'s union query included.
- **The actual managed-campaign workflow doesn't exist yet.** This
  phase is the CRM foundation — who's a lead, who's a client, who's
  managing them. The 10-step pipeline itself (lead → qualified →
  proposal → payment → planning → inventory reserved → creative →
  approval → publisher execution → publication → proof → reporting →
  renewal), campaign packages, and agency margin tracking for managed
  campaigns all need an `agency_campaigns` entity that doesn't exist —
  and whether that wraps `requests`/`channel_requests` or stands alone
  is a big enough design question to deserve its own phase, not a guess
  folded into this one.
- **Renewal status is manual**, not computed from any real deadline —
  there's no "campaign packages" concept yet to derive a renewal date
  from.
- **No lead-to-signup matching.** Converting a lead to a client requires
  `business_id` already set — nothing here searches existing accounts by
  email to suggest a match automatically.

## Next

Agency Core, part 2: the managed-campaign workflow itself. Worth
deciding up front (same spirit as the campaign-manager question above)
whether it's a new `agency_campaigns` table that spawns
`requests`/`channel_requests` rows once things reach execution, or
whether managed campaigns just get flagged fields on the existing
tables — changes the shape of everything else in that phase.
