# Agency Pivot — Admin Request Creation Delivery

Builds on everything through `PHASE7_CAMPAIGN_AUTO_ADVANCE_DELIVERY.md`
and `PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md`. You asked two
things: check whether either of those already closed "admin can't create
a request on behalf of a client," and if not, build it.

## They didn't — confirmed two ways, not just by reading their reports

Both reports say so themselves (client-view: "still open... the bigger
of the two"; auto-advance: repeats the same line in its own "Next"). I
also independently grepped the actual delivered code for any admin
insert path — nothing. Then verified the two deliveries themselves,
since both explicitly flagged their own build/lint/test as never run (no
network access in that sandbox, same standing note since Phase 4):

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — same count as Phase 6, so the client-view RPCs, the two auto-advance triggers, and the new audit log viewer all merged in clean |

## A migration-number collision, caught before it mattered

This codebase's real `schema_phase61` turned out to be
`schema_phase61_managed_campaign_client_view.sql` — built elsewhere while
I had my own not-yet-delivered `schema_phase61_admin_request_creation.sql`
in progress against an older copy of the zip. Never delivered, so never
actually collided, but it would have the moment both landed in the same
database. This is the exact risk flagged back in the messaging-safety
delivery ("three threads running against this codebase") — now a second
occurrence, not just a warning. Renumbered mine to 64 (after
`schema_phase63_campaign_reporting_auto_advance.sql`, the actual latest)
before writing any of it.

**Practically:** whichever tool keeps building this needs to start from
this zip specifically — not an older one sitting in a different
session's context — or the next collision might not be a same-named file
with different content, which is at least obviously wrong, but two
different phase numbers both claiming to be correct in ways that don't
show up until they're both applied to one database.

## What's built

**Schema** — `supabase/schema_phase64_admin_request_creation.sql`: two
additive `insert` policies, `requests_insert_admin` and
`channel_requests_insert_admin`, both gated on `public.is_admin()`
alone (the channel_requests one also keeps the existing
`status = 'pending'` constraint). Confirmed by reading both tables' real
policies first — both were strictly `auth.uid() = business_id`, no admin
path at all — rather than assuming. Additive: Postgres OR's multiple
permissive policies for the same command, so a business creating their
own request is completely unaffected; this sits alongside
`requests_insert_own` / `channel_requests_insert_business`, doesn't
touch either. Mirrors `requests_update_admin`, which already does this
same shape for updates.

**UI** — `src/components/CreateRequestForClient.tsx`, wired into
`AdminCampaigns.tsx`'s expanded campaign view as a "+ Create request"
toggle next to the existing linked-requests list. Modeled closely on
`ChannelRequestForm.tsx` (the business's own version of this form) for
the same two-shape logic:

- Publisher search (debounced, `ilike` on name, reviewed publishers
  only) rather than requiring an ID — the business-facing flow always
  starts from a publisher's own profile page, so this is the one place
  that pattern didn't already exist to reuse.
- `channel_slug === 'social-media'` → inserts into `requests`
  (`publisher_id`, `campaign_message`, optional `budget`) — no proposed
  amount, matching the original flow where the agreed price gets set
  later, admin-side, once the publisher confirms.
- Any of the 4 newer channels → inserts into `channel_requests`
  (`creator_id`, `advertising_method` restricted to what that publisher
  actually accepts, `campaign_message`, `proposed_amount`), same
  commission preview `ChannelRequestForm.tsx` shows.
- Both branches set `agency_campaign_id` to the campaign being viewed —
  created and linked in the same action, no separate "now go link it"
  step.
- The creator still approves/declines/counters exactly as if the
  business had submitted it themselves. Nothing about either table's
  state machine changed — admin's new power is narrowly "who can
  originate the row," matching what the new policies actually grant and
  nothing more.

The `AdminCampaigns.tsx` empty-state text already said "or you request
on their behalf" since Phase 6 — written ahead of the feature existing.
It's accurate now; left it as-is as confirmation of the design rather
than raising a flag.

## Toolchain (this phase's own changes)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — unchanged; no pure-logic surface here worth a dedicated test, same reasoning `AdminLeads`/`AdminClients` gave in Phase 5 |

## Not done / still open

- **Never run against real Postgres** — the two new insert policies
  included, same standing limitation as everything since Phase 1.
- **No bulk creation.** One publisher, one request, per submission —
  fine for assembling a campaign a few bookings at a time, not for
  papering a 20-publisher local-awareness package in one sitting.
- **The two smaller items `PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md`
  named** (no backlink from a booking's workspace to its parent managed
  campaign, no notification when a campaign's status changes or a
  booking gets linked) are still open — untouched by this phase, not
  forgotten.

## Next

Both of Phase 6's original open items are closed now — clients can see
their campaigns, admin can originate and organize them. What's left is
smaller polish (the backlink and notifications above) plus whatever
Phase 1's audit still has queued after Agency Core: opportunity feed,
reverse marketplace, Run Again, and the homepage/brand repositioning,
which was always sequenced last since there's finally enough of the
agency layer built to make that copy true.
