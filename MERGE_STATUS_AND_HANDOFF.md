# ChatSched Merge — Status & Handoff (Part 2)
**As of this checkpoint. Written for a fresh chat to pick up from exactly here.**

## What this document is

This supersedes the original `MERGE_STATUS_AND_HANDOFF.md` (Part 1), which is
now out of date — everything in its "🔲 NOT yet started" section is either
done or narrowed down below. Read this one; Part 1's *only* remaining live
content is the "Two real product/architecture decisions" section, reproduced
unchanged below because neither has been resolved yet.

You are continuing the same non-destructive merge: **their branch is the
working base** (more architecturally advanced), with the previous session's
distinct contributions ported/reconciled onto it. The working codebase is the
attached `chatsched-final-form (1)` folder — it already has everything below
applied.

---

## ⚠️ Two real product/architecture decisions the user needs to make

Still unresolved. Do not resolve either unilaterally — surface them plainly
once the remaining work below is done.

### 1. Messages.tsx — direct messaging
The previous session removed direct messaging entirely; their branch kept and
actively rewrote it. **Current state: theirs was kept** (Header.tsx still
links `/messages`), per "zero code loss." Not confirmed with the user as
final. Worth noting for context: `schema_phase85_retire_direct_messaging.sql`
already exists in their branch and narrows business-side messaging while
keeping an admin thread capability — their own direction here is itself
still evolving, which is one more reason not to resolve this conflict
unilaterally.

