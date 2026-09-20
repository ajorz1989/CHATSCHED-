# ChatSched — Site Architecture Map

**Pass date:** September 2026
**Current state:** ~110 routes declared in `src/App.tsx`, 5 primary header links (after this pass), 63 indexable static routes in the sitemap generator.
**Problem this solves:** the site grew one page at a time, so navigation is organised by *when a page was built* rather than by *what the visitor is trying to do*. Two pages answer the same question, several good pages have no inbound link at all, and three marketing pages contradict each other about how many channels exist.

---

## 1. The five jobs a visitor has

Every page should serve exactly one of these. Anything that serves none is a candidate for deletion.

| # | Job | Primary destination | Supporting pages |
|---|---|---|---|
| 1 | **"Get me local customers"** (business, wants help) | `/build-my-campaign` | `/channels/compare`, `/tools`, `/pricing`, `/how-it-works`, `/case-studies` |
| 2 | **"Show me who I can book"** (business, self-serve) | `/browse` | `/channels`, `/categories`, `/suburbs`, `/audience-finder`, publisher profiles |
| 3 | **"Turn my audience into income"** (publisher) | `/for-publishers` | `/register?role=publisher`, `/opportunities`, `/how-payment-works`, `/fees` |
| 4 | **"Prove I can trust you"** (both, pre-payment) | `/trust` | `/how-payment-works`, `/compliance`, `/platform-rules`, `/security`, `/transparency`, `/safety`, `/fraud-prevention`, `/terms`, `/privacy` |
| 5 | **"Answer my specific question"** | `/faq` | `/help`, `/glossary`, `/platform-rules`, `/blog` |

---

## 2. KEEP — primary hubs (5)

These are the only pages the header links to. Everything else must be reachable within one click of one of them.

| Route | Why it stays | Change made this pass |
|---|---|---|
| `/` | Home = the 60-second pitch for both sides | Dead `LayersSection` removed (restated `TwoWaysSection`); hero + comparison + pricing copy rewritten; unlaunched channels no longer sold as live |
| `/browse` | The marketplace. Real inventory, real prices | Dead icon map removed; channel filter already correctly limited to live channels |
| `/build-my-campaign` | The managed-service funnel — highest-value conversion | Repaired from a broken merge (unclosed JSX + literal `\n` block); case-study banner now renders |
| `/channels` | The category map of the whole business | Copy now states the real open/coming-soon split; links to the new comparison hub |
| `/for-publishers` | The supply side. Every booking depends on it | "Five ways to get booked" above a 13-channel grid → honest, derived split |

## 3. CREATE — the one page the marketplace was missing (1)

| Route | Verdict | Why |
|---|---|---|
| `/channels/compare` | **Built this pass** (`src/pages/ChannelComparison.tsx`) | A business with R2 000 had no way to compare "podcast vs radio vs local page" on the three things that decide it: minimum spend, booking notice, and who they reach. Answers the brief's "dynamic Channel Comparison Hub" requirement and is 100% registry-driven, so it never needs editing when a channel is added. Linked from the header's More menu, the footer quick links, `/channels`, the Home channel strip and `/for-businesses`. |

**Deliberately *not* created:** a separate "Advertiser ROI Estimator" page. `/budget-calculator` already **is** an ROI estimator (customer LTV, conversion rate by goal, payback, live market averages from the DB) and is already the `roi-calculator` tool's `cta_url`. Adding a second one would be exactly the redundancy this pass is removing. **Recommendation instead:** rename it in navigation to "ROI & Budget Estimator" and link it from `/channels/compare` and `/pricing`.

## 4. MERGE — implemented this pass (2)

| Route | → | Evidence |
|---|---|---|
| `/mission` | `/about#mission` | `About.tsx` already contains a section explicitly commented *"Mission & Vision (merged from the standalone Mission page)"*, using the same `PRINCIPLES`/`BELIEFS` content. The standalone page was orphaned (only inbound link: `/roadmap`). `Mission.tsx` deleted, 301-style client redirect added. |
| `/roadmap` | `/about#roadmap` | Same story: `About.tsx` has an `id="roadmap"` section copied from `Roadmap.tsx`, including the "direction, not a promise" framing. The standalone page had **zero** inbound links and its only two CTAs pointed at `/mission` (now a redirect) and `/investors` (already a redirect). `Roadmap.tsx` deleted, redirect added. |

Both redirects use `<Navigate replace>` so existing bookmarks and any indexed URLs keep working, and both were removed from the sitemap generator (a redirect must never be listed in a sitemap).

