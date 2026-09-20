# ChatSched — Database ↔ Frontend Discrepancy Matrix

**Pass date:** September 2026
**Scope:** every advertising channel and every first-party tool defined in the schema, checked against what the frontend actually markets.
**Method:** read `supabase/schema*.sql` for the source of truth (`public.channels`, `public.tools`, `public.tool_features/benefits/faqs`), then traced each row to its UI surface(s) with `grep` across `src/`.

---

## 1. Advertising channels

### 1.1 The registry is the shared source of truth — and it disagrees with the database in one specific way

`public.channels` (created in `schema_phase74`, extended by 75/76/77/96) holds one row per channel with an `active` flag. The frontend has a parallel, richer definition in `src/lib/channelTypes.ts` + `src/channels/<slug>/index.ts`, gated at runtime by `src/lib/featureFlags.ts`.

| Channel slug | DB `channels.active` | Frontend flag | Module `isLive` | Module `bookingFlow` | Min spend | What the frontend actually says |
|---|---|---|---|---|---|---|
| `social-media` | `true` | always on (no flag) | `true` | directory | R250 | ✓ everywhere — but has **no tab on the Home channel strip** (fixed this pass) |
| `influencer` | `true` | on (default) | `true` | request | R2 000 | ✓ Hub card, Home tab, Browse filter, ForBusinesses, ForPublishers |
| `podcast` | `true` | on (default) | `true` | request | R1 500 | ✓ same as above |
| `website` | `true` | on (default) | `true` | request | R500 | ✓ same as above |
| `radio` | `true` | on (default) | `true` | request | R2 500 | ✓ same as above |
| `sports` | `false` | **off** (reverted, phase92) | **`true` ⚠** | request | R500 | Hub card "Coming soon"; invisible on Home/Categories |
| `events` | `false` | **off** | **`true` ⚠** | request | R1 000 | Hub card "Coming soon" |
| `community` | `false` | **off** | **`true` ⚠** | request | R300 | Hub card "Coming soon" |
| `transport` | `false` | **off** | **`true` ⚠** | request | R300 | **Marketed as a live Home section** ("Minibus Taxi & Transport Media") — see 1.2 |
| `informal-retail` | `false` | **off** | **`true` ⚠** | request | R150 | **Marketed as a live Home section** ("Spaza Shops & Township Traders") — see 1.2 |
| `associations` | `false` | **off** | **`true` ⚠** | request | R500 | **Marketed as a live Home section** ("Local Associations & Networks") — see 1.2 |
| `restaurants` | `false` | **off** | **`true` ⚠** | request | R200 | Hub card "Coming soon" |
| `in-venue-screens` | `false` | **off** (deliberate, manual workflow) | **`true` ⚠** | request | R200 | Hub card "Coming soon"; used as a live example in Case Studies |

**Finding CH-01 (medium):** all 13 channel modules declare `isLive: true`, including the 8 whose DB row has `active = false` and whose feature flag is off. Nothing breaks today only because `ChannelHub`/`Browse`/`LiveChannelTabs` consult the feature flag first — `isLive` is never read on its own except inside an already-enabled branch. That's a trap: the moment someone flips an env var, a card that has never been reviewed for launch reads "Explore inventory →". **Recommendation:** derive `isLive` from the DB row (or delete it and keep the feature flag as the single authority), and have the admin channel table surface `channels.active` next to the flag so the two can't drift silently.

**Finding CH-02 (high — copy vs reality):** the Home page's "LOCAL BY DESIGN" block sold four channels, three of which are not bookable:
- "Spaza Shops & Township Traders" (`informal-retail`, flag off)
- "Minibus Taxi & Transport Media" (`transport`, flag off)
- "Local Associations & Networks" (`associations`, flag off)

A business landing on the homepage concluded these were buyable. **Fixed this pass** — the four cards now state their real status ("opens once local traders are verified", "being onboarded", etc.), and the suburb card stays factual.

**Finding CH-03 (high — visible contradiction):** ForPublishers' channels badge read **"Five ways to get booked"** above a grid that renders `getAllChannels()` — all **13** modules — with no status marker at all. On the same page, `/for-businesses` said **"Five channels, one flow"**. Meanwhile `About.tsx`, `Admin.tsx`, `Register.tsx`, `BusinessOpportunities.tsx`, `OpportunityFeed.tsx`, `MarketplaceProfileView.tsx` and `channelOnboardingSchemas.ts` all carry **"12 channels"** comments/strings, and `publisherVisual.ts` / `AdminVisualIdentity.tsx` say **13**. **Fixed this pass** for both marketing pages: badge, headline and grid are now derived from the registry + feature flags, split into "Open now" and "Opening soon".

