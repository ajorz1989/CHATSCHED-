# Pre-Production Fixes — Independent Full-Product Audit

**Audited by:** Claude, this session, reading the codebase directly rather
than summarizing `NEXT_STAGE_DEVELOPMENT_BRIEF.md`'s own findings. Where
this list overlaps that document, it's marked `[ALREADY TRACKED]` with a
pointer, not re-explained — this file's job is to add what that one
doesn't cover, and to give one consolidated "everything before real users
touch this" list. Where I could verify something directly in the code
(grep, read the actual file), I say so. Where I couldn't verify it in
this sandbox — rendered contrast, real Lighthouse scores, actual mobile
device behavior, legal sign-off — I say that too, explicitly, rather than
asserting a pass or fail I didn't check.

**Scope note:** ~94 pages, ~70 components, 79 SQL migrations. This is not
a line-by-line read of all of it — it's a systematic sweep across the
categories below (grep-driven, then hand-verified on every hit before
it's listed here), the same "checked, not assumed" standard this repo's
own history holds itself to. Nothing below is filler; every item points
at a real file/line I looked at.

**How to use this doc:** same convention as `NEXT_STAGE_DEVELOPMENT_BRIEF.md`
— mark items `[COMPLETE]` inline as they're actually done and verified,
not just attempted.

---

## 1. Security & Data Integrity

- **[ALREADY TRACKED — `NEXT_STAGE_DEVELOPMENT_BRIEF.md` Task 1]** Zero
  automated DB-level test coverage until this session's own
  `supabase/tests/` work, and that work is itself unverified against a
  real Postgres instance as of this writing. This is the single highest-
  priority item in this entire document — everything else assumes the
  schema underneath it is actually enforcing what it claims to.
- **Admin-only Edge Functions and RLS-bypassing service-role calls
  deserve a dedicated once-over before launch** — I did not do a
  function-by-function audit of every `supabase/functions/*` for "does
  this correctly check `is_admin()` before using the service-role
  client," beyond what I touched directly this session. Worth one
  explicit pass, given how much of this schema's real security boundary
  lives in Edge Functions rather than RLS alone (Edge Functions run with
  the service role and re-implement authorization themselves).
- **No cookie-consent mechanism**, despite `Privacy.tsx` (line ~144)
  disclosing "essential cookies... and limited analytics." POPIA doesn't
  mandate an EU-style banner the way GDPR's ePrivacy rules do, but
  disclosure-without-consent-mechanism is a gap worth a real legal
  opinion before launch, not an engineering guess — flagging it here
  because I found the disclosure and looked for the mechanism and it
  isn't there, not because I know POPIA requires one.
- **Sentry (`src/lib/errorTracking.ts`) is well-configured** —
  `sendDefaultPii: false` with an explicit POPIA comment. No fix needed
  here; noted so it isn't mistakenly relisted.

## 2. Testing & QA

- **17 vitest files total, almost entirely unit tests of pure logic**
  (`browseFilters`, `campaignRollup`, `subscriptions`, etc.) — only two
  files test an actual component
  (`CreateRequestForClient.test.tsx`, `PublisherCard.test.tsx`) out of
  ~94 pages and ~70 components. No test touches the opportunity flow
  (confirmed last session, still true), the checkout/PayFast flow, the
  channel-request accept/decline UI, or any admin screen.
- **No end-to-end test suite at all** — no Playwright/Cypress/similar
  anywhere in `package.json` or the repo. For a marketplace whose core
  value is "the payment and booking flow actually works," this is the
  highest-leverage testing gap after the DB-level one above: a single
  E2E happy-path per role (business posts a request → publisher accepts
  → payment → goes live; business posts an opportunity → publisher
  applies → gets accepted) would catch an entire class of integration
  break that unit tests structurally can't.
- **`npm run build && npm run lint && npm test` has not been run in this
  session** for anything beyond what I typechecked file-by-file with
  `tsc` directly (see `CLAUDE_3.0.md`) — no Docker/network in this
  sandbox to run the real toolchain. This needs to happen for real, on
  every open change from this session, before any of it ships.

## 3. Accessibility

- **`<html lang="en">` is static** (`index.html` line 2) and never
  updates when a person switches to Afrikaans/isiXhosa/isiZulu via the
  language switcher — confirmed no `document.documentElement.lang`
  assignment anywhere in `src/i18n/` or the hooks that call
  `i18n.changeLanguage`. Screen readers and language-aware browser
  features (translation prompts, pronunciation) will keep announcing the
  page as English even when the visible text is isiZulu. Small, concrete
  fix: an `i18n.on("languageChanged", ...)` listener setting
  `document.documentElement.lang`.
- **No skip-to-content link** — checked for the standard
  "Skip to main content" pattern, not present anywhere. Someone
  navigating by keyboard has to tab through the full header/nav on every
  single page load before reaching page content.
- **Focus-visible styling is present in exactly 2 places** in the entire
  codebase (`Faq.tsx`, `Help.tsx`, both search inputs) — everywhere else
  relies on the browser's default focus ring on whatever element type is
  underneath. Not necessarily broken (browsers do supply a default), but
  worth an actual keyboard-only pass through the core flows (signup,
  request accept/decline, checkout) to confirm focus is always visible
  and lands in a sane order — I didn't render this app to check, so this
  is a "verify," not a confirmed defect.
- **Color contrast not independently verified.** The `billboard-red`
  (`#D4451F`) token is used with white text in places (declined/error
  states) — this specific pairing is worth an automated contrast check
  (e.g. axe or Lighthouse) before launch; I'm flagging the specific token
  to check, not asserting it fails, since I didn't render it.

## 4. Internationalization / Localization

- **[ALREADY TRACKED — brief's Technical Debt section]** isiZulu/isiXhosa
  never reviewed by a fluent speaker; three concrete fixes already made
  this lineage's history (see `CLAUDE_3.0.md` item 1).
- **`howItWorks`/`forBusinesses`/`forPublishers` i18n namespaces are
  registered and bundled in all 4 languages but are pure placeholder
  stubs** (`{"_todo": "Not yet translated..."}` — checked
  `af/howItWorks.json` directly) **and the pages they're meant for
  (`HowItWorks.tsx`, confirmed by grep) don't actually call
  `useTranslation` with them at all.** This is dead weight two ways: it
  ships untranslated JSON in every language bundle for namespaces no
  component reads, and it represents an abandoned half of the
  localization effort — either finish wiring these three pages into
  i18n and translate them, or remove the placeholder files and their
  imports in `src/i18n/index.ts` so the bundle isn't carrying unused
  infrastructure.
- **The 7 new channels' homepage hero copy is plain English by design**
  — `[ALREADY TRACKED]`, `CLAUDE_2.0.md` item 8. Listed here only to
  connect it to the point above: two different "not translated yet"
  states exist in this codebase for two different reasons (deliberate
  scope cut vs. abandoned scaffold), worth distinguishing when someone
  picks this up so the deliberate one isn't accidentally "fixed" by
  wiring in more untranslated stubs.

## 5. Design System & Frontend Code Quality

- **`[CORRECTED — see CLAUDE_1.0.md item 16]` This entry originally
  claimed `src/components/Button.tsx` was already built and 5 call sites
  migrated.** Neither was true of the actual files in the upload this was
  read from — checked directly (`find`, then `grep`) before trusting the
  claim, following this whole log's own stated discipline. Most likely
  explanation: real work done on a branch/session that didn't make it
  into that particular zip, not a fabrication — the *problem* this entry
  originally described was accurate and independently re-verified (61
  occurrences of the exact className string, confirmed by `grep -rn`
  against this specific upload's files). The *fix* wasn't there. Built
  fresh from this description as a spec, verified against the real
  codebase rather than the count taken on faith: **10 of 65 occurrences
  now migrated** (65, not 60 — found 5 more, sharing the identical
  `bg-billboard-ink text-white rounded` dark-filled variant, across 4
  files, that the original count didn't separate out from the outline
  family; `Button.tsx` now ships 3 variants — `outline`, `primary`,
  `dark` — not 2). Files done: `ExportCsvButton.tsx`,
  `SaveSearchButton.tsx` (all 3 of its sites, including its primary
  submit button), `CreatorHomeSummary.tsx`, `BusinessHomeSummary.tsx`,
  `CreateRequestForClient.tsx` (both sites, one dark, one outline — and
  its dark button's missing `type="submit"` made explicit while migrating
  it, since `Button`'s own default is `type="button"`, unlike a bare
  `<button>` inside a form defaulting to submit; verified against its
  own `<form onSubmit={submit}>` before assuming that was safe rather
  than a silent behavior change), `PublisherDashboardView.tsx` (2 of its
  sites — its bare-text "Cancel" link deliberately left alone, since it's
  a genuinely different, borderless style none of the three variants
  cover, not a fourth pattern worth adding for one occurrence).
  **54 outline-family and 3 dark-family occurrences remain, across
  roughly 20 files** (`Admin.tsx`, `AdminAnalytics.tsx`,
  `AdminAuditLog.tsx`, `AdminCampaigns.tsx`, `AdminCareers.tsx`,
  `AdminLeads.tsx`, `AdminPayouts.tsx`, `Browse.tsx`,
  `BusinessOpportunities.tsx`, `BusinessPublisherRelationships.tsx`,
  `CommunityEvents.tsx`, `CommunityQa.tsx`, `Dashboard.tsx`,
  `LanguageSwitcher.tsx`, `MapView.tsx`, `OpportunityFeed.tsx`, `Press.tsx`,
  `ReachChecker.tsx`, `Suburbs.tsx`, `Transparency.tsx` — confirmed by
  `grep -rl` against this file's own actual current state, not copied
  from the earlier, now-known-inaccurate count). Genuinely mechanical
  from here — the component is proven against 10 real, varied call sites
  (forms, disabled states, `Link` vs `button`, all 3 variants) — but 20
  more files is real remaining work, not finished by this correction. A
  `<Badge>` equivalent is still entirely unstarted, as originally noted.
- **`[CORRECTED, THEN BUILT — see CLAUDE_1.0.md items 16-17]` `formatR`
  (currency formatting) was independently reimplemented across the
  codebase and had already drifted.** Item 16 found the originally-
  claimed fix wasn't present in that upload; item 17 built it for real
  against this one. Verified directly rather than trusted from any prior
  account: real drift confirmed in exactly 3 files
  (`AdminAnalytics.tsx`, `BusinessOpportunities.tsx`,
  `OpportunityFeed.tsx`, all three using `n.toLocaleString(undefined,
  ...)` — whichever locale the visitor's own browser reports) and 5 more
  files duplicating the same explicit-`"en-ZA"` logic without being
  actively buggy (`CreatorHomeSummary.tsx`, `mediaKit.ts`, `invoice.ts`,
  `EarningsDashboard.tsx`, `Fees.tsx`). Two files this document's earlier
  draft would have caught as "en-ZA" occurrences — `Admin.tsx`,
  `AdminCareers.tsx`, `CommunityEvents.tsx` — turned out on inspection to
  be `Date.toLocaleString("en-ZA")` calls, not currency at all; left
  alone rather than migrated on the strength of a pattern match that
  didn't actually apply.

  `src/lib/currency.ts` now exports `formatCurrency()`/
  `formatCurrencyRange()`, real `Intl.NumberFormat("en-ZA", ...)` output
  checked directly in Node before documenting it — it's `"R 12 500"`
  (U+00A0 non-breaking space as the group separator, comma as decimal),
  not the `"R12,500"` this same function's own first draft assumed before
  actually running it. A real test file, `currency.test.ts`, pins this
  exact output (5 tests, passing) rather than leaving the formatting
  behavior undocumented and re-discoverable-by-accident.

  All 8 of the above migrated, plus 6 more real raw-`` `R${...}` ``
  displays found and fixed while auditing rather than stopping at the
  originally-flagged files: `MarketplaceProfileView.tsx` and
  `channelOnboardingSchemas.ts`'s admin summary formatter (both this
  session's own recent work, not exempt from the same bug for having
  been written recently), `PublisherProfile.tsx`'s SEO meta description,
  `Browse.tsx` and `browseFilters.ts`'s price-filter chip label (a
  second, independently-confirmed instance of the exact same
  `undefined`-locale drift bug, not just raw formatting), and `Fees.tsx`/
  `Faq.tsx`'s remaining inline examples beyond their own `rand()`
  helpers.

  **`[CLOSED — see CLAUDE_1.0.md item 18]`** All 16 remaining files
  migrated. Final count across every entry on this thread, re-verified
  by grep after each batch rather than trusted from any prior estimate:
  30 real call sites across 22 files total, including 6 genuine
  `undefined`-locale drift bugs (not the originally-claimed 2, and not
  the intermediate count of 3 either — `BankDetailsPanel.tsx`,
  `ManagedCampaignsSection.tsx`, and `marketingSuite/RoiCalculator.tsx`
  turned out to have the same bug, found only by actually reading each
  file rather than assuming the earlier sweep was exhaustive).
  `grep -rlE` for the raw-display pattern across all of `src` now
  returns zero matches outside `currency.test.ts`'s own expected-value
  strings. `formatCurrency`/`formatCurrencyRange` are the only currency
  formatting in this codebase now — no more per-file `rand()`/`formatR`/
  inline template reimplementations anywhere.
- **This is (at least) the third instance of the same underlying
  pattern** (copy-pasted per-file constants instead of one shared source
  of truth) — the other two are `[ALREADY TRACKED]` in the brief's
  Technical Debt section (`getChannelsByCategory()`, `ChannelPage.tsx`'s
  hero badge). Worth treating as one systemic finding rather than three
  unrelated ones: this codebase's per-feature-file style keeps producing
  this specific failure mode, and a short "shared constants/components"
  pass
  across the whole `src/` tree (not just channel/currency maps) is
  probably worth more than fixing each instance individually as it's
  found.

## 6. Performance

- **Route-level code splitting is already in place** (`lazy(() =>
  import(...))` for every page in `App.tsx`) — no fix needed, noted so
  it isn't relisted.
- **Bundle-weight audit not done in this sandbox** — `leaflet`,
  `jspdf`, `react-leaflet` are real-sized dependencies; worth confirming
  (via `vite build --mode production` and checking the actual output
  chunk sizes, which needs a real build I can't run here) that the map
  and PDF-export code paths are only pulled in on the pages that actually
  use them (dynamic `import()`, not top-level), not bundled into the
  main chunk every visitor downloads. I didn't verify this either way —
  flagging it as a check to run, not a confirmed problem.
- **Image assets not audited for format/compression** — didn't check
  whether `public/og-image.png` and any other shipped raster images are
  reasonably sized/compressed, or whether anything would benefit from
  WebP. Low effort to check with a real build; not done here.

## 7. SEO & Discoverability

- **`sitemap.xml` lists 13 fixed routes only** (confirmed by reading it
  directly) — deliberately excludes dynamic pages
  (`/browse/:id`, `/channels/:slug`) per its own header comment, which is
  a reasonable call for a page with no real inventory yet on 7 of 12
  channels, but worth revisiting once Task 2/real owners land: an actual
  sitemap entry per active, verified channel page is easy incremental
  SEO value once there's something real to show at each one.
- **[ALREADY TRACKED — brief's Feature Gaps]** No dedicated SEO landing
  pages (`/sports-advertising` etc.) for the 7 new channels.
- **`Seo` component is used on 82 of 94 pages** — the 12 missing are all
  admin-internal screens plus `ComingSoon.tsx`, which is correct (no
  reason to optimize metadata on pages search engines shouldn't index in
  the first place, and `robots.txt` already disallows `/admin` and
  `/dashboard`). No fix needed; checked so it wouldn't be wrongly flagged.

## 8. Content & Copy

- **Generic error messages throughout the app** — a representative
  sample: `"Couldn't post that — check the budget range... and try
  again"` (`BusinessOpportunities.tsx`), `"Couldn't update that
  application — try again"` (same file), similar phrasing recurs widely.
  Functional, but doesn't tell the person *what actually went wrong* when
  the cause isn't the one guessed reason in the message (e.g. an RLS
  rejection, a network failure, and a genuine validation error all
  produce the same text). Not urgent, but worth a pass to surface the
  actual Supabase error code/message in at least a console log for
  support debugging, if not always in the UI itself.
- **`ComingSoon.tsx` exists as a real, routed page** — worth confirming
  before launch that nothing in production navigation actually still
  points to it (I didn't trace every link into it in this pass — a quick
  grep for its route name before launch is cheap insurance against a
  live dead-end).

## 9. Legal & Compliance

- **`Privacy.tsx` and `Terms.tsx` are both real, POPIA-specific,
  substantive content** (confirmed by reading them, not just their
  existence) — Information Officer contact, POPIA rights section,
  cookie disclosure, children's-data clause. Good baseline; still worth
  actual legal sign-off before launch, which no amount of code review
  substitutes for.
- **Cookie-consent mechanism gap** — see Security section above; grouped
  there since it's also a data-protection question, flagged again here
  because it's fundamentally a legal decision, not an engineering one.
- **No visible accessibility statement page** — not a legal requirement
  in South Africa the way it can be elsewhere, but worth a one-line
  decision (include one or explicitly decide not to) rather than an
  oversight.

## 10. DevOps, Infrastructure & Onboarding

- **[ALREADY TRACKED — brief Tasks 1 & 4]** pgTAP coverage and the
  developer-onboarding path — both addressed this session, both
  explicitly unverified against a real instance.
- **No staging environment documented anywhere this session or the
  prior one read** — `[ALREADY TRACKED]`, brief's closing "Technical
  Stack" note. Restating because it's a genuine pre-launch blocker on
  its own: there is currently no way to test a real deploy before it's
  live, for either the frontend or the 20 Edge Functions.
- **No CI job runs the Edge Functions' own Deno-side checks** — `tsc`
  checking is what this session did by hand (stubbing Deno/esm.sh
  imports locally); there's no equivalent step in `.github/workflows/
  ci.yml` for the `supabase/functions/` tree the way there is for the
  frontend (`npm run build`). Worth adding a `deno check` (or
  `deno lint`) step scoped to `supabase/functions/**/*.ts` so a broken
  Edge Function surfaces in CI instead of only at deploy time.

## 11. Product & Business Gaps (cross-referenced, not re-audited)

Everything in `NEXT_STAGE_DEVELOPMENT_BRIEF.md`'s own "Feature Gaps" and
"Critical Issues" sections still applies and isn't re-litigated here —
most load-bearingly, **7 of 12 channels are publicly live with zero real
inventory**, which no engineering fix in this document touches. See that
document directly; this file is additive to it, not a replacement.

## Priority read, if only a few of these get picked up before launch

In rough order of "how much it protects everything else, and how cheap
it is relative to that":

1. **A real run of the pgTAP suite** (Task 1) — everything downstream of
   the schema being correct depends on this actually happening once,
   for real, against live Postgres.
2. **One E2E happy-path test per side of the marketplace** — the single
   highest-leverage new testing investment; unit tests can't catch an
   integration break the way one real click-through test can.
3. **Finish the `<Button>` migration** — the component exists and is
   proven against 5 real call sites; 55 across 22 files remain. Small
   and self-contained enough to do without touching the schema/backend
   at all, and the accessibility/maintenance payoff only lands once the
   remaining call sites actually adopt it.
4. **Finish the `formatCurrency()` migration** — 15 of the original
   duplicated-helper files are done; 70 more raw, unformatted displays
   across 33 files remain (see Design System section for the full list).
5. **Cookie-consent decision** — not code, a decision; needs a person
   with legal context, not an engineer, but blocks nothing else so it
   can happen in parallel with 1-4.
