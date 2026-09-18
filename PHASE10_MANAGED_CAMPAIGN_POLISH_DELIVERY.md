# Agency Pivot — Managed Campaign Polish Delivery

Builds on everything through `PHASE9_CAMPAIGN_PACKAGES_DELIVERY.md`.
Closes both smaller items `PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md`
first flagged and every phase since left open: no backlink from a
booking's workspace to its parent managed campaign, and no notification
on campaign status change or a new booking getting linked.

Re-verified the latest schema_phase number against this exact zip before
writing anything (64 → 65 → **66**) — the discipline `PHASE9`'s own report
argued for after its own near-miss, now actually followed rather than
just recommended.

## Backlink: no new migration needed

`agency_campaign_id` already existed on the `agency_campaigns`,
`requests`, and `channel_requests` tables since Phase 6 — what was
missing was the TypeScript side: `LinkableRequest` (Phase 6's own
narrow projection type) had it, but the main `ChannelRequest`/
`PublisherRequest` interfaces `CampaignWorkspace.tsx` actually uses never
did. Added it to both.

`ManagedCampaignBacklink` (new, inline in `CampaignWorkspace.tsx`)
reuses `get_my_managed_campaigns()` (`schema_phase61`) rather than
adding a new RPC for a one-line name lookup — that call already returns
every campaign the business can see, so finding the one matching this
booking's `agency_campaign_id` is a client-side filter. Renders nothing
while loading or if the lookup comes back empty (wrong viewer, or the
booking isn't actually linked) — same "say nothing rather than show a
broken state" posture the rest of this app uses. Business-only: a
creator has no relationship to the client's `agency_campaigns` row.

Links to `/dashboard`, not a campaign-specific URL — there's still no
`/managed-campaigns/:id` route, by the same design call
`PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md` made (an expand-in-place
card list, not a new page, since the entity is thin).

## Notifications: one new migration

`schema_phase66_managed_campaign_notifications.sql`:

- **Status change** — fires on any `UPDATE OF status` on
  `agency_campaigns`, regardless of what caused it: an admin's manual
  change, Phase 7's auto-advance trigger, or Phase 9's package-payment
  confirmation. One trigger, one notification either way — the business
  shouldn't need to know or care which of those moved their campaign.
- **New booking linked** — fires on `INSERT OR UPDATE OF agency_campaign_id`
  on both `requests` and `channel_requests`, covering both
  `AdminCampaigns.tsx`'s "Link" action on an existing booking and
  `CreateRequestForClient.tsx` (`schema_phase64`) setting it at creation
  time in the same insert. Guards against firing on a no-op update
  (same value written twice) using `IS NOT DISTINCT FROM`, which also
  correctly handles the INSERT case where `OLD` doesn't exist.

Both route through `create_notification()` (`schema_phase23`), same
function every other notification in this app already uses — no new
notification infrastructure, just two more triggers calling it.

## Toolchain

Same standing limitation as every phase originating in this sandbox: no
network egress, so `npm ci`/`build`/`test`/`lint` couldn't run here, and
neither trigger has touched real Postgres. Verified: brace/paren balance
on every touched file, isolated `tsc --noEmit` (clean), and confirmed
both `get_my_managed_campaigns()` call sites use the identical RPC name.
Worth a real Postgres run in particular for the `IS NOT DISTINCT FROM`
logic across both the INSERT and UPDATE trigger paths — reasoned through
carefully here, not the same as having watched it actually fire.

## Not done / still open

- **No notification preference/mute.** Every status change on a managed
  campaign now notifies, with no way for a client to quiet a
  fast-moving one. Same posture every other notification type in this
  app already has (none of them are mutable individually either), so
  not a new gap this phase introduces — just noting it doesn't solve it.
- **The backlink doesn't distinguish "this campaign's status changed
  because a package was just confirmed paid" from any other reason** —
  it just shows the campaign name, not why it's there. Fine for
  navigation, not a status summary.
- **Never run against real Postgres.**

## Next

Both smaller items from `PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md`'s
original list are closed, alongside everything from
`PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md`'s. The managed-campaign workflow is
about as complete as this thread's incremental build order gets it
without a specific new ask. What's left from `PIVOT_PHASE1_AUDIT.md`:
opportunity feed, reverse marketplace, Run Again, relationship history,
and the homepage/brand repositioning — sequenced last in that original
audit specifically because there's finally enough of the agency layer
built now to make that copy true.
