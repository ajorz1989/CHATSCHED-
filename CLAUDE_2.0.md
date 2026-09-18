# CLAUDE 2.0 — Session Handoff Log

Same convention as `CLAUDE_1.0.md`: a running, chronological record of
what happened in this session, appended to as it continues, not
rewritten. Read `CLAUDE_1.0.md` first — this file assumes it and doesn't
repeat its content.

**This file is appended to, not rewritten, as this session continues.**

---

## 1. What this session built, before this product existed

Separate chat, separate lineage, starting from a `phase18` upload (before
either of the two independent `phase19` copy-fix efforts — this one and
the one `CLAUDE_1.0.md` item 2 merged — existed). Two things:

- **Subscription copy fix** across `Faq.tsx`, `Fees.tsx`,
  `ForBusinesses.tsx`, `ForPublishers.tsx`, `Mission.tsx`, `Pricing.tsx`,
  and `home.json` in four languages — same "unlocks extras" → "gates
  booking/approving" correction as the other independent effort.
- **Bulk request creation** in `CreateRequestForClient.tsx` — multi-pick
  publishers scoped to one channel at a time, one insert per publisher
  via `Promise.all`, partial-failure handling that re-queues only the
  failed picks.

Both delivered against a codebase that had none of `CLAUDE_1.0.md`'s
items 1–7. Full detail and exact diffs: `PHASE19_COPY_FIX_BULK_REQUESTS_DELIVERY.md`,
which shipped in that session's own zip, not this one.

---

## 2. Reconciling against this product, not assuming it needed either

This product (the one this file now lives in) turned out to already
contain independently-built, more advanced versions of both:

- Its own `phase19` copy fix (merged into `CLAUDE_1.0.md` item 2/3).
- `PHASE21_BULK_REQUEST_CREATION_DELIVERY.md` — a queue-then-submit
  rebuild of `CreateRequestForClient.tsx` with per-row method/amount
  (handles mixed-channel batches, which item 1's channel-locking
  approach didn't attempt), batched inserts instead of one-by-one, and a
  real bug fix (`required` attributes blocking the JS validation path)
  found while reconciling a later merge.

Plus real work item 1 above never touched at all: PayFast actually
calling PayFast on cancellation, launch-credit forfeiture, and — most
importantly — `CLAUDE_1.0.md` item 6's find that `schema_phase71`
silently deleted the counter-offer state machine and content-approval
gate, fixed in `schema_phase73`.

**Given that, `CreateRequestForClient.tsx` was left alone.** Overwriting
it with item 1's version would have reverted a real, tested bug fix and
a genuinely better mixed-channel design for a form that already does
more than the one this session built. Checked directly rather than
assumed — read the current file, confirmed the queue/batch-insert shape
`CLAUDE_1.0.md` describes is actually there, ran the real toolchain
before and after touching anything else in this session.

**What was genuinely missing, checked file by file rather than trusted
from either delivery doc's account:** three spots this product's own
phase19 hadn't caught, that item 1's version had —

- `Pricing.tsx`, the membership-section intro paragraph — still said "you
  can also browse or list without one, just with less on offer,"
  unchanged from before either phase19 effort.
- `ForPublishers.tsx`, the "Approve, schedule, execute" step — still
  implied accepting a request was free.
- `ForPublishers.tsx`, the "Can I decline a request?" FAQ — same issue,
  implied accepting was free.

Fixed those three, matching this product's own already-established
phrasing rather than re-pasting item 1's wording verbatim (its voice was
close but not identical — e.g. this product already says "sending a
request needs ChatSched Business" in nearby copy that item 1's session
never saw). Everything else from item 1 — including the `home.json`
translations, which this product's own phase19 already did cleanly and
independently in all four languages — was already superseded and left
untouched.

**Files touched this session:** `src/pages/Pricing.tsx`,
`src/pages/ForPublishers.tsx` (two spots), `CLAUDE_2.0.md` (new, this
file).

---

## 3. Phase A of the expansion doc — Sports, Events, Communities

