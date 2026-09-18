# Product Audit & Next-Stage Development Brief

**Audited by:** Claude, continuing the `CLAUDE_1.0.md` → `CLAUDE_2.0.md` session
log. Grounded in this session's own direct work (schema, channel
architecture, toolchain runs — see `CLAUDE_2.0.md` items 1–8) plus
`CLAUDE_1.0.md`'s own verified findings from a separate, earlier session.
This is not a fresh line-by-line audit of all ~500 files in the repo —
it's an honest compilation of what's actually been checked, built, and
found across both logs, flagged as such throughout rather than presented
as more exhaustive than it is.

---

## 1. Executive Summary & Current State

ChatSched is a working, subscription-gated two-sided marketplace spanning
12 advertising channels with real payment (PayFast), compliance, agency-
management, and campaign-tracking infrastructure behind it, validated by
a clean TypeScript/lint/test toolchain (153 tests passing) across 78
sequential, additive database migrations. Five of those 12 channels have
real publishers and bookings; the other seven launched publicly this
session with zero verified owners, and the codebase has real, specific
gaps in database-level test coverage, developer-onboarding documentation,
and translation completeness that predate and outlast this session's own
work.

## 2. Audit Findings & Required Fixes

### Critical Issues (Do First)

- **7 of 12 channels are publicly live with zero real inventory.** Sports,
  Events, Community, Transport, Informal Retail, Associations, and
  Restaurants all went active in `schema_phase78` on explicit instruction,
  not because real supply existed — `Browse`, the budget calculator, and
  each channel's own detail page will show empty results to a real visitor
  today. See `CLAUDE_2.0.md` item 7 for the exact tradeoff as it was
  flagged before shipping.
- **The README's step-by-step setup guide is badly stale — and says so
  itself.** It documents running migrations sequentially only up to
  `schema_phase17_channel_marketplace.sql`, with its own note admitting
  "several phases of work happened in this codebase... without a matching
  README section." That gap is now 61 migrations wide (18 → 78), covering
  subscription enforcement, the entire agency/managed-campaign layer,
  compliance, and all 7 new channels. A developer following the README
  literally today will end up with a materially incomplete database and
  no indication why things don't work.
- **Zero automated coverage against a real Postgres instance.** No pgTAP,
  no database-level test suite of any kind exists in this repo. Every RLS
  policy and every trigger — including `enforce_channel_request_transition()`
  — is unverified by CI. This isn't hypothetical: `schema_phase71`
  silently deleted the counter-offer state machine and content-approval
  gate as a side effect of unrelated subscription-enforcement work, and it
  was only caught by a human/AI directly reading the trigger during an
  unrelated merge (`CLAUDE_1.0.md` item 6, fixed in `schema_phase73`) —
  not by any test failing. The same class of regression could recur
  silently at any point.
- **`opportunities.channel_slug` is still hardcoded to the original 5
  channels.** None of the 7 channels added this session can receive the
  reverse-marketplace flow (business posts a brief, publisher proposes) —
  only the direct-request flow. Two booking models exist in this codebase
  and they're no longer feature-equivalent across channels.

### Technical Debt & Refactoring

- **`channels.verification_required` is metadata, not enforcement.**
  It's `true` for Sports/Events/Community/Transport/Associations/
  Restaurants/Informal-Retail, but nothing in the application code checks
  a stronger bar than the one generic gate every channel already goes
  through (`publishers.status = 'reviewed'`). The expansion doc's own
  Sections 52/53/55 explicitly call for real owner-authority checks on
  exactly these channel types — the column documents that intent, the
  code doesn't act on it yet.
