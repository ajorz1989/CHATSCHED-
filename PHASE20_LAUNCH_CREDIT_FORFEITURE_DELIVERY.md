# Agency Pivot — Launch Credit Forfeiture on Subscription Lapse

Closes the last open item from `PHASE17_SUBSCRIPTION_ENFORCEMENT_DELIVERY.md`'s
"Not done" list: *"`business_launch_credits` isn't touched by any of
this. A business whose subscription lapses keeps whatever launch credit
they already had; nothing here revisits that."* The other two items on
that same list — the now-false copy, and PayFast cancellation — were
closed in Phase 19 and this session's earlier PayFast fix respectively.

## The actual gap, precisely

Launch credit spending (`applyLaunchCredit`, `payfast-checkout`) was
never blocked by subscription status, because campaign *payment* isn't
subscription-gated at all — only *starting new* requests/opportunities is
(`schema_phase71`, confirmed by reading its policies directly). So a
business could cancel their subscription and still burn remaining launch
credit against an already-confirmed campaign afterward. Not a security
hole, but a real, silent money leak against the product's own intent.

## Decision, not assumed

Three reasonable options existed (freeze-and-restore, forfeit
immediately, or leave it alone as already-granted money) — asked rather
than picked one, same as this repo's own prior audits do for genuine
business-policy forks. **Decision: forfeit immediately on cancellation.**

## What's built

`supabase/functions/_shared/launchCredit.ts` — `forfeitBusinessLaunchCredit(admin, businessId)`.
Zeroes `business_launch_credits.remaining` for that business; a no-op if
there's no credit row yet or it's already at zero (not an error case,
just nothing to do). Deliberately **not** called for `past_due` — that's
still a recoverable state (PayFast still retrying a failed renewal), and
forfeiting mid-retry would be a harsher read of "lapsed" than what was
actually decided. Only `cancelled` (and `suspended`, if a future
grace-period-expiry job ever actually sets it — nothing does today,
checked directly) forfeit.

Wired into both real paths to `cancelled`:

- **`cancel-subscription/index.ts`** — the person's own cancel action.
  Runs after the local status update, only for `role === "business"`
  (launch credit doesn't exist for publishers).
- **`payfast-notify`'s `handleBusinessSubscriptionItn`** — the two ITN
  paths that can independently reach `cancelled` without going through
  our own cancel function: a `FAILED` first payment (never was active,
  nothing to fall back to) and a `CANCELLED` status PayFast reports when
  the subscription is cancelled directly from PayFast's own dashboard
  rather than through ChatSched. The `FAILED` branch is mostly a no-op in
  practice (a subscription that's never been active has no credit yet
  either — it's granted on the first `COMPLETE` payment), but it's the
  correct call for the same reason the explicit-cancel path makes it, not
  a special case worth skipping.

**`SubscriptionSection.tsx`**: the cancel confirmation now names the
forfeiture and its exact amount when there's credit left to lose, instead
of only mentioning PayFast. Local state zeroes the displayed credit
optimistically on a successful cancel, matching what the backend just
did.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, 123/123 passing — unchanged; this is server-side edge-function logic with no pure-function surface to isolate into a new test, same limitation this repo's own edge functions have always had |

## Not done / still open

- **No automated coverage for edge function logic** — same standing gap
  as every `supabase/functions/*` file in this repo; `forfeitBusinessLaunchCredit`
  has no test of its own for the same reason `cancel-subscription` and
  `payfast-notify` never have.
- **Never run against real Postgres** — unchanged standing limitation.
- **Bulk request creation** — unrelated, still open since Phase 8.
