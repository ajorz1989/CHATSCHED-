# Database tests

New as of the compliance feature build — this repo had no database-level
test harness before this. Nothing else here runs these automatically;
`npm test` only covers pure TypeScript (vitest, see `src/lib/*.test.ts`).

## Running `compliance_test.sql`

Requires a local Supabase instance with every `schema_phase*.sql` file
applied through `schema_phase40_proof_screenshots.sql`, plus the `pgtap`
extension enabled:

```sql
create extension if not exists pgtap;
```

Then either:

```bash
supabase test db
```

or directly with `pg_prove`:

```bash
pg_prove --ext .sql -d <your-local-db-url> supabase/tests/compliance_test.sql
```

This has not been run against a real Postgres instance as part of this
change — it was written to the shape pgTAP expects and reviewed by hand,
not executed. Treat the first real run as the actual test of whether it's
correct, not this note.

## What's covered / not covered

`compliance_test.sql` covers the compliance schema in isolation:
auto-creation of `campaign_compliance`, RLS visibility, the "server is the
only writer of status" rule, `set_campaign_compliance_context`,
`acknowledge_campaign_disclosure`, `campaign_proof` insert/review
permissions, the `campaign-proof-screenshots` storage bucket's RLS
(creator-only upload, participant-only read), and the core status
transitions inside `recompute_campaign_compliance` (including a
`not_accepted` category forcing `not_eligible` regardless of everything
else).

Not yet covered, and worth their own file once this one is confirmed
working: the full end-to-end scenario through payout eligibility (crosses
into the payments/payout schema), the AI screening edge function (needs a
mocked Anthropic response, not a pgTAP concern), and the notification
triggers (`trg_notify_disclosure_required` / `trg_notify_proof_submitted`).

## Running `enforce_channel_request_transition_test.sql` and `rls_channels_publishers_channel_requests_test.sql`

