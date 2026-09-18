# Agency Pivot — Opportunity Feed & Reverse Marketplace Delivery

Builds on everything through `PHASE11_RELATIONSHIP_HISTORY_DELIVERY.md`.
The last of the four items `PIVOT_PHASE1_AUDIT.md` queued after Agency
Core — deliberately deferred by Phase 11 rather than built as a rushed
half of that phase, given the real design work flagged at the time:
what a business's post actually contains, how matching works, what
happens when a publisher applies.

## The direction-flip, and why it doesn't need a third booking table

Everywhere else in this marketplace, a business browses publishers and
starts a request aimed at one of them. This flips that: a business posts
what it needs without picking anyone, and publishers apply. But
accepting an application doesn't create a new kind of booking — it
creates an ordinary `requests` or `channel_requests` row, the exact
insert `BusinessPublisherRelationships.tsx`'s Run Again already uses
(`schema_phase67`), pre-filled from the accepted application instead of
history. Which table depends on the *applying publisher's* `channel_slug`
— same "no need to check both" logic Run Again established. Once
created, it's a completely normal booking: compliance, deliverables,
messaging, payment, everything already built for it applies with zero
special-casing anywhere else in this schema.

The corollary: this also doesn't reuse `channel_requests`' own
accept/decline state machine. That machine (`schema_phase17`/`32`/`56`
and others) was built for "a business targeted one specific creator."
Bending it to also mean "one of several applicants to an open posting"
would mean either creating a real `channel_requests` row per applicant
(most of which get declined — exactly the kind of table-abuse this
schema has avoided everywhere else) or overloading an already-nontrivial
machine with a second meaning. A new, much smaller `opportunity_applications`
table, converted into a real booking only on acceptance, keeps both
concerns simple.

## What's built

**Schema** — `supabase/schema_phase68_opportunity_marketplace.sql`:

- `opportunities` — business_id, title, brief, an optional `channel_slug`
  (null = open to any channel), an optional budget range, coarse status
  (`open / filled / closed / cancelled`).
- `opportunity_applications` — publisher_id, message, `advertising_method`
  (nullable — see below), proposed_amount, status (`pending / accepted /
  declined / withdrawn`), unique per (opportunity, publisher).
- `advertising_method` lives on the **application**, not the opportunity.
  The business posting doesn't necessarily know or care whether a
  podcast mention and three Instagram posts are the same kind of thing;
  the publisher applying does, and `channel_requests.advertising_method`
  is `not null` — something has to supply it at accept time, and it
  should be the side that actually knows what they're proposing to do.
- **Accepting one application closes out the rest, server-side.** A
  trigger on `opportunity_applications` (`status -> 'accepted'`)
  auto-declines every other pending application on the same opportunity
  and marks the opportunity `filled` — same "trigger is the real
  consequence of a status change, not something the client has to
  remember to also do in two more round trips" reasoning as every state
  machine in this schema.
- **Column-level lockdown**, same `enforce_*_self_update` shape used
  throughout (`notifications`, publisher self-updates, others): the RLS
  policies are permissive about which *rows* an update can touch, and
  `enforce_opportunity_application_update()` is the real gate on which
  *columns* actually change depending on who's doing the updating — a
  business accepting an application can't quietly rewrite what a
  publisher actually offered; a publisher can't grant themselves
  acceptance.
- **Three notification triggers**, same `create_notification()` helper
  every trigger since `schema_phase23` uses: new opportunity → every
  approved publisher matching the target channel (or every approved
  publisher, if left open), new application → the business, and
  accepted/declined → the publisher.

**Business side** — `/business/opportunities`
(`BusinessOpportunities.tsx`): post an opportunity, see your own with
applications expandable underneath, accept or decline each. Linked from
the business dashboard, next to the existing relationships link.

**Publisher side** — `/publisher/opportunities` (`OpportunityFeed.tsx`):
browse open opportunities (defaults to your own channel type plus
channel-agnostic ones, with a toggle to see everything), apply with a
message, what you'd actually do, and your price, track your own
applications' status, withdraw a pending one. Linked from the publisher
dashboard, next to the existing relationships link.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — unchanged; no new pure-logic surface here worth isolating into a test, same reasoning `AdminLeads`/`AdminClients`/relationship history gave before this |

## Not done / still open

- **Never run against real Postgres** — two new triggers plus the
  column-lockdown one, on top of the standing limitation since Phase 1.
- **No admin visibility into opportunities/applications.** Every other
  major surface in this codebase eventually got an admin tab
  (`AdminCampaigns`, `AdminMessageSafety`, `AdminAuditLog`) — this one
  doesn't have one yet. Deliberately deferred rather than guessed at,
  same reasoning Phase 6 gave for holding off the client-facing campaign
  view until its own pass.
- **A business can only accept one applicant per opportunity.** If a
  business genuinely wants, say, an influencer *and* a podcast for the
  same underlying need, that's two separate opportunities today, not one
  opportunity with two winners. Kept the mental model simple rather than
  building multi-accept for a case I don't know is real.
- **No opportunity editing beyond closing it.** A business can cancel an
  open opportunity but can't edit the title/brief/budget after posting —
  RLS technically allows it (the update policy isn't column-restricted
  the way applications are), but there's no UI for it yet.
- **Notification volume isn't batched.** A new opportunity notifies
  every matching approved publisher individually — fine at pilot volume,
  flagged in the migration's own comment as something that would need
  batching or a digest at real scale, not something to solve
  speculatively here.
- **Run Again's own limitation carries over unchanged**: whichever
  booking gets created on accept is a fresh one, not a copy of
  deliverables/tracking/compliance structure from anywhere — same scope
  line Phase 11 already drew for Run Again itself.

## Next

Two candidates, roughly equal weight: admin visibility into this (the
one major surface without one), or the bulk-creation gap on
`CreateRequestForClient.tsx` that's now been open since Phase 8 without
anyone picking it up. Worth saying which actually matters more for real
usage rather than me guessing.
