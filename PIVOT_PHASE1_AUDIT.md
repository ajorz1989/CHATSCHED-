# ChatSched Agency Pivot — Phase 1 Audit & Roadmap

Scope: the pivot brief you uploaded (Managed Advertising + Marketplace +
Publisher Network) against the actual `chatsched-final` codebase in the
zip. This is Phase 1 from the brief's own implementation order — audit
first, build second. Method: full toolchain run (real, executed, not
inferred), a structural inventory of every page/lib/schema file, and
targeted reads/greps to confirm specific claims below — not a
line-by-line review of all ~85 pages and 54 migrations. Where I checked
something directly, it's stated as confirmed; where I'm going on the
existing README/audit docs' own word, that's stated too.

## Toolchain — actually run this time

Both `PRE_LAUNCH_AUDIT.md` and `COMPLIANCE_DELIVERY_REPORT.md` already in
this repo list "the toolchain has never been run" as the #1 standing
blocker — their sandbox couldn't reach the npm registry or an apt mirror.
Mine can. So, for real:

| Command | Result |
|---|---|
| `npm ci` | ✅ 545 packages, 0 vulnerabilities |
| `npm run build` (`tsc -b && vite build`) | ✅ 0 type errors, builds a complete `dist/` (913 modules, code-split per-route) |
| `npm run lint` (`oxlint`) | ✅ 0 errors, 0 warnings — **1 warning found and fixed**: `workers/payoutWorker.js:122` had an unused catch binding (`catch (_)` → `catch`) |
| `npm test` (`vitest`) | ✅ 15 test files, **99/99 passing** |

This is the single highest-leverage item both prior audits called out, and
it's now clean. It doesn't replace running the pgTAP suite against a real
Postgres instance (still genuinely blocked — same as before, this
sandbox has no way to stand up Postgres either) or an actual staging
deploy, but the entire TypeScript/React layer compiles, lints, and tests
green for the first time on record.

## The real starting point

This is not a build-from-scratch. `chatsched-final` **is** the
marketplace project — 408 files, 54 additive schema migrations
(`schema_phase2.sql` through `schema_phase54_deliverables.sql`), ~85
routed pages, a real admin suite, real PayFast payments, real compliance
tooling. It's dramatically further along than my own notes on it
reflected (I had it stopped at "Phase 4: SEO layer" — it's since gone
through fraud/authenticity, disputes, EFT payments, campaign tracking,
counter-offers, social OAuth, content approval, and deliverables, among
others). One housekeeping note: `package.json`'s `name` field is still
`"billboard-app"` — harmless, but worth renaming once the ChatSched
identity is final.

Given that, most of the pivot brief's Layer 2 (Marketplace) and Layer 3
(Publisher Network) asks are requests to **keep** what's already real,
not build it. The genuinely new work is almost entirely Layer 1 (the
agency): subscriptions, launch credit, CRM, margin tracking, and the
managed-campaign workflow. The map below goes through the brief in that
spirit — grouped by theme, not by section number.

## What's already real vs. genuinely new