Same commands as above (`supabase test db` or `pg_prove`), against an
instance with every `schema_phase*.sql` through `schema_phase78` applied
for `enforce_channel_request_transition_test.sql`, and through
`schema_phase82` for `rls_channels_publishers_channel_requests_test.sql`
(its publishers block now needs `publishers_public`) — these two exercise
`channels` (`schema_phase74`), `publisher_subscriptions` (`schema_phase55`),
and `content_approvals` (`schema_phase53`), all later
than `compliance_test.sql` needs. Written for Task 1 of
`NEXT_STAGE_DEVELOPMENT_BRIEF.md`, specifically because
`enforce_channel_request_transition()` has a real regression history
(`schema_phase71` silently deleted its counter-offer and content-approval
branches; caught by a human/AI reading the trigger directly during an
unrelated merge, not by any test — see `CLAUDE_1.0.md` item 6 and
`schema_phase73`'s own header for the full story). Same honesty note as
`compliance_test.sql`: written to the pattern pgTAP expects, reviewed by
hand against the actual policy/trigger definitions, but **not run against
a real Postgres instance** — this sandbox has no Docker, `psql`, or
Supabase CLI available to run one. The acceptance test for whether these
are actually correct is the first real `supabase test db` run, not this
note.

- **`enforce_channel_request_transition_test.sql`** — every branch of the
  trigger's state machine: the subscription gate on accepting, the
  deliberately-ungated decline/counter paths, the full counter-offer
  cycle (creator counters → business accepts or declines the counter),
  the content-approval gate on going live (no `content_approvals` row,
  an unapproved one, and an approved one), baseline business/admin
  transitions, and cross-user rejection (a non-participant can't touch a
  request they aren't party to). 20 assertions.
- **`rls_channels_publishers_channel_requests_test.sql`** — the RLS
  policies themselves on `channels` (public read, admin-only write),
  `publishers` (approved rows public via `publishers_public`, not the
  base table — updated for `schema_phase82`; `pending_review` rows
  owner/admin only on the base table), and `channel_requests` (select
  limited to business/creator/admin, insert must be self-directed and
  must start at `pending`). Deliberately does not re-test
  `channel_requests_update_participant`'s permissive `USING` clause in
  depth — that policy is intentionally broad by design (the trigger is
  the real gate, per that policy's own comment in
  `schema_phase17_channel_marketplace.sql`), and the one thing worth
  confirming from the RLS side (a non-participant can't touch a request)
  is already exercised in the trigger test file above, which needs that
  same fixture anyway. 18 assertions (17 original + 1 added when the
  approved-publisher check was split in two for `schema_phase82`).

## Running `prevent_role_escalation_test.sql`

Same commands as above, against an instance with every `schema_phase*.sql`
through `schema_phase81` applied. Written for "Claude To fix 1..txt" item
5, CRITICAL — Admin role escalation risk. Same honesty note as the other
files here: not run against a real Postgres instance, reviewed by hand
against `handle_new_user()` and `prevent_role_change()` in
`schema_phase81_prevent_role_escalation.sql`.

- **`prevent_role_escalation_test.sql`** — the two holes that fix closes:
  a `supabase.auth.signUp()` call whose metadata claims `role: admin`
  lands as `business`, not `admin` (with a companion check that a genuine
  `role: publisher` signup is unaffected); a logged-in non-admin's
  `UPDATE ... SET role = 'admin'` on their own row runs without error but
  is silently reset back by `prevent_role_change()`, the same
  "RLS controls rows, not columns" pattern `prevent_self_verification()`
  already uses for the verification columns; and an admin can still
  change another user's role, confirming the trigger only blocks
  non-admin sessions rather than blocking the column outright. 6
  assertions.

## Running `publishers_public_column_restriction_test.sql`

Same commands as above, against an instance with every `schema_phase*.sql`
through `schema_phase82` applied. Written for "Claude To fix 1..txt" item
6, CRITICAL — Public publisher rows expose sensitive columns. Same
honesty note as the other files here: not run against a real Postgres
instance, reviewed by hand against the `publishers_public` view and
`publishers_select_own_or_admin` policy in
`schema_phase82_restrict_public_publisher_columns.sql`.

- **`publishers_public_column_restriction_test.sql`** — the actual column
  exposure the finding described, proven both ways: `publishers_public`
  returns the approved row to an unrelated authenticated user AND to a
  fully anonymous (logged-out) session, but the row it returns has no
  `email`, `payout_details`, or `admin_notes` key at all (checked via
  `to_jsonb(...) ? 'column'`, not just "the value is null" — the column
  itself doesn't exist in the view); the base `publishers` table no
  longer returns the row at all to that same unrelated user (not
  column-restricted — invisible, same as any other row they don't own);
  and the owner and an admin can still read sensitive columns
  (`email`, `payout_method`) straight off the base table, confirming the
  fix narrows who gets the row, not what any legitimate reader of it can
  see. 8 assertions.

## Running `payout_rpc_authorization_test.sql`

Against an instance with every `schema_phase*.sql` through
`schema_phase83` applied, AND `schema_payouts_phase1.sql` /
`schema_payouts_functions.sql` applied first (these two live outside the
numbered `schema_phase*` sequence — see `workers/README.md`). Written for
"Claude To fix 1..txt" item 7, CRITICAL — Payout RPCs are insufficiently
protected. Same honesty note as the other files here: not run against a
real Postgres instance, reviewed by hand against the actual RLS policies
and function bodies in `schema_phase83_secure_payout_rpcs.sql`. Does not,
and cannot, test `workers/payoutWorker.js` or `workers/webhookServer.js`
— both connect via a raw `DATABASE_URL` Postgres connection outside of
PostgREST/RLS entirely, which is out of pgTAP's reach by design (that's
also exactly why those two trusted paths are unaffected by this fix).

- **`payout_rpc_authorization_test.sql`** — RLS on all four payout
  tables (a non-admin sees zero rows in `payouts`, `payout_items`,
  `publisher_ledger`, and `payout_provider_events`; an admin sees them
  fully); the three previously-unprotected RPCs
  (`create_payout_batch()`, `mark_payout_item_attempt()`,
  `update_payout_status()`) all return `ok: false` for a non-admin
  session; an anonymous session can't even attempt the call at all
  (`throws_ok` on a real Postgres permission error, not a jsonb
  response — proving `PUBLIC` execute was actually revoked, not just
  that the in-function check would have caught it); an admin
  successfully walks a payout item through `pending -> sent ->
  succeeded`, with exactly one `publisher_ledger` entry created for it;
  an admin attempting to move that same item backward out of
  `succeeded` (a terminal state) is rejected as an invalid transition;
  and an admin's `create_payout_batch()` call succeeds end-to-end,
  correctly picking up a publisher's real positive ledger balance into
  a new batch. 15 assertions.

## Running `business_contact_public_test.sql`

Against an instance with every `schema_phase*.sql` through
`schema_phase84` applied. Written for "Claude To fix 1..txt" item 8,
HIGH — Business profile data leakage through shared-request/conversation
policies. Same honesty note as the other files here: not run against a
real Postgres instance, reviewed by hand against the actual view
definition in `schema_phase84_safe_cross_party_profile_access.sql`.

- **`business_contact_public_test.sql`** — a publisher who shares a
  request with a business can see that business via
  `business_contact_public`, and the view has no `phone` key at all
  (checked via `to_jsonb(...) ? 'phone'`, same technique as
  `publishers_public_column_restriction_test.sql`); that same publisher
  gets ZERO rows querying the base `profiles` table directly for that
  business — not column-restricted, the row itself is gone from that
  table for them, which is the actual fix (the two dropped policies were
  removed entirely, not narrowed); an unrelated publisher (no request,
  no conversation) sees nothing via either surface; a publisher who
  shares a conversation instead of a request gets the same safe access,
  confirming both of the original policies' relationships were carried
  over into the one view; the business's own session and an admin
  session are both unaffected on the base table (still read phone
  straight off it); and an anonymous session sees nothing on either
  surface. 11 assertions.

## Running `retire_direct_messaging_test.sql`

Against an instance with every `schema_phase*.sql` through
`schema_phase85` applied. Written for "Claude To fix 1..txt" item 9,
HIGH — Business-to-publisher communication conflicts with the new agency
model. Same honesty note as the other files here: not run against a real
Postgres instance, reviewed by hand against the actual policy in
`schema_phase85_retire_direct_messaging.sql`.

- **`retire_direct_messaging_test.sql`** — an ordinary business can no
  longer open a brand-new `conversations` row with a publisher it has no
  existing thread with (`conversations_insert_business` is gone); that
  same business can still send a message in a conversation that already
  existed before this fix, and so can the publisher on that same
  thread — this change doesn't touch existing conversations, only new
  ones; an admin (ChatSched) can still open a brand-new conversation,
  keeping publisher-ChatSched communication alive; and even an admin
  can't open one with `business_id` set to a real business's id instead
  of their own — `auth.uid() = business_id` is still required alongside
  `is_admin()`, not replaced by it. 5 assertions.

## Running `once_off_pricing_and_featured_placement_test.sql`

Against an instance with every `schema_phase*.sql` through
`schema_phase87` applied. Written for "Claude To fix 1..txt" item 10,
HIGH — Current pricing code does not match the latest intended pricing
specification. Same honesty note as the other files here: not run
against a real Postgres instance, reviewed by hand against the actual
constraints, policies, and trigger in
`schema_phase86_once_off_activation_pricing.sql` and
`schema_phase87_featured_placement_subscriptions.sql`. Cannot invoke any
Edge Function (Deno, not reachable from pgTAP) — every state change is
set directly, the same way every other test file in this directory
simulates what an Edge Function would have written.

- **`once_off_pricing_and_featured_placement_test.sql`** — the removed
  `grace_period`/`suspended` statuses are actually rejected by the check
  constraint now, not just unused; `current_period_end`/`payfast_token`
  are actually gone from both subscription tables, and `paid_at` actually
  exists; `opportunity_applications_insert_publisher` (updated by
  schema_phase86) now matches on `status = 'active'` only — a publisher
  with no active `publisher_subscriptions` row is rejected, and the same
  publisher succeeds once that row exists; and for the new Featured
  Placement product, a different publisher can't see someone else's
  `featured_placement_subscriptions` row, and
  `trg_sync_featured_placement_status` correctly flips
  `publishers.featured` to `true` on activation and back to `false` the
  moment the subscription goes `past_due` — no grace window for this
  product, unlike the old core-membership lifecycle. 10 assertions.

## Running `atomic_launch_credit_redemption_test.sql`

Against an instance with every `schema_phase*.sql` through
`schema_phase88` applied. Written for "Claude To fix 1..txt" item 11,
HIGH — Launch-credit race condition. Same honesty note as the other files
here: not run against a real Postgres instance, reviewed by hand against
the actual function bodies in
`schema_phase88_atomic_launch_credit_redemption.sql`. A true race between
two *concurrent* requests can't be simulated inside one pgTAP transaction
(there's only one session) — what this file proves is that the
sequential state transitions serialize correctly (each reservation sees
the balance the previous one actually left, never a stale
pre-deduction value), which is exactly what the `SELECT ... FOR UPDATE`
lock inside `reserve_launch_credit_for_payment` makes true concurrent
calls resolve to as well.

- **`atomic_launch_credit_redemption_test.sql`** — a R60 payment against a
  R100 credit balance is fully covered (`credit_applied = 60`,
  `amount_due = 0`); a second R60 payment for the same business then only
  gets the genuinely-remaining R40 (not a stale pre-deduction R100),
  leaving `amount_due = 20` and the balance correctly exhausted at 0;
  re-reserving the first payment again returns the same stored figure
  rather than attempting (and failing, or worse, double-deducting) a
  fresh reservation against an already-zero balance; confirming a
  reservation and then releasing a *different* one (simulating that
  payment's PayFast attempt failing) correctly gives back only the
  released payment's own amount; and releasing an already-*confirmed*
  redemption is a safe no-op that does not give back money that was
  already spent. 12 assertions.

## Running `atomic_opportunity_acceptance_test.sql`

Against an instance with every `schema_phase*.sql` through
`schema_phase89` applied. Written for "Claude To fix 1..txt" item 12,
HIGH — Opportunity acceptance is not atomic. Same honesty note as the
other files here: not run against a real Postgres instance, reviewed by
hand against the actual function body in
`schema_phase89_atomic_opportunity_acceptance.sql`. A true race between
two *concurrent* accept calls can't be simulated inside one pgTAP
transaction (there's only one session) — same limitation as
`atomic_launch_credit_redemption_test.sql`. What this file proves is
that the sequential state transitions are correct: the opportunity's own
row lock means a second accept for a different application on the same
opportunity always sees the real, current slot count (including
`close_out_accepted_opportunity`'s own cascade from the first
acceptance), never a stale one.

- **`atomic_opportunity_acceptance_test.sql`** — an unrelated business
  can't accept an application on an opportunity it doesn't own; the real
  owner accepting a social-media publisher's application creates a real
  `requests` row and marks the application accepted, both inside the one
  RPC call; accepting that same application again fails (no longer
  pending); accepting a second application (a non-social-media publisher,
  the opportunity's 2nd of 2 needed slots) creates a real
  `channel_requests` row, AND `close_out_accepted_opportunity`'s existing
  cascade correctly fires from inside that same transaction — the
  opportunity flips to `filled` and the still-pending third application
  is auto-declined, proving the cascade and the booking insert now share
  one atomic unit rather than the cascade having already committed
  independently before the booking was ever attempted. 9 assertions.
