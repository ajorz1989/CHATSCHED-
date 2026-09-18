# Agency Pivot — Grace-Period-Expiry Job

Closes the item PHASE20_LAUNCH_CREDIT_FORFEITURE_DELIVERY.md's "Not done"
list named: "No grace-period-expiry job exists yet to ever actually set
`suspended`." That framing undersold the actual gap, found while looking
at what the job would even do — worth stating plainly before the rest of
this doc.

## The gap was bigger than "missing job"

`grace_period` had zero writers anywhere in this codebase. Not "the job
that exits it is missing" — nothing ever put a subscription into it in
the first place. `schema_phase55_subscriptions.sql` defined it as a
valid status because the original brief specifically asked for it, and
`isSubscriptionUsable()` already treated it as usable, but every actual
lapse path (`payfast-notify`'s FAILED branch, `cancel-subscription`)
skipped straight from `active`/`past_due` to `cancelled`. A job that
only handled `grace_period → suspended` would have been real code
watching for rows that could never exist — the same kind of dead
coverage as testing a function nothing calls.

So this phase had to do two things, not one: make something actually
enter `grace_period`, and then build the job that exits it.

## The one deliberate policy call, made as narrowly as possible

`PHASE2_SUBSCRIPTIONS_DELIVERY.md` declined to invent a grace-period
length, and that reasoning holds — neither the original brief nor
anything since states one. Building the job at all meant picking
*something*, so this used the one number this codebase already commits
to for the identical kind of decision: `channel_requests`' 7-day
approval/payment windows (`schema_phase17_channel_marketplace.sql`,
automated in `schema_phase32_expire_channel_requests.sql`). Every place
that number appears —
`subscriptionLapseDecision.ts`'s `SUBSCRIPTION_GRACE_PERIOD_DAYS`,
`schema_phase72`'s migration comment, this doc — says the same thing
plainly: it's a reasonable placeholder following existing precedent, not
a confirmed product decision. Whoever owns that call should treat it as
one line to change (`SUBSCRIPTION_GRACE_PERIOD_DAYS = 7`), not a design
to unpick.

## What's built

- **`schema_phase72_subscription_grace_period.sql`** — adds
  `grace_period_started_at timestamptz` to both `business_subscriptions`
  and `publisher_subscriptions`. A dedicated column rather than reusing
  `updated_at`, which gets touched by unrelated writes and so can't
  reliably answer "how long has this actually been in grace_period."
- **`_shared/subscriptionLapseDecision.ts`** — extended, not replaced:
  - `nextStatusOnFailedPayment` now does three-way lapse instead of two:
    `active → past_due` (recoverable, unchanged) → `past_due → grace_period`
    (new) → repeated failure while already in `grace_period` stays in
    `grace_period` (the scheduled job owns that exit, not retry count —
    otherwise a grace period means nothing for anyone PayFast retries
    more than once during it) → anything else (`pending`, most
    commonly) still goes straight to `cancelled`, unchanged.
  - `shouldForfeitLaunchCredit` unchanged in behavior — `grace_period`
    already didn't forfeit, matching the whole point of a grace period.
  - New: `isGracePeriodExpired(gracePeriodStartedAt, now, graceDays)` —
    the boundary check the new job uses, pure and independently tested.
  - Renamed `BusinessSubscriptionStatus` → `SubscriptionLifecycleStatus`
    now that this module genuinely governs both subscription types, not
    just business's. Checked first: nothing outside this file imported
    the old name.
- **`payfast-notify/index.ts`** — `handlePublisherSubscriptionItn`'s
  FAILED/CANCELLED branches now go through the shared functions instead
  of their own inline `active ? past_due : cancelled` (a small
  consistency fix noted as future work in PHASE22's own "Not done", done
  here since touching the business branch's logic anyway made the
  inconsistency obvious). Both handlers' COMPLETE branches now clear
  `grace_period_started_at` back to null on recovery, and the FAILED
  branches set it only on first entry into `grace_period`, never on a
  repeat failure already inside it.
- **`cancel-subscription/index.ts`** — also clears
  `grace_period_started_at` on explicit cancellation. Not required for
  correctness (the new job only ever queries `status = 'grace_period'`
  rows, so a stale timestamp on an already-`cancelled` row is inert) but
  cheap to keep tidy rather than leave a confusing leftover for whoever
  next reads that row.
- **`expire-subscription-grace-periods`** (new Edge Function) — the
  actual scheduled job. Modeled directly on `expire-channel-requests`:
  same `CRON_SECRET` header auth, same `--no-verify-jwt` deploy, same
  shape. Finds every `grace_period` row (both tables) whose
  `grace_period_started_at` is at or before the cutoff, moves it to
  `suspended`, clears the clock, and — for business rows — calls
  `forfeitBusinessLaunchCredit` for each one afterward (one at a time,
  not `Promise.all`, since that helper already handles its own failures
  internally and there's no benefit to racing concurrent writes against
  the same `business_launch_credits` row).
- **`DEPLOY.md`** — new "Scheduled subscription grace-period expiry"
  section, same shape as "Scheduled request expiry" right above it:
  migration, deploy command, the `cron.schedule(...)` SQL to run by hand
  (not committed, for the same secret-leak reason as the existing
  section), and a manual back-dated-row test procedure. Reuses the
  existing `CRON_SECRET` and `pg_cron`/`pg_net` extensions — nothing new
  to provision beyond the one migration and one function deploy.
- **`launchCredit.ts`**'s doc comments — updated from describing this as
  a hypothetical future job to pointing at the real one.

## Toolchain

Same standing limitation as every phase in this lineage: no network
egress, so nothing here has been run against real Postgres, and the new
`expire-subscription-grace-periods/index.ts` can't be loaded under
vitest for the same `Deno.serve`-at-module-scope reason `payfast-notify`
and `expire-channel-requests` never could — consistent with how PHASE22
already handled that limitation, not a new gap. What could be verified
without a live environment: brace/paren balance on every touched file,
a full-repo grep confirming nothing still references the old
`BusinessSubscriptionStatus` name or the old two-value
`nextStatusOnFailedPayment` return type, and `subscriptionLapseDecision.test.ts`
covering every branch of all three pure functions — including the
`grace_period → grace_period` no-reset-on-repeat-failure case and the
exact boundary `isGracePeriodExpired` treats as expired. None of it has
actually been executed; `npm test` is still the real test of whether any
of this is right, same as every prior phase's own caveat.

## Not done / still open

- **The 7-day grace-period length is a placeholder, not a confirmed
  decision** — see above. One line to change in
  `subscriptionLapseDecision.ts` once someone actually decides.
- **Never run against real Postgres, and the new Edge Function can't be
  loaded under vitest** — standing limitations, not new to this phase.
- **No email notification when a subscription enters `grace_period` or
  is suspended** — `payfast-notify` doesn't send subscription-lifecycle
  email today (unlike `expire-channel-requests`, which does), so adding
  it here would be new scope, not closing the named gap. Worth doing —
  someone whose subscription just got suspended finding out only by
  logging in and noticing the badge changed color is a real gap — but a
  deliberately separate one from what this phase set out to fix.
- **Translation review for isiZulu and isiXhosa** — unrelated, still
  open since PHASE19.

## Next

The email-on-lapse gap named just above is probably the next real
product gap worth closing, now that `grace_period`/`suspended` are
actually reachable states someone can land in without knowing why.
Separately, the 7-day placeholder is worth an explicit decision rather
than quietly becoming permanent by nobody revisiting it.
