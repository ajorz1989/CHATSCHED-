# ChatSched — Integrated Code Changes

Everything listed here is **already applied to the working tree** of `arena/01a0bf93-chatsched`, typechecks (`npx tsc -b`), lints (`npx oxlint`: 0 errors), builds (`npm run build`) and passes the full test suite (**195/195** — it was 194/195 before, with one pre-existing failure).

The three other documents in this folder are the analysis; this one is the diff-level record of what changed, why, and how to extend it.

---

## 0. Blockers repaired first (the repo did not compile at `d8809fa`)

| File | Fault | Fix |
|---|---|---|
| `src/components/Footer.tsx` | **Git merge-conflict markers committed to the file** (lines 59–65: `<<<<<<< HEAD`, `=======`, `>>>>>>> origin/about-page-merge`) | Resolved — kept the `Trust &amp; Help` heading and the merged-in `About ChatSched` link |
| `src/pages/BuildMyCampaign.tsx` | Unclosed `<div>` at 712 → `TS17008`; a pasted block at 734 containing **literal `\n` sequences** plus a duplicated sticky-nav wrapper | Collapsed into one clean block: `px-5 pt-8` wrapper → case-study banner (link to `/case-studies`) → the single sticky step-nav `div` |
| `src/pages/HowItWorks.tsx` | 5 string literals with doubled closing quotes (`: ""Quote."",`) → `TS1005` cascade | Regex-repaired (`: ""X"",` → `: "X",`) |
| `src/lib/types.ts` | `Category.icon` union missing the 4 new icon names declarations in `constants.ts` and implemented in `CategoryIcon.tsx` (`sports`, `transport`, `township`, `business`) → 4 × `TS2322` | Union widened |
| `src/components/AdminNavigation.tsx` / `src/pages/Admin.tsx` | Circular type import: `Admin.tsx` imported `AdminTab` from `AdminNavigation`, which imported it from `Admin`, where it was declared → `TS2614` | `AdminTab` now **declared and exported in `AdminNavigation.tsx`** (with a comment explaining the cycle); `Admin.tsx` re-exports it so existing importers keep working |
| `src/pages/CaseStudies.tsx` | `channelSlugs: string[]` passed to a `ChannelSlug` prop → `TS2322` | Typed `ChannelSlug[]` + type import |
| `src/pages/Browse.tsx` | Dead `BROWSE_CHANNEL_ICONS` map, an unused `Icon` binding and an orphaned `ComponentType` import | All three removed |
| `src/pages/AdminAJCreations.tsx` | Unused `publisherId` callback parameter → `TS6133` | Renamed `_publisherId` |
| `src/pages/PlatformRules.tsx` | `Seo` imported but never rendered → `TS6133` (and a page with no title) | `Seo` now renders a real title + description |

---

## 1. New component — `src/pages/ChannelComparison.tsx` (`/channels/compare`)

The Channel Comparison Hub the brief asked for. **Registry-driven**: it calls `getAllChannels()` + `isChannelEnabled()`, so adding a 14th channel module makes a new row appear here with zero edits to this file.

```tsx
const rows = useMemo(() => {
  const all = getAllChannels().map((module) => ({
    module,
    name: module.definition.name,
    status: isChannelEnabled(module.definition.slug) ? "live" : "opening",
    entry: entryPrice(module),                       // cheapest pricingModel.minPrice
    price: entryPriceLabel(module),                  // "R250 per post"
    lead: leadTimeLabel(module),                     // "3 days' notice" from availability
    bestFor: module.definition.audience.typicalAudience,
    signals: module.definition.audience.signals.slice(0, 4).map(toHumanLabel),
    metrics: module.definition.analyticsMetrics.slice(0, 4).map((m) => m.label),
    useCase: module.definition.exampleUseCases[0] ?? "",
    dueDiligence: module.definition.publisherRequirements.slice(0, 3),
  }));
  const filtered = liveOnly ? all.filter((r) => r.status === "live") : all;
  return filtered.sort(/* minBudget | leadTime | name */);
}, [sort, liveOnly]);
```

Features: sortable (cheapest / fastest / A–Z), "only show channels I can book today" filter, per-row expandable detail, status badge per row, CTAs that route to `/channels/:slug` for live channels and to the publisher application for channels still being onboarded.

Route added in `src/App.tsx` immediately after `/channels`, plus a lazy import. Added to `scripts/generate-sitemap.mjs` at priority `0.7` and to the static `public/sitemap.xml` fallback.

## 2. `src/components/Header.tsx` — 5-link nav + More menu

```tsx
const NAV_LINKS = [
  { to: "/browse",            key: "nav.browse" },        // "Browse Ad Space"
  { to: "/build-my-campaign", key: "nav.agency" },        // "Build a Campaign"
  { to: "/channels",          key: "nav.channels" },
  { to: "/tools",             key: "nav.tools" },
  { to: "/for-publishers",    key: "nav.forPublishers" }, // "Publishers"
] as const;

const MORE_LINKS = [
  { to: "/channels/compare", key: "nav.compareChannels" },
  { to: "/pricing",          key: "nav.pricing" },
  { to: "/how-it-works",     key: "nav.howItWorks" },
  { to: "/case-studies",     key: "nav.caseStudies" },
  { to: "/audience-finder",  key: "nav.audienceFinder" },
  { to: "/categories",       key: "nav.categories" },
  { to: "/suburbs",          key: "nav.suburbs" },
  { to: "/trust",            key: "footer.trustCentre" },
] as const;
```

