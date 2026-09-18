# CLAUDE 1.0 — Session Handoff Log

This file is the single canonical running record of Claude-driven
development on this codebase — chronological, so another developer can
see exactly what changed, why, and what's still open, without
reconstructing it from individual `PHASE*_DELIVERY.md` files or from
separately-numbered `CLAUDE_N.0.md` logs scattered across uploads. Those
files still exist as archived detail for the work done before this
consolidation (`CLAUDE_2.0.md`, `CLAUDE_3.0.md` — each summarized in one
entry below, items 8–9, rather than reproduced in full) — but going
forward, **this is the one file new work gets logged to.** No more
`CLAUDE_4.0.md`.

**This file is appended to, not rewritten, as work continues.** Each
entry below is a discrete unit of work, in the order it happened. If
you're picking this codebase up fresh, everything below is already in
this zip — you're reading a log of how it got here, not a to-do list,
except for the "Open items" section at the very bottom, which is
genuinely still outstanding.

---

## 1. PayFast cancellation actually calling PayFast

**Problem found:** `cancel-subscription/index.ts` only ever flipped
ChatSched's own subscription status to `cancelled`. It never called
PayFast, so the underlying recurring-billing token kept charging the
card. `_shared/payfast.ts` had checkout-field signing and ITN
verification, but no cancellation-API helper existed anywhere.

**Fix:**
- Added `cancelPayfastSubscription()` to
  `supabase/functions/_shared/payfast.ts` — calls PayFast's real
  recurring-billing API (`PUT https://api.payfast.co.za/subscriptions/{token}/cancel`,
  `?testing=true` in sandbox), using a *different* signature scheme from
  checkout (headers signed alphabetically, not PayFast's fixed checkout
  field order). Confirmed against PayFast's published API docs.
- `cancel-subscription/index.ts` now reads the stored `payfast_token`
  (already present in the schema, unused) and calls PayFast before
  flipping local status. ChatSched access is revoked either way; if the
  PayFast call fails, the response says so explicitly
  (`payfast_cancelled: false` + a `warning`) instead of silently
  implying success.
- `SubscriptionSection.tsx` surfaces that warning, and the confirm-dialog
  copy was fixed — it previously *promised* PayFast wouldn't be touched,
  which was no longer true.

Full detail: `PHASE18_PROACTIVE_SUBSCRIPTION_GATE_DELIVERY.md`'s
underlying fix (this predates its own numbered delivery doc — it was
built directly against a `phase18` upload before a `phase19` copy-fix
branch existed).

**Files touched:** `supabase/functions/_shared/payfast.ts`,
`supabase/functions/cancel-subscription/index.ts`,
`src/components/SubscriptionSection.tsx`

---

## 2. Merge onto the phase19 branch

The user's next upload (`ChatSched-phase19-subscription-copy-fix.zip`)
turned out to be a separate fork off the same phase18 base — it fixed
now-false subscription copy on marketing pages (Faq, Fees,
ForBusinesses, ForPublishers, Mission, Pricing, `home.json` × 4
languages) but still had the *original, unfixed* `cancel-subscription`
and `payfast.ts`. Diffed both trees first to confirm zero overlap, then
ported the three files from item 1 onto the phase19 base. Nothing lost
or overwritten in either direction — verified with a full recursive diff
afterward.

---

## 3. Audit: what's fixed vs. still open

Read `PRE_LAUNCH_AUDIT.md`, `PIVOT_PHASE1_AUDIT.md`,
`PHASE17_SUBSCRIPTION_ENFORCEMENT_DELIVERY.md`, and
`PHASE18_PROACTIVE_SUBSCRIPTION_GATE_DELIVERY.md`'s own "not done" lists,
and cross-checked every item against the actual code (not just the
delivery notes' claims about the code). Ran the real toolchain for the
first time in this lineage — `npm ci && build && lint && test` all
passed cleanly, contradicting several audits' standing claim that the
toolchain had "never been run" (this sandbox has network access;
apparently others didn't).

Findings at that point:
- ✅ PayFast cancellation — fixed (item 1 above)
- ✅ Now-false subscription copy — fixed (phase19, not by Claude)
- ✅ Proactive subscription-gate coverage — fixed (phase18, not by
  Claude)
- 🔴 `business_launch_credits` untouched by subscription lapse
- 🔴 No bulk request creation
- 🔴 Never run against real Postgres (pgTAP suite)
- 🔴 Counter-offer/decline "intentionally ungated" — **this
  characterization turned out to be wrong; see item 6 below**

---

## 4. Launch credit forfeiture on subscription lapse

**Problem found:** `business_launch_credits.remaining` was never
touched by subscription status. A business could cancel and still spend
remaining launch credit against an already-confirmed campaign, since
checkout itself isn't subscription-gated (only *starting new* requests
is).

**Decision, asked rather than assumed:** three reasonable options
existed (freeze-and-restore, forfeit immediately, or leave it as
already-granted money). Asked the user directly rather than picking one
— real money implications, and this repo's own prior audits set the
precedent of asking on genuine business-policy forks rather than
guessing. **Answer: forfeit immediately on cancel/suspend.**

**Fix:**
- Added `forfeitBusinessLaunchCredit()` to a new
  `supabase/functions/_shared/launchCredit.ts` — zeroes
  `business_launch_credits.remaining`, no-op if there's no credit or
  it's already zero. Deliberately *not* called for `past_due` (still
  recoverable — PayFast still retrying).