| Brief asks for | Status | Notes |
|---|---|---|
| Marketplace: browse/filter/compare/save, publisher profiles, categories, map, suburbs | ✅ Real | `Browse`, `ComparePublishers`, `SavedLists`, `SavedSearches`, `MapView`, `Suburbs`, `Categories` all exist against live Supabase data |
| Creator sets own price; platform suggests, never forces | ✅ Real | `pricingEngine.ts` — transparent heuristic (followers, engagement, trust score), `MIN_PRICE_PER_POST = 50`, explicitly a starting point not a mandate |
| `/fees` page with exact, worked example | ✅ Real | `Fees.tsx` exists. The brief's own worked example (R500 → R60 fee → R440 payout) already matches the real math |
| Marketplace commission preserved if 12% | ✅ Confirmed | `PLATFORM_COMMISSION_RATE = 0.12` in `constants.ts`, publisher share 88% — exactly the brief's conditional |
| Negotiation / counter-offers | ✅ Real | `schema_phase35_counter_offer.sql` — one round, matches brief's example flow |
| Deliverables + content approval | ✅ Real | `schema_phase53/54`, `contentApproval.ts`, `deliverables.ts` |
| Campaign compliance + proof | ✅ Real, most recently-worked area | `CampaignCompliance.tsx`, `AdminCompliance.tsx`, screenshot proof with signed URLs, sourced platform-policy content (dated 19 Aug 2026, TikTok's policy change flagged for 31 Aug) |
| Campaign tracking / ROI (clicks, leads, conversions) | ✅ Real, not estimated | Redirect-link + embed-snippet tracking, `campaign_stats` view, honestly labeled tracked vs. estimated |
| Trust Score / verification / dispute handling | ✅ Real | `TrustCentre.tsx`, `schema_phase25_disputes.sql`; **unconfirmed**: whether Trust Score and Publisher Score are already two distinct scores as the brief wants, or one combined score today — worth a direct check before building a second one |
| Social OAuth (YouTube/FB/IG/TikTok) | ✅ Real, recently hardened | Access/refresh tokens were plaintext until this repo's own last audit pass — now AES-256-GCM encrypted at rest |
| Media kit, rate cards | ✅ Real | Branded PDF export (`mediaKit.ts`), itemized rate cards with a DB trigger keeping the flat price in sync |
| Budget planner | ✅ Real | `BudgetCalculator.tsx` — directly matches brief §56 |
| "Continue where you left off" | ✅ Real | Recently-viewed, not a placeholder |
| Honest, non-fabricated marketplace activity | ✅ Already the house style | `Transparency.tsx` / `transparencyStats.ts` exist specifically for this; every "what's real" claim in this repo's own README is written the same careful, evidence-labeled way the brief asks for in §65/§98 |
| Payments: don't build ChatSched into an unregulated fund-holder | ✅ Already correctly conservative | PayFast checkout → admin manually confirms and marks payout sent after a real bank transfer. No always-on wallet/ledger. This is the brief's own §78 caution, already respected — worth *not* over-building a ledger system prematurely |
| Additive migrations, feature flags, don't rebuild | ✅ Already the house convention | 54 migrations, all additive; `featureFlags.ts` already used as kill-switches for the 4 newer channels |
| **Business-to-creator communication routed through ChatSched, not direct** | 🟡 Partial | The *original* social-media flow already works this way — every request has a real business↔admin thread, admin relays to the publisher. **The 4 newer channels (influencer/website/podcast/radio) don't**: a business submits a request straight to a specific creator's dashboard, the creator accepts/declines it themselves, no admin relay. There's no open-ended messaging or contact-info exchange on that path — it's a structured accept/decline, not a "Message Creator" button — but it's not ChatSched-mediated either. This is a real design decision, not a bug (see below) |
| Anti-bypass detection (phone/email/WhatsApp exchange attempts) | 🆕 Not present | Checked directly — no redaction/detection logic anywhere in messaging. Genuinely new if you want it |
| **R99/mo publisher subscription, R199/mo business subscription + launch credit** | 🆕 Not present | No subscription/billing tables or recurring-charge logic anywhere. Both sides currently participate for free; ChatSched only earns the 12% commission on completed campaigns. This is the financial foundation the rest of Layer 1 depends on — recommend building this first |
| Agency layer: leads, clients CRM, campaign managers, renewals, packages, margin tracking | 🆕 Not present | No `AdminClients`, `AdminLeads`, `AdminRenewals`, campaign-manager role, or packages anywhere. This is almost the entire net-new build |
| "Run Again" repeat campaigns, publisher relationship history, opportunity feed, reverse marketplace ("I need publishers") | 🆕 Not present | All new |
| `/admin/revenue`, `/admin/profitability` | 🟡 Partial foundation exists | `AdminAnalytics.tsx` already tracks real GMV, avg order value, new publisher/business counts via Postgres RPCs (`analytics_time_series`, `analytics_segmented_by`) — extend this rather than building a parallel dashboard from scratch |
| Homepage/nav repositioning, "You tell us the goal, we build the campaign" | 🆕 Copy + IA work | No agency messaging exists yet since there's no agency layer to describe. Existing pages the brief says to keep (Trust Centre, Blog, Careers, Partners, Community, FAQ, Glossary) are already there and don't need touching |
| Public marketing not prominently showing 12%/88% | ⚪ Unchecked | I read the fee *logic*, not the actual homepage/marketing copy — didn't verify whether the split is currently surfaced prominently anywhere public. Quick check before launch either way |

One naming collision worth flagging so it doesn't cause confusion later:
`src/components/marketingSuite/CampaignBuilder.tsx` already exists, but
it's an AI caption/content generator for an *existing* campaign (part of
the Marketing Suite), not the brief's §22 Campaign Builder (business
describes their goal/budget → gets recommended channels and publishers).
Different feature, same name — worth renaming one of them before both
exist in the same codebase.

