# Agency Pivot — Proactive Subscription Gate Coverage Delivery

Builds on `PHASE17_SUBSCRIPTION_ENFORCEMENT_DELIVERY.md`. Closes its own
named gap: "Proactive client-side checks only cover the opportunity
marketplace" — `ChannelRequestForm`, the original `requests` creation
flow, and the publisher's accept action on `channel_requests` were all
really gated server-side already, just without the polished notice
`BusinessOpportunities.tsx`/`OpportunityFeed.tsx` already had.

## A found gap worth naming before anything else

This zip's own delivery doc references `PHASE17_STATE_OF_THE_PIVOT_AUDIT.md`
as what triggered it — that file isn't actually in this zip. More
concretely: this lineage's own Phase 16 is
`PHASE16_BRAND_HOMEPAGE_PIVOT_DELIVERY.md`. A *different* Phase 16 —
bulk request creation on `CreateRequestForClient.tsx`, delivered last
turn in this conversation — isn't in this zip at all. Two sessions
produced two different "Phase 16"s off the same Phase 15 base, and only
one made it into what's actually here. Not something this delivery
fixes — out of scope for what was asked — but worth saying plainly
rather than silently proceeding as if bulk creation still exists here,
since `PHASE17_SUBSCRIPTION_ENFORCEMENT_DELIVERY.md`'s own "Not done"
list still says "Bulk request creation — still open since Phase 8,"
which is now literally true again in this lineage even though it was
closed in another.

## Verification approach, given Phase 14's finding

`PHASE14_OPPORTUNITY_MULTI_ACCEPT_DELIVERY.md` fixed a real prop-name
bug in this session's own earlier work that an isolated `tsc --noEmit`
check couldn't catch — it only verifies a file against its own imports,
not against what another component actually exports. Took that
seriously again here: `SubscriptionGateNotice`'s `role` prop and both
`hasUsable*Subscription` function signatures were confirmed by reading
`subscriptionGate.ts` and `SubscriptionGateNotice.tsx` directly, and the
exact `subscribed === false` / hide-the-action gating pattern was copied
verbatim from `BusinessOpportunities.tsx` and `OpportunityFeed.tsx`
rather than reconstructed from memory of the shape.

## What's built

Same pattern at all three sites: a `subscribed` state (`undefined` while
loading, so nothing flashes hidden before the check resolves), a
`useEffect` calling the relevant `hasUsable*Subscription` check, and
`SubscriptionGateNotice` rendered when it resolves `false`.

- **`ChannelRequestForm.tsx`** (business, the 4 request-flow channels):
  wrapped the form body in a `<fieldset disabled={subscribed === false}>`
  — greys out and disables every field and the submit button in one
  place rather than threading `disabled` through each input
  individually. Reset the browser's default fieldset border/padding/
  min-width explicitly (`border-0 p-0 m-0 min-w-0`) — an easy thing to
  miss, since an unstyled `<fieldset>` would otherwise have quietly
  added a visible box around the form that wasn't part of this design.
- **`PublisherProfile.tsx`** (business, the original social-media
  request form): identical fieldset treatment, same reset.
- **`PublisherDashboardView.tsx`**'s `ChannelRequestCard` (publisher
  accepting a request): narrower than the other two, on purpose — only
  the "Approve" button is hidden when unsubscribed.
  `schema_phase71_subscription_enforcement.sql`'s own trigger only gates
  `pending -> awaiting_payment`, not the counter-offer path
  (`pending -> countered`) or decline — confirmed by reading the trigger
  directly rather than assuming "accept" meant every action on a pending
  request. A publisher without a subscription can still counter or
  decline exactly as before; they just can't outright approve until
  they subscribe.

## Toolchain

Same standing limitation as every phase originating in this sandbox: no
network egress, so `npm ci`/`build`/`test`/`lint` couldn't run here.
Verified: brace/paren/fieldset-tag balance on all three touched files,
an isolated `tsc --noEmit` pass (clean), and — given Phase 14's specific
finding — direct confirmation that every prop and function signature
used here matches its real definition, not just an isolated per-file
check. Needs a real `npm run build && npm test` before this is trusted
the way a real toolchain run would earn.

## Not done / still open

- **The now-false copy** `PHASE17_SUBSCRIPTION_ENFORCEMENT_DELIVERY.md`
  named (six files, eight instances, plus `home.json` across four
  languages, saying subscriptions unlock extra features rather than
  gating core actions) — still the most consequential open item from
  that report, untouched here.
- **Cancellation doesn't touch PayFast** — unchanged from Phase 17.
- **Bulk request creation** — open again in this lineage specifically,
  per the gap named above. Not touched by this delivery; flagging is as
  far as this phase goes.
- **Never run against real Postgres or a real build.**

## Next

The now-false copy is the one item with a live correctness problem
rather than a missing feature — probably still the right thing to fix
first. Separately, whoever's coordinating across lineages should decide
whether to re-port the missing bulk-creation work into this branch, or
treat the two Phase 16es as a genuine fork that needs reconciling before
either advances further.
