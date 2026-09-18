# ChatSched Layer 1 — Updated End-to-End Product, Copy, UX & Code Audit

**Repository:** `chatsched-final-form (1)` from `chatsched-merged-12channel-audit (1).zip`
**Date:** 16 September 2026
**Scope:** 96 page files, 82 components, 68 lib/service files, 98 SQL migrations, 21 Supabase Edge Functions, i18n locales, routing, E2E configuration.

> Evidence note: this is a static repository audit. No production Supabase project, deployed Vercel app, PayFast merchant account, or live inventory was queried. Build/type-check could not be completed because dependency installation timed out; a global TypeScript transpile/syntax pass across TS/TSX files returned zero syntax diagnostics, and all JSON locale files parsed successfully.

## 1. Executive verdict

| Area | Score |
|---|---:|
| Positioning | 8.7/10 |
| Conversion copy | 7.8/10 |
| Marketplace UX | 8.2/10 |
| Channel architecture | 9.0/10 |
| Database/service alignment | 8.7/10 static |
| Security posture | 8.0/10 static |
| Testing | 7.2/10 after Layer 1 test alignment |
| Overall | **8.3/10** |

The product is now much clearer when framed as **local advertising infrastructure for SMMEs**: browse verified placements, build managed campaigns, or list advertising inventory. The main remaining work is backend/production verification and finishing the deeper consolidation of secondary pages.

## 2. Layer 1 changes implemented in this ZIP

- **Navigation simplified** to Browse, Build a Campaign, Channels, For Publishers, Pricing, with Get Started as the primary action.
- **Footer condensed** from a sitemap-style list into five useful groups.
- **Channel visibility aligned** with the feature-flag model: social media + influencer + podcast + website + radio are the default-live set; the other 8 remain coming soon unless explicitly enabled.
- **Channel tabs now filter against the live feature flag** and expose proper `tab` / `tabpanel` semantics.
- **Channel Hub “Open now” count now uses actual enabled state**, not stale `definition.isLive` metadata.
- **Homepage removed unsupported-looking traction counters** and replaced them with outcome/proof statements.
- **Home positioning sharpened** around local customers, managed vs self-service, and platform-mediated campaign requests.
- **Customer-facing payment language no longer says “escrow”** in the English business flow; it now describes the ChatSched payment flow precisely.
- **About / FAQ / Terms language tightened** to avoid implying off-platform direct booking or contact.
- **Playwright base URL aligned to Vite port 3000**, and stale E2E specs were replaced with current public-route smoke tests.
- **Categories copy fixed** so it no longer claims only four channels without context.

## 3. Critical findings

### C-01 — Production channel state still has two potential sources of truth

The public UI now follows `isChannelEnabled()`, and the default-live array matches the documented four launched non-social channels. However, `channels.active` in Postgres is a separate state field. Static code review confirms the frontend does not query `channels.active`. Production should therefore include a deployment check that verifies the enabled channel set and database `active` flags match.

**Action:** create a small admin diagnostics query/RPC that reports `feature flag`, `channels.active`, inventory count, and verified supply by slug. Do not expose a channel as live until those values agree.

### C-02 — Payment wording must remain legally accurate

English customer-facing copy has been changed from “escrow” to “payment flow/hold”. Keep this wording until the provider/legal structure has been explicitly verified. `SiteSearch`, Glossary and non-English locales still contain escrow terminology and should receive a dedicated translation/legal terminology pass.

### C-03 — Anti-bypass architecture is present but needs production verification

`schema_phase85_retire_direct_messaging.sql` removes ordinary-business creation of new unmediated conversations and preserves admin-originated conversations. `PublisherProfile.tsx` already uses “Start Campaign Request”. The remaining task is production-level testing: attempt a direct `conversations` insert with a normal business JWT and assert rejection.

### C-04 — Build validation remains outstanding

Dependency installation timed out twice in the sandbox. Syntax transpilation passed, but this is not a substitute for `tsc -b`, Vite build, Vitest and Playwright against a real environment.

