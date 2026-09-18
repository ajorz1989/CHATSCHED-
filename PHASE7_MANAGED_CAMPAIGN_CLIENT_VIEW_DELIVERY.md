# Agency Pivot — Client-Facing Managed Campaign View Delivery

Builds on `PIVOT_PHASE1_AUDIT.md` through `PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md`.
Resolves the first of the two open items in that report: no
client/business-facing view. (The other — admin creating a request *on
behalf of* a client — is still open; see Next.)

## What's built

**Schema** — `supabase/schema_phase61_managed_campaign_client_view.sql`:
three RPCs, not a new SELECT policy on `agency_campaigns` — the file's
own header explains why (short version: `campaign_manager_id` needs
resolving to a display name, and `profiles` has no general "read
anyone's name" policy, so a narrow security-definer RPC is a smaller
grant than opening that table up; also keeps this consistent with
`agency_client_totals()`/`agency_campaign_totals()` already being
computed-projection RPCs rather than raw table reads).

- `get_my_managed_campaigns()` — the calling business's own campaigns,
  client-safe fields plus the manager's resolved `full_name`.
- `get_my_managed_campaign_totals(p_campaign_id)` — same combined-both-
  settlement-paths math as `agency_campaign_totals()`
  (`schema_phase60_agency_campaigns.sql`), gated on campaign ownership
  instead of admin. Not a refactor of the admin one — genuinely two
  different actors asking the same question, so both exist side by side.
- `get_my_managed_campaign_bookings(p_campaign_id)` — the linked
  requests/channel_requests, just enough detail to list and link out to
  `/campaigns/:id` for the real thing. Deliberately doesn't duplicate
  that page's data.

Deliberately still admin-only, untouched: `agency_clients`
(service_level, renewal_status, internal notes) and `agency_leads`
(pipeline stage, estimated value, source). A client sees their
campaigns, not ChatSched's internal account record of them.

**UI** — `src/components/ManagedCampaignsSection.tsx`, wired into
`Dashboard.tsx` above `CampaignRollup`. Renders nothing for the ~everyone
who isn't a managed client — fetches `get_my_managed_campaigns()` on
mount, bails silently on an empty result, so ordinary self-service
businesses never see an empty, confusing section. Each campaign is a
collapsed summary card; expanding lazy-loads totals + linked bookings via
the other two RPCs (loaded once, cached in state — re-collapsing and
re-expanding doesn't re-fetch). Each linked booking is a row linking
straight into `/campaigns/:id`.

**Types** — `MyManagedCampaign`, `MyManagedCampaignBooking` in
`types.ts`. Deliberately not the same interfaces as `AgencyCampaign`/
`AgencyCampaignTotals` — the RPCs return a different, narrower,
resolved-name-instead-of-id shape than the admin-only table/function
they're modeled on, and reusing the admin type would have implied a
column-for-column match that isn't actually true.

## A design call worth flagging

Went with an expand-in-place card list on the existing Dashboard rather
than a new `/managed-campaigns/:id` route. `AdminCampaigns.tsx`
(Phase 6) already does "expand to see detail" for the same entity on the
admin side, and a managed campaign is a genuinely lighter entity than a
request/channel_request — a handful of fields plus a short list of links
out to the real workspaces, not enough unique content to earn its own
route the way `/campaigns/:id` does. Matches the "extend, don't fork" call
made in every phase so far rather than introducing a new page pattern for
something this thin.

## Toolchain

Same standing limitation as every phase originating in this sandbox: no
network egress, so `npm ci`/`build`/`test`/`lint` couldn't run here, and
none of this SQL has touched real Postgres. Verified what's possible
without one: brace/paren balance and an isolated `tsc --noEmit` pass on
every touched file (clean), and confirmed every RPC name called from
`ManagedCampaignsSection.tsx` matches its SQL definition exactly. Needs a
real `npm run build && npm test` and a live Postgres run before merging
— Phase 5's own report is the reminder of why that check matters: it
caught nothing broken that time, but it was a real check, not an
assumption.

## Not done / still open

- **Admin can't create a request on behalf of a client** — the other
  open item from `PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md`, untouched by this
  phase. Still the bigger of the two.
- **No backlink from `/campaigns/:id` to its parent managed campaign.**
  This phase links Dashboard → campaign → booking → `/campaigns/:id`, but
  not the reverse — a business viewing a booking's workspace has no way
  to navigate back up to "this is part of your Q3 Push campaign" from
  there. Would need `agency_campaign_id` added to
  `ChannelRequest`/`PublisherRequest`'s type and a small addition to
  `CampaignWorkspace.tsx`'s Overview tab — straightforward, just not
  done here to keep this phase to the one clear ask.
- **No notification when a campaign's status changes** or a new booking
  gets linked — a managed client currently has to check the dashboard to
  notice anything changed. Every other status-change surface in this app
  (content approval, deliverables, disputes) has a notification; this one
  doesn't yet.
- **Never run against real Postgres**, same as always.

## Next

Whichever matters more for actually running a managed campaign without a
campaign manager doing everything by hand outside the product: admin-side
request creation (the harder, more valuable of the two remaining gaps —
requires either a new admin-side insert path on two mature RLS-sensitive
tables, or an edge function acting on the business's behalf), or the
smaller polish items above (backlink, notifications). Given how much of
the loop is closed now — clients can see what's happening, admin can
organize and report on it — request creation is probably the one actually
blocking a real end-to-end managed campaign.
