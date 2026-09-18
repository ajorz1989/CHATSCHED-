# Agency Pivot — Now-False Subscription Copy Fix

Closes the top item on `PHASE17_SUBSCRIPTION_ENFORCEMENT_DELIVERY.md`'s
"Not done" list, carried forward unfixed through
`PHASE18_PROACTIVE_SUBSCRIPTION_GATE_DELIVERY.md`: six files, eight
named instances of copy claiming a subscription only "unlocks extra
features" while core actions (sending a request, approving one) work
without one — false since Phase 17's `schema_phase71` shipped.

## What was actually false, precisely

Not every "R99/month" or "R199/month" mention was wrong — plenty of
lines correctly describe things that stay free either way (browsing,
listing a basic profile). The false pattern was narrower: any line
claiming a business could still **book**, or a publisher could still
**approve**, *without* an active subscription. Checked each of the six
files line by line against that specific claim rather than rewriting
every subscription mention on sight.

## What's fixed

- **`Faq.tsx`**, **`ForBusinesses.tsx`**, **`Mission.tsx`**,
  **`Pricing.tsx`** (FAQ answer): the "browse and book / list and
  approve, without one" line each had — replaced with browsing/listing
  staying free, sending a request needing the business subscription,
  approving one needing the publisher subscription.
- **`Pricing.tsx`**'s two "without a subscription" panels: "Browsing
  without a subscription" no longer claims you can "book direct" there
  — booking moved to the businesses-need-a-subscription bullet.
  "Listing without a subscription" no longer claims you "approve every
  request yourself" for free — approving moved alongside the other
  R99/month-gated items already listed in that panel.
- **`Fees.tsx`**: "Do publishers pay to join?" now lists approving
  requests as part of what R99/month unlocks, alongside opportunities/
  analytics/earnings — it previously listed only those three and left
  approving unmentioned, which read as free by omission.
- **`ForPublishers.tsx`** (four instances — hero, `Seo` description,
  final CTA, and the numbered steps): none of these stated the false
  claim outright, but the steps list separated "list your channel"
  (free) from "approve, schedule, execute" (also presented as free)
  without saying approving needs the subscription — fixed by folding
  approving into the R99/month step and adding an explicit line to the
  "Review requests" step that approving needs an active subscription
  while declining doesn't (matching Phase 18's own finding that the
  trigger only gates the accept path). The hero/Seo/CTA lines were
  already listing "approve every request" as something R99/month buys
  rather than something free — tightened wording only, not a factual
  fix.
- **`home.json`, all four languages** (`audienceSplit.businessBody`,
  `audienceSplit.publisherBody`): same "book without one" /
  ambiguous-approve pattern as the `.tsx` files, fixed the same way.
  `layers.marketplaceBody` was left alone — it describes the
  self-service layer's mechanics (no campaign manager) without making
  a subscription-optional claim, so it wasn't in scope.

## Translation confidence, honestly

The Afrikaans rewrite is a direct, fairly confident translation of the
corrected English. The isiZulu and isiXhosa rewrites are a good-faith
attempt, not a native-speaker-verified one — same caveat
`PHASE16_BRAND_HOMEPAGE_PIVOT_DELIVERY.md` flagged about its own
original copy in these two languages. Worth a native-speaker pass
before this is fully trusted, same as Phase 16's copy always was.

## Toolchain

Same standing limitation as every phase in this sandbox: no network
egress, so `npm ci`/`build`/`test`/`lint` couldn't run. Verified:
JSON-parsed all four `home.json` files (all valid), brace/paren balance
on all six touched `.tsx` files, and re-grepped all six plus `home.json`
afterward for the specific false pattern ("book without one" / "list
and approve ... without one" / "not whether you can use ChatSched at
all") to confirm none remains outside the one line that's still
actually true (`Pricing.tsx`'s "browse or list without one, just with
less on offer" — accurate, left as-is). Needs a real
`npm run build && npm test` before this is trusted the way a real
toolchain run would earn.

## Not done / still open

- **Translation review for isiZulu and isiXhosa** — see above.
- **Bulk request creation** — still open in this lineage since Phase 8,
  unrelated to this delivery, still sitting (per Phase 18's note, closed
  in a separate lineage that hasn't been reconciled with this one).
- **Cancellation doesn't touch PayFast** — unchanged from Phase 17.
- **Never run against real Postgres or a real build.**

## Next

With the copy now honest, the two items Phase 18 left open are the
real remaining work: a verified PayFast cancellation integration, or
reconciling this lineage's missing bulk-request-creation with the one
that shipped it elsewhere — whichever matters more for how this
actually gets used next.