Scoped to exactly what the person asked for and what Section 80 of the
original 81-section doc itself recommends starting with, not the other
seven channels.

**Schema decision, checked before writing anything:** the doc's own
Sections 2–5 suggest a new `inventory_owners` / `advertising_inventory` /
`inventory_pricing` / `inventory_availability` schema. Read the actual
tables in this product first instead of building that. `publishers` +
`publisher_rate_cards` (label/price/description per priced item, already
exists) + `channel_requests` (the booking/request lifecycle, already
subscription-gated, compliance-integrated, proof-tracked, payment-
integrated) already **are** a working "owner lists priced inventory,
business books it" system for the 5 existing channels. Building a second
one for three more channels would be exactly the duplication the doc
itself repeatedly says not to do — Section 71's own "before adding any new
table: search the existing schema" was written for this exact situation.

So Sports, Events, and Community are three new entries in the *existing*
channel-module plugin architecture (`src/channels/<slug>/index.ts`,
`CHANNEL_REGISTRY`), not a parallel system:

- `schema_phase74_universal_channels.sql` — a real `channels` reference
  table replacing the hardcoded `channel_slug` CHECK constraints on
  `publishers` and `channel_requests` (this is also what the doc's
  Section 38 asks for directly — "configurable channel definitions...
  do not hard-code channel-specific business rules" — schema_phase17's
  own column comment had already flagged the old CHECK as a coupling
  problem). Seeded with all 8 channels; the 3 new ones ship
  `active = false`. A `channel_metadata jsonb` column on `publishers`
  holds per-vertical structured fields (sport/competition/season; event
  date/venue; community type) without a new table per vertical or forcing
  incompatible fields onto the other five channels.
- `src/channels/sports/index.ts`, `src/channels/events/index.ts`,
  `src/channels/community/index.ts` — full `ChannelModule` definitions
  (pricing models, audience signals, availability, analytics metrics,
  review dimensions, owner requirements, advertising methods) built from
  the expansion doc's own Sections 8/9/10 inventory lists, in the same
  shape as the existing podcast/radio/etc. modules — nothing new invented
  for how a channel describes itself.
- `channelTypes.ts` — `ChannelSlug` and `ChannelCategory` widened.
  `featureFlags.ts` — `VITE_CHANNEL_SPORTS_ENABLED`,
  `VITE_CHANNEL_EVENTS_ENABLED`, `VITE_CHANNEL_COMMUNITY_ENABLED`, all
  default off — same "don't launch behind code, launch behind real
  supply" posture as the schema, and the doc's own Section 80.
  `channelRegistry.ts` — the 3 modules registered.

**Ships inactive, on purpose, twice over** — `channels.active = false` in
the DB and the Vite flags off. This repo's own history is that placeholder
channels with no real supply got deleted outright rather than shipped
half-built (the comment at the top of `channelTypes.ts`), and the
expansion doc's own Sections 57 and 80 say the same thing a different way.
The publisher-application form (`/publisher-apply?channel=sports` etc.)
works today regardless of the flags, so real owners can be onboarded
quietly first.

**What that gets for free, unmodified:** `ChannelHub`, `ForPublishers`,
`ForBusinesses`, the channel quiz, `PublisherApply`, the request/booking
flow, and — once each flag flips — `Browse`, the budget calculator, case
studies, and transparency reporting. That's the entire point of this
architecture (its own comment: "no other file needs to change") and it's
also why almost nothing else got built this session — building bespoke UI
for three channels with zero real listings yet would be exactly the "fake
marketplace inventory" Section 57 warns against.

