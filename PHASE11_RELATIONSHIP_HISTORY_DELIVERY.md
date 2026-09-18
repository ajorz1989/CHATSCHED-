# Agency Pivot — Relationship History & Run Again Delivery

Builds on everything through `PHASE10_MANAGED_CAMPAIGN_POLISH_DELIVERY.md`.
Verified that one first (see below), then built two of the four items
`PIVOT_PHASE1_AUDIT.md` queued after Agency Core: relationship history
(brief sections 29/30) and Run Again (section 28). Opportunity feed and
reverse marketplace are not in this delivery — see "Why only two of
four" below.

## Verifying Phase 9 and 10

Both explicitly flagged their own build/lint/test as never run (no
network access in that sandbox — same standing note since Phase 4).
Confirmed clean:

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** — same count as Phase 8, so campaign packages, the backlink, and the two notification triggers all merged in clean |

Schema numbering checked before writing anything: latest was
`schema_phase66_managed_campaign_notifications.sql`. No collision this
time — both `PHASE9`'s and `PHASE10`'s reports describe actively
re-checking the real zip before numbering their own migration, which is
exactly the discipline the last few reports have been arguing for. New
work here is `schema_phase67_relationship_history.sql`.

## Why only two of four

Opportunity feed and reverse marketplace are a matched pair — an
"opportunity" a publisher sees is naturally a business's open request
for publishers, so building the feed without the thing it feeds from
would mean inventing a second, disconnected concept of "opportunity."
That pairing is real design work (what does a business's post actually
contain, how does matching/scoring work, what happens when a publisher
applies) that deserves its own pass rather than a rushed half of this
one. Relationship history and Run Again, by contrast, are almost
entirely queries and forms over data that already exists — a coherent,
independently useful slice on their own, same reasoning every phase
since Phase 2 has used for scoping.

## What's built

**Schema** — `supabase/schema_phase67_relationship_history.sql`:
`my_publisher_relationships()` and `my_business_relationships()`, both
self-scoped to `auth.uid()` — an ordinary business or publisher reading
their own history, not admin-gated. Mirrors `get_my_managed_campaigns()`
(`schema_phase61`) rather than the admin-only totals functions from
Phase 5/6, which raise for anyone who isn't an admin and would just
break if called from here. "Worked with" means paid — same "latest
payment per request, union channel_requests' own paid_at" query every
totals function since Phase 5 uses, duplicated again rather than shared
for the same cross-function-boundary reason as always.

**Business side** — `/business/publishers`
(`BusinessPublisherRelationships.tsx`): every publisher paid at least
once, total spent, your own rating if you left one, and two actions —
"View profile" and "Run again." Linked from the dashboard's existing
"current campaign" card.

**Publisher side** — `/publisher/relationships`
(`PublisherRelationships.tsx`): every business paid at least once, total
earned, repeat-client flag. No "invite repeat campaign" action — the
brief suggested one, but a publisher-initiated contact prompt is exactly
the direct-contact pattern Phase 3's message safety work exists to keep
off this platform. A publisher can see who's a repeat client; reaching
out about more work stays the business's or ChatSched's move. Linked
from the earnings card on the publisher dashboard.

**Run Again**, inline on each business-side relationship card: fetches
that publisher's most recent `completed` request (`requests` if
`channel_slug` is `'social-media'`, `channel_requests` otherwise — the
publisher's own channel tells you which table, no need to check both),
pre-fills message/amount/method, everything still editable, submits
through the exact same insert a business creating a request for the
first time would use. No new RLS — a business has always been able to
insert its own request; this just pre-fills the form instead of leaving
it blank.

## Toolchain (this phase's own changes)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 123/123 — unchanged; no new pure-logic surface here worth isolating into a test, same reasoning `AdminLeads`/`AdminClients` gave in Phase 5 |

## Not done / still open

- **Never run against real Postgres** — both new functions included,
  same standing limitation as everything since Phase 1.
- **Opportunity feed and reverse marketplace** — see above, genuinely
  next, not forgotten.
- **Bulk creation on `CreateRequestForClient.tsx`** — flagged in
  `PHASE8_ADMIN_REQUEST_CREATION_DELIVERY.md`'s own "Not done," still
  one publisher per submission. Neither this phase nor `PHASE9`/`PHASE10`
  touched it — worth naming since it's been open a few deliveries now
  without anyone picking it up.
- **Run Again only looks at the single most recent completed booking**
  with that publisher — no picker if a business wants to copy an older
  one specifically.
- **No deliverables/compliance-structure copy.** The brief's fuller Run
  Again ("copy deliverables, tracking setup, compliance structure")
  isn't attempted here — this covers the core fields (who, what, how
  much), not the surrounding scaffolding a completed campaign
  accumulates.

## Next

Opportunity feed + reverse marketplace, or the bulk-creation gap if
that's actually blocking real usage first — worth saying which.