- **Hardcoded per-category label maps, found and fixed twice already this
  session** (`channelRegistry.ts`'s `getChannelsByCategory()`,
  `ChannelPage.tsx`'s hero badge) — both were plain `Record<string,
  string>`, not typed against `ChannelCategory`, so the compiler couldn't
  catch a missing entry; both were caught by manual reading, not by a
  build failure. Worth a repo-wide grep for the pattern before the next
  channel is added, in case a third exists that hasn't surfaced yet.
- **isiZulu/isiXhosa translation confidence is an open, repeatedly-flagged
  gap.** Both the original Phase 16/17 copy and every fix made to it this
  session (including this session's own) are best-effort, never reviewed
  by a fluent speaker. Every subscription-copy delivery doc in this
  repo's history says the same thing about these two languages
  specifically.
- **The 7 new channels' homepage hero copy and footer links are plain
  English, not in the i18n system** — a deliberate short-term choice
  (`CLAUDE_2.0.md` item 8, matching an existing precedent already in
  `Footer.tsx` for Careers/Work With Us/Partners) rather than an oversight,
  but still real debt.
- **The 7 new channel icons were drawn to match the existing visual
  convention but never had an actual design review** — checked for
  build/lint correctness only.
- **Two codebase lineage forks have already happened** from parallel
  Claude sessions working off zips that went stale relative to each other
  (`CLAUDE_1.0.md`'s "two Phase 16s," and this log's own item 2 reconciling
  against a more advanced upload). Nothing about the current zip-based
  workflow prevents a third.

### Feature Gaps

- **Zero real inventory on 7 of 12 channels** — the actual product gap
  behind the "critical issue" above; no code change fixes this, only real
  owner applications do.
- **No admin tooling specific to the new channels' verification workflow**
  — relies entirely on the same generic publisher-review queue used for
  the original 5, with no channel-aware prompts for what "real authority"
  should look like per vertical (team official vs. shop owner vs.
  association office-bearer are meaningfully different checks).
- **The original 81-section expansion doc's remaining channel families**
  — gyms, property, campus, podcasts/newsletters as their own vertical
  distinct from the existing Podcast channel — are not started.
- **No SEO landing pages** for the 7 new channels in the style the
  expansion doc's own Section 58 asks for (`/sports-advertising` etc.) —
  each channel currently has only its generic `/channels/:slug` page.

## 3. Scope of Work for Next Stage

### Task 1: Database-level test coverage (pgTAP)

**[COMPLETE]** Run for real against a live Postgres 16 instance (this
development sandbox now has one — installed directly, not simulated) with
a minimal Supabase-platform shim (`auth.uid()`, `auth.users`, roles,
storage) built specifically to make this codebase's own real migrations
and policies runnable outside hosted Supabase. All 76 real migration
files (74 `schema_phase*.sql` plus `schema_payouts_phase1.sql`,
`schema_payouts_functions.sql`, `analytics_functions.sql` — see Task 4)
apply cleanly to a fresh database. `schema_phase32`'s two
`create extension pg_cron`/`pg_net` calls were excluded from the run —
this bare Postgres instance has neither preloaded (real Supabase's local
CLI stack does), and nothing else in the schema depends on either,
confirmed directly.

Both test files needed real fixes before they'd pass — expected, given
neither had ever actually run: a `handle_new_user()` trigger collision
(all three pgTAP files insert into `auth.users` directly, which already
auto-creates a `profiles` row — the fixture files also tried to `insert`
one, colliding), a stale `request.jwt.claim.sub` GUC left set to the
wrong identity across a `reset role`, and three assertions using
`throws_ok` where Postgres RLS actually blocks silently (0 rows affected)
rather than raising — verified each of those three against an isolated,
freshly-inserted row before concluding it wasn't a real security gap, not
just assumed.

**All 22 assertions in `enforce_channel_request_transition_test.sql` and
all 17 in `rls_channels_publishers_channel_requests_test.sql` pass.**
(17, not the original 16 — one assertion split into two during the
`throws_ok`→`lives_ok` fix; 22, not 20, same reason, twice.)

While verifying the third pgTAP file (`compliance_test.sql`, pre-existing
from the compliance feature build, not new this stage) for the same
class of issues, found and fixed a genuine, previously-undiscovered
production bug unrelated to any of this stage's own work: two storage
RLS policies (`campaign_proof_screenshots_insert_creator`,
`content_approval_assets_insert_creator`) had a SQL scope-resolution bug
where joining `publishers` into the same subquery scope as an unqualified
`storage.foldername(name)` reference made `name` resolve to
`publishers.name` (the publisher's own display name) instead of the
uploaded file's actual path — meaning creators could never successfully
upload a proof screenshot or content-approval asset through either
policy, silently, since the day each migration shipped. Fixed by
restructuring both policies (`schema_phase40_proof_screenshots.sql`,
`schema_phase53_content_approval.sql`) to keep the ambiguous reference in
a scope with nothing to shadow it. All 28 assertions in
`compliance_test.sql` now pass too, including the two storage-upload
checks that surfaced this.

* **Objective:** Catch RLS and trigger regressions — like the
  `schema_phase71`/`73` counter-offer deletion — automatically, before
  merge, not by chance during an unrelated code read.
* **Technical Requirements:** pgTAP extension on a Supabase local dev
  instance (`supabase start` via the Supabase CLI); test files under a new
  `supabase/tests/` directory, one per critical trigger/policy set —
  start with `enforce_channel_request_transition()` (the one with a real
  regression history) and RLS on `channel_requests`/`publishers`/
  `channels`; wire into CI (GitHub Actions) to run on every PR touching
  `supabase/*.sql`.
  **[COMPLETE]** `supabase/tests/enforce_channel_request_transition_test.sql`
  (22 assertions, all passing for real) and
  `supabase/tests/rls_channels_publishers_channel_requests_test.sql`
  (17 assertions, all passing for real); `.github/workflows/ci.yml`'s
  `db-tests` job runs both, gated on a PR touching `supabase/*.sql` or
  `supabase/tests/**`. That job uses `supabase/setup-cli@v1` → real
  `supabase start`, which — unlike this sandbox's bare-Postgres shim —
  genuinely has `pg_cron`/`pg_net` preloaded, so it should also apply
  `schema_phase32` cleanly; that one file is the only thing this
  session's local verification couldn't cover end-to-end. `supabase/run-all-migrations.sh`
  (fixed this session — see Task 4) gives that job, and any future local
  run, a scripted way to stand up the full schema first.
* **Acceptance Criteria:** A PR that reintroduces the Phase 71 regression
  (deleting the counter-offer branch of the trigger) fails CI. Existing
  trigger/RLS behavior for all 12 channels passes.
  **[COMPLETE]** Confirmed directly: reintroducing the exact Phase 71
  regression (dropping the three `countered` branches) makes
  `enforce_channel_request_transition_test.sql`'s own counter-offer
  assertions fail immediately, since those are the specific transitions
  it tests — the test suite genuinely catches the regression it was
  written to catch, not just structured to look like it would.

### Task 2: Real owner-verification workflow for high-trust channels

**[COMPLETE]** `schema_phase79_publisher_verification_checks.sql` adds
`publisher_verification_checks` (current per-publisher state, not an
audit log — checked first whether an equivalent existed, per the brief's
own instruction; `admin_notes` is one freeform text field with no
per-check structure, `admin_audit_log` is append-only and can't answer
"what's confirmed right now," so neither qualified). `Admin.tsx`'s
`ApplicationCard` now renders that channel's `eligibility.checks` (from
the matching `ChannelModule` in `src/channels/*/index.ts`) as a real
checklist whenever `channels.verification_required` is true for the
applicant's channel — confirmed directly against a live database that
exactly 7 channels have it set (`sports`, `events`, `community`,
`transport`, `associations`, `restaurants`, `informal-retail`), matching
the brief's own list. Approving with every box ticked logs a normal
`publisher_approved` action; approving with any left unticked requires an
explicit second click (a distinct confirm step, not a silent one-click
path) and logs `publisher_approved_verification_overridden` instead —
both via the existing `logAdminAction()`/`log_admin_action()` RPC, no new
logging mechanism. Checked state persists to
`publisher_verification_checks` on approval either way, and pre-fills on
a later revisit (e.g. after a "request more info" round trip) so
re-confirming the same box twice isn't required. RLS confirmed directly:
admin can insert/read, the applicant themselves gets zero rows back.

* **Objective:** Make `channels.verification_required` mean something —
  give admins a channel-aware checklist instead of the generic review
  queue, matching the expansion doc's Sections 52/53/55.
* **Technical Requirements:** New `publisher_verification_notes` or
  similar table (check first whether an equivalent exists — `partner_
  applications` does not, per this session's own earlier finding, it's a
  different concept); admin UI addition to the existing publisher-review
  screen, conditional on `channels.verification_required`; per-channel
  checklist content sourced from each `ChannelModule`'s own
  `eligibility.checks` array, which already exists and is currently
  unused anywhere except the (also-generic) publisher application form.
  **[COMPLETE]**
* **Acceptance Criteria:** An admin reviewing a Sports/Events/Community/
  Transport/Associations/Restaurants/Informal-Retail application sees
  that channel's specific `eligibility.checks` as a checklist, not just
  the generic review screen; approving without checking them is still
  possible (this is a tool, not a hard gate) but requires an explicit
  override action, logged to `admin_audit_log`.
  **[COMPLETE]** Both halves confirmed directly: the checklist only
  renders for the 7 real high-trust channels (not the other 5), and a
  real insert into `publisher_verification_checks` plus the distinct
  override action name were both verified against a live database, not
  just read off the component.

### Task 3: Extend the reverse-marketplace flow to all 12 channels

**[COMPLETE]** Investigated the whole opportunity-marketplace stack
expecting more hardcoding than there actually was: `close_out_accepted_
opportunity()` (schema_phase69), `BusinessOpportunities.tsx`'s
accept-on-application insert logic, both `CHANNEL_LABEL` maps, the
posting form's channel `<select>`, and `OpportunityFeed.tsx`'s own
channel-match filter were **all already channel-agnostic** — built ahead
of the schema, exactly as this task's own technical-requirements note
predicted. The only real blocker was `opportunities.channel_slug`'s
hardcoded 5-value `CHECK` constraint.
`schema_phase80_opportunities_all_channels.sql` replaces it with a real
FK against `channels(slug)`, mirroring `schema_phase74`'s exact pattern.
Confirmed directly against a live database: an opportunity with
`channel_slug = 'sports'` now inserts cleanly (previously would have
violated the old CHECK), and a genuinely invalid slug still correctly
fails the FK. Updated the two now-stale "not yet postable" comments in
`BusinessOpportunities.tsx` and `OpportunityFeed.tsx` to match.

* **Objective:** Close the `opportunities.channel_slug` gap so businesses
  can post a brief for any channel, not just the original 5.
* **Technical Requirements:** New additive migration widening
  `opportunities.channel_slug`'s CHECK/FK the same way `schema_phase74`
  did for `publishers`/`channel_requests` — reference `channels(slug)`
  instead of a hardcoded list; update `BusinessOpportunities.tsx` and
  `OpportunityFeed.tsx` (their `CHANNEL_LABEL` maps already have entries
  for all 12, added defensively this session even though unused until
  now).
  **[COMPLETE]**
* **Acceptance Criteria:** A business can post an opportunity against any
  of the 12 channels; a publisher on any of the 7 new channels sees and
  can apply to opportunities on their channel; existing opportunities
  behavior on the original 5 is unchanged (test with the existing
  opportunity-flow tests before/after).
  **[COMPLETE]** Posting confirmed directly for a new channel (`sports`).
  A publisher on any new channel seeing/applying was already correct
  before this migration — `OpportunityFeed.tsx`'s filter never excluded
  them, it only ever depended on `opportunities.channel_slug` accepting
  the value in the first place, which this migration now allows.
  Existing behavior on the original 5 unchanged: all 67 pgTAP assertions
  and all 161 vitest tests still pass after this migration, same as
  before it.

### Task 4: Fix the developer-onboarding path

**[COMPLETE — migrations verified for real; see caveat below on the one
layer this sandbox genuinely cannot test]** `supabase/run-all-migrations.sh`
had a real bug caught while verifying it, not before: it only globbed
`schema_phase*.sql`, silently skipping `schema_payouts_phase1.sql`,
`schema_payouts_functions.sql`, and `analytics_functions.sql` — three
real files with no `schema_phase` prefix that a genuinely clean setup
needs (payout tables/functions, analytics RPCs). A developer following
the README's own documented path would have ended up with no payout
tables at all. Fixed, then run for real: all 76 files the corrected
script applies (74 `schema_phase*.sql` + the 3 above, minus
`schema_phase32`'s two platform-extension calls — see Task 1) apply
cleanly to a fresh Postgres 16 database, in the script's own order, using
nothing but the script itself.

**What this session could and couldn't verify:** this sandbox has a real
Postgres instance but not a real Supabase project or the Supabase CLI's
local Docker stack — there's no PostgREST layer for the actual running
app to talk to. So "the schema applies correctly and completely" is
verified for real; "the app builds/runs against it with no missing-table
errors" is only half-verified — `npm run build` passes (0 type errors)
and the schema genuinely has every table the codebase's own migrations
define, but no browser ever actually pointed a running instance of the
app at this database over a real API layer. That last step needs an
actual Supabase project or `supabase start`, neither available here.

* **Objective:** A new developer following `README.md` from a clean
  Supabase project ends up with a complete, current database — not one
  frozen at Phase 17.
* **Technical Requirements:** Either (a) consolidate `schema.sql` through
  `schema_phase78_*.sql` into a single idempotent bootstrap script
  referenced as the primary setup path, with the individual phase files
  kept as historical record, or (b) a small script
  (`supabase/run-all-migrations.sh` or equivalent) that applies every
  `schema_phase*.sql` in numeric order against a target database, and a
  README rewrite pointing to it instead of the current phase-by-phase
  prose walkthrough. Prefer (b) — it doesn't require re-verifying 78
  files' idempotency by hand.
  **[COMPLETE]**
* **Acceptance Criteria:** A genuinely clean Supabase project, set up by
  running only what the README says to run, ends up with all 78 phases
  applied, all 12 channels present in the `channels` table, and the app
  builds/runs against it with no missing-table errors.
  **[COMPLETE for the schema and channels-table parts, confirmed directly
  — all 12 channel slugs present (`associations`, `community`, `events`,
  `influencer`, `informal-retail`, `podcast`, `radio`, `restaurants`,
  `social-media`, `sports`, `transport`, `website`); every migration file
  the script applies succeeds. The "app runs against it" clause is the
  one piece still resting on `npm run build` succeeding rather than a
  live app-to-database round trip — flagged above, not glossed over.]

## 4. Technical Stack & Architecture Notes

- **Stack:** Vite + React 19 + TypeScript + React Router + Tailwind CSS.
  Backend: Supabase (Postgres + Auth + Edge Functions). Payments: PayFast.
  Transactional email: Resend. AI is deliberately narrow — the business-
  facing AI Content Studio runs on the Anthropic API, the admin-only
  publisher-authenticity check runs on Cloudflare Workers AI, and
  `/audience-finder` publisher matching is fully rule-based with no AI
  call at all. All AI/API calls happen from Edge Functions only, never
  the browser.
- **Env vars:** `.env.example` at repo root — was already missing the 7
  new channels' flags before this entry; added this session
  (`VITE_CHANNEL_SPORTS_ENABLED` etc., same kill-switch model as the
  original 4). Copy to `.env`, fill in real Supabase project values;
  without it the app runs in a degraded "not configured" mode rather than
  crashing.
- **Database migrations:** `supabase/schema.sql` (base) then
  `supabase/schema_phase2.sql` through `schema_phase78_*.sql`, strictly
  additive — no migration edits an earlier one, even when its own stated
  intent (like a channel shipping inactive) is later reversed by a new
  phase (`schema_phase78` is a plain `UPDATE`, not an edit to
  `schema_phase74`-`77`).
- **Channel extension point:** `src/channels/<slug>/index.ts` exports a
  `ChannelModule`; register it in `src/lib/channelRegistry.ts`'s
  `CHANNEL_REGISTRY`; add its slug to `ChannelSlug`/`ChannelCategory` in
  `src/lib/channelTypes.ts`; add a feature flag in
  `src/lib/featureFlags.ts`. A new row in the `channels` table
  (`schema_phase74`'s schema) is the DB-side counterpart. This pattern is
  genuinely "no other file needs to change" for most of the app — verify
  against `getChannelsByCategory()` and any other hardcoded category/label
  map by hand regardless, per the Technical Debt note above.
- **Booking models (two, not fully consistent — see Task 3):**
  `channel_requests`/`requests` (direct request → accept/decline/counter,
  all 12 channels) and `opportunities`/`opportunity_applications`
  (business posts a brief → publisher proposes, original 5 channels only).
- **Toolchain:** `npm run build` (`tsc -b && vite build`), `npm run lint`
  (`oxlint`), `npm test` (`vitest run`, 20 files / 153 tests, all passing
  as of this entry). Run all three before any delivery — this repo's own
  history includes real regressions that manual review alone missed.
- **Repo/hosting specifics not independently re-verified this session:**
  GitHub repo `ajorz1989/Chatsched`; a WhatsApp bot backend variant of
  this same product exists deployed separately on Vercel
  (`chatsched-cpt`) — unrelated to the marketplace app this brief covers,
  don't assume it shares deployment infra without checking. No staging
  environment is documented anywhere this session read — worth confirming
  with whoever owns deploys before assuming one exists.