`MoreMenu` handles click-outside (`mousedown`), `Escape`, and auto-close on route change; sets `aria-expanded` / `aria-haspopup`; marks itself active when any child route is open. The mobile drawer renders the same 5 links, then a labelled "More" group — one hierarchy on both form factors.

## 3. `src/components/Footer.tsx`

- Merge conflict resolved (see §0).
- Quick-links row mirroring the header's five destinations.
- Columns regrouped into **Advertise · Publish · Trust & help · Company**, each linking to pages that serve that job.
- `/suburbs` and `/categories` retained (they were about to be orphaned by the footer rewrite).
- Newsletter copy rewritten.

## 4. `src/components/LiveChannelTabs.tsx`

Before: `LIVE_CHANNEL_TABS` hard-coded 4 slugs (influencer, website, podcast, radio) — no `social-media`.

After: tabs generated from `getAllChannels().filter(isChannelEnabled)`, hero copy keyed by slug in a `Partial<Record<ChannelSlug, string>>` (unknown channels fall back to their registry tagline), plus a registry-driven **"Opening soon"** chip row. `social-media` links straight to `/browse`; every tab has a secondary "Compare channels →" link.

## 5. `src/pages/ForPublishers.tsx`, `ForBusinesses.tsx`, `ChannelHub.tsx`

All three split their channel grids by the same feature flag the Browse filter uses:

```tsx
const allChannels = getAllChannels();
const liveChannels  = allChannels.filter((m) => isChannelEnabled(m.definition.slug));
const openingSoon   = allChannels.filter((m) => !isChannelEnabled(m.definition.slug));
```

Badges that were hardcoded and had drifted ("Five ways to get booked" above 13 cards; "Five channels, one flow") are now derived from those arrays, and every card carries an explicit **Open now / Coming soon** marker. `ChannelHub`'s heading does the same via `openCount`.

## 6. `src/pages/Home.tsx`

- `LayersSection` deleted (duplicated `TwoWaysSection`).
- Pricing figures bound to `BUSINESS_SUBSCRIPTION_PRICE` / `PUBLISHER_SUBSCRIPTION_PRICE` through `formatCurrency` — no more hardcoded `R399`/`R199` in JSX.

## 7. `src/App.tsx` + sitemaps

- `/mission` → `<Navigate to="/about#mission" replace />`, `/roadmap` → `<Navigate to="/about#roadmap" replace />`; `Mission.tsx` and `Roadmap.tsx` deleted.
- `/channels/compare` route added.
- `scripts/generate-sitemap.mjs`: removed `/advertise`, `/investors`, `/mission`, `/roadmap` (all redirects — a sitemap must only list canonical 200-status URLs), added `/channels/compare`. Non-redirect `/collaborate` added in its place.
- `public/sitemap.xml` fallback updated to match.

## 8. i18n (`src/i18n/locales/*`)

- `home.json` (en): rewritten hero, two-ways, comparison, marketplace, local, how, trust, tools, pricing, publisher, final copy — all four locales re-verified for key parity.
- Ten dead key groups deleted from `home.json` in **all four** locales.
- `comparison.platforms` empty string filled in all four locales (`What you're comparing` / `Wat jy vergelyk` / `Okuthelekiswayo` / `Okugathaniswayo`) — this was the single failing test.
- `forBusinesses.json`: `channels.badge` ("Five channels, one flow") removed from all four locales — the page now derives that number; tools list corrected to the 8 `active` rows in `public.tools`.
- `common.json`: `nav.more`, `nav.compareChannels`, `nav.caseStudies` added to all four locales; English nav labels tightened.

---

## 9. How to extend this without re-introducing drift

1. **Adding a channel** — create `src/channels/<slug>/index.ts`, add the slug to `ChannelSlug`, add its env key to `featureFlags.ts`, register it in `channelRegistry.ts`, add the row to `public.channels`. It then appears automatically (correctly badged) in the Hub, Home/Categories strip, ForBusinesses, ForPublishers, SiteSearch, the comparison hub, the sitemap and the publisher application picker. **Do not** hardcode channel names or counts in copy — that is exactly the bug class fixed in this pass.
2. **Adding a tool** — insert into `public.tools` (`/admin/tools` exists for this). It appears on `/tools` from the database. If it has a public page, set `cta_url`; if it's dashboard-only, set `requires_auth`.
3. **Adding a page to the header** — you must remove one. Secondary pages belong in `MORE_LINKS` (and will render in the mobile drawer automatically).
4. **Currency** — never write `R…` in JSX. Use the constant plus `formatCurrency`; `scripts/check-currency-formatting.mjs` enforces this in `npm run lint`.
5. **Translations** — any key added to an `en/*.json` namespace must be added to `af`, `xh`, `zu` (the parity test fails otherwise, by design). Never leave a value empty.

## 10. Verification performed

```
npm install                     → 549 packages, exit 0
npx tsc -b                      → clean, no output
npx oxlint                      → 0 errors, 2 warnings (pre-existing unicorn(no-thenable) in a test file)
npx vitest run                  → 28 files, 195/195 tests passing
npm run build                   → built in 2.4s; dist/sitemap.xml: 61 static routes, 25 articles
```

Not verified (no credentials in this environment, unchanged from the repo's existing caveat): anything requiring a live Supabase instance — the channel pages' database-backed sections, the tools catalogue fetch, payment flows — and no browser-based visual pass was run. Run `npm run dev` with a populated `.env` before shipping.
