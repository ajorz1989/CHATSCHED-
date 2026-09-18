# Agency Pivot — Admin Opportunity Visibility (Multi-Accept Catch-Up)

Builds on `PHASE14_OPPORTUNITY_MULTI_ACCEPT_DELIVERY.md`, which flagged
this specifically: `AdminOpportunities.tsx` wasn't re-checked for
whether it should surface `publishers_needed`/accepted-count once
multi-accept existed.

## No schema change

Nothing here needed a migration — `AdminOpportunities.tsx` already loads
every application for every opportunity upfront (unlike the business-side
page, which loads lazily per-expand), so the accepted count was always
available in memory; it just wasn't being shown. Pure UI addition.

## What changed

One line in the collapsed summary row, next to the existing application
count: `{accepted} of {publishers_needed} accepted`, shown only when
`publishers_needed > 1` — same gating condition the business and
publisher-facing pages already use, so a single-slot opportunity's
summary looks exactly like it did before multi-accept existed.

Unlike `BusinessOpportunities.tsx`, there's no "loaded vs. not loaded"
distinction to worry about here — this page fetches all applications for
all opportunities in one `load()` on mount, not per-expand — so the count
is always accurate the moment the list renders, no gating needed beyond
the `publishers_needed > 1` check itself.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 123/123 — unchanged, one JSX line, nothing to test |

## Not done / still open

- **Bulk creation on `CreateRequestForClient.tsx`** — the one item that's
  now been open the longest, since Phase 8, across five deliveries
  without anyone picking it up.
- Everything else named in Phase 14's own "Not done" (partial-fill
  notification to applicants, real-Postgres verification of the
  threshold trigger) is unchanged by this note — pure UI catch-up, not a
  reason to revisit those.

## Next

Bulk creation seems like the obvious next pick given how long it's sat —
worth confirming that's actually still the priority before starting it.