**Finding CH-04 (medium):** `LiveChannelTabs` (Home + Categories) hard-coded four slugs — influencer, website, podcast, radio — and **omitted `social-media`**, the one channel with real inventory. Home therefore showed a tab strip that hid its own marketplace. **Fixed this pass:** tabs are generated from every enabled channel (social-media included, linking straight to `/browse`), with a registry-driven "Opening soon" row beneath so all 13 channels have representation on Home and Categories.

**Finding CH-05 (low):** `src/channels/*/index.ts` uses `isLive: true` as a static property, while `channels.active` is the DB's own launch switch and `verification_required` is a separate DB column the frontend never reads (publisher verification gating lives in application code instead). No user-visible effect today; flagged so the next channel added doesn't assume the column is wired.

### 1.2 Where each channel is represented

| Surface | Source | Result |
|---|---|---|
| `/channels` (Channel Hub) | `getAllChannels()` + `isChannelEnabled()` | all 13 shown, 8 badged "Coming soon" |
| `/channels/:slug` | registry + flag | live channels get the full detail page; off channels get the road-map CTA |
| Home channel strip | `getAllChannels()` + flag (after this pass) | 5 tabs + 8 "opening soon" chips |
| `/categories` channel section | same component | same |
| `/browse` channel filter | `getEnabledChannels()` | 5 only — correct (you can't filter for inventory that doesn't exist) |
| `/for-businesses` | registry + flag (after this pass) | 5 "Book now" cards + roadmap row |
| `/for-publishers` | registry + flag (after this pass) | 5 "Open now" + 8 "Opening soon", each linking to the right application URL |
| `SiteSearch` | `getAllChannels()` | all 13 searchable |
| `/channels/compare` (**new this pass**) | registry + flag | all 13, with status column |
| Footer | static | previously linked only 5 channel-related URLs; now links the Hub + Compare |
| `/media-kit` | n/a (business-side asset) | not channel-scoped — see MERGE-02 |

**Verdict:** every registered channel now has at least one accurate, status-labelled UI representation, and the two marketing pages can no longer claim a channel is live when it isn't.

---

## 2. First-party tools (`public.tools`)

`schema_phase100` seeds 8 `active` tools and 5 `coming_soon` tools, with RLS exposing both to the public catalogue. Frontend coverage after this pass:

| DB slug | DB name | Status | CTA target (`tools.cta_url`) | Frontend surface(s) | Gap found |
|---|---|---|---|---|---|
| `audience-finder` | Audience Finder | active | `/audience-finder` | `/audience-finder` page, `/tools`, Home teaser, ForBusinesses list | **Was called "Match"** in `forBusinesses.json` — renamed to match the database |
| `reach-planner` | Reach Planner | active | `/reach-checker` | `/reach-checker` page, `/tools` | Name drift: DB "Reach Planner" vs page title "Local Reach Checker". Considered acceptable (the page is the public face, the module is the dashboard version) but flagged |
| `content-studio` | Content Studio | active | `/dashboard?tool=content` | dashboard module, `/tools` | none |
| `caption-writer` | Caption Writer | active | `/dashboard?tool=captions` | dashboard module, `/tools` | **Had no marketing card at all** — added to `/for-businesses` |
| `campaign-builder` | Campaign Builder | active | `/dashboard?tool=builder` | dashboard module, `/tools` | none |
| `media-kit` | Media Kit | active | `/media-kit` | `/media-kit` page, `/tools` | **Had no card on `/for-businesses`** — added |
| `roi-calculator` | ROI Calculator | active | `/budget-calculator` | `/budget-calculator` page, `/tools` | none |
| `campaign-tracker` | Campaign Tracker | active | `/dashboard?tool=tracking` | dashboard module, `/tools` | none |
| `ai-receptionist` | ChatSched AI Receptionist | coming_soon | — | `/tools`, `/tools/:slug` | See TOOL-01 |
| `quote-engine` | ChatSched Quote Engine | coming_soon | — | `/tools`, `/tools/:slug` | See TOOL-01 |
| `booking-engine` | ChatSched Booking Engine | coming_soon | — | `/tools`, `/tools/:slug` | See TOOL-01 |
| `review-recovery` | ChatSched Review Recovery | coming_soon | — | `/tools`, `/tools/:slug` | See TOOL-01 |
| `smart-offers` | ChatSched Smart Offers | coming_soon | — | `/tools`, `/tools/:slug` | See TOOL-01 |