**What the real compiler caught that a written plan wouldn't have:**
`AudienceSignal` doesn't include an `"expected_attendance"` or
`"audience_type"` value — fixed to the real `"event_attendance"`. Two
`Record<ChannelSlug, string>` label maps on `BusinessOpportunities.tsx`
and `OpportunityFeed.tsx` failed to compile once `ChannelSlug` grew,
correctly, since TypeScript won't let an exhaustive map go non-exhaustive
silently — filled in with labels, kept explicit that opportunities
themselves aren't extended to the new channels yet (their own
`channel_slug` CHECK is untouched, on purpose, smaller scope for this
phase). `getChannelsByCategory()`'s category order/label list is a plain
`Record<string, string>`, which the compiler can't check for
completeness — that one had to be found by reading the function, not by
the build failing, and would have silently dropped the three new channels
from `ChannelHub`'s grouped view if missed.

**Explicitly not done, so it's not assumed done:**
- `channels.verification_required` is set `true` for sports/events/
  community, but nothing in the app currently *enforces* a stronger check
  than the existing generic `publishers.status = 'reviewed'` gate every
  channel already goes through. The column documents intent (Sections
  52/53/55 of the expansion doc all ask for real owner-authority checks on
  these three specifically); actually building a stronger check than the
  current admin review is still open.
- `opportunities.channel_slug` untouched — the reverse-marketplace flow
  (business posts a brief, publisher proposes) doesn't support the three
  new channels yet.
- No seed or demo listings — deliberately, per the "don't create fake
  inventory" point above. These channels have zero real inventory until
  someone applies.
- Not run against real Postgres — same standing gap as everything else in
  both logs. The `channels` table, the dropped/re-added constraints, and
  the RLS policies are unverified against an actual database.
- The other seven channel families (gyms, restaurants, podcasts/
  newsletters as their own vertical rather than the existing podcast
  channel, property, campus, transport, associations) — not started,
  per Section 80's own staged rollout.

---

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors (after fixing the 4 issues above) |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings as item 2 |
| `npm test` | ✅ 20 test files, 153/153 — unchanged; no new pure-function logic, only data/config additions, so nothing new to add a test for |

## Open items (carried forward, nothing resolved this entry)

Same list as item 2's close, plus this entry's own "explicitly not done"
above.

---

## 4. Two more channels — Transport Media, Informal Retail

Two channels the person asked to be invented, not lifted from the
original 81-section doc — reasoning given before building, built only
after "build both" confirmed both. Same mechanism as item 3, nothing new:
one insert into the `channels` table Phase 74 created (no new table this
time), two more `ChannelModule` definitions, two more feature flags.

- **Transport** (`schema_phase75`, `src/channels/transport/`) — minibus
  taxi and rank advertising. Picked over the original doc's generic
  "Transport & Mobility" for being more specific to what's actually the
  country's largest daily-transit audience.
- **Informal Retail** (`src/channels/informal-retail/`) — spaza shops and
  township traders. Not in the original doc at all. Lowest minimum spend
  on the platform (R150) on purpose — the pitch for this one specifically
  is opening ChatSched to campaigns with no real marketing budget behind
  them, not serving the same advertiser base the other 9 channels already
  reach.

Both `verification_required = true` in the `channels` row, same as Sports/
Events/Community — Transport for the same reason as Sports (a driver
claiming authority over an association's fleet isn't authority);
Informal Retail is flagged true too but is genuinely lower-friction to
actually verify, since a single shop's owner is usually straightforward
to establish, unlike a shared community or fleet asset.

**What the real compiler caught this time:** `"per_unit"` isn't a valid
`PricingUnit` — the type only has `per_post`/`per_send`/`per_subscriber`/
`per_listener`/`per_impression`/`per_click`/`per_acquisition`/`per_slot`/
`per_event`/`per_cm2`/`per_word`/`flat_rate`/`retainer`, and "per vehicle"/
"per shop" fixed-fee-per-item is `flat_rate`, not a new unit — used that
instead of inventing one. `"hyperlocal"` isn't a valid `geographicScope`
either; the real value is `"hyper-local"` (hyphenated). Both wrong on the
first pass, both caught by `tsc`, neither would have been caught by lint
or the test suite, which is the actual argument for always running the
real build rather than trusting a review that only reads the code.

