# Agency Pivot — Brand, Homepage, Navigation & Conversion Delivery

The last item from `PIVOT_PHASE1_AUDIT.md`'s original build order, held
until now on purpose — "sequenced deliberately last since there's
finally enough of the agency layer built to make that copy true"
(`PHASE8_ADMIN_REQUEST_CREATION_DELIVERY.md`'s own words). Subscriptions,
CRM, managed campaigns, opportunities and relationship history are all
real now, so this is the first point where promoting them isn't getting
ahead of what's actually built.

## The gap that had to close first: false claims

Before touching anything the brief asked for, a search turned up
something that would have undercut the whole pivot: **six pages
confidently promised "no subscription, ever"** — `Faq.tsx`, `Fees.tsx`,
`ForBusinesses.tsx`, `ForPublishers.tsx` (four separate instances),
`Mission.tsx`, and `Pricing.tsx` (two instances), plus one line in
`home.json`. All written before Phase 2's subscriptions existed, never
updated since. Promoting R199/R99 pricing on a new homepage while five
other pages flatly deny subscriptions exist would have made the site
look broken, not repositioned. Fixed all of them — see "What's built"
below for the actual replacement wording, chosen to stay accurate to
what's real today: subscriptions exist and unlock the full platform,
but nothing is gated behind one yet (`isSubscriptionEnforcementEnabled()`
from Phase 2 is still off) — so "you need one" would be just as false as
"there isn't one."

## What's built

**New page** — `/build-my-campaign` (`BuildMyCampaign.tsx`): the actual
destination "Build My Campaign" needed. A short form (business name,
contact, goal, rough budget) that inserts straight into `agency_leads`
— the same table `/admin`'s Leads tab already manages, so a submission
shows up there immediately, stage `new`, ready for follow-up. Not a
self-service wizard that recommends channels or budget on the spot —
that's real product surface this page doesn't attempt, and pretending
otherwise would've been a bigger, less honest thing to ship than what's
actually here: a capture step that gets a real person into the pipeline.

**Schema** — `supabase/schema_phase70_public_lead_capture.sql`: one new
additive `insert` policy on `agency_leads` (`with check (stage = 'new'
and campaign_manager_id is null)`), so an anonymous visitor can submit a
lead. No read/update/delete — confirmation is client-side ("we'll be in
touch"), not a lookup. `agency_leads.business_id` was deliberately left
nullable back in Phase 5 for exactly this "before anyone's signed up"
case; this is the first thing that actually uses it.

**Homepage** (`Home.tsx` + `home.json`, all four languages): new hero —
"Tell us your goal. We'll build the campaign," badge reading "Managed
Advertising + Marketplace + Publisher Network" verbatim. Primary CTA
**Build My Campaign** → the new page; **Browse Marketplace** kept as an
equal-weight secondary button, not demoted to a footnote; **Join
Publisher Network** as a lighter tertiary link. A new "three layers"
section (Agency / Marketplace / Network) sits right after the hero,
each with its own explainer and CTA — the concrete answer to "introduce
the three layers." Everything else on the page (featured publishers,
channel tabs, how-it-works, case studies) is untouched.

**Navigation** (`Header.tsx`): "Build My Campaign" and "Publisher
Network" added to the primary nav; "Pricing" promoted into it too, since
it's now central to the positioning rather than a footer link. Made
room by dropping Suburbs/Categories/About from the top bar — **not
removed from the site**, still reachable from the footer (checked
before cutting them, not after).

**Pricing** (`Pricing.tsx`): a new tier section leads the page —
ChatSched Business (R199/month + R199 launch credit) and Publisher
Network (R99/month), each with what it actually unlocks and a CTA. The
existing business/publisher explainer cards stay, reframed as
"browsing/listing without a subscription" — accurate today, since
neither is gated.

**False-claim fixes**: `Faq.tsx`, `Fees.tsx`, `ForBusinesses.tsx`,
`ForPublishers.tsx` (×4), `Mission.tsx`, `home.json` — replaced "no
subscription, ever" language with the same accurate framing used on
Pricing: subscriptions exist, unlock the full platform, aren't required
today.

**Marketplace browse: unchanged.** `/browse`, `/suburbs`, `/categories`,
`/channels`, `/audience-finder` — every route, every RLS policy, every
piece of marketplace functionality is exactly as it was before this
phase. Nothing here touched request creation, publisher discovery, or
the existing self-service flow beyond linking to it more prominently.

## Translation quality — read this before publishing non-English copy

All four languages validate as JSON and pass this codebase's own
`keyParity` test (confirms every locale has the same key set — a real
check, not just my own claim). That confirms **structure**, not
**quality**. My confidence differs sharply by language:

- **Afrikaans**: reasonably confident — closely related to a language
  I have strong grounding in, mechanical grammar.
- **Zulu and Xhosa**: genuinely uncertain. These are Bantu languages
  with noun-class agreement and grammatical structures I can produce
  reasonably but can't guarantee read as natural, idiomatic marketing
  copy the way the existing (pre-this-phase) copy in those files does.

**Recommend a native or fluent speaker review the Zulu and Xhosa
`home.json`/`common.json` changes before this goes live** — new hero
copy needs to land emotionally, not just parse grammatically, and I
can't fully vouch for that in either language the way I can for English
or Afrikaans.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing**, including `i18n/keyParity.test.ts` — confirms all four locales' key sets match after this phase's edits |

## Not done / still open

- **Native review of Zulu/Xhosa copy** — see above, the one thing in
  this delivery I'd actively flag as needing a second pair of eyes
  before publishing, not just before relying on.
- **`/for-businesses` and `/for-publishers` weren't restructured**, only
  had their false claims fixed. They still read as marketplace-first
  pages rather than reflecting the three-layer positioning the way the
  homepage now does — a reasonable next pass, not attempted here.
- **No admin visibility into `/build-my-campaign` submissions beyond the
  existing Leads tab** — which already shows them (same table), but
  there's no "came from the homepage form" indicator beyond `source =
  'homepage'` on the row itself.
- **No spam protection on the public lead form** beyond required
  fields — no captcha, no rate limit. Named directly in the migration's
  own comment, not an oversight.
- **Bulk request creation** — still open since Phase 8, still nobody's
  picked it up, now seven deliveries running.
- The pre-existing "held in escrow" language on the homepage's payment
  section (`payment.step2` in `home.json`) wasn't touched — outside this
  phase's scope, but worth a look separately: the actual mechanism
  (PayFast checkout, admin-confirmed manual payout) is more conservative
  than what "escrow" implies, and calling it that could be an overclaim
  worth tightening regardless of this pivot.

## Next

Native speaker review on the Zulu/Xhosa copy is the one open item with
real downside if skipped. Past that: `/for-businesses`/`/for-publishers`
restructuring, or the bulk-creation gap that's been sitting the longest.