## 4. High findings

- **H-01 Pricing decision must be frozen.** Current source of truth is `BUSINESS_SUBSCRIPTION_PRICE = 399`, publisher activation `199`, and commission `8%`. Do not change public price copy alone. If the commercial decision becomes R299, update constants, Edge Functions, migrations/documentation and tests together.
- **H-02 Hardcoded homepage traction claims were removed.** If future traction numbers return, derive them from verified statistics and display a date/source.
- **H-03 The “TrustedBy” component needs relationship verification before being used as social proof.**
- **H-04 `in-venue-screens` is the 13th registered channel.** The repository and marketing copy should stop saying “12 channels”. Present it as “13 channel types registered” or “5 live + 8 in development”.
- **H-05 Public taxonomy should prefer “publisher / inventory owner” over “creator” when the channel may be a venue, radio station, team, restaurant or association.
- **H-06 The first-party Marketing Suite is real; future products such as WhatsApp Receptionist, Quote Engine and Review Recovery are roadmap concepts, not current backend services. Keep them out of “live tools” marketing until entitlement/billing/service code exists.
- **H-07 In-venue screens remain a beta architecture: schema/channel definition exists, but the repository does not prove a complete production playback/scheduling/proof network. Label as Beta / Applications Open.
- **H-08 Payout worker remains a production risk.** `workers/payoutWorker.js` documents provider/signing placeholders; payment copy must not promise automated settlement beyond the verified path.

## 5. Database vs frontend discrepancy matrix

| Service/channel | Backend/schema evidence | Frontend | Status | Action |
|---|---|---|---|---|
| Social media | Core publisher/request model + directory booking flow | Browse, Home, channel hub, publisher profiles | LIVE | Keep as core inventory |
| Influencer | Typed request fields + channel module + request flow | Channel Hub, channel page, publisher/request surfaces | LIVE by default after Layer 1 | Keep |
| Podcast | Typed request fields + module + request flow | Channel Hub, channel page | LIVE by default after Layer 1 | Keep |
| Website | Typed request fields + module + request flow | Channel Hub, channel page | LIVE by default after Layer 1 | Keep |
| Radio | Typed request fields + module + request flow | Channel Hub, channel page | LIVE by default after Layer 1 | Keep |
| Sports | Schema/module present | Frontend detail pages and application paths exist | COMING SOON | Add supply-first state |
| Events | Schema/module present | Frontend detail pages and application paths exist | COMING SOON | Add verified event inventory first |
| Community | Schema/module present | Frontend detail pages and application paths exist | COMING SOON | Add verified groups first |
| Transport | Schema/module present | Frontend detail pages and application paths exist | COMING SOON | Add route/media inventory first |
| Informal retail | Schema/module present | Frontend detail pages and application paths exist | COMING SOON | Add real shops/inventory first |
| Associations | Schema/module present | Frontend detail pages and application paths exist | COMING SOON | Add association inventory first |
| Restaurants | Schema/module present | Frontend detail pages and application paths exist | COMING SOON | Add restaurant placements first |
| In-venue screens | Phase 96 channel schema/module; manual Phase-1 delivery notes | Channel registry/detail route present | BETA / COMING SOON | Do not advertise as fully automated DOOH until playback proof is built |
| Marketing Suite | Real match/reach/content/campaign/ROI tooling in source | Business-facing tools/pages | LIVE | Package as ChatSched Tools / Marketing Suite |
| WhatsApp receptionist | No dedicated production service found in audited schema/functions | No dedicated production product page/service | ROADMAP | Do not market as live |
| Lead capture | Public forms + agency leads + rate-limited Edge Function | Forms and agency flow | LIVE | Position as lead capture workflow, not a generic SaaS tool |
| Quote/booking/review/offer tools | No equivalent dedicated backend product service found | No dedicated production product page/service | ROADMAP | Keep in roadmap |

## 6. Simplified site architecture

