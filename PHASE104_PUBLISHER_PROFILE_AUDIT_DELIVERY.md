# Phase 104 — Publisher Profile Audit + Implementation

Source: a design/content audit of the publisher profile system (public
profile page, browse card, dashboard listing editor), followed by
implementing the fixes rather than just listing them.

## Run this first
`supabase/schema_phase104_publisher_profile_image.sql` in the Supabase SQL
editor, after phase103. It adds the `profile-images` storage bucket, the
`profile_image_url` column, extends `publishers_public`, and — this part
matters, don't skip it — extends `enforce_publisher_self_update()` to
whitelist the new column. Without that last piece the upload UI works but
every save silently reverts the photo, because that trigger resets any
column not explicitly whitelisted.

## What changed and why

| Finding | Fix | Files |
|---|---|---|
| No image field existed anywhere — every publisher rendered initials-on-a-gradient, everywhere, always | New `profile_image_url` column + `profile-images` bucket; shared `PublisherAvatar` component (photo or initials fallback) used everywhere an avatar renders | `schema_phase104_*.sql`, `types.ts`, `PublisherAvatar.tsx` (+ test), `PublisherCard.tsx`, `PublisherProfile.tsx`, `PublisherDashboardView.tsx` |
| Bio field had no minimum, no example, no guidance | `MIN_BIO_LENGTH` (40) enforced at save, live counter, example placeholder, one line of guidance | `constants.ts`, `PublisherDashboardView.tsx` (`ProfileEditPanel`) |
| Public profile header literally read "About this page" | → "About {name}" | `PublisherProfile.tsx` |
| 4 trust badges (stars, publisher score, response time, last active) hand-rolled twice, competing for attention | One shared `PublisherTrustStrip`, trust score as the dominant element | `PublisherTrustStrip.tsx`, `PublisherProfile.tsx`, `PublisherDashboardView.tsx` |
| Dashboard's own code comment: "a returning publisher shouldn't have to pass six setup panels" | `CollapsiblePanel` wrapper — each section auto-collapses to a one-line summary once complete, using the same checklist logic that already existed | `CollapsiblePanel.tsx`, `PublisherDashboardView.tsx` |
| Empty portfolio rendered nothing — silent to the owner too | Owner-only nudge with a link back to the dashboard; public view unchanged (staying silent to a visiting business is still correct there) | `PortfolioGallery.tsx` |
| Business name / company reg / VAT sat at the same visual weight as bio/audience | Grouped into their own de-emphasized "optional, for invoicing" sub-section | `PublisherDashboardView.tsx` (`ProfileEditPanel`) |
| Sidebar's only CTA was a full 5-field campaign brief, no lighter first step | Added a one-line no-commitment reassurance instead of a new contact tier — a lighter "message first" path was deliberately removed in `schema_phase85_retire_direct_messaging.sql` as a business-model integrity fix, so this doesn't fight that decision | `PublisherProfile.tsx` |

## Verified, not just written
- `npx tsc -b` — every new/changed file typechecks clean. 4 pre-existing errors remain in files this pass never touched (`AdminVisualIdentity.tsx`, `Browse.tsx`, `Faq.tsx`, `Pricing.tsx` — the last one is missing imports and looks like a real separate bug worth a look).
- `npx oxlint` on every touched file — 0 warnings, 0 errors.
- `npx vitest run` — 179/180 passing. The 1 failure (`af/home.json` missing a translation key) is pre-existing and unrelated to this work.
- Fixed two pre-existing bugs this work surfaced while typechecking: `TrustBadge.tsx` was importing `PublisherLevel` from a module that never re-exported it (blocked the whole build), and `test/fixtures.ts` needed the new field added to its fixture.

## Not done — deliberately out of scope for a patch pass
- Case studies / past-campaign proof beyond star reviews — needs a real data model addition (new table, admin/upload flow), not a fix on top of what exists.
- The 4 pre-existing type errors and the 1 pre-existing currency-formatting violation (`Home.tsx`) noted above — flagged, not fixed, since they're unrelated to publisher profiles.