**Finding TOOL-01 (medium):** the DB gives every `coming_soon` tool `cta_label = 'Join Waitlist'`, but `Tools.tsx` hard-overrides the label to "Learn more →" and `ToolDetail.tsx` replaces the CTA entirely with a non-interactive "Coming soon" pill plus a "use the contact page" paragraph. The waitlist intent stored in the database never reaches the UI, and there is no waitlist capture anywhere. Either wire a real capture (a `tool_waitlist` table + form) or change the DB label to match what the UI does — right now the source of truth and the render disagree.

**Finding TOOL-02 (low):** `EarningsEstimator` (`/earnings-estimator`) is a real shipped page, deliberately **not** in the tools catalogue (the schema comment explains: it's publisher-facing, the catalogue is business-facing). It is also unreachable — **zero inbound links** anywhere in the codebase. Either give it a home (Publisher Network funnel) or retire it.

**Finding TOOL-03 (low):** `Featured Placement` (R99/mo, `schema_phase87`) is a real, billable publisher product surfaced only inside `PublisherDashboardView` and a single FAQ answer. It is not on `/for-publishers`, `/pricing` or `/fees`. That is under-marketing of something already in production.

---

## 3. Revenue & pricing alignment

| Product | Source of truth | Frontend | Status |
|---|---|---|---|
| Business activation | `BUSINESS_SUBSCRIPTION_PRICE = 399` | `/pricing`, `/fees`, Home | ✓ — but Home **hardcoded "R399"**; now bound to the constant |
| Publisher activation | `PUBLISHER_SUBSCRIPTION_PRICE = 199` | `/for-publishers`, Home, `/pricing` | ✓ — same hardcoding fixed |
| Launch credit | `BUSINESS_LAUNCH_CREDIT_AMOUNT = 199`, `schema_phase88` | `ActivationFeeInfo`, `Faq`, `Fees`, `Pricing`, `SubscriptionSection`, `ActivationNudge` | ✗ **absent from the Home pricing block** — the single strongest business-side incentive was never on the highest-traffic page |
| Platform commission | `PLATFORM_COMMISSION_RATE = 0.08` (publisher keeps 92%) | Home, ForPublishers, Fees, HowPaymentWorks | ✓ (Home interpolates the constants) |
| Featured placement | `FEATURED_PLACEMENT_MONTHLY_PRICE = 99` | dashboard + one FAQ | → TOOL-03 |
| Content Studio tier | `CONTENT_STUDIO_MONTHLY_PRICE = 99` | `schema_phase103` tier + dashboard | not marketed publicly — flagged, not a defect |
| Channel minimums | `minBudgetZAR` per module (R150 informal-retail → R2 500 radio) | was shown only on channel pages | now also on `/channels/compare` |

---

## 4. What was fixed in code during this pass

1. `LiveChannelTabs.tsx` — registry-driven tabs including `social-media` + "Opening soon" row for all off channels.
2. `ForPublishers.tsx` — "Five ways to get booked" → live count; grid split into "Open now" / "Opening soon" with per-channel application links.
3. `ForBusinesses.tsx` + `forBusinesses.json` — "Five channels, one flow" badge replaced with a derived count; two missing tools (Caption Writer, Media Kit) added and "Match" corrected to "Audience Finder"; channels split by real status.
4. `Home.tsx` — "LOCAL BY DESIGN" cards no longer imply unlaunched channels are bookable; pricing figures bound to the shared constants.
5. `ChannelHub.tsx` — heading now states the real open/coming-soon split computed from the flag.
6. New `/channels/compare` — every channel with min spend, booking notice, audience signals and live status, all registry-derived.
7. `i18n` — empty `comparison.platforms` value (a blank table header in all four languages) filled in; ~10 dead key groups pruned from `home.json` across all four locales.

## 5. Open items needing a product decision (not fixable in code alone)

- **CH-01** — retire `isLive` in favour of `channels.active` + the feature flag, or wire the DB column to the UI.
- **TOOL-01** — build a real waitlist, or stop advertising one.
- **TOOL-02** — publish or retire `/earnings-estimator`.
- **TOOL-03** — put Featured Placement on the publisher funnel.
- **The 12-vs-13 question** — the codebase, the registry and the database all say **13**. Decide that publicly (copy, press, pitch deck) and delete the remaining "12" comments in the same commit.