**Explicitly not done, same shape as item 3:** no stronger verification
enforcement than the generic review gate, `opportunities.channel_slug`
still untouched, no seed/demo listings, not run against real Postgres.

## Toolchain (this entry)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors (after fixing the 2 issues above) |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings |
| `npm test` | ✅ 20 test files, 153/153 — unchanged |

## Open items (carried forward)

Same as item 3's close, plus: 8 channels ship real, 2 more (10 total)
built and inactive, 0 seeded with any actual listings yet on any of the 5
new ones. The remaining 6 channel families from the original doc
(gyms, restaurants, podcasts/newsletters as their own vertical, property,
campus, associations) still untouched.

---

## 5. Associations & Business Networks

The last named request — back to the original doc this time, its own
Section 17, not another invented channel. Same mechanism as items 3 and
4: one more row in the Phase 74 `channels` table (`schema_phase76`,
category CHECK widened again), one more `ChannelModule`
(`src/channels/associations/`), one more feature flag
(`VITE_CHANNEL_ASSOCIATIONS_ENABLED`), same `verification_required = true`
posture as Sports/Events/Community/Transport — an association member
isn't automatically its authorised sponsorship contact, same reasoning as
every other verified channel here.

Inventory pulled straight from the doc's own list for this channel:
member newsletter, directory listing, annual report, webinar, conference,
website, and member-offer sponsorship — nothing invented this time, just
built.

First clean pass this time — no compiler errors on the first `npm run
build`, unlike items 3 and 4 (`AudienceSignal`/`Record` exhaustiveness/
`getChannelsByCategory`, then `PricingUnit`/`geographicScope`). Worth
naming plainly rather than letting it pass silently: not because this
entry was done more carefully, but because by now the actual valid values
for `AudienceSignal`, `PricingUnit`, and `geographicScope` were already
known from getting them wrong twice, not re-guessed. The lesson from
items 3–4 held: read the type before writing the value that has to
satisfy it, not after the build fails.

**Explicitly not done, same shape as items 3 and 4:** no stronger
verification enforcement than the generic review gate,
`opportunities.channel_slug` still untouched, no seed/demo listings, not
run against real Postgres.

## Toolchain (this entry)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors, first pass |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings |
| `npm test` | ✅ 20 test files, 153/153 — unchanged |

## Open items (carried forward)

11 channels total now: 5 live, 6 built-and-inactive (sports, events,
community, transport, informal-retail, associations), 0 seeded with any
real listings. Remaining from the original doc, still untouched: gyms,
restaurants, podcasts/newsletters as their own vertical, property, campus.

---

## 6. Restaurants & Cafés

Recommended over the other four remaining doc items (gyms, property,
campus, podcasts/newsletters-as-own-vertical) specifically for pairing
with Informal Retail rather than standing alone: same shape of business
— single owner, daily foot traffic, straightforward ownership to verify
— same natural inventory (menu, till/receipt, QR, loyalty card), same low
entry price. Together the two now cover most of the small-physical-
business advertising surface in one town or township.

Same mechanism as items 3–5: one more row in the Phase 74 `channels`
table (`schema_phase77`, category CHECK widened to add
`food-and-beverage`), one more module (`src/channels/restaurants/`), one
more feature flag (`VITE_CHANNEL_RESTAURANTS_ENABLED`). Inventory from
the original doc's own Section 12 — menu sponsor, table card, receipt/QR
sponsor, loyalty card, waiting-screen sponsor, customer newsletter.
`verification_required = true`, same lighter-friction posture as Informal
Retail rather than Sports/Events/Associations' level — a venue owner or
manager is usually straightforward to establish, not a shared or
delegated asset.

Clean build on the first pass again — the `AudienceSignal`/`PricingUnit`/
`geographicScope` values used here were already the ones confirmed
correct from items 3–4, not re-guessed.

**Explicitly not done, same shape as every entry since item 3:** no
stronger verification enforcement than the generic review gate,
`opportunities.channel_slug` still untouched, no seed/demo listings, not
run against real Postgres.

