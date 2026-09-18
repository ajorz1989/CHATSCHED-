# Agency Pivot — Campaign Package Pricing Delivery

Builds on everything through `PHASE8_ADMIN_REQUEST_CREATION_DELIVERY.md`.
Closes the last item on `PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md`'s original
"Not done" list: "No package pricing / client payment collection for the
campaign as a whole."

## Started against the wrong base, caught before delivery

This was first drafted as `schema_phase62_campaign_packages.sql` against
a copy of the zip from before Phase 7 and Phase 8 existed. Mid-build, the
Phase 8 report landed — and named the exact same mistake happening to
its own author one number earlier: a `schema_phase61` built against a
stale snapshot, collision caught only because the newer work hadn't been
delivered yet. Same situation here, one phase later. Discarded the draft
entirely rather than patch the numbering and hope nothing else had
shifted — re-read this exact zip's actual `agency_campaigns` schema,
`AdminCampaigns.tsx`, and `types.ts` from scratch, and rebuilt against
what's really here. Renumbered to `schema_phase65_campaign_packages.sql`,
after the confirmed-latest `schema_phase64_admin_request_creation.sql`.

**Worth being blunt about:** this is the second time this exact failure
mode has shown up in this thread, and the underlying cause hasn't
changed — no shared filesystem between whichever sessions are building
this concurrently, so "what's the latest migration number" is only ever
known by re-checking a specific zip, never assumed from memory of an
earlier one. Third time, it might not get caught before delivery.

## Scope call: one price on one campaign, not a package catalog

The brief's "campaign packages" reads as a bigger idea — a catalog of
named, reusable tiers a campaign manager picks from. Building that
catalog is a real, separate design surface with almost nothing to go on
beyond a one-line mention. What's unambiguous and buildable now: a
single price on a single `agency_campaigns` row, paid once, instead of
per linked booking. A reusable catalog can layer on top later (a
`package_id` FK and a template table) without touching what's built
here.

## Payment mechanism: manual EFT, not new PayFast integration

`channel_requests` already deliberately uses manual bank transfer +
admin confirmation instead of PayFast, specifically because "the payment
mechanics genuinely differ" for that kind of relationship
(`schema_phase17_channel_marketplace.sql`'s own words). A managed agency
client is at least as high-touch. A third payment rail as new,
never-run Deno edge-function code carries real risk for something
core-financial, with no way to test it against a live PayFast sandbox
here. Reused the exact submit-then-admin-confirms shape
`channel_requests` already has.

## What's built

**Schema** — `supabase/schema_phase65_campaign_packages.sql`:
- Four new columns on `agency_campaigns`: `package_price`,
  `package_payment_status` (`unpaid`/`payment_submitted`/`paid`),
  `package_payment_reference`, `package_payment_submitted_at`,
  `package_paid_at`.
- `submit_managed_campaign_package_payment(p_campaign_id, p_reference)`
  — client-facing RPC, not a raw UPDATE policy (same reasoning
  `schema_phase61`'s header already gives: touches only these four
  fields, nothing else on the row, without needing a trigger to fence
  it). Admin confirming receipt is a plain UPDATE from
  `AdminCampaigns.tsx` — admin already has full write access.
- `get_my_managed_campaigns()` (`schema_phase61`) extended,
  `CREATE OR REPLACE`, same signature plus the four new fields.

**Interaction with Phase 7's auto-advance, deliberately not touched:**
`maybe_advance_agency_campaign()` moves `payment_pending` → `planning`
based on every linked booking being paid individually. A package-priced
campaign's bookings may never show paid at that level — the client paid
the package, not each booking — so that trigger simply won't fire here,
and will keep no-op'ing (safe by its own design, just inert for this
path). Rather than edit another phase's trigger without being able to
test it against real Postgres, `AdminCampaigns.tsx`'s package-payment
confirmation advances status to `planning` itself, client-side, in the
same action, only when the campaign is still `payment_pending`. Same end
state, zero risk to the existing trigger.

**Admin UI** — `AdminCampaigns.tsx`: package price field in the create
form; in the expanded view, a "Package pricing" block showing price,
payment status, the client's submitted reference, and a "Confirm
received" button (only enabled from `payment_submitted`, logs via
`log_admin_action` — the same audit trail Phase 7 built a viewer for).
Price becomes read-only once payment moves past `unpaid`, so the
displayed price can't drift from what the client actually paid against.

**Client UI** — `ManagedCampaignsSection.tsx`: the collapsed card summary
now shows "Campaign price RX" instead of "Budget RX" when a package price
is set (the actual number that matters to the client). Expanded view
gets a `PackagePayment` block: bank details via the existing
`BankDetailsPanel` with a deterministic reference (`CS-PKG-{id}`, not a
free-text field — matches how references are generated everywhere else
in this app, e.g. `CampaignWorkspace.tsx`'s own `CS-{id}` pattern), and
an "I've made this payment" button once unpaid. Reloads the campaign list
after submitting so the new `payment_submitted` status shows immediately.

**Types** — both `AgencyCampaign` and `MyManagedCampaign` in `types.ts`
get the four new fields (the client-facing one omits
`package_payment_submitted_at`, which isn't shown to the client).

## Toolchain

Same standing limitation as every phase originating in this sandbox: no
network egress, so `npm ci`/`build`/`test`/`lint` couldn't run here, and
none of this SQL has touched real Postgres. Verified what's possible:
brace/paren/div balance and an isolated `tsc --noEmit` pass on every
touched file (clean), and confirmed every RPC name called from either
component matches its SQL definition exactly — worth checking explicitly
given the messaging-safety and margin-economics phases both had close
calls with names or numbers that looked right on inspection. Needs a
real `npm run build && npm test` and a live Postgres run before merging.

## Not done / still open

- **No reusable package catalog** — by design, see scope call above.
- **No PayFast option for package payments** — manual EFT only, by
  design, see payment-mechanism reasoning above. A future phase could add
  it as an alternative, not a replacement.
- **Auto-advance doesn't know about package payment** — deliberately;
  see the interaction section above. If `maybe_advance_agency_campaign()`
  is ever revisited, this is the one caller-side workaround that could
  be retired in favor of teaching the trigger about
  `package_payment_status` directly.
- **Never run against real Postgres.**
- Everything still open from Phase 7's own list (backlink from a
  booking's workspace to its parent campaign, no notification on status
  change) — untouched here.

## Next

Every item from `PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md`'s original "Not
done" list is closed. What's left is the polish items above, plus
whichever of Phase 1's audit remaining items — opportunity feed, reverse
marketplace, Run Again, homepage/brand repositioning — comes next.
Given how close two migration-numbering collisions have come to landing
in this thread, whoever picks up next should treat "re-verify the latest
phase number against the actual zip in hand" as a mandatory first step,
not a nice-to-have.