- Wired into both real paths to `cancelled`: the user's own cancel
  button (`cancel-subscription/index.ts`) and PayFast's ITN webhook
  (`payfast-notify`) — the latter matters because PayFast can report a
  cancellation independently (e.g. cancelled from PayFast's own
  dashboard) without going through ChatSched's cancel function at all.
- `SubscriptionSection.tsx` now tells the person exactly how much
  credit they're about to forfeit before they confirm cancellation.

Full detail: `PHASE20_LAUNCH_CREDIT_FORFEITURE_DELIVERY.md`

**Files touched:** `supabase/functions/_shared/launchCredit.ts` (new),
`supabase/functions/cancel-subscription/index.ts`,
`supabase/functions/payfast-notify/index.ts`,
`src/components/SubscriptionSection.tsx`

---

## 5. Bulk request creation

**Problem found:** `CreateRequestForClient.tsx` (admin creating a
request on a managed client's behalf) submitted one publisher at a time
— no way to paper a many-publisher campaign in one sitting.
Named as an open gap since `PHASE8_ADMIN_REQUEST_CREATION_DELIVERY.md`.

**Fix:** Rebuilt as a queue-then-submit flow:
- One shared campaign message for the whole batch (it's one brief going
  to many publishers, not N unrelated ones — deliberately not per-row,
  to avoid rows silently drifting out of sync).
- Search now adds to a queue instead of collapsing into a single form,
  so you can keep adding publishers one after another.
- Advertising method and proposed amount stay per-row — the one thing
  that genuinely differs per publisher (different rate cards).
- Submit does two batched inserts (one per destination table:
  `requests` for social-media, `channel_requests` for the other four
  channels), not N sequential round trips.
- Partial-failure handling is explicit, not assumed-atomic: if the
  social-media batch lands but the channel-request batch then fails,
  the UI says so and only clears the succeeded rows from the queue, so
  the rest can be fixed and resubmitted without re-entering everything.

No new RLS policy needed — the existing admin insert policies from
Phase 8 had no per-row limit.

Full detail: `PHASE21_BULK_REQUEST_CREATION_DELIVERY.md`

**Files touched:** `src/components/CreateRequestForClient.tsx`
(rewritten), `src/pages/AdminCampaigns.tsx` (button label only)

---

## 6. Counter-offer / content-approval regression — corrected, not confirmed

This is the most consequential finding of the session, and it started
from a mischaracterization of Claude's own making.

**What was said earlier in this session:** that counter-offer/decline
on `channel_requests` were "intentionally ungated" — a documented design
choice from `PHASE18_PROACTIVE_SUBSCRIPTION_GATE_DELIVERY.md`, worth
confirming but presumed correct.

**What was actually true, on reading the trigger directly instead of
trusting that summary:** the counter-offer feature doesn't gate because
it doesn't exist. `schema_phase71_subscription_enforcement.sql`
replaced `enforce_channel_request_transition()` by building off an old
base (`schema_phase17`) instead of the live one (`schema_phase53`).
`create or replace function` swaps the entire body, not a diff, so this
silently deleted:

1. The entire counter-offer state machine from Phase 35 (`pending ->
   countered -> awaiting_payment`/`cancelled`)
2. The content-approval gate on going live from Phase 53/54 (`paid ->
   live` used to require an approved `content_approvals` row — after
   Phase 71, nothing checked this at all)

The frontend was never broken because it was never wrong — it was
written against the real state machine and had no reason to expect
Phase 71 would regress it. `PublisherDashboardView.tsx` still fires
`.update({ status: 'countered', ... })`; `ChannelCampaignCard.tsx` still
has a business-side "Accept counter" button. Every one of those calls
had been hitting a raw Postgres exception since Phase 71 shipped.

**Fix:** `schema_phase73_restore_counter_offer_and_content_gate.sql` —
rebuilt `enforce_channel_request_transition()` from Phase 53's complete,
last-correct body, with Phase 71's subscription check merged into the
accept branch (the one thing Phase 71 actually meant to add). Confirmed
by re-reading Phase 53's full function directly, not from memory of what
it "should" contain — the same mistake that caused the regression in the
first place.

Renumbered from 72 to 73 after a real collision with the
next upload's own `schema_phase72_subscription_grace_period.sql` (see
item 7) — same call Phase 71 itself made against Phase 70, for the
identical reason.

