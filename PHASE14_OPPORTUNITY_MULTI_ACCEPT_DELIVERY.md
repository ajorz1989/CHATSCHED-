# Agency Pivot — Opportunity Multi-Accept Delivery

Builds on `PHASE12_OPPORTUNITY_MARKETPLACE_DELIVERY.md` and
`PHASE13_ADMIN_OPPORTUNITY_VISIBILITY_DELIVERY.md`. Both flagged their
own build/lint/test as never run (no network access in that sandbox —
same standing note since Phase 4). Verified, and found a real bug in the
process:

| Command | Result |
|---|---|
| `npm run build` | ❌ then ✅ — see below |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** |

## The bug: `AdminOpportunities.tsx(117)`

`<SkeletonRows rows={5} />` — that component takes a `count` prop, not
`rows`, confirmed by every other call site in this codebase (`AdminLeads`,
`AdminClients`, `AdminCampaigns`, all use `count`). Phase 13's own
verification was "brace/paren balance and an isolated `tsc --noEmit`
pass" on the files it touched in isolation — a real build catches a
prop-name mismatch against another file's actual exported type; an
isolated per-file check doesn't cross that boundary. One-line fix,
confirmed clean on rebuild. Nothing else in either phase needed
touching.

## What's built: multi-accept

`PHASE12_OPPORTUNITY_MARKETPLACE_DELIVERY.md` named this directly: "a
business can only accept one applicant per opportunity" — accepting any
one auto-declined every other pending application and marked the
opportunity `filled`, unconditionally. The brief's own example was
"Need: 5 publishers."

**Schema** — `supabase/schema_phase69_opportunity_multi_accept.sql`:
- `opportunities.publishers_needed`, `integer not null default 1` — the
  default preserves every existing opportunity's current behavior
  exactly (1 needed = old single-accept behavior).
- `close_out_accepted_opportunity()` replaced in place (`create or
  replace`, same trigger, same firing condition — only the body
  changed): now counts how many applications are currently `accepted`
  for that opportunity (a live count, not a stored one — same
  "compute, don't duplicate" reasoning every totals function in this
  schema already uses) and only declines the rest / marks `filled` once
  that count reaches `publishers_needed`. Below the count, the just-accepted
  application stays accepted, every other pending one stays pending and
  visible, the opportunity stays `open`.
- No new status. `open` already meant "still taking applications;" it
  keeps meaning that until enough slots are filled, rather than
  introducing a `partially_filled` state for what's really the same
  thing from the business's side — they're still reviewing, some
  applicants are just further along than others.

**UI** — both existing pages, not new ones:
- `BusinessOpportunities.tsx`: a "Publishers needed" field on the post
  form (defaults to 1), and — once a business has actually expanded a
  given opportunity's applications (loaded, not just fetched the
  opportunity list itself) — "X accepted so far" next to the needed
  count. Gated on having loaded applications specifically, not just on
  the count being non-zero, since an unloaded opportunity's application
  array and a loaded-but-empty one both start as `[]`/`undefined` —
  showing "0 accepted" for one that just hasn't been expanded yet would
  be a wrong number, not an honest one.
- `OpportunityFeed.tsx`: publishers now see "Looking for N publishers"
  on a listing, so applying isn't a guess about their odds against
  everyone else who's interested.
- `decide()` — the accept/decline handler that creates the actual
  `requests`/`channel_requests` row — didn't need to change. It already
  ran independently per application; the only thing stopping a second
  accept was the trigger auto-declining everything else the moment the
  first one landed. Fix the trigger, the existing per-application logic
  already does the right thing for each one.

## Toolchain (this phase's own changes)

Re-ran after the fix above — build, lint, test all clean, 123/123
unchanged. No new pure-logic surface here worth a dedicated test — this
is a trigger threshold change plus display logic, same reasoning
`AdminLeads`/`AdminClients`/relationship history gave for skipping tests
in similarly CRUD-shaped phases.

## Not done / still open

- **Never run against real Postgres** — the threshold-counting trigger
  included, same standing limitation as everything since Phase 1. This
  one's worth a specific real-DB check before relying on it: the count
  query runs inside an `after update` trigger, and while Postgres
  guarantees the just-updated row is visible to a same-transaction
  `select` at that point, that's exactly the kind of thing worth
  confirming against a live database rather than trusting reasoning
  alone.
- **No partial-fill notification.** A publisher who applies to a
  5-needed opportunity that already has 3 accepted isn't told that up
  front — they'd see "Looking for 5 publishers" without knowing 3 slots
  are already taken. Minor, but a real gap in the number's usefulness.
- **Admin opportunity visibility** (Phase 13) and this phase's own fix
  weren't cross-checked against each other beyond the shared toolchain
  run — `AdminOpportunities.tsx` wasn't specifically re-read for whether
  it should also surface `publishers_needed`/accepted-count now that
  multi-accept exists. Worth a look next time that page's open.
- **Bulk creation on `CreateRequestForClient.tsx`** — still open since
  Phase 8, still nobody's picked it up.

## Next

Whichever's actually blocking real usage: the admin opportunity view
picking up the new slot count, or that bulk-creation gap that's now
been open across five deliveries without anyone building it.