## 5. MERGE — recommended, needs sign-off (4)

| Route | → | Why | Reversible? |
|---|---|---|---|
| `/network` (Media Network) | `/channels` | Both read the same `getChannelsByCategory()` registry. `/network` is a positioning essay over the identical list `/channels` already renders functionally. Keep the essay as a `/channels#the-network` section. | Yes — 30-line redirect |
| `/earnings-estimator` | `/for-publishers#earnings` | Zero inbound links. The publisher page already argues the earnings case; an estimator embedded there converts better than an orphan page. | Yes |
| `/reach-checker` + `/budget-calculator` + `/audience-finder` | `/tools` sub-pages | They're seeded as tools with `cta_url` pointing at themselves, so they must stay as URLs — but they should be *framed* as tools (all `/tools/:slug` pages link to them), not as three unrelated standalone pages. No redirect needed; presentation change only. | n/a |
| `/opportunities/preview` | `/opportunities` (logged-out state) | Preview exists only to show a gated page to logged-out visitors; the gate can render the preview inline. | Yes |

## 6. REMOVE — recommended, needs sign-off (3)

| Route | Why | Suggested action |
|---|---|---|
| `/glossary` | 2 references (self + sitemap). Thin content, no SEO weight yet, no funnel role. | Fold 10–15 terms into `/faq` as an accordion; drop the route. |
| `/accessibility` | Legally worth having but currently a stub; if kept, it must state a real conformance target and a contact route. | Either expand to a real accessibility statement (recommended — it's a trust page) or remove. |
| `/media-kit` as a *page* | It duplicates the `media-kit` **tool** (`/tools/media-kit` → `/media-kit`). Two URLs, one function. | Keep `/media-kit` as the tool's target but remove it from all navigation; reach it only via `/tools`. |

## 7. TRUST CLUSTER — keep, but stop promoting seven pages from the footer

`/trust`, `/compliance`, `/platform-rules`, `/security`, `/transparency`, `/safety`, `/fraud-prevention` are all real pages with real content, and three of them (`/compliance`, `/platform-rules`, `/how-payment-works`) already absorb what used to be `/trust/*` sub-pages via redirects. That's correct.

**Recommendation:** the footer now links **Trust Centre · Platform rules · Compliance Centre · How it works · FAQ · Help**, with the rest reachable *from* `/trust`. Do not re-expand this list — a footer with seven legal links reads as a company hiding behind paperwork.

## 8. Navigation contract (enforced this pass)

**Header — exactly 5 primary links + a "More" overflow:**

```
Browse Ad Space · Build a Campaign · Channels · Tools · Publishers        [More ▾]
                                                                          Compare channels
                                                                          Pricing
                                                                          How it works
                                                                          Case studies
                                                                          Audience Finder
                                                                          Categories
                                                                          Suburbs
                                                                          Trust Centre
```

**Footer — a quick-links row mirroring the same five destinations, then five task-grouped columns** (Brand · Advertise · Publish · Trust & help · Company). Header and footer now share one `QUICK_LINKS` mental model, so they cannot drift apart again.

**Rule going forward:** adding a page to the primary bar means removing one. Secondary pages go in More (desktop), the labelled drawer section (mobile), or the footer group that matches their job.

## 9. Resulting sitemap (indexable static routes)

```
/                       /channels               /trust
/browse                 /channels/compare   ←   /trust/creator-standards
/browse/:id             /channels/:slug         /trust/business-standards
/categories             /tools                  /trust/safety
/suburbs                /tools/:slug            /trust/fraud-prevention
/compare                /pricing                /compliance
/audience-finder        /fees                   /platform-rules
/build-my-campaign      /how-it-works           /security
/for-businesses         /how-payment-works      /transparency
/for-publishers         /case-studies           /faq · /help · /glossary
/blog · /blog/:slug     /business-success       /about · /contact
/publisher-success      /collaborate            /careers · /partners
/privacy · /terms       /accessibility          /channel-quiz
/media-kit (unlisted, reached via /tools)
```

Redirected (never in the sitemap): `/mission`, `/roadmap`, `/advertise`, `/investors`, `/work-with-us`, `/search`, `/match`, `/fees/calculator`, `/trust/verification`, `/trust/disputes`, `/trust/payments`, `/trust/platform-compliance`, `/business/opportunities`, `/publisher/opportunities`.

`scripts/generate-sitemap.mjs` was corrected this pass: `/advertise`, `/investors`, `/mission` and `/roadmap` were all being listed as indexable URLs despite being redirects, and the new `/channels/compare` was added at priority 0.7 (high-intent).
