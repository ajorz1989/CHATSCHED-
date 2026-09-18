# Agency Pivot — Subscriptions & Launch Credit Delivery

Builds on `PIVOT_PHASE1_AUDIT.md`. Confirmed decisions going in: route all
campaign communication through ChatSched (next phase — not touched here),
retire the original ChatSched booking product (frees the name/price point,
also not a code change in this repo). This phase: the R99/month Publisher
Network subscription, R199/month Business subscription, and the R199
launch credit.

## What's built

**Schema** — `supabase/schema_phase55_subscriptions.sql` (additive, run
after phase54):
- `publisher_subscriptions` — one row per publisher, `status` in
  `pending / active / past_due / grace_period / suspended / cancelled`.
- `business_subscriptions` — same shape, plus `launch_credit_granted`
  (the race-safe guard described below).
- `business_launch_credits` — one row per business, `amount` / `remaining`,
  `remaining` DB-constrained to `0 <= remaining <= amount`.
- `payments.credit_applied` — new column, additive `alter table`.
- RLS on all three new tables: select-own-or-admin, no client writes —
  same shape as `content_studio_subscriptions`' existing policy.

**Billing (PayFast recurring)** — reused the exact pattern already proven
in `content-studio-subscribe` / `payfast-notify`'s Content Studio branch
(R99/month recurring, already shipped, already covered by
`_shared/payfast.ts`'s field order), rather than inventing a new one:
- `supabase/functions/publisher-subscribe/index.ts` (new)
- `supabase/functions/business-subscribe/index.ts` (new)
- `payfast-notify/index.ts` — two new ITN branches
  (`handlePublisherSubscriptionItn`, `handleBusinessSubscriptionItn`),
  same activate/extend-period/past_due/cancelled logic as the Content
  Studio branch.

**Launch credit — grant.** Happens in `handleBusinessSubscriptionItn`, on
this subscription's first-ever `COMPLETE` ITN, once. Guarded by an atomic
check-and-set on `launch_credit_granted` (`update ... where id = ? and
launch_credit_granted = false`, only insert the credit row if that update
actually matched a row) — a retried or duplicate ITN for the same payment
can't grant it twice.

**Launch credit — redemption.** `payfast-checkout` now looks up the
business's remaining credit before building the campaign checkout,
applies `min(campaign amount, remaining credit)`, and charges PayFast only
the difference. The credit itself is deducted only once PayFast confirms
the payment — same reasoning as `payments.status`, which has always only
ever changed inside `payfast-notify`. To make that safe against PayFast's
own webhook retries, the paid-status update there is now guarded with
`.neq("status", "paid")`; the credit is only redeemed when that guarded
update actually matches a row.

**The one exception:** a campaign fully covered by credit (realistic —
posts start around R50, credit is R199) has nothing to charge PayFast for,
and PayFast doesn't accept a R0 checkout. For that case only,
`payfast-checkout` marks the payment paid directly (service-role client,
same `.neq` guard) instead of redirecting to PayFast. I've updated the
comment at the top of `payfast-notify/index.ts` — it previously said
notify was the *only* place a payment is marked paid; that's no longer
quite true, and leaving a stale invariant comment felt worse than
documenting the one exception plainly.

**Application layer** — `src/lib/subscriptions.ts` (+ `.test.ts`, 10
tests): status → label/tone mapping, `isSubscriptionUsable()`, and
`applyLaunchCredit()` — the credit math, as a pure function so it's tested
without touching Supabase. The exact same math is duplicated inline in
`payfast-checkout` (Deno edge functions can't import from `src/`, same
reason `MONTHLY_PRICE` is duplicated in the subscribe functions — flagged
in a comment at each duplication site so they don't drift silently).

**UI** — `src/components/SubscriptionSection.tsx`, wired into
`/account` for business and publisher accounts: status, renewal date,
launch credit balance (business only), and a subscribe/retry button.
Deliberately the *only* UI surface touched this phase — see below.

**Feature flag** — `isSubscriptionEnforcementEnabled()` in
`featureFlags.ts`, reading `VITE_SUBSCRIPTIONS_ENFORCED`, hard-defaulted
to `false`. Nothing calls it yet.

## Toolchain

Ran clean after every file above was in place:

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 16 test files, **109/109 passing** (was 99 before this phase) |

## Judgment calls made — flagging rather than burying

1. **Launch credit is one-time, not monthly.** "R199 Launch Credit"
   reads as a first-payment incentive, not a recurring discount that
   would just cancel out part of the subscription price every month.
   Easy to change if wrong — `business_launch_credits` would just get a
   unique constraint on `(business_id, subscription_id)` instead of
   `business_id` alone, and the grant would move out of the
   "first payment only" guard.
2. **No expiry on the credit** (`expires_at` is nullable, unset by
   default). The brief said "if applicable" and didn't specify a policy —
   didn't want to invent one.
3. **No automatic time-based transitions** into `grace_period` or
   `suspended` — those exist as valid states (the brief specifically
   asked for both), but nothing moves a subscription into them
   automatically. That needs either a scheduled job or an admin action,
   and a grace-period-length policy neither the brief nor the existing
   codebase states anywhere. This matches how `channel_requests` expiry
   is handled elsewhere in this repo — no cron, admin is the safety net
   at pilot volume — rather than me inventing a duration.
4. **No enforcement wired up.** Subscribing and having an active
   subscription is fully real; nothing currently checks it before letting
   someone use the marketplace. That's `isSubscriptionEnforcementEnabled()`
   waiting for a decision, not an oversight — flipping the entire existing
   free flow into a paywall is a bigger, more visible product change than
   "add billing," and deserves its own explicit go-ahead rather than
   arriving as a side effect of this phase.
5. **UI scope.** One integration point (`/account`) for both roles,
   not a dashboard banner, pricing-page rewrite, or admin subscription
   list. Those are straightforward extensions of what's here, just
   deliberately left for the next pass rather than guessed at now.

## Not done / still open

- Never deployed or run against real Postgres/PayFast sandbox — same
  standing limitation as everything else in this repo (no DB in this
  sandbox). The RLS policies and table constraints read correctly against
  the existing schema, but haven't been exercised for real.
- Admin visibility into subscriptions (who's subscribed, MRR, failed
  payments) — ties into `/admin/revenue` from the Phase 1 audit, not
  built here.
- Cancellation UI — a business/publisher can retry or let a subscription
  lapse, but there's no explicit "cancel" button anywhere yet.

## Next

Messaging/communication architecture (route all channels through
ChatSched, including the 4 that currently let a business and creator
accept/decline directly) — the confirmed decision from last message, next
in the build order from `PIVOT_PHASE1_AUDIT.md`.
