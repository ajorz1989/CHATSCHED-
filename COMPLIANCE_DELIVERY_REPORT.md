# ChatSched Compliance Upgrade — Delivery Report

**Merge note:** this build (Phases 1–6, compliance/sponsored-content) was
originally built against a `ChatSched-publisher-traction.zip` snapshot,
then merged into a separate `ChatSched-rate-cards.zip` snapshot that had
progressed independently and already claimed migration slot 38 for
`schema_phase38_rate_cards.sql`. The compliance migration was renumbered
to `schema_phase39_compliance.sql` for this merge — every in-repo
cross-reference to it was updated to match (grepped for
`schema_phase38_compliance` across the tree after the rename; none
remained). No rate-card file, route, or component was altered beyond the
minimal re-application of the compliance edits documented in section 2/5
below — see the merge's own commit message / diff for the exact patch
applied to each shared file (`App.tsx`, `Admin.tsx`,
`AdminChannelRequests.tsx`, `Dashboard.tsx`, `Footer.tsx`,
`ChannelCampaignCard.tsx`, `PublisherDashboardView.tsx`,
`supabase/functions/_shared/cors.ts`).

Status: **partial delivery, unverified.** This covers Phases 1–6 of the
platform-compliance/sponsored-content brief, built incrementally in a chat
session with no ability to run `npm ci`, `npm run build`, `npm test`, or
`npm run lint` against this repo (no network access, no `node_modules`).
Nothing below has been compiled or executed. Treat this as a structured,
carefully-cross-referenced draft ready for review in a real dev
environment — not as a tested deliverable. See "Known gaps" and "Recommended
next steps" before doing anything else with it.

## 1. Files changed

**New:**
- `supabase/schema_phase39_compliance.sql`
- `supabase/schema_phase40_proof_screenshots.sql` (added in a follow-up pass — see §11)
- `supabase/tests/compliance_test.sql`, `supabase/tests/README.md`
- `supabase/functions/campaign-compliance-screen/index.ts`
- `src/lib/complianceTypes.ts`, `src/lib/complianceTypes.test.ts`
- `src/lib/compliance.ts`
- `src/pages/CampaignCompliance.tsx`
- `src/pages/Compliance.tsx`
- `src/pages/PlatformRules.tsx`
- `src/pages/CreatorStandards.tsx`
- `src/pages/BusinessStandards.tsx`
- `src/pages/AdminCompliance.tsx`, `src/pages/AdminCompliance.test.ts`
- `src/components/ComplianceBadge.tsx`
- `src/components/RiskBadge.tsx`
- `src/components/PlatformRequirementCard.tsx`
- `src/components/ComplianceChecklist.tsx`
- `src/components/DisclosureNotice.tsx`
- `src/components/ProofSubmissionCard.tsx`
- `src/components/CampaignComplianceStrip.tsx`
- `src/components/PayoutComplianceHint.tsx`

**Modified:**
- `src/App.tsx` — 5 new routes
- `src/pages/Admin.tsx` — new "Compliance" tab, payout hint wiring
- `src/pages/AdminChannelRequests.tsx` — payout hint wiring
- `src/pages/Dashboard.tsx` — compliance strip on business request cards
- `src/components/PublisherDashboardView.tsx` — compliance strip on both creator-side flows
- `src/components/ChannelCampaignCard.tsx` — compliance strip on business-side channel flow
- `src/components/Footer.tsx` — links to new public pages
- `supabase/functions/_shared/cors.ts` — comment update listing the new function

## 2. Routes added

| Route | Access | Notes |
|---|---|---|
| `/compliance` | Public | Hub: platform grid, categories, responsibilities, FAQ |
| `/platform-rules` | Public | Full per-platform requirement cards |
| `/trust/creator-standards` | Public | |
| `/trust/business-standards` | Public | |
| `/campaigns/:id/compliance` | Auth (participant) | Works for both `requests` and `channel_requests` ids |

