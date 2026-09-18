MERGE SUMMARY — This session's work (items 14–25 + activity timeline)
reapplied onto ChatSched-fix8-atomic-opportunity-acceptance
======================================================================

This document is specific to this merge — it does not replace or
duplicate "claude fixes Sept 2.txt" (this session's own fix log, carried
over unchanged) or this codebase's own "claude fixes Sept 1–8" logs
(a separate, independent history — see the note below).

----------------------------------------------------------------------
1. What this merge actually was
----------------------------------------------------------------------
The uploaded codebase (ChatSched-fix8-atomic-opportunity-acceptance) and
the one this session's items 14–25 + activity timeline were built on
share an identical common ancestor through schema_phase80 (verified
byte-for-byte), then diverged: this session went 81→84 (delete-account
retention, public-form rate limiting, channel-launch revert, realtime for
channel_requests), while this codebase's own separate lineage went
81→89 (role-escalation prevention, restricting public publisher columns,
secure payout RPCs, safe cross-party profile access, retiring direct
messaging, once-off activation pricing, featured placement subscriptions,
atomic launch-credit redemption, atomic opportunity acceptance).

This was a real two-way merge — checking every file this session touched
against both the original starting point and this codebase, reconciling
by hand wherever both sides had changed the same file — not a copy-over.

----------------------------------------------------------------------
2. File-level results
----------------------------------------------------------------------
- 60 files: untouched by this codebase's own lineage — this session's
  final versions applied directly.
- 7 files were genuine conflicts (both lineages changed them), resolved
  individually, none by blind overwrite:
  - src/hooks/usePublishers.ts — this codebase moved the query from
    `publishers` to a `publishers_public` view; this session's fix
    (wrapping the error via formatSupabaseError) applied on top, applies
    to the new query path.
  - src/components/PublisherDashboardView.tsx — this codebase replaced a
    `business:profiles(...)` embed with fetchBusinessContacts() in one
    function; this session's changes (7 formatSupabaseError call sites,
    the CampaignActivityTimeline addition, a currency-range fix) were in
    different functions entirely — merged via a fuzzy-matched unified
    diff, verified afterward that both sets of changes are present.
  - src/pages/Messages.tsx — this codebase substantially repositioned
    this page (direct messaging being retired in favor of campaign-
    specific chat); this session's one-line fix (formatSupabaseError on
    the conversation-list error) was on an untouched line, reapplied
    directly.
  - src/components/SubscriptionSection.tsx — this codebase's own "once-
    off activation pricing" rework had already fixed two of this
    session's three intended currency-formatting fixes independently
    (and removed the self-service cancel flow that contained the third).
    Only the "Launch credit" line still needed the fix — applied.
  - src/pages/AdminAnalytics.tsx, src/pages/Press.tsx,
    src/pages/ReachChecker.tsx — non-overlapping changes, merged via
    unified diff with a small line-offset (fuzzy match), verified each
    landed correctly afterward.
- 1 new file (src/components/CampaignActivityTimeline.tsx) added; its
  dependencies (ChannelRequest/ContentApproval types, RLS policy names,
  getContentApproval helper) were independently re-verified against this
  codebase's current schema, not assumed unchanged.
- 8 other new files (this session's scripts, the two new Supabase
  functions, vercel.json) copied in directly — none collided with an
  existing file of the same name.
- supabase/DEPLOY.md: this session's two added sections (security
  headers, dynamic sitemap) appended to this codebase's current version
  of that file, after confirming this session's own edit to it was a
  pure append with nothing else touched.
- 4 new SQL migrations, renumbered 81→84 to 90→93 (this codebase's own
  lineage had already taken 81–89 for unrelated work) — content
  unchanged, only the header comments' phase numbers and "run after"
  predecessor references updated to fit the real sequence.

