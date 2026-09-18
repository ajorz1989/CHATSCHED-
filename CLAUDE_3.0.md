# CLAUDE 3.0 — Session Handoff Log

Same convention as `CLAUDE_1.0.md` and `CLAUDE_2.0.md`: a running,
chronological record of what happened in this session, appended to as it
continues, not rewritten. Read those two first — this file assumes them
and doesn't repeat their content.

**This file is appended to, not rewritten, as this session continues.**

---

## 1. What this session integrated, from a separate lineage

Separate chat, separate fork — same shape as `CLAUDE_2.0.md`'s item 1/2.
That lineage's own `CLAUDE_3.0.md` (not this file — same filename,
different product) had, past what `CLAUDE_1.0.md`/`2.0.md` here already
cover: an isiZulu/isiXhosa non-native review pass, and an in-progress,
not-yet-typechecked subscription-lapse email feature. Diffed both trees
file by file before touching anything, the same discipline `CLAUDE_1.0.md`
item 7 and `CLAUDE_2.0.md` item 2 already used for prior merges — not
assumed compatible just because both lineages descend from the same
subscription/grace-period work.

**Confirmed clean base first:** `payfast-notify/index.ts`,
`expire-subscription-grace-periods/index.ts`, and
`subscriptionLapseDecision.ts` in that lineage were byte-for-byte
identical to this product's own versions *before* that session's edits —
confirmed with `diff`, not assumed from either lineage's own account of
its history. That's what made porting the diff safe rather than a guess:
the two functions had genuinely converged on the same code (both descend
from `CLAUDE_1.0.md` item 7's merge of the grace-period work), so there
was no risk of silently reverting something this product's own history
added that the other lineage never saw.

**Ported in:**
- `supabase/functions/_shared/resend.ts` (new) — thin wrapper around the
  Resend send call, extracted so the two new call sites below don't
  duplicate `notify/index.ts`'s and `expire-channel-requests/index.ts`'s
  existing inline fetch boilerplate a third and fourth time.
- `supabase/functions/_shared/subscriptionLapseEmail.ts` (new) — pure,
  unit-tested email-content builder for the two subscription-lifecycle
  transitions that were previously silent: entering `grace_period` and
  reaching `suspended`. Deliberately doesn't cover `past_due` (PayFast's
  own retry gets a first shot, unannounced, same as it already was) or
  `cancelled` (already not the same missing-context problem — the
  account holder either clicked cancel themselves or acted on PayFast's
  own site).
- `supabase/functions/_shared/subscriptionLapseEmail.test.ts` (new) — 8
  assertions: grace-period vs. suspended wording differs correctly,
  launch-credit language appears for business accounts and never for
  publisher accounts, the manage-subscription link is omitted (not
  linked to a bare `/account`) when `siteUrl` is empty, subjects are
  distinguishable in an inbox.
- `supabase/functions/_shared/notifySubscriptionLapse.ts` (new) —
  look up the account holder's email + build + send, factored out once
  so the two call sites below can't drift from each other.