## Toolchain (this entry)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors, first pass |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings |
| `npm test` | ✅ 20 test files, 153/153 — unchanged |

## Open items (carried forward)

12 channels total: 5 live, 7 built-and-inactive (sports, events,
community, transport, informal-retail, associations, restaurants), 0
seeded with any real listings on any of the 7. Remaining from the
original doc, still untouched: gyms, podcasts/newsletters as their own
vertical, property, campus.

---

## 7. All 7 flipped to live

Explicit instruction — not a continuation of the original plan for these
7, which was to launch each once it had real verified supply
(schema_phase74's own comment, and the expansion doc's Sections 57/80).
Said so plainly before doing it, then did it, since the tradeoff is a
product decision that's the person's to make, not something to withhold
over.

`schema_phase78` flips `active = true` on all 7 rows in the `channels`
table (an `UPDATE`, not an edit to schema_phase74-77 — additive
migrations stay additive even when reversing an earlier one's own
stated intent). `featureFlags.ts`'s `DEFAULT_ON` gets all 7 added,
matching the same "env var is a kill switch, not an activation switch"
model influencer/podcast/website/radio already use. `verification_required`
on all 7 is untouched — that governs how much scrutiny an owner
application gets, a separate question from public visibility, and nothing
about that reasoning changed.

**What "live" actually means right now, plainly:** all 7 sections are
publicly visible — `ChannelHub`, `ForPublishers`, `ForBusinesses`,
`Browse`, the budget calculator — with zero real publishers or listings
behind any of them. That's not a bug in this delivery; it's the direct,
known consequence of the instruction, on the record here rather than
discovered later.

## Toolchain (this entry)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings |
| `npm test` | ✅ 20 test files, 153/153 — unchanged; checked specifically for any test asserting a fixed enabled-channel count that this would silently break — none exist |

## Open items (carried forward)

All 12 channels now publicly active; 0 have real listings. The
highest-priority open item from here on isn't another channel — it's
getting real owners into the 7 that just went live before someone finds
them empty.

---

## 8. Answering "did you create new pages" honestly, then fixing what that answer surfaced

Direct question deserved a direct, checked answer, not an assumption
either way. Real per-channel pages already existed for all 7 —
`/channels/:slug` is a generic route that's rendered every registered
channel's full detail page since Phase 74, no per-channel page-creation
code ever needed. So the honest first answer was "yes, technically, and
have been since they were built" — but checking that claim against the
actual render logic surfaced three real gaps the technical existence of
a page doesn't cover, which is what "brand them across the website" was
actually asking about:

- **`ChannelPage.tsx`'s own category-label map** was a fourth instance of
  the same hardcoded-category-list bug pattern as item 3's
  `getChannelsByCategory()` — a plain `Record<string, string>` the
  compiler can't check for completeness. Would have shown a blank
  category badge on all 7 channels' own hero section. Fixed.
- **The homepage's `LiveChannelTabs`** — the hand-curated 4-channel
  showcase on Home and Categories, each with hero copy written
  specifically for that placement — never had the other 7 added to it.
  This is the actual reason "brand them across the website" needed doing
  at all: the pages existed, but nothing on the homepage pointed at them.
  Added all 7 with fresh hero lines, same voice as the original 4, same
  component, same tab-switcher UI — nothing about the pattern changed.
- **`ChannelIcon.tsx`** falls back to a generic megaphone glyph for any
  slug without a custom line-icon — safe, never broken, but meant all 7
  new channels looked visually generic next to the 5 hand-drawn ones.
  Drew 7 new icons in the same technical convention (28×28 viewBox,
  `currentColor` stroke, strokeWidth 2) — sports (trophy), events
  (ticket), community (two figures), transport (minibus), informal-retail
  (storefront), associations (network of three nodes), restaurants
  (fork). Flagged honestly: these are a first pass checked for build/lint
  correctness, not a design review — worth an actual visual pass before
  calling them final, same caveat as the isiZulu/isiXhosa copy in item 2.