----------------------------------------------------------------------
3. A real bug this merge caught and fixed, not just avoided
----------------------------------------------------------------------
scripts/generate-sitemap.mjs (this session's item 25) queried the base
`publishers` table directly with the anon key, relying on that table's
own RLS to restrict results to approved publishers. This codebase's own
phase82 migration (schema_phase82_restrict_public_publisher_columns.sql)
removed anonymous/public access to the base table entirely, replacing it
with a `publishers_public` view built for exactly this kind of public
read. Merging the sitemap script without checking this would have left
it silently returning zero publishers on every future build — not an
error, just an empty result, exactly the kind of gap that looks fine
until someone checks the actual sitemap output. Fixed: the script now
queries `publishers_public`, and both its own comment and the
corresponding DEPLOY.md section were updated to describe the real
current access path instead of the policy name that no longer applies.

----------------------------------------------------------------------
4. A second thing the merge surfaced: this session's own new lint rule
   found a real violation in this codebase's newer code
----------------------------------------------------------------------
This session's currency-formatting check (scripts/check-currency-
formatting.mjs, now part of `npm run lint`) had never run against this
codebase before. On the first run after merging, it correctly caught one
real violation this codebase's own "featured placement subscriptions"
feature (phase87) had introduced — a raw `R${FEATURED_PLACEMENT_MONTHLY_PRICE}`
in src/lib/constants.ts, predating this session's check entirely. Fixed
directly (routed through formatCurrency()) since this session's own
tooling was what surfaced it and would otherwise fail this codebase's
build — not an unrelated drive-by change.

----------------------------------------------------------------------
5. Verification performed on the merged result
----------------------------------------------------------------------
- npm install — succeeds.
- npx vitest run — 175 tests, all passing (this is this codebase's own,
  larger test suite — not this session's 201, which covered different
  work).
- npx tsc -b — 8 pre-existing type errors, ALL confirmed pre-existing in
  the untouched original upload (checked directly against a pristine
  re-extraction of the zip, not assumed): 3 in BuildMyCampaign.tsx and 2
  in campaignRecommendation.test.ts (already known from this session's
  own earlier work — same errors, same cause); 3 more newly found in
  this merge (src/pages/Admin.tsx ×2 lines, src/components/
  PublisherDashboardView.tsx — `r.business?.phone` and
  `computeVerificationLevel(r.business)` used where the type is now a
  narrower `Pick<Profile, ...>` after this codebase's own phase84 profile-
  access change) — confirmed present verbatim in the pristine upload
  before any merge activity touched those files, so not introduced by
  this merge. Not fixed, per the same reasoning items 17–19 used for the
  first 5: fixing someone else's unrelated, pre-existing type gap isn't
  this merge's job.
- npx vite build — succeeds cleanly (this is the real build check, since
  tsc -b's pre-existing errors block the full `npm run build` chain from
  ever reaching vite — a pre-existing condition, not something this merge
  caused or could fix without taking on that unrelated work).
- npm run lint — 0 errors after the one fix in section 4 (2 pre-existing,
  unrelated warnings about `.then()` on test-mock objects remain, not
  from this merge).
- Both postbuild scripts (generate-security-headers.mjs, generate-
  sitemap.mjs) run successfully against a real build of the merged code.
- No new environment variables introduced — the only two this session's
  code needs (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) were already in
  .env.example.
- No `@/`-style path aliases exist anywhere in this project (checked) —
  it uses relative imports throughout, including everything this session
  added: nothing to reconcile there beyond the build itself succeeding,
  which it does.

----------------------------------------------------------------------
6. What this merge deliberately did not do
----------------------------------------------------------------------
- Did not touch, review, or attempt to reconstruct this codebase's own
  "claude fixes Sept 1–8" history — that's a separate, complete body of
  work from a different session lineage, already present and untouched
  in this merge.
- Did not fix the 8 pre-existing type errors described in section 5 —
  confirmed pre-existing, out of scope for "reapply this session's
  changes."
- Did not re-audit this codebase's newer features (subscriptions, agency
  CRM, atomic opportunity acceptance, etc.) against items 14–25's
  concerns — only checked the specific overlap points that this
  session's own changed files or new tooling actually touched or
  surfaced.