### 2. The "12 live channels" copy claims
Their branch deliberately reverted 7 channels to feature-flagged-off ("none
having a real publisher or listing yet"). The previous session's "12
channels" copy fixes (`Roadmap.tsx`, `About.tsx`, `Faq.tsx`) were re-applied
anyway — defensible (the channels are genuinely built) but optimistic given
only ~6 are actually business-facing-discoverable right now (5 original +
`in-venue-screens`, also shipped inactive/flagged-off this session — see
below). **Left as applied — flag this nuance.** Per their documented "let
supply build" design, no `isChannelEnabled()` filter has been added to
`Register.tsx`, `BusinessOpportunities.tsx`, or `OpportunityFeed.tsx`'s
channel pickers, and none should be.

---

## ✅ Fully completed this session (Part 2)

Verified via `tsc -b --noEmit` after every step. Baseline error count went
from 9 → 6 (3 real bugs fixed as a side effect of completing
`BuildMyCampaign.tsx` — see below).

### SQL migrations
- `supabase/schema_phase94_manager_internal_roles.sql` — `campaign_manager`/
  `publisher_manager` added to `profiles_role_check`; `publisher_manager_id`
  added to `agency_leads` and `agency_campaigns` (mirrors existing
  `campaign_manager_id`). Confirmed both tables still exist in the phase59/60
  shape, and that the phase81 role-escalation trigger's `auth.uid() IS NULL`
  carve-out still allows manual SQL-editor promotion. Deliberately does
  **not** widen any RLS policy to check these new roles — real, separate
  follow-up work, not assumed done here.
- `supabase/schema_phase95_channel_request_metadata.sql` — plain `jsonb`
  `request_metadata` column added to `channel_requests`.
- `supabase/schema_phase96_in_venue_screens_channel.sql` — `channels_
  category_check` widened for `'outdoor'`; `in-venue-screens` row inserted
  (`active: false`, `verification_required: true`, `sort_order: 12`).

### Small fixes
- `.env.example` — `VITE_CHANNEL_IN_VENUE_SCREENS_ENABLED` added.
- `src/components/CookieConsentScript.tsx` — stray `console.log` removed.
- Deleted 4 stale `.orig` backup files found lying around
  (`PublisherDashboardView.tsx.orig`, `AdminAnalytics.tsx.orig`,
  `ReachChecker.tsx.orig`, `Press.tsx.orig`) — confirmed each was superseded
  by already-improved current files, not a pending conflict.

### Request-metadata UI (channel_requests.request_metadata)
- `src/components/ChannelRequestForm.tsx` — full `META_FIELDS` table wired
  for all 12 request-flow channels (podcast, website, influencer, radio,
  sports, events, community, transport, informal-retail, associations,
  restaurants, in-venue-screens), generic text/date/number/checkbox
  rendering, required-field validation, built into the `request_metadata`
  insert payload. Fixed a stale "4 request-flow channels" docstring while
  there.
- `src/components/RequestMetadataDetails.tsx` — new shared component
  rendering saved `request_metadata` as a label/value list. Wired into both
  `PublisherDashboardView.tsx`'s `ChannelRequestCard` and
  `AdminChannelRequests.tsx`.
- `src/pages/AdminChannelRequests.tsx` — added the missing `campaign_message`
  and `duration_days` display (bonus fix), plus the metadata wiring above.

### Publisher Manager role
- `src/lib/types.ts` — `publisher_manager_id` (+ optional `publisher_manager`
  join field) added to `AgencyLead` and `AgencyCampaign`.
- `src/pages/AdminLeads.tsx`, `src/pages/AdminCampaigns.tsx` — widened the
  Campaign Manager query to `role in (admin, campaign_manager)`, added a
  parallel Publisher Manager query/state/`assignPublisherManager()` function/
  second `<select>` in both files.

### notify Edge Function
- `supabase/functions/notify/index.ts` — full rewrite. Added `new_agency_lead`
  and `campaign_brief_confirmation` kinds; both skip the login requirement
  (confirmed via `schema_phase91_public_form_rate_limiting.sql` that
  `agency_leads` now has **zero** client-readable access at all, tighter than
  Part 1 assumed — insert-only via the service role in `public-form-submit`,
  and even that direct-insert path was later closed); both kinds read the
  lead via a service-role client instead, gated by a 1-hour recency guard
  (an abuse control, not a business rule — see the file's own comments).

### Payment/auth try/catch fixes
Applied the same pattern as `AuthContext.tsx` (catch a thrown network error,
reset the loading flag, show a friendly retry message) to:
- `src/pages/Dashboard.tsx` (`handlePay`, `handleConfirmEft`)
- `src/components/SubscriptionSection.tsx` — confirmed `subscribe`/
  `cancelSubscription` no longer exist (replaced by once-off `activate()`,
  exactly as Part 1 warned); fixed `activate()` instead
- `src/pages/AccountSettings.tsx` (`handleDelete`)
- `src/pages/Admin.tsx` (`AuthenticityCheck.run`)
- `src/components/marketingSuite/ContentStudio.tsx` (`subscribe`)
- `src/components/ConnectSocialAccounts.tsx` (`handleSummarize`)

### `src/pages/BuildMyCampaign.tsx` — mostly done
This was "the big one." Completed:
- **Fixed 3 real pre-existing bugs** in this file as part of finishing it:
  `profile?.business_name`/`profile?.name`/`profile?.mobile_number` (none of
  which exist on `Profile`) → correct fields `company_name`/`full_name`/
  `phone`. This is why the baseline error count dropped from 9 to 6.
- `WizardStep` widened to `1–7`; stepper now shows 7 steps (added "Brand");
  all "Step N of 5" labels → "of 7".
- **localStorage draft persistence** — a `CampaignDraft` shape + `loadDraft()`
  restore every field (including `currentStep`) on mount, a save effect
  persists on every change, cleared on successful submission. Key:
  `chatsched:build-my-campaign:draft:v1`.
- **`useSearchParams`** — `?goal=` / `?budget=` prefill `goalId`/
  `budgetTierId` on load if valid, for the homepage quick-start hero to link
  into (see "Still to do" below — the homepage side of this isn't built yet).
- **Case-study card** (Step 3) — `bestScenarioForCategories(targetCategories)`
  from the already-shared `src/lib/caseStudyScenarios.ts`, recomputes live,
  links to `/case-studies`.
- **Live budget/reach preview boxes** (Steps 4 and 5) — reflect
  `recommendation.estimatedReach`/`estimatedCost.totalBudgetZar` in real time.
- **New Step 6 "Brand & Creative Brief"** — brand website, tagline, brand
  colors/style notes, and the creative-instructions textarea (moved here from
  the old Step 6), plus a brief-completeness progress indicator (all fields
  optional — this is encouragement, never a gate on Next).
- **`handleFinalSubmit`** — `fullBriefText` now includes the brand fields +
  contact method + urgency; fires both `new_agency_lead` and
  `campaign_brief_confirmation` notify calls; clears the localStorage draft
  on success.
- **`handleDownloadPdf`** + new `src/lib/campaignBriefPdf.ts` — mirrors
  `invoice.ts`'s established jsPDF pattern (dynamic import, brand colors,
  a4/mm, `doc.save(...)`). Not yet wired to a button — see below.
- Old Step 6 block's header/condition renamed to **Step 7** — its *body* is
  the one piece of this file still not finished, see next section.

---

## 🔲 Still to do

### Finish `BuildMyCampaign.tsx` Step 7 (small, well-scoped)
The Step 7 (`currentStep === 7`, "RECOMMENDED CAMPAIGN & SUBMISSION") block's
condition was renamed from 6→7, but its body still has 3 loose ends:
1. **`contactMethod`/`urgency` selectors** — state already exists
   (`contactMethod`/`setContactMethod`, `urgency`/`setUrgency`, driven by the
   already-defined `CONTACT_METHODS`/`URGENCY_LEVELS` constants near the top
   of the file) and is already included in `fullBriefText` — just needs the
   actual `<select>`/button-group UI added to the submission form, matching
   the existing field styling in that block.
2. **"← Modify Inputs" button** — currently `onClick={() => setCurrentStep(5)}`
   (line ~1540) — should target step 6 (Brand & Creative Brief) now that it
   exists, i.e. `setCurrentStep(6)`.
3. **PDF download button** — `handleDownloadPdf` is fully written and
   type-checks but isn't called from anywhere yet (hence the
   `'handleDownloadPdf' is declared but its value is never read` `tsc`
   warning). Add a button calling it somewhere in the Step 7 review section
   (e.g. near the cost breakdown, or alongside the submit button — "Download
   as PDF" as a secondary action).

### Success screen enhancements (small)
The `if (submittedLeadId)` success view (~line 367) needs:
- A **contact method + urgency badge** — both are in component state
  (`contactMethod`, `urgency`), not re-fetched from the DB, so this is a pure
  display addition next to the existing "Campaign Reference ID" /
  "Manager Assigned" badges.
- A **"Download Campaign Brief (PDF)"** button calling the same
  `handleDownloadPdf`.

### `src/pages/Home.tsx` — not started
TrustedByStrip removal was done in Part 1. NOT done: the `heroMockup` i18n
section (mockup widget translations) and the entire `QuickStartHero`
component (the goal/budget picker that would link into
`BuildMyCampaign.tsx`'s new `?goal=&budget=` query-param handling above —
right now nothing links there with those params yet, so that piece of
`BuildMyCampaign.tsx` is functional but currently unreachable from the
homepage). Needs `home.json` i18n additions across all 4 locales too.

### i18n work — not started
- `home.json` × 4 locales — `heroMockup` and `quickStart` key sections
- `forBusinesses.json` × 4 locales — new files, full translation, need
  creating from scratch
- `src/i18n/index.ts` — register the `forBusinesses` namespace
- `src/i18n/keyParity.test.ts` — extend to cover `forBusinesses`
- `src/pages/ForBusinesses.tsx` — the FULL i18n rewrite (the deferred escrow
  + channel-count + TrustedByStrip-import-cleanup fixes from Part 1 should
  land here too, in one pass rather than patched separately)

### Not yet run
- Full `npx vitest run` (only `tsc` checkpoints have been run so far this
  entire merge, across both sessions)
- Full `npx vite build` production build check
- Final whole-tree structural sanity sweep

---

## Pre-existing errors in THEIR branch — not caused by this merge, don't chase them

`tsc -b --noEmit` shows these consistently. 3 of the original 9 (all in
`BuildMyCampaign.tsx`) were genuine bugs fixed this session as a side effect
of completing that file — see above. The remaining 6 are confirmed unrelated
to anything ported in this merge:
- `src/components/PublisherDashboardView.tsx` — `VERIFICATION_META` type
  mismatch
- `src/lib/campaignRecommendation.test.ts` — 2 errors, `Publisher` test
  fixture shape
- `src/pages/Admin.tsx` — 3 errors, `"phone"` property missing on a `Pick`
  of `Profile`

## Files deliberately NOT restored (confirmed obsolete, not missing)
Unchanged from Part 1 — their "once-off activation pricing" rework replaced
the whole monthly-subscription-with-grace-period model:
- `src/lib/conversations.ts`
- `supabase/functions/_shared/notifySubscriptionLapse.ts`
- `supabase/functions/_shared/resend.ts`
- `supabase/functions/_shared/subscriptionLapseDecision.ts`
- `supabase/functions/_shared/subscriptionLapseEmail.ts`
- `supabase/functions/expire-subscription-grace-periods/`

---

## How to resume in a new chat

1. Unzip the attached `chatsched-final-form (1)` folder — this **is** the
   current working state, everything in "✅ Fully completed" above already
   applied.
2. Re-read this whole document before touching anything.
3. Start with `BuildMyCampaign.tsx` Step 7's 3 loose ends (small, ~30 min of
   work) — everything else in that file is done and type-checks clean.
4. Then `Home.tsx` + the i18n work — the largest remaining piece, and the
   one that makes `BuildMyCampaign.tsx`'s new query-param handling actually
   reachable from the homepage.
5. Run `npm install && npx tsc -b --noEmit && npx vitest run && npx vite build`
   as a final check once everything above is done.
6. Surface the two flagged conflicts (Messages.tsx, the "12 live channels"
   nuance) to the user explicitly before considering the merge finished.