- `supabase/functions/payfast-notify/index.ts` — both `FAILED` branches
  (business and publisher) now email on a *fresh* entry into
  `grace_period` (guarded by the same `enteringGracePeriod` boolean that
  already gates `grace_period_started_at`, reused rather than
  re-checked, so the two conditions can't diverge).
- `supabase/functions/expire-subscription-grace-periods/index.ts` — now
  emails every business/publisher it moves to `suspended`, after the
  status update and credit forfeiture have already committed — same
  "never make a failed email look like the action itself failed" posture
  `expire-channel-requests`' own `notifyBusiness` already established.
- `src/i18n/locales/zu/home.json` — the other lineage's isiZulu review
  pass, three fixes (a duplicated-word typo in `seo.description`, a
  one-off `"Ukubrawuza"` neologism reverted to the established
  `"Ukubhuka"`, `"Umdidiyeli"` corrected to `"Umphembeleli"` for the
  Influencer category label so it stops conflating with the general
  "creator" term). Diffed and confirmed byte-identical to the source
  lineage's file after copying, then re-validated as parseable JSON.
- `README.md` — the one localization bullet updated to describe the
  review that happened, same wording as the source lineage's own fix to
  its copy of this file.

**Verified, not just copied:** every new/touched TypeScript file above
type-checks cleanly under `tsc --strict` (Deno/`esm.sh` imports stubbed
locally, since this sandbox has no network to resolve them for real —
same limitation the source lineage's own session flagged before handing
this off mid-typecheck). The one pre-existing error surfaced while
checking `payfast-notify.ts`'s import chain
(`_shared/payfast.ts`'s `node:crypto` import needing `@types/node`) is
unrelated to anything touched this session — confirmed by checking it
against `payfast.ts` unmodified, not assumed harmless.

**Not ported, deliberately:** nothing else from that lineage — the
12-channel universal architecture (`CLAUDE_2.0.md` items 3–9 here) has no
counterpart there, and that lineage's own subscription/grace-period work
was already this product's own (per the byte-identical check above), so
there was nothing else to reconcile.

**Files touched this session (item 1):**
`supabase/functions/_shared/resend.ts` (new),
`supabase/functions/_shared/subscriptionLapseEmail.ts` (new),
`supabase/functions/_shared/subscriptionLapseEmail.test.ts` (new),
`supabase/functions/_shared/notifySubscriptionLapse.ts` (new),
`supabase/functions/payfast-notify/index.ts`,
`supabase/functions/expire-subscription-grace-periods/index.ts`,
`src/i18n/locales/zu/home.json`, `README.md`.

---

## 2. Task 1 (pgTAP + CI) — started, not finished

`NEXT_STAGE_DEVELOPMENT_BRIEF.md` Task 1, taken first since the brief's
own "Do First" ordering and Task 1's own framing (catch the exact class
of regression `schema_phase71`/`73` already produced once) made it the
clear starting point.

- **`supabase/tests/enforce_channel_request_transition_test.sql`** (new,
  20 assertions) — every branch of the trigger: the subscription gate on
  accepting (and that a *lapsed* subscription still blocks it), that
  decline and counter are deliberately NOT subscription-gated, the full
  restored counter-offer cycle (counter → business accepts or declines
  it), the restored content-approval gate on going live (no
  `content_approvals` row, an unapproved one, an approved one), baseline
  business/admin transitions untouched by the regression, and
  cross-user rejection. Written directly against
  `schema_phase73_restore_counter_offer_and_content_gate.sql`'s actual
  function body — re-read in full rather than worked from either prior
  log's summary of it, the same discipline that log's own item 6 says
  the original regression needed and didn't get.
- **`supabase/tests/rls_channels_publishers_channel_requests_test.sql`**
  (new, 16 assertions) — the RLS policies themselves on `channels`
  (public read, admin-only write), `publishers` (approved rows public,
  `pending_review` rows owner/admin only, insert must be self-directed
  and can't self-approve on insert), and `channel_requests` (select
  limited to participants/admin, insert must be self-directed and must
  start at `pending`). Deliberately doesn't re-test
  `channel_requests_update_participant`'s permissive `USING` clause in
  depth — intentionally broad by that policy's own design comment, the
  trigger test file above is where the real gate is exercised.
- **`supabase/run-all-migrations.sh`** (new) — applies `schema.sql` then
  every `schema_phase*.sql` against `$DATABASE_URL` in correct *numeric*
  order (a plain sort gets `schema_phase17` before `schema_phase2`
  wrong). Also functions as a first, partial answer to Task 4's option
  (b), since Task 1's own CI needs a scriptable way to stand up a
  database and none existed yet — not a full Task 4 delivery (the
  README rewrite Task 4 also asks for hasn't happened), but genuine
  progress on it. The numeric-sort logic was dry-run against the actual
  74 `schema_phase*.sql` filenames in this repo and confirmed to produce
  a strictly increasing order (gaps at 4/8/10 are pre-existing retired
  numbers, not files this script is missing) — the script itself has NOT
  been run against a real database.
- **`.github/workflows/ci.yml`** — new `db-tests` job, gated on
  `github.event_name == 'pull_request'` AND a diff touching
  `supabase/*.sql` or `supabase/tests/**`, so it doesn't add overhead to
  every PR. Uses `supabase/setup-cli@v1` → `supabase start` → this
  session's own `run-all-migrations.sh` → enables `pgtap` → `supabase
  test db`.
- **`supabase/tests/README.md`** — documented both new test files: what
  they cover, what they deliberately don't (and why), how to run them.

**HONESTY NOTE, load-bearing, not a formality:** none of the above has
been run against a real Postgres instance or a real GitHub Actions
runner. This sandbox has no Docker, `psql`, or Supabase CLI — checked
directly (`which docker psql supabase pg_config` all came back empty),
same limitation `supabase/tests/compliance_test.sql` already documented
before this session existed. What *was* verified in this sandbox:

- The two new `.sql` test files were reviewed line by line against the
  actual `create policy`/`create or replace function` statements they
  test, not written from memory of what those should contain — the exact
  mistake that produced the `schema_phase71` regression this whole task
  exists to catch a recurrence of.
- Assertion counts in each file's `plan(N)` were counted programmatically
  against the file's own `select is(`/`ok(`/`lives_ok(`/`throws_ok(`
  calls and confirmed to match (20 and 16 respectively) — a mismatched
  plan count is one of the more common ways a pgTAP file fails on its
  first real run for a reason that has nothing to do with the schema
  under test.
- `run-all-migrations.sh`'s ordering logic was dry-run (not executed
  against a database — just the `sed`/`sort`/`cut` pipeline that
  produces the apply order) against the real file list and confirmed
  correct.

The first real `supabase test db` run against a live instance is the
actual test of whether any of this is correct — everything above reduces
the chance of an obvious mistake surfacing there, it doesn't replace that
run.

**Files touched this session (item 2):**
`supabase/tests/enforce_channel_request_transition_test.sql` (new),
`supabase/tests/rls_channels_publishers_channel_requests_test.sql` (new),
`supabase/tests/README.md`, `supabase/run-all-migrations.sh` (new),
`.github/workflows/ci.yml`.

---

## 3. Task 4's README half, closed out

`run-all-migrations.sh` (item 2) made this the natural next small piece:
the script existed, but the README still told a new developer to stop at
`schema_phase17`, exactly the gap `NEXT_STAGE_DEVELOPMENT_BRIEF.md` names
as a critical issue.

**`README.md` changes:**
- **"Setup (one-time)"** — step 2 now offers two explicit paths: the
  script (recommended, applies every phase) or the original single-file
  `schema.sql` (explicitly relabeled "minimal/quick start... none of the
  phases below," so it can't be mistaken for a complete setup anymore).
- **New "If you ran the full migration script" note** — tells anyone who
  used the script to skip the individual "Setup — Phase 2/3"/"Phase 17"
  SQL-editor steps (already covered) but still follow `DEPLOY.md` for
  Edge Function deploys, since the script only ever applies SQL, never
  deploys functions or sets secrets.
- **The Phase 17 section's own header** — now says directly that this is
  where the README's sequential walkthrough historically stopped, 61
  migrations short, and that everything from here on (including this
  section itself) is feature documentation to read, not a checklist to
  run by hand for a new setup.

**Deliberately not done:** a full section-by-section README rewrite
narrating what each of phases 18–78 built, the way Phase 2/3/4/17 are
narrated. That's real, separate work the brief itself scopes as bigger
than "fix the setup path" — the script closes the *setup* gap (a new
developer's database ends up complete), not the *documentation* gap (a
developer understanding what's in it prose-first still has to read
`CLAUDE_1.0.md`/`2.0.md`/`3.0.md` and the individual `PHASE*_DELIVERY.md`
files, same as before this entry).

**Not run against a real project** — same honesty note as item 2. The
script's ordering was dry-run and confirmed against the real file list;
neither the script nor the README's new instructions have been followed
end-to-end against an actual clean Supabase project.

**Files touched this session (item 3):** `README.md`.

---

## Toolchain

**Not run for real**, same reason as above — no network/Docker in this
sandbox to run `npm ci`, `supabase start`, or a real GitHub Actions job.
What was checked instead: every new/touched TypeScript file (item 1) and
this session's own new files under `supabase/functions/` type-check
cleanly under `tsc --strict` with Deno/`esm.sh` imports stubbed locally
(see item 1's own note); the two new `.sql` test files were reviewed by
hand and their `plan()` counts verified against their own assertion
counts; `run-all-migrations.sh`'s ordering logic was dry-run against the
real filenames, not against a database.
`npm run build && lint && test`, and a real `supabase test db` run,
should both happen for real the next time this reaches an environment
with network/Docker access — the same thing every phase in every lineage
in this product has had to say at some point.

## Open items (carried forward, plus this session's own)

Everything `CLAUDE_2.0.md`'s "Open items" pointed at
`NEXT_STAGE_DEVELOPMENT_BRIEF.md`'s own findings section for — not
re-listed here, same reasoning that entry gave, to avoid the two
documents drifting apart.

Specific to this session:
- **Task 1 needs a real run.** Everything in item 2 above is hand-reviewed,
  not executed. Until it runs once against a live Postgres instance and
  the pgTAP output is actually read, none of it is confirmed correct —
  see the honesty note above.
- **Task 1's own acceptance criterion** ("a PR that reintroduces the
  Phase 71 regression fails CI") is untested for the same reason — the
  CI job itself has never executed.
- **Task 4's script and README half also need a real run** — a genuinely
  clean Supabase project, set up only by following the new "Setup
  (one-time)" instructions, is Task 4's own acceptance criterion and
  hasn't been attempted (item 3).
- **Task 4's documentation half is still open** — the README rewrite
  fixes the *setup* path, not a section-by-section narrative of phases
  18–78 the way 2/3/4/17 have one. Not attempted this session; a
  genuinely large undertaking on its own.
- **Tasks 2 and 3 not started at all.**

## Moving forward, from this session

1. **Get Task 1 and Task 4 actually run**, once this reaches an
   environment with Docker/network — `supabase start`, apply migrations
   via the new script (also exercises Task 4's own acceptance criterion
   directly), `create extension pgtap`, `supabase test db`, read the
   actual output. Fix whatever the new test files or the script get
   wrong on a real database — some mismatch on a first real run is
   likely; the sandbox review above catches obvious mistakes, not
   everything.
2. **Task 2** (owner-verification workflow) next in the brief's own
   ordering, once Task 1 is confirmed working — a new `ChannelModule`
   currently unused field (`eligibility.checks`) driving a real admin
   checklist, gated on `channels.verification_required`.
3. **Task 3** (widen `opportunities.channel_slug` to all 12 channels) —
   not started; smaller in scope than 1/2, worth picking up once 1/2 are
   confirmed working rather than adding a fourth unverified change on top.

---

## 5. Channel onboarding/dashboard/marketplace-view request — see its own file

Full account in `CHANNEL_UPDATES_AUDIT.md`, not duplicated here — a
different upload (`ChatSched-task2-task3-complete.zip`) than the one
item 4 corrected this log against, requesting distinct per-channel
onboarding, dashboards, and marketplace profile views. Registration
channel picker, a scoped publisher-can-also-be-a-business toggle, three
typed contrasting onboarding schemas (Podcast/Informal Retail/Sports),
and a dynamic `MarketplaceProfileView` component all built and verified
this entry (build ✅, lint ✅, tests ✅ 21 files/161 passing, up from
20/153). Nine of twelve channels still have no typed onboarding schema
of their own, and dashboards aren't yet channel-differentiated — both
named plainly in that file, not implied done.

---

## 4. Correcting this log's own staleness — Tasks 2 and 3 turned out done

Found while orienting for an unrelated new request (channel onboarding
UI), not while working this log's own "moving forward" list — worth
naming that plainly, since it means this correction almost didn't happen
before more work got planned on top of a stale account.

**`schema_phase79_publisher_verification_checks.sql` and
`schema_phase80_opportunities_all_channels.sql` both exist, both are
substantive, and both have real frontend wiring** — `Admin.tsx` fetches
and upserts `publisher_verification_checks`, pre-ticks already-confirmed
checks, and renders each channel's own `eligibility.checks`; the
`opportunities.channel_slug` FK swap is in place and the "not yet
postable" comments schema_phase80's own header flagged as stale are gone
from both `BusinessOpportunities.tsx` and `OpportunityFeed.tsx`. Read
both migrations and the `Admin.tsx` call sites directly rather than
trusting either this file's own "not started" account above or the
zip's own filename — same discipline this whole log already claims to
use, applied to itself this time, not just to incoming uploads.

**Item 2's own open item stands, unchanged by this:** none of Tasks 1–3
has been run against a real Postgres instance. Checked this sandbox
specifically (`which docker psql supabase pg_config`) — same result as
every prior sandbox: nothing available. That gap doesn't close until
someone with Docker/network access actually runs `supabase test db`.

**Why this happened, stated plainly rather than left implicit:** whoever
wrote `schema_phase79`/`80` and their frontend wiring did real, careful
work — the migrations' own header comments show the same "checked first"
discipline as everything else in this codebase — but didn't append a new
entry here recording it. A file existing and a log describing it are two
different things, and this log went stale relative to the files sitting
right next to it. The zip's own name, "task2-task3-complete," was the
more accurate account of the two — worth remembering the next time a
filename and a log disagree: check the actual files before trusting
either one alone.

**Files touched this entry:** `CLAUDE_3.0.md` only — a correction, not
new implementation work.

## Open items (superseding this entry's own item 3 list above)

- Tasks 2 and 3: code complete, unverified against real Postgres — same
  status as Task 1.
- Task 1: unchanged from item 2's own account.
- Task 4: unchanged from item 3's own account.
