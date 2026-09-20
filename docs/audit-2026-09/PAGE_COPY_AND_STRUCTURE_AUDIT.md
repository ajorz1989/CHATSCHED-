# ChatSched — Page-by-Page Copy & Structural Audit

**Voice for this pass, in one line:** talk like a South African business owner to another one. Short sentences. Rand amounts instead of adjectives. "You pay only once they approve", not "transparent, secure marketplace solutions".

Two questions every page must answer in the first screenful:
- **Business:** *"How does this get me real local customers, fast, without me losing money?"*
- **Publisher:** *"How does this make me money, and when do I actually get paid?"*

Legend: **✅ done this pass** · **📋 recommended, needs sign-off**

---

## 1. `src/pages/Home.tsx` + `en/home.json` — the page that decides everything

**Problems found**

| # | Issue |
|---|---|
| H1 | Hero answered "what is this" but not "what do I get". "Reach local customers. Without the ad-platform headache." is a principle, not an offer. |
| H2 | `LayersSection` restated `TwoWaysSection` almost verbatim ("Three layers" vs "Two ways") — two sections, one message, ~900px of scroll. |
| H3 | The "LOCAL BY DESIGN" cards **sold three channels that cannot be booked** (taxi, spaza, associations) — a direct copy-vs-database contradiction. |
| H4 | Pricing block hardcoded `R399` / `R199` while `BUSINESS_SUBSCRIPTION_PRICE` / `PUBLISHER_SUBSCRIPTION_PRICE` exist in `constants.ts`. |
| H5 | The R199 **launch credit** — a real, shipped incentive (`schema_phase88`) — was missing from the highest-traffic pricing block. |
| H6 | `comparison.platforms` was an **empty string in all four languages**, so the comparison table rendered with a blank header cell (this was also the only failing test in the suite). |
| H7 | ~40% of `home.json` was dead keys (10 unused groups) across four locales. |
| H8 | The channel strip omitted `social-media` — the only channel with live inventory. |

**Copy changes (✅ done)**

| Element | Before | After |
|---|---|---|
| Hero badge | "LOCAL ADVERTISING, WITHOUT THE HEADACHE" | "LOCAL ADVERTISING · NO AD ACCOUNT · NO AUCTION" |
| H1 | "Reach local customers. / Without the ad-platform headache." | "Reach the people who / actually buy in your suburb." |
| Hero sub | "Tell us your goal and budget — we build the campaign…" | "Pick a local page, creator, podcast, radio slot or venue screen. Send one request — you pay only once they approve, and ChatSched holds the money until your ad is live. Then you keep the proof." |
| Primary CTA | "Build My Campaign →" | "Build My Campaign — free →" |
| Secondary CTA | "Browse Advertising →" | "Browse Ad Space →" |
| Trust chips | "One tracked workflow" | "One request-to-proof workflow" |
| Two ways | "One platform. Choose how much help you want." | "Do it yourself, or hand us the brief." |
| Managed card body | "Tell us your goal, audience and budget…" | "…you approve before a cent is paid." |
| Marketplace card body | "Search real advertising inventory…" | "See exactly who you're booking, what they charge and how big their audience is." |
| Comparison row: proof | "Dashboard metrics" vs "Placement proof" | "Metrics you have to interpret" vs "Screenshot proof plus a tracked link" |
| Marketplace section | "Advertising inventory is already waiting." | "Real local ad space. Real prices. No mystery." |
| How-it-works step 3 | "Choose the placement" | "The publisher approves — they accept within 3 days, or the request closes itself. No ghosting." |
| How-it-works step 6 | "Keep the proof" | "You keep the proof — screenshot proof and a tracked link land in your dashboard." |
| Local section bodies | Sold taxi/spaza/association inventory as available | State real status: "opens once local traders are verified", "being onboarded", "onboarding now" |
| Final CTA | "Ready to reach your customers?" | "Your next customers already follow someone local." |
| Final closer | "No ad account. No bidding war. One tracked workflow." | "No ad account. No auction. Money held until you're live." |

**Structural changes (✅ done)**

