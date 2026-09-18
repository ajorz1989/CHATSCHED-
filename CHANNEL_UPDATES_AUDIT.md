# Channel Updates Audit

Covers this session's response to the "distinct onboarding, dashboards,
and marketplace views for all 12 channels" request. Read alongside
`CLAUDE_3.0.md` (which this session also corrected — see its own item 4
before trusting anything else it says about task status) and
`NEXT_STAGE_DEVELOPMENT_BRIEF.md`. Same standard as both: what's real and
verified is stated as such, what isn't is named, not implied.

## What this request was actually asking for, and why that mattered

The request's own Core Requirement 2 says dashboards "can share a base
layout template" with only the data varying, and Core Requirement 3 asks
for "a dynamic content-rendering system that swaps the data points,
badges, and metrics" behind one consistent layout. That's not a request
for 12 separate onboarding-form and dashboard components — it's a request
for exactly the kind of generalized, data-driven system this codebase's
channel architecture (`ChannelModule`, `CHANNEL_REGISTRY`,
`channels`/`channel_metadata`) already exists to provide. Built
accordingly: one dynamic system, extended with real per-channel data for
three channels, not twelve forked component trees. Where the two
frontings (bespoke-components vs. data-driven) would have actually
differed — full field-set completeness for 9 of the 12 channels — that
gap is real and is named below, not hidden by the architecture choice.

## What's built and verified this session

- **Registration channel picker** (`Register.tsx`) — the publisher path
  now shows all 12 channels as a selectable grid (`getAllChannels()`, so
  a 13th channel added later needs no change here), required before
  submit. Fixes a real, silent gap: previously, landing on `/register`
  without a `?channel=` param (i.e., not arriving from a channel page's
  own "Apply" link) defaulted a new publisher into `social-media` with no
  way to choose otherwise. Selection is stored the same
  `sessionStorage` key `PublisherApply.tsx` already reads, so the existing
  hop across signup → email confirmation → login → application keeps
  working unchanged.
