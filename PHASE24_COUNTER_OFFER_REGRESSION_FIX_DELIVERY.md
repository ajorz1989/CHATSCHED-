# Agency Pivot — Counter-Offer & Content-Approval Regression Fix

Corrects a mischaracterization, not a design decision. This session's own
earlier summary described "counter-offer/decline on `channel_requests`
are intentionally ungated" as `PHASE18_PROACTIVE_SUBSCRIPTION_GATE_DELIVERY.md`'s
documented design choice. Asked to act on it, reading the actual trigger
directly (rather than trusting that prior characterization) turned up
something worse: the counter-offer path doesn't gate because it doesn't
exist. `schema_phase71_subscription_enforcement.sql` silently deleted it.

## What actually happened

`schema_phase71`'s own header says it "supersedes
`enforce_channel_request_transition()` (`schema_phase17`)... identical to
that version except for the one added check." That's the bug: by the
time Phase 71 was written, the real, live definition of this trigger
function was Phase 53's — which had already picked up two things
Phase 17 never had:

1. **Phase 35's counter-offer state machine** — `pending -> countered`,
   `countered -> awaiting_payment`, `countered -> cancelled`.
2. **Phase 53/54's content-approval gate on going live** — `paid -> live`
   required an approved `content_approvals` row.

`create or replace function` replaces the entire body, not a diff.
Building Phase 71 off Phase 17 instead of Phase 53 silently deleted both
features rather than gating or extending them. Confirmed by a direct
diff of the two function bodies, not assumed: everything Phase 71 has is
a strict subset of Phase 53's, minus the one subscription check it
legitimately added.

The frontend was never updated to match — it didn't need to be, since it
was written against the real (Phase 53) state machine and had no reason
to expect Phase 71 would regress it. `PublisherDashboardView.tsx` still
fires `.update({ status: 'countered', counter_amount, counter_note })`.
`ChannelCampaignCard.tsx` still has a business-side "Accept counter"
button doing `countered -> awaiting_payment`. Every one of those calls
has been hitting this function's fallback —
`raise exception 'That status change is not allowed.'` — since Phase 71
shipped. Separately, any placement could go live with zero content-
approval check, a real compliance hole, not a subscription gap.

## The fix

`schema_phase73_restore_counter_offer_and_content_gate.sql` — renumbered
from 72 after a real collision with `PHASE23_SUBSCRIPTION_GRACE_PERIOD_DELIVERY.md`'s
own `schema_phase72_subscription_grace_period.sql` (this was originally
written against a base that didn't yet have that phase's work). Same
call `schema_phase71` itself made against `schema_phase70` for the
identical reason, per its own header.

Full `create or replace`, built from Phase 53's complete body (the last
correct version) with Phase 71's subscription check merged into the
accept branch — not Phase 71's body with pieces added back, to avoid the
same failure mode: missing a third silently-dropped feature the way
Phase 71 missed these two. Confirmed by re-reading Phase 53's full
function directly while writing this, not from memory of what it "should"
contain.

Restores, verbatim from Phase 53:
- `pending -> countered` (creator counters, requires a real
  `counter_amount`)
- `countered -> awaiting_payment` (business accepts — `proposed_amount`
  gets overwritten with the agreed counter, same as before)
- `countered -> cancelled` (business declines the counter)
- `paid -> live` requiring an approved `content_approvals` row

Countering and declining a counter stay ungated by subscription status —
same reasoning Phase 71 itself gave for exempting decline: a lapsed
subscription shouldn't trap a creator mid-negotiation on an
already-started booking.

`supabase/DEPLOY.md` gets a new section in the same format as every
other migration, with a manual verification step (counter a `pending`
row, confirm accept/decline both work, confirm `paid -> live` still
blocks without approval).

## An adjacent bug found while verifying, fixed in the same pass

Running the full toolchain against the merged tree surfaced two failing
tests in `CreateRequestForClient.test.tsx` (Phase 22's own new coverage
for Phase 21's bulk-creation component) — pre-existing in the uploaded
zip, not introduced by this session's changes, but worth fixing rather
than leaving broken:

1. **Real bug in `CreateRequestForClient.tsx`**: the per-row `required`
   HTML attributes on the method `<select>` and amount `<input>` let the
   browser's native constraint validation intercept form submission
   before the component's own JS validation ever runs — so the
   friendly, publisher-specific error message
   (`"X is missing its advertising method or proposed amount"`) was
   unreachable, for that row or any other in the batch. A real browser
   hits the same problem: a generic native tooltip instead of the
   intended message. Fixed by removing `required` from those two fields
   — the JS-level per-row check in `submit()` is the real validation now,
   which is what the message-field UX was already designed around.
2. **Test-query ambiguity, not a component bug**: one test's
   `getByText(regex)` matched two separate elements once an amount was
   typed — the row header and the commission-preview line, which
   legitimately both contain the publisher's name
   (`"{name} would receive R... after commission."`). The component's
   actual behavior (row stays queued after a partial failure) was
   already correct; tightened the assertion to `getAllByText(...).length`
   rather than touching the component further.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 errors (2 pre-existing warnings on intentional `thenable` test-mock shims in `launchCredit.test.ts` and `CreateRequestForClient.test.tsx` — not touched, since removing them would break the mock's ability to imitate Supabase's awaitable query builder) |
| `npm test` | ✅ 20 test files, 153/153 passing |

## Not done / still open

- **Never run against real Postgres** — unchanged standing limitation;
  this fix in particular really deserves a real-database check given
  what shipped broken last time a trigger function was replaced without
  one.
- **No automated coverage for `enforce_channel_request_transition()`
  itself** — this whole regression existed because a SQL trigger
  function has no test suite anywhere in this repo, unlike the
  TypeScript logic Phase 23 pulled into `subscriptionLapseDecision.ts`
  specifically to get coverage. Worth considering pgTAP tests for this
  function specifically, given it's now regressed once already.