**Adjacent bug found and fixed while verifying:** in the same pass,
running the real toolchain against the merged tree surfaced two failing
tests in `CreateRequestForClient.test.tsx` (new coverage from a parallel
`PHASE22_TEST_COVERAGE_DELIVERY.md`, not written by Claude). One was a
genuine bug in item 5's own component: the `required` HTML attributes on
the per-row method/amount fields let the browser's native constraint
validation block form submission *before* the component's own
per-publisher JS validation could run — so the friendly error message
was unreachable in a real browser too, not just in tests. Fixed by
removing `required` from those two fields; the JS-level check in
`submit()` is the real validation. The second failure was a test-query
ambiguity, not a component bug (`getByText` matched both the row header
and the commission-preview line, which legitimately both contain the
publisher's name) — fixed the test assertion, not the component.

Full detail: `PHASE24_COUNTER_OFFER_REGRESSION_FIX_DELIVERY.md`

**Files touched:**
`supabase/schema_phase73_restore_counter_offer_and_content_gate.sql`
(new), `supabase/DEPLOY.md` (new deploy section),
`src/components/CreateRequestForClient.tsx` (validation fix),
`src/components/CreateRequestForClient.test.tsx` (test-query fix)

---

## 7. Merge onto the phase23 branch

The upload that prompted item 6
(`ChatSched-phase23-grace-period-expiry.zip`) was, again, a separate
fork — this one built real subscription grace-period tracking:
`schema_phase72_subscription_grace_period.sql` (adds
`grace_period_started_at`, a real `expire-subscription-grace-periods`
scheduled function that moves `grace_period -> suspended`), plus a
refactor pulling the failed-payment status decision out of
`payfast-notify` into a testable `subscriptionLapseDecision.ts`
(`PHASE22_TEST_COVERAGE_DELIVERY.md`,
`PHASE23_SUBSCRIPTION_GRACE_PERIOD_DELIVERY.md` — neither written by
Claude, both legitimate downstream builds on items 1–5 above). Diffed
both trees before touching anything: no functional overlap with the
counter-offer trigger, only a filename collision on `schema_phase72`
(theirs claimed it for grace-period work). Resolved by renumbering
Claude's migration to 73, as in item 6.

---

## 8. Merge from a parallel lineage — 12-channel expansion, grace-period emails (not written by this thread)

A separately-uploaded zip (`CLAUDE_2.0.md`'s own subject) arrived already
containing a large body of work from a different session: five new
channels (Sports, Events, Community, Transport, Associations,
Restaurants, Informal-Retail — 12 total), `schema_phase74`–`78`, real
subscription-lapse transactional emails (Resend), a refactor pulling the
failed-payment status decision out of `payfast-notify` into a testable
`subscriptionLapseDecision.ts`, and two draft pgTAP test files explicitly
marked unverified because that session's own sandbox had no Postgres to
run them against. Full detail in `CLAUDE_2.0.md` — not reproduced here.

---

## 9. Merge from a third lineage — CI wiring, dev-onboarding fix (not written by this thread)

A further upload (`CLAUDE_3.0.md`'s own subject) folded in another
session's work on top of item 8: `.github/workflows/ci.yml` (build/test
gating), `supabase/run-all-migrations.sh` (a scripted path through all
`schema_phase*.sql` in true numeric order, since a plain `ls` sort breaks
past `schema_phase9.sql`), and a `README.md` rewrite pointing new
developers at that script instead of a stale phase-by-phase walkthrough
frozen at Phase 17. Same honesty posture as item 8: explicitly marked
`[DONE, unverified]` in `NEXT_STAGE_DEVELOPMENT_BRIEF.md`'s Task 1 and
Task 4, because that session's sandbox also had no way to run any of it
for real. Full detail in `CLAUDE_3.0.md`.

---

## 10. Real Postgres, for real — Task 1 and Task 4 verified, one genuine production bug found and fixed

This sandbox has something none of the prior ones did: root access and
Ubuntu's package archives in the network allowlist. Installed PostgreSQL
16 and pgTAP directly (`apt-get install postgresql postgresql-16-pgtap`)
and built a minimal Supabase-platform shim — `auth.uid()`/`auth.users`,
the `anon`/`authenticated`/`service_role` roles with the same broad
grants real Supabase gives them, a `storage.objects`/`storage.buckets`
pair with a real `storage.foldername()` implementation — specifically so
this codebase's own real migrations and RLS policies could run unmodified
against it, not a reimplementation.

**Integration first:** the zip this session started from hadn't received
this same conversation's own earlier real-Postgres fixes yet (item 6's
`schema_phase17` generated-column bug, `schema_phase65`'s
return-type-change bug, `CreateRequestForClient.tsx`'s `'reviewed'` vs
`'approved'` status bug) — ported all three in directly, confirmed via
diff that each source file's only difference from the already-fixed
version was that one change.

**Then a new bug, caught immediately:** `run-all-migrations.sh` only
globbed `schema_phase*.sql`, silently skipping `schema_payouts_phase1.sql`,
`schema_payouts_functions.sql`, and `analytics_functions.sql` — three
real files with no `schema_phase` prefix. A developer following the
README's documented path would have ended up with no payout tables at
all. Fixed the script's own file list, then ran it for real: **all 76
files apply cleanly** to a fresh database (excluding `schema_phase32`'s
two `create extension pg_cron`/`pg_net` calls, which need platform-level
preloading this bare instance doesn't have and nothing else depends on —
confirmed via grep, and real Supabase's CLI stack has both preloaded, so
this is specific to the local shim, not the app).

**Both draft pgTAP files from item 8/9 needed real fixes before they'd
pass** — expected, since neither had ever actually run: a
`handle_new_user()` trigger collision (all three test files insert into
`auth.users` directly, which already auto-creates a `profiles` row —
the fixtures then tried to `insert` one too, colliding on the primary
key), a stale `request.jwt.claim.sub` GUC left set to the wrong identity
across a `reset role` (in `compliance_test.sql`, not caught until
directly diagnosing why an admin-visible row read back as invisible to
its own participant), and three assertions using `throws_ok` where
Postgres RLS actually blocks by silently affecting zero rows rather than
raising — each of those three was verified against a fresh, isolated
row before concluding it wasn't a real cross-tenant security gap, not
just assumed safe because the alternative explanation was more
comfortable.

**All 22 assertions in `enforce_channel_request_transition_test.sql`
and all 17 in `rls_channels_publishers_channel_requests_test.sql` now
pass** (17/22, not the original 16/20 — each grew by one when a
`throws_ok` split into `lives_ok` + a follow-up zero-effect check).
Confirmed the suite genuinely catches what it's meant to, not just
structurally resembles a test that would: reintroduced the exact Phase
71 regression (dropped the three `countered` branches from
`enforce_channel_request_transition()`) and watched exactly the 6
counter-offer/content-approval assertions fail while the other 16 kept
passing — then rebuilt the correct schema fresh again before delivery.

**While verifying the third, pre-existing pgTAP file
(`compliance_test.sql`) for the same class of fixture issues, found a
genuine, previously-undiscovered production bug with no connection to
any of this stage's own work:** two storage RLS policies
(`campaign_proof_screenshots_insert_creator` in `schema_phase40`,
`content_approval_assets_insert_creator` in `schema_phase53`) joined
`public.publishers` into the same subquery scope as an unqualified
`storage.foldername(name)` reference. Since `publishers` has its own
`name` column (the publisher's display name), standard SQL scope
resolution bound `name` to `publishers.name` instead of the outer
`storage.objects` row actually being inserted — meaning **creators could
never successfully upload a proof screenshot or a content-approval
asset through either policy**, silently, since the day each migration
shipped. Confirmed the mechanism directly (dumped the compiled policy
expression from `pg_policy`, saw `storage.foldername(p.name)` where it
should never have referenced `p` at all) before touching anything.
Fixed both by restructuring the subquery so the ambiguous reference sits
in a scope with nothing to shadow it — check `campaign_compliance`/
`content_approvals` alone first (neither has a `name` column), nest the
publisher-ownership check separately — mirroring the SELECT-side
policies' own structure, which never had this bug for exactly that
reason. All 28 assertions in `compliance_test.sql` now pass, including
the two storage-upload checks that surfaced this.

**Marked `NEXT_STAGE_DEVELOPMENT_BRIEF.md`'s Task 1 and Task 4
`[COMPLETE]`** — Task 1 with no caveats (everything in its acceptance
criteria was directly, repeatedly verified); Task 4 with one explicit,
undismissed caveat: this sandbox can verify the schema applies
completely and correctly, and that `npm run build` succeeds against it,
but has no PostgREST layer or real Supabase project for the actual
running app to talk to — so "the app runs against it with no
missing-table errors" is only half-verified, and the brief says so
rather than rounding up to a bare `[COMPLETE]`.

Full toolchain also re-confirmed on this merged tree: `npm run build` —
0 type errors; `npm run lint` — 0 errors; `npm test` — 21 files,
161/161 passing.

**Files touched this entry:** `schema_phase17_channel_marketplace.sql`,
`schema_phase65_campaign_packages.sql`, `CreateRequestForClient.tsx`
(ported from item 6, this thread's own earlier fixes),
`run-all-migrations.sh` (missing-files bug), `schema_phase40_proof_screenshots.sql`,
`schema_phase53_content_approval.sql` (the storage RLS fix),
`supabase/tests/compliance_test.sql`,
`supabase/tests/enforce_channel_request_transition_test.sql`,
`supabase/tests/rls_channels_publishers_channel_requests_test.sql`
(fixture fixes), `NEXT_STAGE_DEVELOPMENT_BRIEF.md` (Task 1/4 marked
`[COMPLETE]`).

---

## 11. Task 2 and Task 3 — owner-verification checklist, 12-channel opportunities

**Task 2:** `schema_phase79_publisher_verification_checks.sql` — one row
per publisher (current state, not an audit log; checked first that no
equivalent existed, per the brief's own instruction — `admin_notes` is
one freeform field, `admin_audit_log` is append-only, neither can answer
"what's confirmed right now"). `Admin.tsx`'s `ApplicationCard` now
renders a real checklist from the matching `ChannelModule`'s own
`eligibility.checks` whenever `channels.verification_required` is true
for that publisher's channel — confirmed directly against a live
database that exactly the 7 channels the brief names have it set.
Approving with everything ticked logs a normal `publisher_approved`;
approving with anything left unticked needs an explicit second click and
logs a distinct `publisher_approved_verification_overridden` — both
through the existing `logAdminAction()`, no new logging mechanism.
Checked state persists and pre-fills on a later revisit. RLS confirmed
directly: admin reads/writes, the applicant themselves gets zero rows.

**Task 3:** Investigated the opportunity-marketplace stack expecting
more hardcoding than there actually was — `close_out_accepted_
opportunity()`, the accept-on-application insert logic, both
`CHANNEL_LABEL` maps, the posting form's channel dropdown, and the
feed's own channel-match filter were all already channel-agnostic, built
ahead of the schema. The only real blocker was
`opportunities.channel_slug`'s hardcoded 5-value CHECK constraint.
`schema_phase80_opportunities_all_channels.sql` replaces it with a real
FK against `channels(slug)`, mirroring `schema_phase74`'s exact pattern.
Confirmed directly: posting against `sports` now succeeds where it
previously would have violated the CHECK; a genuinely invalid slug still
correctly fails. Updated two now-stale "not yet postable" comments to
match.

**Full re-verification after both migrations:** all 78 real migrations
apply cleanly to a fresh database (up two from 76); all three pgTAP
suites still fully green (67/67 assertions, no regression); `npm run
build` — 0 type errors; `npm run lint` — 0 errors (same 2 pre-existing
warnings); `npm test` — 21 files, 161/161 passing.

Marked `NEXT_STAGE_DEVELOPMENT_BRIEF.md`'s Task 2 and Task 3
`[COMPLETE]`, with the specific live-database checks that back each
acceptance-criteria claim named inline, not just asserted.

**Files touched:** `schema_phase79_publisher_verification_checks.sql`
(new), `schema_phase80_opportunities_all_channels.sql` (new),
`src/pages/Admin.tsx` (`approvePublisher`, `ApplicationsTab`,
`ApplicationCard`, `loadAll`), `src/pages/BusinessOpportunities.tsx`,
`src/pages/OpportunityFeed.tsx` (stale comments),
`NEXT_STAGE_DEVELOPMENT_BRIEF.md` (Task 2/3 marked `[COMPLETE]`).

---

## 12. Closing CHANNEL_UPDATES_AUDIT.md's first "not done" item — typed onboarding schemas for the remaining 9 channels

A separately-uploaded zip arrived with a new audit doc
(`CHANNEL_UPDATES_AUDIT.md`) describing a parallel session's response to
a "distinct onboarding, dashboards, and marketplace views for all 12
channels" request — a data-driven system (`channelOnboardingSchemas.ts`,
`MarketplaceProfileView.tsx`) rather than 12 forked component trees,
with 3 of 12 channels (podcast, informal-retail, sports) fully wired as
proof, and the other 9 named as an honest, explicit gap. Verified this
zip's diff against the prior delivered state first: clean and additive,
every one of items 1–11's fixes intact.

Extended the proven pattern to the remaining 9 (social-media, website,
influencer, radio, events, community, transport, associations,
restaurants) — the first item on that audit's own "not done" list.
Grounded every field in each channel's actual `advertisingMethods`/
`description` in `src/channels/*/index.ts` (checked all 9 directly)
rather than inventing generic ones — e.g. Website gets
`placementsAvailable`/`monthlyUniqueVisitors` (no follower concept
applies to a website), Transport gets `vehicleCount`/`routesCovered`/
`placementTypesAvailable` (the least "media-shaped" channel in the set,
on purpose). Where two channels are genuinely the same underlying shape,
they share a type instead of a forced-different duplicate: Community's
and Associations' reach-channel enum, and Community's newsletter cadence
reusing Podcast's own frequency enum plus a `"none"` option.

All three integration points, for all 9 channels:
`channelOnboardingSchemas.ts` (9 new interfaces + 9 new
`get*Metadata()` accessors), `PublisherApply.tsx` (9 new `FormState`
field groups, 9 new `buildChannelMetadata()` branches, 9 new form UI
sections, following the exact existing visual pattern), and
`MarketplaceProfileView.tsx` (9 new stats/badges branches). Updated the
now-stale "3 of 12" framing in each file's own header comment, and in
`CHANNEL_UPDATES_AUDIT.md` itself — struck through, not deleted, so the
history of what was proven first and why is still legible.

Full toolchain: `npm run build` — 0 type errors; `npm run lint` — 0
errors (same 2 pre-existing warnings); `npm test` — 21 files, 161/161
passing, no regression.

**Files touched:** `src/lib/channelOnboardingSchemas.ts`,
`src/pages/PublisherApply.tsx`, `src/components/MarketplaceProfileView.tsx`,
`CHANNEL_UPDATES_AUDIT.md` (first "not done" item struck through).

---

## 13. Closing CHANNEL_UPDATES_AUDIT.md's second "not done" item — per-channel dashboard visualization

Picked up the next item on the same audit's list: "the publisher's own
dashboard (`PublisherDashboardView.tsx`) still shows the same view
regardless of channel." Rather than building a second, dashboard-specific
data-driven system alongside item 12's `MarketplaceProfileView`, reused
that exact component directly — the request's own Core Requirement 3
asked for "one dynamic content-rendering system," not one per surface.
`PublisherDashboardView.tsx` now renders `MarketplaceProfileView` right
below the existing `CreatorHomeSummary`, inside a small framing card
("How your listing looks to businesses") so a publisher can see exactly
what a visiting business sees on their own `/browse/:id` page — same
channel-specific stats and badges, same 12-channel coverage item 12 just
finished. No new fetch: `publisher.rating`/`publisher.reviews` were
already loaded on the same object `CreatorHomeSummary` reads, matching
the same fallback `PublisherProfile.tsx` itself uses when it has no
separately-fetched reviews array.

Full toolchain: `npm run build` — 0 type errors; `npm run lint` — 0
errors (same 2 pre-existing warnings); `npm test` — 21 files, 161/161
passing, no regression.

**Files touched:** `src/components/PublisherDashboardView.tsx`,
`CHANNEL_UPDATES_AUDIT.md` (second "not done" item struck through).

---

## 14. Closing CHANNEL_UPDATES_AUDIT.md's third item — the dual-role feature's narrow scope

Picked up the third item: the publisher-can-also-be-a-business toggle in
`Dashboard.tsx` showed only `BusinessHomeSummary` + two links, not the
full business experience (onboarding checklist, marketing suite,
campaign rollup, managed campaigns, request/channel-request lists) —
named at the time as a deliberate first-pass scope limit, not a bug.

Extracted the primary business view's entire body (everything below the
page-level "Your dashboard" heading) into one new component,
`BusinessDashboardBody`, and had both the primary business view and the
publisher-role toggle render it — one shared body, not two maintained
copies of the same ~70 lines of JSX. Checked first, not assumed, that
nothing inside that body actually requires a business-role account:
`ManagedCampaignsSection`, `CampaignRollup`, `MarketingSuite` take no
props at all (self-fetching, keyed on `auth.uid()`), and
`computeBusinessChecklist` has no `profile.role` reference anywhere —
confirming the original session's own data-layer finding (item in
`CHANNEL_UPDATES_AUDIT.md`'s "Publisher-can-also-be-a-business" entry)
that a publisher-role account could always act as a business at the data
layer, this was purely a UI gate.

Full toolchain: `npm run build` — 0 type errors; `npm run lint` — 0
errors (same 2 pre-existing warnings); `npm test` — 21 files, 161/161
passing, no regression.

**Files touched:** `src/pages/Dashboard.tsx` (new
`BusinessDashboardBody` component, both call sites updated),
`CHANNEL_UPDATES_AUDIT.md` (third "not done" item struck through).

---

---

## 15. Closing CHANNEL_UPDATES_AUDIT.md's last real gap — admin visibility into channel_metadata

**This upload** (`ChatSched-dual-role-full-dashboard.zip`) — checked first,
not assumed: independently re-ran the full toolchain (`npm run build`,
`npm run lint`, `npm test`) and spot-verified the specific claims in
items 12–14 directly against the actual files (`grep`-counted 12
interfaces and 12 accessor functions in `channelOnboardingSchemas.ts`,
confirmed `PublisherDashboardView.tsx` imports and renders
`MarketplaceProfileView`, confirmed `Dashboard.tsx` has a real
`BusinessDashboardBody` used at both call sites) before trusting the log
above at all — same discipline item 12 itself used on the zip that
preceded it. All confirmed genuine.

Picked up `CHANNEL_UPDATES_AUDIT.md`'s one remaining named gap:
"`Admin.tsx`'s publisher-review screen doesn't yet surface the 12
channels' extra fields for a reviewer to see." Added
`getOnboardingSummaryFields()` to `channelOnboardingSchemas.ts` — one
generic formatter flattening whichever of the 12 typed schemas matches a
given publisher into label/value pairs, same "one function decides
content" pattern `MarketplaceProfileView.tsx` already established rather
than 12 near-identical admin-side branches. `Admin.tsx`'s
`ApplicationCard` renders every field in a compact panel below the
business-registration details — deliberately all of them, not a curated
subset, since a reviewer judging an application's plausibility needs the
full picture. Kept genuinely separate from Task 2's `eligibility.checks`
checklist, which already had its own section: one answers "did we
confirm these yes/no gates," the other "what did the applicant actually
tell us" — different questions, so not merged into one section.

Full toolchain: `npm run build` — 0 type errors; `npm run lint` — 0
errors (same 2 pre-existing warnings); `npm test` — 21 files, 161/161
passing, no regression.

Also found, read but not yet actioned: `PRE_PRODUCTION_FIXES.md`, a
separate, large independent full-product audit (security, testing,
accessibility, and more categories not yet read in this entry) — real,
substantive, but a materially different scope than the one named request
this entry was scoped to. Left for its own pass rather than folded in
here partially.

**Files touched:** `src/lib/channelOnboardingSchemas.ts`
(`getOnboardingSummaryFields()`, new), `src/pages/Admin.tsx`
(`ApplicationCard` — new panel, one new import),
`CHANNEL_UPDATES_AUDIT.md` (last remaining item struck through).

---

## Toolchain status as of the end of this log

Run for real, against a real Postgres 16 instance and this repo's own
`npm` toolchain — not reasoned about, not deferred:

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 errors |
| `npm test` | ✅ 21 test files, 161/161 passing |
| All 78 real `supabase/*.sql` migrations | ✅ apply cleanly to a fresh database |
| `enforce_channel_request_transition_test.sql` | ✅ 22/22 assertions passing |
| `rls_channels_publishers_channel_requests_test.sql` | ✅ 17/17 assertions passing |
| `compliance_test.sql` | ✅ 28/28 assertions passing |
| `opportunities.channel_slug` accepts all 12 channels | ✅ confirmed directly (insert against `sports`; invalid slug still rejected) |
| `publisher_verification_checks` RLS | ✅ confirmed directly (admin read/write; applicant sees zero rows) |
| All 12 channels have typed onboarding schemas | ✅ (item 12 — was 3/12) |
| Publisher dashboard shows channel-specific stats | ✅ (item 13 — reused `MarketplaceProfileView`) |
| Publisher toggle shows the full business dashboard body | ✅ (item 14 — reused `BusinessDashboardBody`) |

---

## 16. Going through PRE_PRODUCTION_FIXES.md — found its Button/currency claims didn't match this upload

Same discipline every prior item claims to use, applied to this session's
own inherited document rather than just to incoming uploads: before
picking up PRE_PRODUCTION_FIXES.md's priority list, checked whether its
"already fixed" claims actually held in these files. Two didn't —
`src/components/Button.tsx` and `src/lib/currency.ts` were both described
as built (with specific migrated-file lists and a specific bug found
while building the first one), and neither file existed anywhere in this
upload. The *problems* both described were real and independently
re-confirmed (65 occurrences of the button className pattern via
`grep -rn`, not 60 — 5 more sharing an undocumented third "dark-filled"
variant; 9 real occurrences of the currency locale-drift bug). The
*fixes* weren't there. Most likely explanation, consistent with this
whole project's history: real work done on a branch or session that
didn't make it into this particular zip, not a fabricated entry —
corrected `PRE_PRODUCTION_FIXES.md` in place rather than silently
building on top of, or silently redoing, a claim that didn't match reality.

Built `Button.tsx` fresh from that document's own description, treated as
a spec rather than trusted as a completed account: 3 variants
(`outline`, `primary`, and `dark`, the last found while migrating real
call sites, not in the original count), `focus-visible:ring-2` baked in.
Migrated 10 real call sites across 6 files — `ExportCsvButton.tsx`,
`SaveSearchButton.tsx` (all 3 of its sites), `CreatorHomeSummary.tsx`,
`BusinessHomeSummary.tsx`, `CreateRequestForClient.tsx` (2 sites — its
dark submit button needed an explicit `type="submit"` added, since
`Button`'s default is `type="button"`, unlike a bare `<button>` inside a
form silently defaulting to submit; checked its form context before
assuming that swap was safe), `PublisherDashboardView.tsx` (2 sites — its
borderless-text "Cancel" link deliberately left alone as a genuinely
different, one-off style). **54 outline and 3 dark occurrences remain
across roughly 20 files** — real, mechanical, unstarted work, not
attempted further in this entry given the size already covered.

`currency.ts`/`formatCurrency()` — corrected the document's claim, did
not build it this entry. Named clearly as the next well-scoped pickup,
not attempted alongside the Button work at the same level of care within
one session.

Full toolchain, real: `npm run build` — 0 type errors; `npm run lint` —
0 errors, same 2 pre-existing warnings; `npm test` — 21 files, 161/161,
no regression from the button migrations.

**Files touched:** `src/components/Button.tsx` (new), `ExportCsvButton.tsx`,
`SaveSearchButton.tsx`, `CreatorHomeSummary.tsx`, `BusinessHomeSummary.tsx`,
`CreateRequestForClient.tsx`, `PublisherDashboardView.tsx`,
`PRE_PRODUCTION_FIXES.md` (two corrections).

---

---

## 17. Currency migration — building what item 16 correctly declined to rush

Same document, next pickup, this time given proper room rather than
squeezed alongside the Button work. Verified independently before
building anything, same as always: real drift confirmed in exactly 3
files (`AdminAnalytics.tsx`, `BusinessOpportunities.tsx`,
`OpportunityFeed.tsx`, all using `n.toLocaleString(undefined, ...)`) and
5 more duplicating the same explicit-`"en-ZA"` logic without being
actively buggy. Two files a naive `grep` for `"en-ZA"` also caught —
`Admin.tsx`, `AdminCareers.tsx`, plus `CommunityEvents.tsx` — turned out
to be `Date.toLocaleString("en-ZA")` calls on inspection, not currency;
left alone rather than migrated on a pattern match that didn't actually
apply.

Built `src/lib/currency.ts` — `formatCurrency()`/`formatCurrencyRange()`.
Ran the real `Intl.NumberFormat("en-ZA", ...)` output through Node before
documenting it, rather than assuming: it's `"R\u00a012\u00a0500"`
(U+00A0 non-breaking space as both the currency-symbol gap and the
thousands separator, comma as decimal) — not the `"R12,500"` this
function's own first draft assumed and had to correct in its own doc
comment before this entry was done. Wrote `currency.test.ts` to pin that
exact output — 5 tests, checked the literal Unicode code points in Node
first so the test wasn't guessing either.

Migrated 14 real call sites across 13 files: the 3 genuine drift bugs,
the 5 duplicated-but-not-buggy ones, plus 6 more found while auditing
rather than stopping at the originally-flagged set —
`MarketplaceProfileView.tsx` and `channelOnboardingSchemas.ts`'s own
admin-summary formatter (this session's own recent work, not exempt for
being recent), `PublisherProfile.tsx`'s SEO description, a second
genuine `undefined`-locale drift bug in `Browse.tsx` **and**
`browseFilters.ts` (the same price-filter label duplicated in two
places), and `Fees.tsx`/`Faq.tsx`'s remaining inline examples.

**18 files still have a raw, unformatted display** —
`BankDetailsPanel.tsx`, `ChannelCampaignCard.tsx`,
`ManagedCampaignsSection.tsx`, `PublisherDashboardView.tsx`,
`RateCardManager.tsx`, `SubscriptionSection.tsx`, all three
`marketingSuite/` components, `authenticitySignals.ts`,
`marketingSuite.ts`, `Admin.tsx`, `AdminCampaigns.tsx`,
`CampaignWorkspace.tsx`, `Dashboard.tsx`, `PublisherApply.tsx` — a
smaller, re-verified list, not copied from either of `PRE_PRODUCTION_
FIXES.md`'s own earlier, now-corrected estimates (15 migrated/70
remaining across 33 files). Genuinely mechanical from here.