1. `LayersSection` deleted (component + render + all four locales' key group).
2. Pricing figures bound to `BUSINESS_SUBSCRIPTION_PRICE` / `PUBLISHER_SUBSCRIPTION_PRICE` via `formatCurrency`.
3. `comparison.platforms` filled in **all four languages** ("What you're comparing" / "Wat jy vergelyk" / "Okuthelekiswayo" / "Okugathaniswayo") — test suite back to 195/195.
4. Ten dead key groups removed from `home.json` in all four locales (key sets verified identical).
5. Channel strip rebuilt (see `DATABASE_FRONTEND_MATRIX.md` CH-04).

**Recommended next (📋)**

- Add the **R199 launch credit** to the Home pricing block ("…includes a R199 launch credit toward your first booking") — highest-value missing line on the site.
- Social proof: Home has metrics but no **named** evidence. `/case-studies` holds six scenarios — promote one to the homepage with a "See the whole booking" link.

---

## 2. `src/components/Header.tsx` ✅

| Before | After |
|---|---|
| 6 primary links (Browse, Build a Campaign, Channels, Tools, For Publishers, **Pricing**) | **5 primary links**: Browse Ad Space · Build a Campaign · Channels · Tools · Publishers |
| 8+ footer-only destinations effectively buried | A **"More" dropdown** (Compare channels, Pricing, How it works, Case studies, Audience Finder, Categories, Suburbs, Trust Centre) — click-outside + Esc to close, closes on route change, `aria-expanded`/`aria-haspopup` set |
| Mobile drawer = same 6 links | Drawer = the same 5, then a labelled "More" group — mobile now has the same hierarchy as desktop |
| Nav labels: "Browse", "For Publishers", "Get Started" | "Browse Ad Space", "Publishers", "Get Started Free" |

## 3. `src/components/Footer.tsx` ✅

- **Merge-conflict markers were committed to `main` at lines 60/62/65** (`<<<<<<< HEAD` … `>>>>>>> origin/about-page-merge`) in a shipped file. Resolved, keeping the `Trust &amp; Help` heading and the `About ChatSched` link the merge was trying to add.
- Added a **quick-links row** mirroring the header's five destinations, so header and footer share one mental model.
- Columns reorganised from a flat "Platform / Explore / Trust & Help / Contact" dump into task groups: **Advertise · Publish · Trust & help · Company**.
- Dropped `/suburbs` → caught and re-added to both the More menu and the footer before it became orphaned.
- Newsletter strip rewritten: "One email a month. Real numbers." (was "Stay in the loop" — no reason to subscribe).

## 4. `src/components/LiveChannelTabs.tsx` ✅

Gallery bug: the component that renders "where your customers pay attention" on **Home and Categories** hard-coded 4 slugs and **omitted `social-media`** — the live marketplace. Now registry-driven: every enabled channel gets a tab (social-media links straight to `/browse`), plus an "Opening soon" chip row for registered-but-off channels. A new channel added to `src/channels/` appears here with zero code changes.

## 5. `src/pages/ChannelHub.tsx` ✅

| Element | Before | After |
|---|---|---|
| H1 | "Every board your customers already look at." | "Every place your customers already look." |
| Body | "Browse the advertising inventory available through ChatSched…" | "{n} channels are taking paid bookings right now. The rest are registered and being onboarded — shown as **Coming soon** so you always know whether there's real inventory behind a channel." |
| CTAs | "Explore live inventory →" / "Audience Finder" | "Compare channels side by side →" / "Browse live ad space →" |
| Bottom CTA | "Ready to advertise?" + generic copy | "Not sure which channel to pick?" → build a campaign or compare |
| SEO title | "Advertising Channels — ChatSched" | "Advertising channels — what's open, what's coming \| ChatSched" |

The open/coming-soon count is now computed from `isChannelEnabled()` rather than being asserted in prose.

## 6. `src/pages/ChannelComparison.tsx` — **NEW** ✅

The missing high-intent page. Every channel side by side: cheapest way in, booking notice, who you reach, live status — sortable by price/lead time, filterable to bookable-today, expandable for measurable metrics, audience signals, a real example and the publisher checks we run. 100% registry-driven. Full rationale in `SITE_ARCHITECTURE_MAP.md` §3.

## 7. `src/pages/ForPublishers.tsx` ✅

- Badge **"Five ways to get booked"** corrected → "{n} channels earning right now", with the grid split into **Open now** (each card links to `/register?role=publisher&channel=…`) and **Opening soon** ("get in before the rush" — turns a missing channel into a supply-acquisition pitch).
- All other copy left intact: it already answers the money question well ("R199 once-off", "payment confirmed before you ever post", "payout within 48 hours", "you keep 92%", "never chase an invoice again").

## 8. `src/pages/ForBusinesses.tsx` + `forBusinesses.json` ✅

- Badge **"Five channels, one flow"** (13 render) → derived "{n} open now · {n} opening soon", with "Book now" markers and a roadmap row linking to the Hub.
- Tools list corrected against the database: **"Match" → "Audience Finder"**, plus the two missing tools (**Caption Writer**, **Media Kit**) — the list now matches the 8 `active` rows in `public.tools` exactly.
- Added a "Compare channels side by side →" CTA.
- Channel subtitle rewritten to name the channels that are actually bookable.

## 9. `src/pages/PlatformRules.tsx` ✅

`Seo` was imported and never rendered — a compliance page indexed under a blank title. Added a real title + description ("What each social platform expects from a sponsored post — disclosure wording, restricted categories, and proof requirements — so your South African campaign doesn't get pulled after it goes live").

## 10. `src/pages/BuildMyCampaign.tsx` ✅

Committed broken: an unclosed `<div>` at line 712 and a pasted block containing **literal `\n` escape sequences** (a bad automated edit) at 734, plus a duplicated sticky-nav wrapper. Repaired; the case-study banner now renders correctly above the wizard. Copy reviewed and kept: the wizard is already plain-language ("Tell us what you want to achieve, who you want to reach, what you want to invest and when you want to run") with a strong approval-before-payment promise.

## 11. `src/pages/HowItWorks.tsx` ✅

Five string literals were written with doubled quotes (`: ""Feature our new autumn menu…"",`) — a syntax error committed to `main`. Repaired. Copy left as written; it already reads plainly.

## 12. Other pages — assessment

| Page | Copy | Structure | Notes |
|---|---|---|---|
| `/browse` | Strong ("Find where your customers already spend their attention.") | Removed a dead icon map + unused binding | Channel filter correctly shows only live channels |
| `/pricing` | Strong, honest, once-off framing | — | 📋 surface Featured Placement + launch credit more prominently |
| `/case-studies` | "Not sure what a booking actually looks like? We walk through three." | Typed `channelSlugs` as `ChannelSlug[]` (was `string[]`, a type error) | 📋 promote one scenario to Home |
| `/trust`, `/compliance`, `/how-payment-works` | Good — plain-language escrow explanation | — | Keep |
| `/faq` | "Questions, answered honestly." | — | 📋 absorb `/glossary` terms |
| `/audience-finder`, `/reach-checker`, `/budget-calculator`, `/media-kit` | Good hooks | — | 📋 present as the four public tools they are, linked from `/tools` |
| `/channels/:slug` | Uses registry tagline + benefits | "Coming soon" channels get an honest apply-early CTA | Keep |
| `/tools`, `/tools/:slug` | Good | Coming-soon CTA contradicts the DB's `Join Waitlist` label | See TOOL-01 |
| `/for-businesses` SEO/meta | Rewritten this pass to lead with the offer | — | Keep |
| `/about` | Already absorbed Mission + Roadmap | `/mission` and `/roadmap` now redirect here | ✅ |
| `/mission`, `/roadmap` | Duplicated content inside `/about` | **Deleted**, redirects added | ✅ |
| `/network` | Positioning essay over the same registry list as `/channels` | 📋 merge as a `/channels` section |
| `/earnings-estimator` | Fine | **Zero inbound links** | 📋 fold into `/for-publishers` |
| `/glossary`, `/accessibility` | Thin | Orphaned | 📋 fold / expand, else retire |
| Admin + dashboard pages | Out of scope for marketing voice | Build-blocking type errors fixed (`AdminTab` cycle, unused vars) | — |

## 13. Translation debt created by this pass (must be cleared before launch)

The four locales must keep identical key sets (enforced by `keyParity.test.ts`), and that test passes. However:

- New keys added in English only: `nav.more`, `nav.compareChannels`, `nav.caseStudies`.
- English marketing copy was rewritten in `home.json` and `forBusinesses.json` while `af`/`xh`/`zu` kept their previous (now stale) translations of the same keys.
- Two new tool cards (`Caption Writer`, `Media Kit`) carry English body text in the `af`/`xh`/`zu` files.

`xh`/`zu` were already flagged in `src/i18n/index.ts` as unreviewed first passes. **Recommendation:** before launch, have a native speaker review `home.json` + `forBusinesses.json` for `af`/`xh`/`zu` in one sitting — the file structure and the parity test will hold automatically.
