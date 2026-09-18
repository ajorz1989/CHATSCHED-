# Agency Pivot — Margin & Economics Delivery

Builds on `PIVOT_PHASE1_AUDIT.md` and `PHASE2_SUBSCRIPTIONS_DELIVERY.md`.
Also folds in Phase 3 (channel messaging — `schema_phase56_channel_messaging.sql`),
built in a separate session in parallel with Phase 2 and merged into this
codebase alongside this phase.

## What this phase actually is

Not a new page. Extending `AdminAnalytics.tsx` and its RPCs
(`supabase/analytics_functions.sql`) — per `PIVOT_PHASE1_AUDIT.md`'s own
recommendation not to fork a parallel `/admin/revenue` dashboard when a
real one already exists.

## A real bug found and fixed, not just new metrics

While reading `analytics_functions.sql` to figure out where subscription
MRR should plug in, found that every number on the existing dashboard —
GMV, request counts, avg order value, top publishers — only ever queried
`payments`/`requests`. That's the *original* social-media/PayFast flow
only. The 4 newer channels (influencer/website/podcast/radio) settle
entirely on `channel_requests` itself (`proposed_amount` + `paid_at` — no
PayFast checkout on that path, so no `payments` row ever gets written,
per `schema_phase17_channel_marketplace.sql`'s own comment on why). Every
GMV/request number on this dashboard has been invisible to that revenue
since phase17 shipped — not a small gap, since margin/economics work
built on an incomplete revenue base would just be wrong from the start.

Fixed in `analytics_get_overview`, `analytics_time_series`, and
`analytics_segmented_by` — all three now sum both flows. `total_gmv` and
`'gmv'`/`'requests'` are corrected in place, not renamed: an incomplete
"GMV" isn't a different, narrower metric worth preserving under the same
name, it's just wrong. Added `channel_gmv` / `paid_channel_requests` as
new fields alongside the corrected totals so the split stays visible for
anyone who wants it, rather than silently blending two flows together
with no way to tell them apart again.

## What's new

**`analytics_get_overview`** now also returns (all admin-only, same
`is_admin()` gate as before):
- `active_publisher_subs`, `active_business_subs` — current active-subscriber
  counts (a snapshot, not period-scoped — "how many paying subscribers
  right now" is the MRR question, not "how many started this week")
- `past_due_publisher_subs`, `past_due_business_subs`, `grace_or_suspended_subs`
  — the "subscriptions at risk" figures `PHASE2_SUBSCRIPTIONS_DELIVERY.md`
  flagged as not yet built
- `credit_granted`, `credit_redeemed`, `credit_outstanding` — launch
  credit totals (standing liability, all-time)
- `credit_applied_in_period` — the one period-scoped credit figure,
  since it's the actual discount against that period's revenue

Deliberately does **not** compute commission revenue or subscription MRR
in SQL — those are `raw count/GMV × price`, and the price
(`PLATFORM_COMMISSION_RATE`, `PUBLISHER_SUBSCRIPTION_PRICE`,
`BUSINESS_SUBSCRIPTION_PRICE`) already lives once, in
`src/lib/constants.ts`. `AdminAnalytics.tsx` does that multiplication
client-side, so the rate can't drift between a SQL copy and the TS one —
same reasoning `PHASE2_SUBSCRIPTIONS_DELIVERY.md` already used for why
`MONTHLY_PRICE` isn't duplicated where it can be avoided.

**`AdminAnalytics.tsx`** — new "Revenue & margin" section: commission
earned this period, current subscription MRR (split publisher/business),
subscriptions at risk (past-due + grace/suspended), launch credit
outstanding. Commission is explicitly labeled "period" and MRR explicitly
labeled "current snapshot" rather than summed into one blended "revenue"
figure — a period total and a monthly run-rate are different units, and
adding them together would be the kind of quietly-misleading number this
codebase's own README/Transparency page explicitly avoids elsewhere.

## Toolchain

Same standing limitation as every phase so far in this thread: no network
egress in this sandbox, so `npm ci`/`build`/`test`/`lint` couldn't
actually run here, and none of this SQL has touched real Postgres.
Verified what's possible without a real toolchain: brace/paren balance
and an isolated `tsc --noEmit` pass on every touched file (clean), plus a
manual read-through of the extended SQL for the union/join logic. This
needs a real `npm run build && npm test` and an actual Postgres run
before merging — flagging plainly rather than implying the green
checkmarks the audit/phase2 docs got from an environment with more
access than this one has.

## Not done / still open

- No `/admin/profitability` deep-dive (cost breakdown beyond credit,
  cohort/retention analysis) — this phase is the overview-level fix and
  addition the audit called for, not a full profitability suite.
- `credit_redeemed` (all-time redeemed total) is returned by the RPC but
  not yet surfaced in the UI — `credit_outstanding` and
  `credit_applied_in_period` covered the two questions that seemed most
  actionable (what's the standing liability, what got redeemed
  recently); the all-time redeemed figure is one line to add whenever
  it's wanted.
- Margin tracking for the agency/managed-campaign layer (Phase 5) doesn't
  exist yet, for the obvious reason that the managed-campaign workflow
  itself doesn't exist yet — this phase covers marketplace + subscription
  economics only, which is everything currently real.

## Next

Phase 5 — agency core (leads, clients CRM, campaign managers, managed
campaign workflow) — the last major item from `PIVOT_PHASE1_AUDIT.md`'s
build order, and by its own description "almost the entire net-new
build." One thing worth deciding before that one starts, flagged but not
yet resolved: whether a campaign manager is a new `profiles.role` value
or an admin with a client-assignment table layered on top — changes the
RLS shape for everything downstream of it.