Full toolchain: `npm run build` — 0 type errors; `npm run lint` — 0
errors, same 2 pre-existing warnings; `npm test` — 22 files, 166/166,
+1 file/+5 tests from `currency.test.ts`, no regression.

**Files touched:** `src/lib/currency.ts` (new), `currency.test.ts`
(new), `AdminAnalytics.tsx`, `BusinessOpportunities.tsx`,
`OpportunityFeed.tsx`, `CreatorHomeSummary.tsx`, `mediaKit.ts`,
`invoice.ts`, `EarningsDashboard.tsx`, `Fees.tsx`,
`MarketplaceProfileView.tsx`, `channelOnboardingSchemas.ts`,
`PublisherProfile.tsx`, `Browse.tsx`, `browseFilters.ts`, `Faq.tsx`,
`PRE_PRODUCTION_FIXES.md` (currency section corrected and updated).

---

---

## 18. Finishing the currency migration — the remaining 16 files

Straight continuation of item 17, no new investigation needed — the file
list and the tool were already known, this was execution. Migrated all
16: `BankDetailsPanel.tsx`, `ChannelCampaignCard.tsx`,
`ManagedCampaignsSection.tsx`, `PublisherDashboardView.tsx`,
`RateCardManager.tsx`, `SubscriptionSection.tsx`, all three
`marketingSuite/` components, `authenticitySignals.ts`,
`marketingSuite.ts`, `Admin.tsx`, `AdminCampaigns.tsx`,
`CampaignWorkspace.tsx` (4 sites, two of them byte-identical lines —
migrated by exact line number via script rather than `str_replace`,
which requires a unique match and would have failed or hit the wrong
one), `Dashboard.tsx`, `PublisherApply.tsx`.

