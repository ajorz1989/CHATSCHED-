# ChatSched 12-Channel Audit — Implementation Log

**Status: 23 of 27 tracked items done or corrected; 4 explicitly deferred
with reasoning (none silently dropped). See "Progress notes" at the
bottom for the full session summary.**

Tracks implementation of every fix identified in `ChatSched-12-Channel-Audit.md`.
Updated live as work proceeds — `[ ]` = planned, `[~]` = in progress,
`[x]` = done (with files + exact changes noted), `[deferred]` = explicitly
scoped out this pass, with reasoning, not silently dropped.

Numbering below matches the audit document's own section numbers (1.x, 2.x,
3.x, 4.x) so each fix traces back to exactly the finding it addresses.

---

## Category A — Schema Integrity (DB)

- [x] **A1** — Verification proof upload: new private Storage bucket +
  `publishers.verification_proof_urls` column. Addresses audit 1.2.1 (the
  single highest-priority finding — no proof upload exists anywhere despite
  every physical channel's eligibility copy promising it).
  **DONE** — `supabase/schema_phase90_verification_proof_upload.sql`: new
  private bucket `publisher-verification-proof` (5MB limit,
  image/video mime types), select policy (owner-publisher or admin,
  keyed by `(storage.foldername(name))[1]::uuid`), insert policy
  (owner-publisher only), no update/delete policy for anyone (append-only,
  same posture as `campaign_proof_screenshots`). New column
  `publishers.verification_proof_urls text[]` (max 5, default `{}`).
  `src/lib/types.ts`: added the matching field to the `Publisher` type.
- [x] **A2** — ~~`RestaurantsOnboardingFields` schema (currently missing~~
  **CORRECTION**: this schema already exists in full
  (`channelOnboardingSchemas.ts` lines 228+, plus a `getRestaurantsMetadata`
  helper) — my original audit's claim that Restaurants had no dedicated
  schema was **wrong**, based on an incomplete read of that file the first
  time through. No fix needed. Verified by direct grep before writing
  anything else in this category.
- [x] **A3** — ~~`AssociationsOnboardingFields` schema (currently
  missing)~~ **CORRECTION**: same as A2 — this schema already exists in
  full (lines 210+, `getAssociationsMetadata` helper). My original audit
  was wrong here too. No fix needed.
- [x] **A4** — New fields on existing schemas: Podcast RSS/show URL (1.2.2),
  Radio ICASA licence number + stream/website link (1.2.3), a generalized
  peak-hours/peak-times field per channel (1.2.7), per-advertising-method
  rate card instead of one blended `price_per_post` (1.2.6).
  **DONE (peak-hours + missing links; rate-card descoped — see note)** —
  `src/lib/channelOnboardingSchemas.ts`: added `showUrl` +
  `peakListeningTimes` to `PodcastOnboardingFields`; `icasaLicenceNumber` +
  `peakListeningTimes` to `RadioOnboardingFields`; `peakFootTrafficHours`
  to `InformalRetailOnboardingFields`; `peakServiceTimes` to
  `RestaurantsOnboardingFields`; `peakOperatingHours` to
  `TransportOnboardingFields`. All new fields nullable/optional — a safe,
  additive change to a `jsonb` column, no migration needed, no existing
  row breaks. **Per-method rate cards NOT built** — replacing one
  `price_per_post` number with a structured per-advertising-method price
  list touches the booking/checkout amount calculation too, not just
  onboarding capture; scoping that in properly is a larger, separate
  change than fits safely in this pass alongside everything else — logged
  as a real follow-on, not silently dropped.
- [x] **B4** — Render the new A4 fields in their channels' existing form
  sections. **DONE** — `src/pages/PublisherApply.tsx`: new `FormState`
  fields + inputs added to the Podcast, Informal Retail, Radio, Transport,
  and Restaurants sections (show link, peak-times/hours fields, ICASA
  licence number), all optional per the schema above.
- [x] **A5** — Data needed for earned badges (Top Responder / Rising
  Publisher / Verified Since) — addresses audit 3.2. **DONE (turned out to
  need no new schema)** — Top Responder and Verified Since (D5) were both
  computable entirely from existing fields (`response_count`,
  `avg_response_hours`, `created_at`, `verified`) — no new column or
  table needed. Rising Publisher is the one that would need real schema
  work (a booking-history time series) — deferred along with D5's own
  note on it, not built partially.

## Category B — Onboarding Wizard UI (`PublisherApply.tsx`)

- [x] **B1** — Proof-of-claim upload step, gated to
  `verification_required` channels (Sports, Events, Community, Transport,
  Associations) plus optional for the others. Addresses 1.2.1.
  **DONE** — `src/pages/PublisherApply.tsx`: `VERIFICATION_REQUIRED_CHANNELS`
  constant (mirrors `channels.verification_required` — sports, events,
  community, transport, informal-retail, associations, restaurants), a
  file-upload block at the Review step for those 7 channels ("Show us
  the real thing" — up to 5 images/short videos), and
  `submitApplication()` now uploads selected files to the new bucket
  and stores their paths right after the `publishers` insert succeeds
  (keyed by the new row's real id). `src/pages/Admin.tsx`: new
  `VerificationProofThumbnails` component renders signed-URL
  thumbnails/video previews next to the existing verification checklist,
  so a reviewer finally has something to look at instead of a bare
  self-attested checkbox list.
- [x] **B2** — ~~Restaurants channel-specific form section (currently the
  only channel with zero dedicated fields)~~ **CORRECTION**: already
  rendered in full (`PublisherApply.tsx` line ~1084,
  `channelSlug === "restaurants"` block). No fix needed.
- [x] **B3** — ~~Associations channel-specific form section~~
  **CORRECTION**: already rendered in full (line ~1040,
  `channelSlug === "associations"` block). No fix needed.
- [x] **B5** — Move authority-attestation checkboxes from the Eligibility
  (first) step to the Review (last) step — addresses audit 1.3's
  friction-ordering finding. **DONE** — `src/pages/PublisherApply.tsx`:
  `checkEligibility()` now only gates on the metric threshold; the 3
  checkboxes render at Review instead, and the submit button's own
  `disabled` condition now requires them there. The "ineligible" screen's
  copy updated to match (no longer references "all three checks above").
- [x] **B6** — Make company registration/VAT number optional (not
  required) for Informal Retail and Transport applicants — audit 1.3.
  **DONE (skip the step, not just optional fields — see correction)** —
  **CORRECTION found while implementing**: these fields were already
  optional in the sense that nothing validated them before Continue; my
  original audit's framing ("being asked... is a plausible drop-off
  point") was about the ask itself, not a validation gate. Fixed that:
  `src/pages/PublisherApply.tsx`'s new `LOW_BARRIER_CHANNELS` constant
  (Informal Retail, Transport) skips the Business step screen entirely
  for those two channels — Social's Continue button goes straight to
  Review, and Review's Back button returns to Social for them
  specifically. Every other channel's flow is unchanged.

## Category C — Profile & Media Kit (`MarketplaceProfileView.tsx`, `PublisherCard.tsx`)

- [x] **C1** — ~~Wire `intro_video_url`/`portfolio_images` into every
  channel's profile branch~~ **CORRECTION**: already fully wired —
  `PublisherProfile.tsx` already renders `<PortfolioGallery
  introVideoUrl={...} images={...} />` universally, for every channel,
  positioned prominently above the channel-specific stats
  (`MarketplaceProfileView`). `PortfolioGallery.tsx` itself is entirely
  channel-agnostic (only hides when a publisher has uploaded nothing, a
  correct empty state, not a gap). My original audit was wrong here too.
  No fix needed.
- [x] **C2** — Embedded audio/stream player for Radio and Podcast profiles
  — audit 2.2. **DONE (link-out, not a full embed player — see note)** —
  `src/components/MarketplaceProfileView.tsx`: added an optional
  `listenLink` to `ProfileContent`, rendered as a prominent "🎧 Listen to
  the show" / "📻 Listen live" button. Podcast uses the new `showUrl`
  field (A4); Radio only shows it when `frequencyOrStream` is actually a
  URL (an online-only station), not for a plain "94.5 FM" terrestrial
  entry. A true embedded player was descoped — different, incompatible
  embed code is needed per platform (Spotify iframe vs. Apple Podcasts vs.
  a raw audio stream vs. RSS), which is real integration work beyond a
  single link component; a link-out still fully serves the audit's actual
  goal ("let a buyer sample the show before booking") at a fraction of the
  effort.
- [x] **C3** — Surface currently-captured-but-unshown stats: Podcast's
  `topListenerRegions`/`hostingPlatform`, Website's session-duration trend.
  **DONE (podcast); website partly a correction** —
  `src/components/MarketplaceProfileView.tsx`: podcast profile now shows
  `hostingPlatform` and up to 3 `topListenerRegions` as badges (neither
  rendered anywhere before). **Correction**: Website's `niche` was already
  shown (my original audit was wrong there) and
  `averageSessionDurationSeconds` was already a stat card — there's no
  session-duration *trend* to show because no historical time-series data
  is captured anywhere in the schema (only a single current-value field
  exists), so a trend graph isn't a UI gap, it's a data-collection gap
  outside this pass's scope.
- [x] **C4** — Distinct "Ownership Verified" badge for
  `verification_required` channels that passed the admin authority
  checklist, separate from the generic "Verified" badge — audit 2.3.
  **DONE** — `src/components/PublisherCard.tsx` and
  `src/pages/PublisherProfile.tsx`: badge now reads "✓ Ownership Verified"
  (darker green) instead of "✓ Verified" when `publisher.verified` is true
  AND the channel is one of the 7 verification-required ones. Deliberately
  keyed off `channel_slug` + the existing `verified` flag rather than
  `verification_proof_urls` — that field is correctly private (not in
  `publishers_public`'s column allowlist, item 6's own fix), so it's
  never available to the public card/profile view in the first place.
- [x] **C5** — Surface one real review quote (not just the aggregate
  rating) on the profile — audit 2.3. **DONE** —
  `src/pages/PublisherProfile.tsx`: shows the highest-rated review with
  actual comment text (not just whichever is most recent) right below the
  channel stats, with the reviewer's business name where available.
- [x] **C6** — ~~Restaurants/Associations profile branches (depends on
  A2/A3)~~ **CORRECTION**: `MarketplaceProfileView.tsx` already calls
  `getRestaurantsMetadata`/`getAssociationsMetadata` and renders both
  branches. No fix needed.

## Category D — On-Site Merchandising & Bundling

- [x] **D1** — Campaign-cost calculator widget on channel hub pages, using
  real `pricingModels`/`minBudgetZAR` — audit 3.3. **DONE** — new
  `src/components/CampaignCostCalculator.tsx`, wired into
  `src/pages/ChannelPage.tsx` (shown regardless of live/coming-soon state
  — a dormant channel benefits from a real price preview too). Slider-based
  quantity input against the channel's own real pricing model(s), floored
  at `minBudgetZAR`. Deliberately simple (min price × quantity) rather
  than a full quote engine — real quotes still happen at actual booking
  time; this is a discovery tool.
- [x] **D2** — Live scarcity/availability banner on channel hub pages —
  audit 3.3. **DONE (honest real-count version — see note)** — new
  `src/components/LiveInventoryBanner.tsx`, wired into `ChannelPage.tsx`
  for live/enabled channels. **Descoped from the audit's own literal
  example** ("3 stations have availability this week" implies a
  per-slot/per-week booking-calendar dataset that doesn't exist anywhere
  in `AvailabilityConfig` or elsewhere — only lead-time/campaign-length
  constraints are modeled, not real-time slot counts). Fabricating that
  number would mean showing fake urgency with nothing real behind it.
  Built the honest version instead: a real, live count of approved
  publishers on that channel right now, via `publishers_public`
  (item 6's safe view).
- [x] **D3** — Rule-based cross-sell bundle suggestion at campaign-creation
  time — audit 3.1. **DONE** — new `src/components/BundleSuggestion.tsx`,
  wired into `BusinessOpportunities.tsx`'s "post an opportunity" form,
  keyed off the channel selected. Static rule set (the four physical/
  local channels complement each other, per audit 3.1's own reasoning),
  not a real co-occurrence model — no fabricated stats ("+30% reach")
  shown, since no real booking-history data exists yet to back a number
  like that.
- [deferred] **D4** — "Local Business Starter Kit" landing page (Informal Retail +
  Restaurants + Community bundle) — audit 4.7. Genuinely new marketing
  page (copy, layout, its own calculator variant) rather than an
  extension of an existing component — real, valuable, but a
  content-and-design task in its own right rather than a same-pass
  addition alongside 15 other implemented fixes. `CampaignCostCalculator.tsx`
  (D1) and `BundleSuggestion.tsx` (D3) already built in this pass are the
  right building blocks for it whenever it's picked up.
- [x] **D5** — Earned-badge display (Top Responder, Rising Publisher,
  Verified Since) on profile cards — audit 3.2. **DONE (2 of 3 — see
  note)** — new `src/components/EarnedBadges.tsx`, wired into
  `PublisherProfile.tsx`. "Top Responder in category" computed client-side
  against the same category's already-loaded publisher list (needs ≥3
  responses on record to qualify, so one lucky fast reply can't out-rank
  a real track record). "Verified Since [year]" uses the existing
  `created_at`/`verified` fields. **"Rising Publisher" NOT built** — no
  time-series booking-volume data exists anywhere in this schema (only
  current-state counts), so "fastest-growing this month" isn't a real,
  honest number to compute yet; a booking-history table would be needed
  first. Logged as a real follow-on, not faked with a plausible-looking
  placeholder.
- [x] **D6** — "Be one of the first" callout for the still-dormant channels
  once each goes live — audit 3.3. **DONE** — `src/pages/ChannelPage.tsx`'s
  `ComingSoonDetail`: new callout beneath the existing "in development"
  banner, with a WhatsApp-based "Get early access" CTA (same
  `whatsappLink()` pattern the rest of this page already uses for
  coming-soon channels).

## Category E — Disruptive/Creative Features (prioritized subset)

- [deferred] **E1** — "Preview This Placement" interactive simulator (at least
  in-venue screen mockup) — audit 4.1. Needs a real visual mockup
  component per placement type (a rendered "screen" or "chat bubble"
  frame with the publisher's own uploaded image/copy composited into it)
  — genuine frontend design work, not a data-wiring task like most of
  this pass. A real, valuable follow-on; not attempted here to avoid
  shipping a half-convincing version of something whose whole value is in
  looking genuinely real.
- [deferred] **E2** — Cross-channel Reach Estimator — audit 4.4. Needs a
  cross-channel reach MODEL (converting followers/foot-traffic/
  listenership across 12 different audience-size units into one
  comparable "people reached" number) that doesn't exist anywhere in this
  codebase yet — building a plausible-sounding but ungrounded model would
  be worse than not shipping it. Real follow-on, needs a product decision
  on the actual conversion assumptions first, not just an engineering
  task.
- [x] **E3** — Publisher earnings-forecast tool, shown mid-onboarding —
  audit 4.8. **DONE** — `src/pages/PublisherApply.tsx`'s Eligibility step
  (the very first screen, before any real commitment) now shows an
  illustrative earnings range using the channel's own real
  `minBudgetZAR`, clearly labeled as a rough estimate, not a guarantee.
- [deferred] **E4** — Public "Verified Proof Wall" page — audit 4.6.
  Directly depends on A1/B1's proof uploads (now built) actually
  accumulating real submissions first — building a public gallery page
  for zero current photos would ship an empty page. Right sequencing is:
  let real applications flow in through the new upload step, then build
  this once there's real content to show. Noted as next-in-line once A1
  has real data, not indefinitely deferred.

### Explicitly deferred this pass (logged, not silently dropped)

- Dynamic flash-sale pricing for unsold inventory (audit 4.2) — needs a new
  scheduled-job system (pricing markdown + time-boxed expiry), the same
  scale of build as the grace-period/cron infrastructure retired and
  rebuilt across items 10–11 of the prior fix cycle. Real, but a
  follow-on task of its own, not a same-pass addition.
- OAuth-based social-handle verification (audit 1.3) — the
  `social-oauth-start`/`social-oauth-callback` functions exist for a
  different feature; repurposing or extending them for onboarding
  verification needs its own scoped investigation into what they
  currently do before touching them.
- Full channel-tailored creative-template generator for all 12 channels
  (audit 4.3) — building one genuinely good template per channel is a
  content-authoring task as much as an engineering one; descoped to
  documenting the concept in this log for a follow-on pass.
- Sponsored/auctioned search-result slots (audit 3.2) — needs real booking
  volume and a pricing model decision (flat-rate vs. auction) that's a
  product decision, not something to default on unprompted.
- Performance-linked CPA pricing as a promoted, first-class UI option
  (audit 4.5) — the `per_acquisition` pricing unit already exists in the
  type system; promoting it as a distinct advertiser-facing flow is a
  larger UX design task than fits this pass.

---

## Progress notes

Session summary, in build order (also see each item's own `[x]`/`[deferred]`
entry above for exact files and reasoning):

1. **A1/B1 — verification proof upload** (the audit's #1 priority
   finding). New private Storage bucket + `publishers.verification_proof_urls`
   column (`schema_phase90_verification_proof_upload.sql`); a real upload
   step in the onboarding wizard's Review page; admin's review screen now
   shows actual photo/video thumbnails via signed URLs instead of a bare
   self-attested checklist.
2. **Correction found immediately after**: the original audit's claims
   that Restaurants/Associations lack onboarding schemas (A2/A3/B2/B3/C6)
   and that generic media fields aren't wired into profiles (C1) were
   **wrong** — all of that already existed, confirmed by direct grep
   before writing any "fix." Struck through and corrected in place rather
   than silently dropped.
3. **A4/B4/C2 — missing fields + listen links.** Added `showUrl`/peak-time
   fields to Podcast, ICASA licence/peak-time to Radio, peak-hours to
   Restaurants/Transport/Informal Retail (all optional/additive, no
   migration needed). Wired a "Listen to the show"/"Listen live" link
   into public profiles using the new URL fields.
4. **C3/C4 — verification badge + stat surfacing.** Distinct "✓ Ownership
   Verified" badge (vs. generic "✓ Verified") for the 7 high-scrutiny
   channels. Podcast profiles now show hosting platform + top listener
   regions.
5. **B5/B6 — friction reorder.** Authority-attestation checkboxes moved
   from the very first screen to the Review step. Business/VAT step now
   skipped entirely for Informal Retail and Transport (not just
   non-mandatory, which it already was — a second correction to the
   original audit's framing).
6. **D1/D6 — cost calculator + dormant-channel callout.** Real interactive
   cost estimator using actual `pricingModels`/`minBudgetZAR` data, shown
   on every channel hub page. "Be one of the first" early-access callout
   for the 7 not-yet-live channels.
7. **D2 — live inventory banner**, honestly rescoped: the audit's own
   example ("3 stations have availability this week") needs real-time
   slot-booking data that doesn't exist in this schema; built the honest
   version instead — a real, live count of approved publishers per
   channel.
8. **C5/D5 — review quotes + earned badges.** Real highest-rated review
   quote surfaced on profiles (not just an aggregate star count).
   "Top Responder in category" and "Verified Since [year]" badges,
   computed from real existing data. "Rising Publisher" honestly deferred
   — no booking-volume time series exists to compute real growth.
9. **D3 — bundle suggestions.** Rule-based "pair this with" suggestion at
   campaign-creation time, static pairing rules, no fabricated reach
   percentages.
10. **E3 — publisher earnings forecast**, shown on the very first
    onboarding screen before any commitment, using real `minBudgetZAR`
    data, clearly labeled as an estimate.

**Explicitly deferred, each with its own reasoning recorded above**: per-
method rate cards (A4 partial — touches checkout pricing logic, too large
for this pass), "Rising Publisher" badge (D5/A5 — needs new
booking-history schema), the Local Business Starter Kit landing page (D4
— a content/design task), the Preview simulator (E1 — real visual design
work), the cross-channel Reach Estimator (E2 — needs a reach-conversion
model/product decision first), and the Verified Proof Wall (E4 — should
wait for real proof submissions to exist via A1 before building a public
gallery for them).

**Every file touched was balance-checked (parens/braces) after editing**;
none of this has been run in a live dev server or against a real
Supabase instance from this sandbox — same standing honesty note carried
through every prior session's SQL/test work. The first real `npm run dev`
+ a real migration run against a staging Supabase project are the actual
tests of whether this all works exactly as written.
