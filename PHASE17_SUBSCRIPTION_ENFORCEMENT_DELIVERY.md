# Agency Pivot — Subscription Enforcement & Cancellation Delivery

Wires up `isSubscriptionEnforcementEnabled()` (Phase 2) — the item
`PHASE17_STATE_OF_THE_PIVOT_AUDIT.md` flagged as the one gap on that
list that wasn't really an engineering gap: the billing was always
real, nothing ever required it. Confirmed decision, built here. Paired
with a cancellation UI in the same delivery — flagged in that same audit
as something a real paywall shouldn't ship without, and it's a much
worse look to add one after people are already stuck than before.

## A real numbering collision, immediately

This was originally written as `schema_phase70_subscription_enforcement.sql`
against the zip before this one. `chatsched-final-phase16-brand-homepage-pivot`
landed in the meantime with its own, unrelated
`schema_phase70_public_lead_capture.sql`. Renumbered to **71** rather
than risk two different "phase 70" migrations coexisting — the exact
kind of collision flagged as a risk since the very first audit of this
codebase, now an actual instance of it rather than a hypothetical one.
Resolved the same way every prior instance has: re-check the real
latest number against the zip actually in hand, don't trust a number
carried over from a stale session.

## What's gated, and what deliberately isn't

Only "start something new": a business creating a
`requests`/`channel_requests`/`opportunities` row, and a publisher
accepting a `channel_requests` booking or applying to an opportunity.
Everything about an *already-accepted* booking — messaging, proof,
deliverables, payment, decline — is untouched. A lapsed subscription
shouldn't be able to trap either side inside a booking they can no
longer act on; it should only stop new engagements. Declining is
explicitly exempt for the same reason — a publisher without a
subscription can still say no to something already sitting in their
queue.

The original `requests` table (social-media channel) turned out to have
no publisher-side accept action to gate at all — checked directly
against this zip: `requests_update_admin` is the only non-select/insert
policy on that table anywhere in this schema. That flow is still
admin-mediated. Only its business-side insert needed a check.

## What's built

**Schema** — `supabase/schema_phase71_subscription_enforcement.sql`:
subscription checks folded into the `WITH CHECK` on `requests_insert_own`,
`channel_requests_insert_business`, `opportunities_insert_own`, and
`opportunity_applications_insert_publisher` (all four re-created, since
Postgres RLS ORs multiple permissive policies together — tightening one
means replacing it, not adding a new permissive policy alongside it,
which would only add another way to pass). Plus one added check inside
`enforce_channel_request_transition()`'s creator-accept branch — same
function, same file precedent as `schema_phase58` superseding
`schema_phase57`'s trigger body via `create or replace`, not an edit to
either original migration.

"Usable" means `status in ('active', 'grace_period')` — exactly
`isSubscriptionUsable()` (`src/lib/subscriptions.ts`, Phase 2), mirrored
in SQL rather than called, same cross-boundary duplication every other
SQL/TypeScript pair in this schema already has (the message-safety
patterns, the launch-credit math) and the same reason: a Postgres
function can't import from `src/`.

**Why this is unconditional server-side, not gated by the flag
itself**: `isSubscriptionEnforcementEnabled()` is a Vite env var — it
was never going to be readable from Postgres, so it was never going to
be the thing actually deciding whether these checks run. Repurposed
instead (see below) as a client-side "explain this before the user hits
a raw error" switch — same shape as `isMessageSafetyPrescanEnabled()`
(`schema_phase58`): real UX, not the boundary. A real kill switch, if
ever needed, is a migration reverting the checks above, not an env var
flip.

**Client-side UX** — `src/lib/subscriptionGate.ts` (the check),
`src/components/SubscriptionGateNotice.tsx` (the message), wired into
`BusinessOpportunities.tsx` and `OpportunityFeed.tsx`: the "Post an
opportunity" and "Apply" actions check subscription status up front and
show a clear "subscribe on your account page" notice instead of the raw
RLS/trigger rejection. **Not wired into every gated entry point** — see
"Not done" below.

**Cancellation** — `supabase/functions/cancel-subscription/index.ts`
(new edge function) + a cancel button and confirm step in
`SubscriptionSection.tsx`. Read the function's own comment before
relying on it: **this does not call PayFast to stop the recurring
charge.** No PayFast cancellation-API helper exists anywhere in this
codebase, and fabricating one without verified documentation felt like
a worse mistake than shipping the smaller, honest version — this stops
ChatSched from treating the account as subscribed, but the PayFast-side
token, if still active, isn't touched. The confirm dialog says this in
plain language before anyone clicks it.

## Now-false copy, not fixed here

`PHASE16_BRAND_HOMEPAGE_PIVOT_DELIVERY.md` — the phase immediately
before this one — deliberately wrote accurate copy for its own moment:
*"subscriptions exist, unlock the full platform, but nothing is gated
behind one yet."* Representative line, `Pricing.tsx`: *"a subscription
changes what you get access to, not whether you can use ChatSched at
all."* This migration makes that sentence false. Per PHASE16's own
accounting, the same framing appears in six files, eight instances —
`Faq.tsx`, `Fees.tsx`, `ForBusinesses.tsx`, `ForPublishers.tsx` (×4),
`Mission.tsx`, `Pricing.tsx` (×2) — plus `home.json` across all four
languages. Not touched in this delivery: fixing it properly means the
same translation care `PHASE16` put into the original copy (including
its own flagged uncertainty about Zulu/Xhosa), and rushing that here
felt worse than naming it precisely and leaving it for its own pass.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — unchanged; the new logic is RLS/trigger SQL and UI wiring, nothing pure-function to isolate into a test |

## Not done / still open

- **The now-false copy above** — the most important item on this list,
  not because it's hard, but because it's live and wrong the moment
  this ships.
- **Never run against real Postgres** — five changed/new RLS policies
  and one trigger function, on top of the standing limitation since
  Phase 1.
- **Proactive client-side checks only cover the opportunity
  marketplace.** `ChannelRequestForm`, the original `requests` creation
  flow, and the publisher's accept action on `channel_requests` are all
  really gated (the RLS/trigger is unconditional), but none of them have
  a pre-check yet — a subscription-less user hitting those specific
  paths gets the trigger's plain-language exception (for the accept
  case) or a generic Postgres RLS error (for the two insert cases), not
  a polished notice.
- **Cancellation doesn't touch PayFast.** Covered above, worth repeating
  here since it's the kind of gap that's easy to forget is still open
  once a cancel button exists at all.
- **`business_launch_credits` isn't touched by any of this.** A business
  whose subscription lapses keeps whatever launch credit they already
  had; nothing here revisits that.
- **Bulk request creation** — still open since Phase 8, unrelated to
  this delivery, still sitting.

## Next

Fix the now-false copy first — it's the one item here with a live
correctness problem, not just a missing feature. After that: proactive
UX on the remaining gated entry points, or a verified PayFast
cancellation integration, whichever actually matters more for how this
gets used.