Three more genuine `undefined`-locale drift bugs found in this batch,
not just raw-display cleanup — `BankDetailsPanel.tsx`,
`ManagedCampaignsSection.tsx`, `marketingSuite/RoiCalculator.tsx` — for
6 total across the two entries, not the 2 either document originally
named. Final, verified count for the whole migration: 30 call sites
across 22 files. `grep -rlE` for the raw-display pattern across all of
`src` now returns nothing outside `currency.test.ts`'s own expected
strings — checked directly, not assumed from the file list being
exhausted.

**One real mid-task correction worth recording plainly:** the previous
turn ended with `AdminCampaigns.tsx` edited but its `formatCurrency`
import not yet added — a genuinely broken intermediate state, reported
as such rather than glossed over, and fixed first in this entry before
anything else.

Full toolchain: `npm run build` — 0 type errors; `npm run lint` — 0
errors, same 2 pre-existing warnings; `npm test` — 22 files, 166/166, no
regression, no new tests needed (no new pure-function logic, only call-
site substitutions into an already-tested formatter).

**Files touched:** the 16 listed above, plus `PRE_PRODUCTION_FIXES.md`
(currency section closed).

---

## Open items (genuinely still outstanding, not yet done)

- **No PostgREST/real-Supabase-project verification.** This sandbox can
  run raw Postgres directly but has no Docker and no network path to a
  hosted Supabase project, so the actual client-facing API layer
  (`supabase-js` talking to PostgREST, not raw SQL) has never been
  exercised end-to-end. Flagged explicitly in Task 4's entry rather than
  left implicit.
