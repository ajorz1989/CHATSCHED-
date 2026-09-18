# Growth/Marketing audit — cross-checked against this codebase, 2 fixes applied

An uploaded `GROWTH_MARKETING_AUDIT.md` turned out to have been run against a
**different, earlier fork** of `chatsched-final-form` than this one — verified
directly, not assumed:

- Its "fixed this session" Header/Footer changes (7→5 nav links, per-channel
  "(Coming soon)" footer tags) don't match this codebase's actual `Header.tsx`
  (6 links, including `Tools` — a feature this audit's snapshot predates) or
  `Footer.tsx` (a completely different 5-column layout with no per-channel
  links at all, so the overclaiming bug it describes doesn't exist here).
- Its Home.tsx "hardcoded trust metrics" finding doesn't apply — no
  `MetricCounter` component or metrics strip exists anywhere in this
  codebase's `Home.tsx`.
- It says "12 channels" — this codebase actually has 13 (`in-venue-screens`
  isn't mentioned anywhere in the audit).

So the audit's diffs weren't applied as-is. Two of its findings **did**
verify as real against this actual code, and were fixed:

## 1. `src/pages/ChannelHub.tsx` — flat H1

Was `"Advertising channels."` — the one core page without a benefit-led
headline (every other one — Home, ForBusinesses, ForPublishers, Browse —
follows the "...your customers already ___" pattern). Changed to:

> "Every board your customers already look at."

Subtitle left unchanged (already accurate).

## 2. `src/pages/ForPublishers.tsx` — two live features, zero marketing

Confirmed via direct route/component check: **Open Opportunities**
(`/opportunities`, `/opportunities/preview` — a real reverse-marketplace,
businesses post briefs, publishers pitch) and the **Media Kit PDF
generator** (`/media-kit`, live component using `buildAndDownloadMediaKit`)
are both shipped and routed, but `ForPublishers.tsx`'s `FEATURES` array only
had 4 entries (Trust score, Response-time badge, Portfolio, Reviews) and
neither feature was mentioned anywhere else on the page.

Fixed:
- Added two entries to `FEATURES`: "Open Opportunities" and "Auto-generated
  media kit" — same title/body shape as the existing four, rendered in the
  same dashboard-features grid, no new markup needed.
- Added a short new section ("Two ways to get booked") between the
  dashboard-features grid and the FAQ, explaining Opportunities specifically
  — it's a genuinely different mental model (pitch for an open brief vs.
  wait for a direct request) that one FEATURES-card line doesn't convey on
  its own. Links to the existing public `/opportunities/preview` route.
  Media Kit didn't get its own section — a one-line feature card is enough
  for a tool that's simple to understand once named.

Held back, per the prior conversation: the About/Mission/Investors
consolidation (needs your call on Investors' intent before touching
anything), and the Home.tsx metrics-sourcing question (doesn't apply to
this codebase at all).

Not run against a real dev server (no `node_modules`/network in this
sandbox) — checked by direct reading and bracket/structure verification.
