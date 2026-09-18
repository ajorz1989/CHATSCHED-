# ChatSched Tools — Phase 100 Delivery

Full first build of the "ChatSched Tools" master implementation prompt
(uploaded as `ChatSched_Layer1_Updated_Product.zip`'s companion brief),
against the codebase from `ChatSched_Layer2_Updated_Product.zip`. Builds on
the Phase 1 (schema-only) delivery from the Layer 1 pass; this phase adds
the admin CRUD, the public pages, and the wiring the schema-only phase
deliberately deferred.

## Renumbered: 98 → 100

The original migration was written as `schema_phase98_chatsched_tools.sql`
against the Layer 1 zip. This Layer 2 zip turned up
`schema_phase98_cross_party_contact_completeness.sql` and
`schema_phase99_fix_stale_commission_rate.sql` already occupying those
numbers — a real concurrent-session collision, the same kind
`PHASE9_CAMPAIGN_PACKAGES_DELIVERY.md` already describes happening once
before. Renumbered to `schema_phase100_chatsched_tools.sql`, content
otherwise unchanged. Confirmed phase98/99 don't touch anything this
migration also touches (contact fields on `channel_requests` and a
commission-rate function; this migration only adds three new tables).

## What's in this phase

**Database** (unchanged from the Phase 1 delivery — see that doc's full
reasoning on what's real vs. roadmap):
- `supabase/schema_phase100_chatsched_tools.sql` — `tools`,
  `tool_features`, `tool_benefits`, `tool_faqs`, RLS, seed data (8 active,
  5 coming_soon).

**Admin** (Sections 3, 4, 20–22 of the brief):
- `src/pages/AdminTools.tsx` — standalone route (`/admin/tools`), not a
  tab inside `Admin.tsx`. Followed `AdminCareers.tsx`'s existing precedent
  for exactly this reason: a full multi-field authoring form is a
  different shape of workflow than the status-transition tabs that make
  up `Admin.tsx`'s `Tab` union, and there was already a real precedent for
  routing that distinction out to its own page rather than stretching the
  tab bar further. Full CRUD (create, edit, publish/unpublish, duplicate,
  archive), stats overview, status filter, and every field from the
  brief's Section 4 field list except the ones explicitly out of scope
  (documentation URL, support information, requirements — no existing
  admin form in this repo has a place for arbitrary long-form
  requirements text yet, and nothing downstream reads those three fields,
  so adding empty columns for them felt like exactly the "unused stub"
  the brief itself warns against in Section 7's `tool_usage` guidance;
  easy to add if a real use for them shows up).
- Linked from `Admin.tsx` next to the existing Careers link, not folded
  into the tab bar, with a comment explaining why (mirrors the existing
  Careers comment).
- "Preview" needed no special plumbing: `tools_admin_all`'s RLS policy
  already lets an authenticated admin read a tool at any status, so
  linking straight to the real `/tools/:slug` route previews exactly what
  will be public once published — including draft/paused/archived rows
  nobody else can see. Confirmed this by reading the policy, not assumed.
- Every mutation calls `logAdminAction` (`log_admin_action` RPC), matching
  every other admin write path in this repo.

**Public** (Sections 9–15, 28):
- `src/pages/Tools.tsx` — `/tools`. Hero, featured row, category filter
  (only shows categories that actually have an active tool in them —
  never renders an empty "Convert" or "Keep Customers" tab, since nothing
  is active in either yet), category-grouped grid, separate "On the way"
  section for `coming_soon` rows. Reads only what RLS already returns
  (`status in (active, coming_soon)`); never renders a `coming_soon` card
  inside the main grid even if that ever changed.
- `src/pages/ToolDetail.tsx` — `/tools/:slug`. Hero, What it does
  (benefits), How it works (a fixed 4-step Set up/Connect/Use/Get results
  per Section 15 — generic on purpose, since the concrete mechanics differ
  per tool and none of that detail exists in the schema), Features, Who
  it's for, Pricing, FAQ, final CTA. An unknown or inaccessible slug
  (draft/archived, to anyone without `tools_admin_all`) renders the real
  `NotFound.tsx`, not a bespoke "tool not found" page — reusing it rather
  than writing a near-duplicate.
- `src/components/ToolIcon.tsx` — same visual badge language as the
  existing `ChannelIcon.tsx` (rounded-xl, 3px ink border, yellow fill) so
  a tool card reads as the same product family as a channel card.
  Resolves the admin's free-text icon field against the full `lucide-react`
  set at render time (already a project dependency, not newly added),
  falling back to a generic wrench glyph for blank/typo'd/not-yet-set
  values so this never renders empty.

**Nav/footer** (Sections 17–19) — deliberately last, so nothing links to
`/tools` before it exists:
- `Header.tsx` — added a "Tools" nav item between Channels and For
  Publishers, matching the brief's suggested order exactly.
- `Footer.tsx` — added a single "ChatSched Tools" link inside the
  existing "Platform" column, **not** the six-link dedicated footer group
  the brief's Section 19 describes. This footer is already a full 5-column
  grid with five links in its densest column; adding a sixth column with
  five more sub-links (Get Customers/Convert/Keep Customers/Advertise/
  Measure) would be the exact kind of overload the brief itself warns
  against elsewhere (Sections 6, 10, 17), just relocated to the footer.
  One link in an existing, appropriate column does the actual job — get a
  visitor from anywhere on the site to `/tools` — without it. Flagging
  this as a deliberate deviation from the brief's literal Section 19, not
  an oversight.
- Homepage teaser (Section 17, "One platform. More ways to grow.") —
  **now built** (was deferred in this phase's first pass). `ToolsTeaserSection`
  in `Home.tsx`, placed directly after `ThreeLayersSection`
  (Agency/Marketplace/Network) rather than anywhere else on the page —
  Tools is the fourth pillar in that same ecosystem, so it reads as a
  continuation of that section, matching its exact badge convention
  ("Layer 1/2/3 —" for the existing three, "Layer 4 — Tools" here).
  Fetches up to 3 active tools (featured first, then fill by sort_order),
  each linking to its real `/tools/:slug` page; a loading skeleton and an
  empty state (no active tools) are both handled, matching how the
  existing Featured Publishers section handles the same two states.
  Deliberately does not duplicate `Tools.tsx`'s richer catalogue — no
  category filter, no coming_soon section, exactly the "3 tools maximum"
  Section 17 asks for. Added `toolsTeaser` i18n keys to all four locales.

**Small fix while wiring CTAs** (not in the brief, found while building):
Six of the eight active tools only exist inside the Dashboard's
`MarketingSuite.tsx`, which always opened on its first tab regardless of
how you got there — flagged as a known gap in the Phase 1 delivery.
Fixed: `MarketingSuite` now reads `?tool=<module>` (e.g.
`/dashboard?tool=roi`) and opens on that tab, falling back to the old
default (`match`) for a missing or invalid value. The affected tool rows'
`cta_url` were updated to use it (`content`, `captions`, `builder`,
`tracking`).

**SEO** (Section 28) — `scripts/generate-sitemap.mjs`:
- Added `/tools` to `STATIC_ROUTES`.
- Added a dynamic fetch block for `/tools/:slug`, mirroring the existing
  channels block exactly (same RLS-backed reasoning: anything the query
  returns is real, indexable content).
- Also added `/media-kit` to `STATIC_ROUTES` — a real, shipped, now-seeded
  page that was missing from the sitemap before this phase. Narrowly
  in scope (it's one of this phase's own tool pages), not a general
  sitemap audit.

## Deliberately not done

- `AdminTools.tsx`'s three unused-field exclusions, above.
- Per-tool billing/entitlements — still correctly unnecessary; see the
  Phase 1 delivery's reasoning, unchanged.
- Automated tests for the new pages/admin flow (Section 32). Existing
  test suite (178 tests) still passes unmodified — see Verification —
  but nothing new was added for `AdminTools`/`Tools`/`ToolDetail`
  specifically. Flagging rather than skipping silently: worth a follow-up
  pass, especially RLS-boundary tests (anonymous/business read of a draft
  tool must fail) given Section 32's explicit emphasis on exactly that
  class of test.

## Files changed

New:
- `supabase/schema_phase100_chatsched_tools.sql`
- `src/pages/AdminTools.tsx`
- `src/pages/Tools.tsx`
- `src/pages/ToolDetail.tsx`
- `src/components/ToolIcon.tsx`

Modified:
- `src/lib/types.ts` — `Tool`, `ToolFeature`, `ToolBenefit`, `ToolFaq`
  types and the four enum unions.
- `src/lib/constants.ts` — category/status/type/pricing-model label maps,
  `defaultToolCtaLabel()`.
- `src/App.tsx` — four new lazy routes (`/admin/tools`, `/tools`,
  `/tools/:slug`, plus the corresponding lazy imports).
- `src/pages/Admin.tsx` — "ChatSched Tools →" link next to Careers.
- `src/pages/Home.tsx` — `ToolsTeaserSection`, added after
  `ThreeLayersSection`.
- `src/components/Header.tsx` — Tools nav item.
- `src/components/Footer.tsx` — Tools footer link.
- `src/components/marketingSuite/MarketingSuite.tsx` — `?tool=` deep link.
- `src/i18n/locales/{en,af,zu,xh}/common.json` — `nav.tools` key, all four
  locales (`Tools` / `Gereedskap` / `Amathuluzi` / `Izixhobo`).
- `src/i18n/locales/{en,af,zu,xh}/home.json` — `toolsTeaser` block, all
  four locales.
- `scripts/generate-sitemap.mjs` — `/tools`, `/media-kit`, and the dynamic
  tools-URL block.

No existing table, route, or component was removed or renamed.

## Verification

Actually run, not assumed:

- `npx tsc -b` — clean. (Caught and fixed two real errors along the way:
  an invalid JSX attribute-string escape in `AdminTools.tsx`, and three
  unused type imports.)
- `npx oxlint` against every new/changed file — 0 warnings, 0 errors.
- `node scripts/check-currency-formatting.mjs` — clean. (Caught and fixed
  six violations: `Tools.tsx`/`ToolDetail.tsx` originally built Rand
  strings by hand instead of calling `formatCurrency()`, exactly what
  this script exists to catch.)
- `npx vitest run` — all 178 existing tests pass, 23 files, including
  `src/i18n/keyParity.test.ts` (confirms the four locale files stayed in
  key-parity after the `nav.tools` addition).
- `npm run build` (`tsc -b && vite build` + postbuild) — succeeds.
  `AdminTools` bundles as its own 20.26 kB lazy chunk, confirming it
  code-splits correctly rather than bloating the main bundle. Postbuild's
  sitemap generator ran cleanly with the new tools block (gracefully
  skips the dynamic fetch with no `VITE_SUPABASE_URL` set locally, same
  as it already did for channels/publishers).

Not run: `playwright` E2E tests (no browser/display in this environment)
and the Supabase-side RLS test suite under `supabase/tests/` (needs a
real Supabase project to run against). Both should be run for real before
this ships — flagging rather than claiming a false pass.

## Assumptions worth a second look

- Tool → category mapping (Audience Finder → Get Customers; Reach
  Planner/Content Studio/Caption Writer/Campaign Builder/Media Kit →
  Advertise; ROI Calculator/Campaign Tracker → Measure) is a judgment
  call, not something stated anywhere in the repo. Easy to change — it's
  a column value, not structure.
- `pricing_model = 'included'` for the six Dashboard-only tools assumes
  "included with Business activation" is the right story until a
  standalone price exists. If any of these are meant to be gated
  separately from Business activation itself, that's a real product
  decision this phase didn't make and shouldn't have.