- **Publisher-can-also-be-a-business** (`Dashboard.tsx`) — checked the
  data model first rather than assuming a new role system was needed:
  `channel_requests`/`requests`/`opportunities` inserts and
  `business_subscriptions` are already keyed purely on `auth.uid()`, not
  `profiles.role` — a publisher-role account could already act as a
  business at the data layer with zero schema change. The actual blocker
  was `Dashboard.tsx`'s own hard `if (role === "publisher") return
  <PublisherDashboardView />` — an exclusive early return that never let a
  publisher see business-side content at all. Replaced with an opt-in
  toggle: publisher view by default, an explicit "also want to book
  campaigns as a business?" banner reveals a real business-activity
  summary (same `BusinessHomeSummary` component, same
  `business_id = auth.uid()` data every business account already gets) —
  off by default, since most publishers aren't also advertisers. **Scoped
  deliberately narrow:** this shows a summary and links out to
  `/browse`/`/messages`, not the full business dashboard body (onboarding
  checklist, marketing suite, campaign rollup, managed campaigns) inline
  — replicating that whole body safely would have meant extracting and
  verifying ~300 unread lines of `Dashboard.tsx` under this session's time,
  which the risk didn't justify for a first pass. No RLS/schema change was
  needed or made.
- **Three contrasting typed onboarding schemas**
  (`src/lib/channelOnboardingSchemas.ts`) — `PodcastOnboardingFields`,
  `InformalRetailOnboardingFields`, `SportsOnboardingFields`, as requested,
  chosen by the request itself as the three to demonstrate. Deliberately
  not a discriminated union on `Publisher` itself (would require turning
  every consumer of `Publisher` into a type-narrowing site) — instead,
  `channel_metadata` stays `Record<string, unknown> | null` on the base
  type, with typed accessor functions (`getPodcastMetadata()` etc.) doing
  the narrowing at the point of use.
- **`Publisher.channel_metadata` added to `types.ts`** — the DB column has
  existed since `schema_phase74`; nothing in the frontend could actually
  read or write it in a typed way until this entry. Every use before this
  was, structurally, impossible — not a bug exactly, since nothing tried,
  but a real gap between what the schema could hold and what the app
  could see.
- **`PublisherApply.tsx` collects real data for the three schemas above**
  — genuine new form fields (not placeholders) for podcast/informal-retail/
  sports applicants specifically, written into `channel_metadata` on
  submit via `buildChannelMetadata()`. The other 9 channels' applicants
  see only the pre-existing generic fields — an honest, visible gap, not
  a silently missing one.
- **`MarketplaceProfileView.tsx`** (new component) — the dynamic component
  the request asked for by name. Same exact card markup/classNames the
  publisher-profile page already used for its stats grid; the function
  that decides *which* stats and badges to show is the only thing that
  branches per channel. Three channels get real, typed, channel-specific
  content (podcast: downloads/episode length/ad-slot badges; informal-
  retail: foot traffic/WhatsApp list size/till badge; sports: matchday
  attendance/squad size/authority badge); every other channel falls back
  to the same generic followers/engagement stats the page always showed —
  an honest fallback, not a disguised non-change. Wired into
  `PublisherProfile.tsx` in place of the hardcoded block it replaced.
- **`src/test/fixtures.ts`** — the shared `makePublisher()` test fixture
  needed `channel_metadata: null` added once `Publisher` required it; every
  existing test using this fixture kept passing after the one-line fix.

## Toolchain

Real run — this sandbox has npm registry access.

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors (after fixing the fixture above — the only break this session's changes caused) |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings from before this session |
| `npm test` | ✅ 21 test files, 161/161 passing — up from 20/153 at the start of this session; the extra file/8 tests are `subscriptionLapseEmail.test.ts`, ported in by a separate reconciliation earlier in this session (`CLAUDE_3.0.md` item 1) and now genuinely exercised under vitest for the first time, not just `tsc --strict`-checked with stubbed imports as that item's own account described |

## What's explicitly NOT done — the real gap behind the architecture choice

- ~~**9 of 12 channels have no typed onboarding schema.**~~ **CLOSED —
  see `CLAUDE_1.0.md`'s own log for the session that did this.** All 12
  channels now have a typed `channelOnboardingSchemas.ts` interface, a
  `PublisherApply.tsx` form section, and a `MarketplaceProfileView.tsx`
  stats/badges branch, following exactly the pattern the original three
  (podcast, informal-retail, sports) established — grounded in each
  channel's own real `advertisingMethods`/`description` in
  `src/channels/*/index.ts`, not invented generically. Where two channels
  are genuinely the same shape underneath (Community's and Associations'
  reach channels; Community's newsletter cadence and Podcast's episode
  frequency), they share the same type rather than duplicating a
  near-identical enum.
- ~~**No distinct dashboard visualizations per channel yet.**~~ **CLOSED
  — see `CLAUDE_1.0.md`'s own log.** `PublisherDashboardView.tsx` now
  renders `MarketplaceProfileView` — the exact same component a visiting
  business sees on `/browse/:id` — right below the existing
  `CreatorHomeSummary`. Deliberately reused rather than building a second,
  separate dashboard-specific system: Core Requirement 3's own language
  ("one dynamic content-rendering system that swaps the data points,
  badges, and metrics") asked for one system used in more than one place,
  not a parallel one. No extra fetch — `publisher.rating`/`publisher.reviews`
  were already loaded on the same object `CreatorHomeSummary` uses, the
  same fallback `PublisherProfile.tsx` itself uses when it has no
  separately-fetched reviews array.
- ~~**The dual-role feature's scope, restated plainly:** a summary +
  entry points, not a full unified dashboard.~~ **CLOSED — see
  `CLAUDE_1.0.md`'s own log.** `Dashboard.tsx`'s publisher-toggle view now
  renders `BusinessDashboardBody` — extracted from the primary business
  view so both render the exact same body (onboarding checklist,
  marketing suite, campaign rollup, managed campaigns, request and
  channel-request lists), not two maintained copies of ~70 lines of JSX.
  Checked first that nothing inside that body hard-codes
  `profile.role === "business"` (`ManagedCampaignsSection`,
  `CampaignRollup`, `MarketingSuite`, `computeBusinessChecklist` — none
  do; all key off `business_id`/`auth.uid()` or plain profile fields,
  confirming the original session's own finding that nothing in the data
  layer actually required a business-role account) before wiring it in
  for a publisher-role account.
- **No admin-side visibility into the new `channel_metadata` fields.**
  ~~`Admin.tsx`'s publisher-review screen doesn't yet surface
  the 12 channels' extra fields for a reviewer to see — they're stored
  and used on the public profile, but invisible in the moderation queue.
  (Note: this is a different gap from Task 2's verification *checklist*,
  which is the channel's `eligibility.checks` — a short list of
  yes/no gates — not these onboarding-form *data* fields, which are
  richer and channel-specific. Both are currently missing from the
  reviewer's view, for different reasons.)~~ **CLOSED — see
  `CLAUDE_1.0.md`'s own log.** `getOnboardingSummaryFields()`
  (`channelOnboardingSchemas.ts`) flattens whichever of the 12 typed
  schemas matches a publisher into label/value pairs; `Admin.tsx`'s
  `ApplicationCard` renders them in a compact panel right below the
  business-registration details, above the (separate)
  `eligibility.checks` checklist. Deliberately every field, not a
  curated subset — a reviewer judging plausibility needs the full
  picture. Genuinely different from Task 2's checklist, which stays as
  its own section: one is "did we confirm these yes/no gates," the other
  is "what did the applicant actually tell us."
- **Not run against a real browser/device.** Everything here is validated
  by the real toolchain (build/lint/test), not by actually loading
  `/register`, `/publisher-apply`, or `/browse/:id` in a browser and
  clicking through them — the same class of gap this whole codebase's
  history keeps naming for different layers (no real Postgres run, no real
  CI run) applies here too, one layer up, for the UI itself.