- **`Footer.tsx`** had a manually-curated channels section, hardcoded
  links to influencer/website/podcast/radio, present on every page.
  Added the 7 new ones the same way — as plain text links, not new i18n
  keys, matching this exact file's own existing precedent one section up
  (Careers/Work With Us/Partners are already plain text with a comment
  explaining why) rather than attempting a rushed translation pass.

**Explicitly not done:** no attempt to convert the new footer links or
homepage hero copy into translated i18n keys across all four languages —
same reasoning as leaving them plain text in the first place. No visual/
design review of the 7 new icons beyond "it compiles and follows the
same technical pattern."

## Toolchain (this entry)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings |
| `npm test` | ✅ 20 test files, 153/153 — unchanged |

## Open items (carried forward)

Same as item 7's close, plus: the 7 new icons and homepage hero copy
haven't had a human design/copy review; the 7 new footer links aren't
in the i18n system yet.

---

## 9. Product Audit & Next-Stage Development Brief

Requested as a standalone, structured deliverable for onboarding external
developers, not a session-log entry — written to
`NEXT_STAGE_DEVELOPMENT_BRIEF.md` at repo root instead of inline here, per
the explicit either/or in the request. This entry is the pointer, not a
duplicate.

Compiled from what's actually been checked across both logs — this
session's own direct schema/toolchain work (items 1–8) plus
`CLAUDE_1.0.md`'s separately-verified findings — not a fresh audit of
every file in the repo, and the brief says so plainly rather than
implying more coverage than exists.

Two real, previously-unflagged gaps surfaced while writing it, both fixed
on the spot since they're small and directly relevant to "a developer can
start immediately without ambiguity":

- **`.env.example`** never got the 7 new channels' feature-flag entries —
  a developer copying it today would have no way to toggle
  `sports`/`events`/etc. without reading `featureFlags.ts` source
  directly. Added, same kill-switch documentation style as the existing
  4.
- **`README.md`'s setup guide stops at `schema_phase17`**, out of 78, and
  says so itself in an existing note — this predates this session
  entirely (the gap was already 61 migrations wide before today) but is
  now materially worse given how much sits on top of it. Not fixed this
  entry — it's Task 4 in the brief itself, not a quick edit, since
  fixing it properly means either consolidating 78 files or scripting
  their sequential application, not just prose.

## Toolchain (this entry)

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 errors, same 2 pre-existing warnings |
| `npm test` | ✅ 20 test files, 153/153 — unchanged; this entry touched no application code, only documentation and env-var scaffolding |

## Open items (carried forward)

Everything in `NEXT_STAGE_DEVELOPMENT_BRIEF.md`'s own findings section —
not re-listed here to avoid the two documents drifting out of sync with
each other.


---

## Toolchain

Real run, same as `CLAUDE_1.0.md`'s (this sandbox also has network
access):

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 errors, 2 pre-existing warnings (same intentional `thenable` test-mock shims noted in `CLAUDE_1.0.md`, untouched) |
| `npm test` | ✅ 20 test files, 153/153 passing — unchanged; the fixes this session were copy-only, nothing pure-function to add a test for |

## Open items (carried from CLAUDE_1.0.md, nothing new)

Nothing in this session's own work changed these — listed here so
they're not lost between the two logs:

- Never run against real Postgres (pgTAP suite) — including the
  counter-offer trigger fix from `CLAUDE_1.0.md` item 6.
- No automated coverage for `enforce_channel_request_transition()`
  itself.
- No automated coverage for the bulk-creation queue/batch logic beyond
  what `PHASE22_TEST_COVERAGE_DELIVERY.md` already added.
- Separately, from the *other* session that produced item 1 above: an
  81-section "Universal Advertising Inventory Expansion" doc is still
  unstarted. Nothing in this product's schema — checked against the
  actual table list, not assumed — has the generalized "any owner type
  sells priced inventory" model that doc's Sections 2–5 need. Worth its
  own phase, scoped to just Sports/Events/Communities first, whenever
  that becomes the priority again.