## Two things worth confirming before I write subscription/billing or brand copy

**1. The original ChatSched.** My notes on it describe a *different*
product — an AI front-desk booking bot for SMBs, also R199/month, with a
hard rule never to say "AI" in its own marketing. This pivot reuses both
the ChatSched name and the R199 price point for something else entirely
(marketplace access). Is the booking bot being retired, kept as a
separate product line under the same company, or something else? This
mostly changes homepage/nav copy, not the database work, but I'd rather
ask than guess and redo a brand pass.

**2. The 4-channel direct accept/decline.** Do you want *all* channels
routed through a ChatSched-managed communication layer (matching the
original flow), or is the current structured request → accept/decline
(no open messaging, no contact-info exchange) actually fine as-is, and
"remove direct contact" mainly means preventing things like WhatsApp/
email/phone exchange — which, as built, already can't happen on that
path? These are different amounts of work.

Everything else in the brief I'm comfortable making a reasonable call on
as I go and flagging what I assumed, rather than stopping to ask.

## Recommended build order

The brief's own phase order is basically right; adjusted for what's
already done:

1. **Subscriptions + launch credit** (brief Phase 2) — the financial
   foundation. `business_subscriptions`, `publisher_subscriptions`,
   `business_launch_credits`, status states (`ACTIVE`/`PAST_DUE`/
   `CANCELLED`/`GRACE_PERIOD`/`SUSPENDED`), recurring PayFast charge.
2. **Messaging/communication decision** (brief Phase 3) — resolve
   question 2 above, then implement.
3. **Agency core**: campaign managers, leads, clients CRM, managed
   campaign workflow (brief Phases 5, 8).
4. **Margin/economics system**, extending `AdminAnalytics.tsx` rather
   than forking it (brief Phase 7).
5. **Opportunity feed, reverse marketplace, Run Again, relationship
   history** (brief Phases 9–10).
6. **Homepage/nav/brand repositioning** (brief Phase 13) — deliberately
   last, once question 1 is answered and the agency layer actually
   exists to describe.
7. Testing + a real toolchain run after each phase, same as today.

## Where this should happen

This is realistically several weeks of work even with most of the
marketplace layer already built — the agency/CRM/subscription layer
alone is a dozen-plus new tables and a full admin surface. Both this
repo's own prior audits already recommended moving execution into Claude
Code once the toolchain question was resolved; that's now done, and I'd
second it for the remaining phases — you get a persistent environment
with git, and this project already has the CI/test discipline to make
that worthwhile. I'm glad to keep working on it here in chat too,
especially for anything you want scoped or reasoned through before it
becomes code.

**Next step:** tell me how to resolve the two questions above (or say
"your call" and I'll proceed with the more conservative reading of
each), and I'll start on subscriptions + launch credit.