### Primary navigation
`Browse` · `Build a Campaign` · `Channels` · `For Publishers` · `Pricing` · **Get Started**

### Recommended hubs
- `/browse` — all live inventory discovery
- `/build-my-campaign` — managed advertising
- `/channels` — live + coming-soon channel catalogue
- `/for-publishers` — supply acquisition / publisher network
- `/pricing` — activation + fees + payment overview
- `/how-it-works` — consolidated buyer/publisher/payment flow
- `/trust` — verification, safety, disputes, payments, compliance
- `/help` — FAQ + support + glossary
- `/resources` — future content hub combining blog/success stories (route can initially be `/blog`)

### Routes to retain as redirects/secondary
`/fees`, `/how-payment-works`, `/faq`, `/glossary`, `/media-network`, `/safety`, `/fraud-prevention`, `/creator-standards`, `/business-standards`, and company/resource pages should remain reachable for SEO/bookmarks but disappear from primary navigation.

## 7. Page-by-page structural audit — all page files

| Page | Route status | Recommendation | Core improvement |
|---|---|---|---|
| `About.tsx` | /about | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Accessibility.tsx` | /accessibility | KEEP/HUB — trust/legal | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `AccountSettings.tsx` | /account | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Admin.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminAnalytics.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminAuditLog.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminCampaigns.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminCareers.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminChannelRequests.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminClients.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminCompliance.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminLeads.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminMessageSafety.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminOpportunities.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminPayouts.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `AdminSecurity.tsx` | No direct route / nested or imported | KEEP — contextual/app | Internal-only; audit RBAC and do not place in marketing navigation. |
| `Advertise.tsx` | /advertise | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `AudienceFinder.tsx` | /audience-finder | KEEP — core funnel | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Blog.tsx` | /blog | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `BlogPost.tsx` | /blog/:slug | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `Browse.tsx` | /browse | KEEP — core funnel | Keep filters progressive; make “Request placement” the obvious next step. |
| `BudgetCalculator.tsx` | /budget-calculator | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `BuildMyCampaign.tsx` | /build-my-campaign | KEEP — core funnel | Keep the landing page focused on one audience and one dominant CTA. |
| `BusinessOpportunities.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `BusinessPublisherRelationships.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `BusinessStandards.tsx` | /trust/business-standards | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `BusinessSuccess.tsx` | /business-success | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `BusinessSuccessArticle.tsx` | /business-success/:slug | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `CampaignCompliance.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `CampaignWorkspace.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Careers.tsx` | /careers | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `CaseStudies.tsx` | /case-studies | KEEP — core funnel | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Categories.tsx` | /categories | KEEP — core funnel | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `ChannelHub.tsx` | /channels | KEEP — core funnel | Live/coming-soon state from feature flag; use “inventory/placement” vocabulary. |
| `ChannelPage.tsx` | /channels/:slug | KEEP — core funnel | Above fold should answer audience, placement, price, availability, proof and CTA. |
| `ChannelQuiz.tsx` | /channel-quiz | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `ComingSoon.tsx` | * | REPLACE — dedicated 404 | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Community.tsx` | /community | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `CommunityAnnouncements.tsx` | /community/announcements | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `CommunityEvents.tsx` | /community/events | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `CommunityQa.tsx` | /community/qa | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `ComparePublishers.tsx` | /compare | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Compliance.tsx` | /compliance | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `Contact.tsx` | /contact | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `CreatorStandards.tsx` | /trust/creator-standards | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `Dashboard.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `EarningsDashboard.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `EarningsEstimator.tsx` | /earnings-estimator | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Faq.tsx` | /faq | MERGE/HUB — Help | Consolidate into Help hub with search and contextual links. |
| `Fees.tsx` | /fees | MERGE INTO Pricing | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `ForBusinesses.tsx` | /for-businesses | KEEP — core funnel | Keep the landing page focused on one audience and one dominant CTA. |
| `ForPublishers.tsx` | /for-publishers | KEEP — core funnel | Keep the landing page focused on one audience and one dominant CTA. |
| `ForgotPassword.tsx` | /forgot-password | KEEP — auth | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `FraudPrevention.tsx` | /trust/fraud-prevention | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `Glossary.tsx` | /glossary | MERGE/HUB — Help | Consolidate into Help hub with search and contextual links. |
| `Help.tsx` | /help | MERGE/HUB — Help | Consolidate into Help hub with search and contextual links. |
| `Home.tsx` | / | KEEP — core funnel | Outcome-first hero; managed vs self-service; no unsupported counters. |
| `HowItWorks.tsx` | /how-it-works | MERGE/HUB — How it works | Consolidate into one concise sequence; remove legal/operational overclaiming. |
| `HowPaymentWorks.tsx` | /how-payment-works | MERGE/HUB — How it works | Consolidate into one concise sequence; remove legal/operational overclaiming. |
| `Investors.tsx` | /investors | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Login.tsx` | /login | KEEP — auth | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `MapView.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `MediaKit.tsx` | /media-kit | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `MediaNetwork.tsx` | /network | MERGE INTO For Publishers | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Messages.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `MfaSetup.tsx` | /mfa-setup | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `MfaVerify.tsx` | /mfa-verify | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Mission.tsx` | /mission | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `OpportunityFeed.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Partners.tsx` | /partners | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `PartnersApply.tsx` | /partners/apply | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `PaymentResult.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `PlatformRules.tsx` | /platform-rules | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `Press.tsx` | /press | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Pricing.tsx` | /pricing | KEEP — core funnel | Single source of truth; distinguish activation, campaign spend, commission, tools. |
| `Privacy.tsx` | /privacy | KEEP/HUB — trust/legal | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `PublisherApply.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `PublisherProfile.tsx` | /browse/:id | KEEP — core funnel | Audience fit → placement → proof → price → request; no private contact fields. |
| `PublisherRelationships.tsx` | No direct route / nested or imported | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `PublisherSuccess.tsx` | /publisher-success | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `PublisherSuccessArticle.tsx` | /publisher-success/:slug | KEEP/CONSOLIDATE — content hub | Keep useful content but attach every article to a live funnel CTA. |
| `ReachChecker.tsx` | /reach-checker | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Register.tsx` | /register | KEEP — auth | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `ResetPassword.tsx` | /reset-password | KEEP — auth | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Roadmap.tsx` | /roadmap | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Safety.tsx` | /trust/safety | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `SavedLists.tsx` | /lists | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `SavedSearches.tsx` | /saved-searches | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Security.tsx` | /security | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `Suburbs.tsx` | /suburbs | KEEP — contextual/app | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Terms.tsx` | /terms | KEEP/HUB — trust/legal | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `TrackRedirect.tsx` | /t/:slug | REVIEW | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |
| `Transparency.tsx` | /transparency | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `TrustCentre.tsx` | /trust | KEEP/HUB — trust/legal | Make Trust the hub; use anchors instead of duplicate standalone navigation. |
| `WorkWithUs.tsx` | /work-with-us | SECONDARY — remove from primary nav | Contextual/secondary route; keep focused on its task and avoid competing with the core funnel. |