- **`schema_phase32`'s `pg_cron`/`pg_net` extensions never verified
  locally** — this bare Postgres instance doesn't have either preloaded;
  real Supabase's CLI stack does, so `.github/workflows/ci.yml`'s
  `db-tests` job should apply it cleanly, but that's inference from how
  the platform works, not something this session watched happen.
- **No automated coverage for the storage RLS policies** fixed in item
  10 — same standing gap as `enforce_channel_request_transition()` had
  before item 6/10's own tests existed for it.
- **No automated coverage for the Task 2 checklist/override flow or the
  Task 3 opportunities FK** — both verified manually against a live
  database this session, but neither has a pgTAP test of its own the way
  item 10's fixes do. Worth adding given the storage-RLS bug in item 10
  was found by exactly that kind of direct verification, not by an
  existing test.
- **`CHANNEL_UPDATES_AUDIT.md`'s remaining item** — nothing in this whole
  area has been exercised in a real browser (admin visibility into
  `channel_metadata` closed in item 15).
- **`PRE_PRODUCTION_FIXES.md`** — Button (item 16) and currency (items
  17-18) both gone through. Currency fully closed: `formatCurrency`/
  `formatCurrencyRange` are the only currency formatting anywhere in this
  codebase now, verified by a zero-match `grep` sweep. Genuinely still
  open: 54 outline + 3 dark Button occurrences across ~20 files;
  everything else in that document not yet gone through at all (its own
  Security, Testing, Performance, SEO, Legal, and DevOps sections beyond
  what items 16-18 touched).