Admin compliance UI is a **tab inside `/admin`**, not a nested route —
deliberate deviation from the brief's literal `/admin/compliance` path,
matching how `AdminPayouts`/`AdminChannelRequests`/`AdminSecurity` already
work in this codebase (one `/admin` route, in-page tabs). Flagged explicitly
in case a real nested route is still wanted.

## 3. Database migrations added

`schema_phase39_compliance.sql` — one file, additive only. Adds:
`platform_compliance_rules`, `campaign_category_rules`, `campaign_compliance`,
`campaign_disclosures`, `campaign_proof`, `compliance_reviews`,
`campaign_risk_flags`, `creator_category_preferences`,
`business_campaign_preferences`. Full rationale is in the file's own header
comment, including why "campaign" maps to `request_id`/`channel_request_id`
rather than the existing tracking-link `campaigns` table.

**Not yet run against a live database.** Before applying: review it in the
Supabase SQL editor or `supabase db push` against a branch/staging project.

## 4. RLS policies added/changed

Every new table has RLS enabled. Summary:
- `platform_compliance_rules`, `campaign_category_rules` — public read (enabled rows), admin write
- `campaign_compliance` — participant-only read, **no direct write policy at all** (see #10)
- `campaign_disclosures` — participant read, append-only (no update/delete for anyone)
- `campaign_proof` — participant read, creator insert (own campaign only), admin-only update
- `compliance_reviews` — admin-only, full stop
- `campaign_risk_flags` — participant read, admin write
- `creator_category_preferences` — public read, owner (or admin) write
- `business_campaign_preferences` — owner (or admin) only

No existing table's RLS was touched.

## 5. Edge/server functions added/changed

- **New:** `campaign-compliance-screen` — AI-assisted screening (brief §6/7), on the Claude/Anthropic path this app defaults to. Writes `risk_score`/`risk_level`/`campaign_risk_flags` via service role; never writes `status` directly; opens a `compliance_reviews` row on a high-severity flag.
- **Changed:** `_shared/cors.ts` — comment-only, added the new function to the "who uses this" list.

## 6. Components created

`ComplianceBadge`, `RiskBadge`, `PlatformRequirementCard`, `ComplianceChecklist`,
`DisclosureNotice`, `ProofSubmissionCard`, `CampaignComplianceStrip`,
`PayoutComplianceHint`. All built against the app's existing bold-block
Tailwind conventions (`billboard-*` palette, `font-mono uppercase` labels),
not a new design language.

## 7. Compliance features completed

Sections 1–14, 17, 18, 20, 22, 23, 27, 33, 34 (partial), 37 (design only —
see #11) from the original brief are represented in some form. Section 6/7
(AI screening) is implemented but unverified end-to-end (no live Anthropic
key was called from this environment).

## 8. Admin features completed

Overview counts, manual review queue (approve/reject/request changes/start
review), platform-rule editor (with automatic version bump + audit log),
category-status editor. Restrict/escalate as distinct actions were folded
into the existing 5-status enum rather than added as separate verbs — see
`AdminCompliance.tsx`'s header comment.

## 9. Tests added

- `src/lib/complianceTypes.test.ts` — vitest, pure functions (label/icon coverage, `outstandingComplianceItems`). Written to this repo's existing vitest convention; **not run** in this session (no `node_modules`).
- `src/pages/AdminCompliance.test.ts` — vitest, `arrToText`/`textToArr` round-trip. Same caveat.
- `supabase/tests/compliance_test.sql` — pgTAP scaffold covering auto-creation, RLS, the "server-only-writer" rule, the RPCs, and core status transitions. **This is new test infrastructure — no pgTAP/database test harness existed in this repo before.** Not run against a real Postgres instance; see `supabase/tests/README.md`.

Not written: tests for the notification triggers, the AI edge function (needs a mocked Anthropic call), and the full brief-mandated end-to-end scenario through payout eligibility.

## 10. Security considerations

- `campaign_compliance.status`/`risk_score`/`risk_level`/checklist booleans have **zero** client-writable paths — no UPDATE policy grants touching them, only `recompute_campaign_compliance()` (SECURITY DEFINER, triggered by the RPCs and the AI function) ever sets them. This was the one design decision I'd flag hardest for a second pair of eyes: it's a real security property, but it's also the single point where a bug would be highest-impact (a wrong `security definer` function is a bigger blast radius than a wrong RLS policy).
- `campaign_proof` review is admin-only; a creator cannot mark their own proof verified.
- `compliance_reviews` never exposes itself to participants — matches the existing `disputes` pattern of keeping resolution admin-side.
- The AI screening function authenticates the caller, checks `business_id`/`admin` ownership before running, and only then switches to a service-role client for the writes — same shape as `publisher-authenticity-check`.
- Payout actions are **never blocked** by risk score or compliance status anywhere in this build — `PayoutComplianceHint` is read-only decoration next to the existing buttons, per brief §23's explicit instruction.

## 11. Remaining limitations

- **Nothing in Phases 1–6 has been compiled, type-checked, linted, or run.** This is the biggest limitation and applies to every file listed above.
- `policy_version`/`requirement_version` snapshotting (brief §37) is implemented as a plain integer bumped by `set_platform_compliance_rule`, not a full separate `compliance_policy_versions` table with history — simpler, but means only the current+"version at time of review" are queryable, not a full diff history of every past version's content.
- ~~Screenshot upload for proof (brief §10) is not wired — no Storage bucket created.~~ **Closed in a follow-up pass:** `schema_phase40_proof_screenshots.sql` adds a private `campaign-proof-screenshots` bucket, `ProofSubmissionCard.tsx` uploads to it and offers a signed-URL "View screenshot" on existing submissions, and — a gap that surfaced *while* wiring this in — there was no admin UI anywhere that actually called `review_campaign_proof`, so a submitted proof had no way to reach `verified`/`rejected` short of raw SQL. Added a "Proof" tab to `AdminCompliance.tsx` alongside the fix, since a screenshot nobody can look at and act on isn't a real feature. Same unverified-in-this-session caveat as everything else in this report.
- `/trust/safety`, `/trust/verification`, `/trust/payments`, `/trust/disputes`, `/trust/fraud-prevention`, `/trust/platform-compliance` (brief §34) are not built as separate routes — worth checking how much `TrustCentre.tsx` already covers before adding more pages.
- Remaining notification events from brief §26 beyond the two wired (disclosure required, proof submitted) are not implemented.
- No accessibility audit was performed (brief §29) — components follow existing patterns (semantic buttons/labels) but haven't been tested with a screen reader or keyboard-only pass.
- Mobile layout was not visually checked (no running dev server in this environment).

## 12. Platform/API dependencies

- `ANTHROPIC_API_KEY` env var required for `campaign-compliance-screen` (same var `content-studio-generate` already uses).
- No new third-party platform APIs are called anywhere — per brief §32, nothing scrapes or integrates with TikTok/Instagram/YouTube/etc. directly.

## 13. Features requiring manual policy review

- Every seeded row in `platform_compliance_rules` is explicitly labeled "Illustrative starting point" — none of it should be treated as actual current platform policy without a human checking it.
- `campaign_category_rules` seed values (e.g., Gaming → restricted, Financial Services/Healthcare → manual_review) are placeholder judgment calls, not a compliance/legal team's actual risk assessment.

## 14. Recommended next development phase

In order of likely value:
1. **Take this into Claude Code (or equivalent) and actually run `npm ci && npm run build && npm run lint && npm test`.** Fix whatever that surfaces before adding anything else — this is the single highest-leverage next step, repeated from every phase's closing note because it hasn't happened yet.
2. Apply `schema_phase39_compliance.sql` to a staging Supabase project and run `supabase/tests/compliance_test.sql` for real.
3. Wire the remaining §26 notification events now that real call sites exist to test against.
4. Storage bucket + screenshot upload for proof.
5. Decide whether `/admin/compliance` should genuinely become a nested route rather than a tab, and whether the six remaining `/trust/*` sub-pages are worth building or whether `TrustCentre.tsx` should just be expanded in place.