## 8. Component audit

The repository contains **82 React component files**. The highest-impact shared components are:

| Component | Finding | Action |
|---|---|---|
| `Header.tsx` | Too many primary links | **Patched** to five core destinations + Get Started |
| `Footer.tsx` | Sitemap-style overload | **Patched** into compact groups |
| `LiveChannelTabs.tsx` | Did not apply live flag | **Patched**; accessible tabs + enabled filtering |
| `ChannelCampaignCard.tsx` | Uses payment-hold note | Keep; verify release-condition copy |
| `EscrowNote.tsx` | Naming remains legacy but copy now avoids unsupported escrow claim | Consider rename after codebase migration |
| `TrustedByStrip.tsx` | Potential social-proof overclaim | Verify every named relationship before launch |
| Marketing Suite components | Real product surface | Keep, consolidate under Tools/Marketing Suite hub |

## 9. Technical debt / security / performance

### Critical
- Complete production verification of role escalation hardening (`schema_phase81`).
- Verify public publisher view (`schema_phase82`) actually replaced direct table exposure in deployment.
- Verify payout RPC security/idempotency (`schema_phase83`) with direct API tests.
- Verify safe cross-party profile access (`schema_phase84`).
- Verify direct conversation insert rejection (`schema_phase85`).
- Verify rate limiting on all public forms (`schema_phase91`).
### High
- Run full build and Vitest suite.
- Run Playwright against a test Supabase environment; current specs are now public smoke tests only.
- Replace/disable `workers/payoutWorker.js` until provider settlement implementation is complete.
- Add a single channel diagnostics RPC for flag/database/live-supply parity.
- Add a CI “marketing claims” check for hardcoded metrics and price drift.
### Medium
- Standardize button `type` attributes, especially inside forms.
- Add semantic tab patterns wherever button groups behave as tabs.
- Complete WCAG 2.2 AA keyboard/focus/contrast regression testing.
- Centralize channel marketing descriptions in registry data.
- Reduce duplicate SEO/resource pages while preserving legacy URLs as redirects.
### Low
- Rename internal `billboard-*` design tokens only when convenient; they are technical tokens, not a customer-facing defect.
- Replace generic not-found use of `ComingSoon` with a dedicated 404 page.

