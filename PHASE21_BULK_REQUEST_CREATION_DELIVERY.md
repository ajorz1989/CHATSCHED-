# Agency Pivot — Bulk Request Creation

Closes the last remaining item from the outstanding-work list: "no bulk
creation," named in `PHASE8_ADMIN_REQUEST_CREATION_DELIVERY.md`'s own
"Not done" section and repeated unfixed through every phase since
("`PHASE17_SUBSCRIPTION_ENFORCEMENT_DELIVERY.md`'s own... still open
since Phase 8"). Per that report's own words: *"One publisher, one
request, per submission — fine for assembling a campaign a few bookings
at a time, not for papering a 20-publisher local-awareness package in
one sitting."*

## What changed

`CreateRequestForClient.tsx` (admin-side, wired into `AdminCampaigns.tsx`)
went from submit-on-select to a queue-then-submit flow:

- One shared campaign-message field for the whole batch — this is one
  campaign brief going out to many publishers, not N unrelated ones.
  Deliberately not per-row: per-row message editing would let 20 rows
  silently drift out of sync with each other, which is a worse failure
  mode than losing the ability to customize one row's wording.
- Publisher search now **adds to a queue** instead of opening a single
  form — search stays open the whole time, so admin can add publisher
  after publisher without the UI collapsing back to a blank search box
  each time.
- Advertising method and proposed amount stay **per-row** — the one
  thing that can't safely be shared, since `channel_requests.proposed_amount`
  genuinely differs per publisher (different rate cards). Each queued
  non-social-media row shows its own method dropdown (still filtered to
  that specific publisher's `accepted_ad_formats`, same as before) and
  amount input, with the same live commission preview the single-request
  version had.
- A publisher already in the queue can't be added twice — the search
  result shows "(added)" and the entry disables rather than silently
  creating a duplicate row.
- Submit does **two batched inserts**, not N sequential ones: every
  social-media row in one `requests.insert([...])` call, every
  channel-request row in one `channel_requests.insert([...])` call. Two
  round trips regardless of queue size, not one per publisher.

## Partial-failure handling, on purpose

These are two separate tables, so — unlike a single-table batch insert,
which Postgres itself keeps atomic — a submission spanning both shapes
isn't atomic as a whole. If the social-media batch succeeds and the
channel-request batch then fails, the UI says so explicitly (*"The N
social-media request(s) above were already sent"*) and clears only the
rows that actually landed from the queue, leaving the failed ones staged
so admin can fix and resubmit without re-entering the ones that already
went through. Same honesty posture as this session's earlier PayFast-
cancellation fix (`cancel-subscription/index.ts`'s `payfast_cancelled:
false` warning) — report what actually happened, don't imply atomicity
that isn't real.

Client-side validation (every non-social row needs a method and a
positive amount) runs before either insert fires, so a bad row in a
20-publisher batch doesn't burn a round trip only to fail immediately
after.

## What didn't change

- **The RLS policies** (`schema_phase64_admin_request_creation.sql`) —
  `requests_insert_admin` / `channel_requests_insert_admin` already had
  no per-row limit; a multi-row insert under one admin JWT was always
  going to pass the same `public.is_admin()` check N times over in one
  statement. No new migration needed.
- **The creator's own workflow** — every queued row still becomes an
  ordinary `pending` request or channel_request; the creator still
  approves/declines/counters exactly as if the business had submitted it
  themselves, unchanged from Phase 8's own design.
- **No subscription gate on this path** — confirmed still correct per
  `schema_phase71`'s own comment: admin-initiated inserts on behalf of a
  managed client aren't the client's own self-service subscription being
  exercised, so this stays ungated the same way the single-request
  version always was.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, 123/123 passing — unchanged; this is form-state UI logic with no pure-function surface worth isolating into a new test, same reasoning the original single-request version gave |

## Not done / still open

- **No automated coverage** for the queue/batch logic itself, same
  reasoning as above — worth a component test at some point given how
  much more state this version carries than the original.
- **Never run against real Postgres** — unchanged standing limitation;
  the admin insert policies this relies on have still never executed
  against a live instance.
- That closes every item on Phase 17's original "Not done" list plus
  this one — nothing outstanding from that lineage of audits remains
  except the standing "never run against real Postgres" limitation,
  which isn't fixable from this environment.