## 10. UX conversion system

### Business
**Hook:** Reach local customers without learning another ad platform.
**Primary paths:** Browse Advertising / Build My Campaign.
**Proof sequence:** Audience → placement → price → verification → request → payment → live proof.

### Publisher / inventory owner
**Hook:** Monetise the audience or advertising space you already own.
**Primary path:** List Inventory.
**Proof sequence:** Profile → price → incoming request → approve → deliver → payout/proof.

### Vocabulary to standardize
Use: **placement, inventory, publisher, inventory owner, request, campaign proof, payment flow**.
Avoid: **board/billboard** as the umbrella term, **book directly**, **contact publisher**, **escrow** unless verified, and **creator** for non-creator channels.

## 11. Verification checklist before production

1. Run `npm ci` in CI/local developer environment.
2. Run `npm run build`.
3. Run `npm test`.
4. Run `npm run lint`.
5. Run `npm run test:e2e` against a seeded test Supabase environment.
6. Verify default channel set: social-media + influencer + podcast + website + radio.
7. Verify eight coming-soon channels are not bookable/discoverable as live unless explicitly enabled.
8. Verify a normal business cannot create a new direct `conversations` row against an approved publisher.
9. Verify public publisher queries cannot expose private contact, payout or admin fields.
10. Verify price/commission values in constants, UI, Edge Functions and payment notifications match.
11. Verify every customer-facing metric/testimonial/relationship claim is production-evidenced.
12. Verify payment/legal terminology with the actual settlement arrangement.

## 12. Files changed in Layer 1 implementation

- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/LiveChannelTabs.tsx`
- `src/components/EscrowNote.tsx`
- `src/pages/Home.tsx`
- `src/pages/ChannelHub.tsx`
- `src/pages/ForBusinesses.tsx`
- `src/pages/HowPaymentWorks.tsx`
- `src/pages/Categories.tsx`
- `src/pages/About.tsx`
- `src/pages/Faq.tsx`
- `src/pages/Terms.tsx`
- `src/lib/featureFlags.ts`
- `src/i18n/locales/en/home.json`
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/en/forBusinesses.json`
- `playwright.config.ts`
- `e2e/auth-flows.spec.ts`
- `e2e/marketplace-happy-path.spec.ts`

Supporting audit documents added to repository root:
- `CHATSCHED_LAYER1_UPDATED_AUDIT.md`
- `LAYER1_CHANGELOG.md`
- `LAYER1_PAGE_AUDIT.csv`
- `LAYER1_SERVICE_MATRIX.csv`
