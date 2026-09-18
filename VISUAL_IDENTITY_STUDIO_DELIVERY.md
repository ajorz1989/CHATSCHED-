# Visual Identity Studio — admin-only design review page

## What this is

A separate, previously-unrelated workspace (a concept exploration app) contained a
one-off page (`visual-identity.tsx`) proposing three branded directions for how a
publisher's avatar + cover banner should look on ChatSched: **Yellow Plate**,
**Channel Crest**, and **Publisher Storefront**. That workspace used a different
framework (TanStack Router) and its own mock publisher data, so the page couldn't be
copied in as-is.

What was ported: the concept work itself — the three directions, their copy/rationale,
the audit of what's live today, the strategy discussion, the outcomes table, and the
three mood-photography images (`plate-mood.jpg`, `crest-mood.jpg`, `storefront-mood.jpg`).

What was deliberately **not** ported: that workspace's icons, favicon, PWA manifest,
service worker, or any of its other unrelated files/tooling — none of that is part of
the visual-identity work and none of it was brought over.

## What was built here

- `src/pages/AdminVisualIdentity.tsx` — new page, rewritten from scratch against this
  codebase's real design system (`tailwind.config.js`'s `billboard-*` tokens, which
  already matched the source workspace's palette by coincidence), real `Seo`/`Button`
  components, and real channel data (`ChannelSlug`, the 13 channels this marketplace
  actually runs, per `src/lib/channelTypes.ts` and `src/channels/*/index.ts`'s
  emoji/labels).
- Route: `/admin/visual-identity`, added to `src/App.tsx` lazy-loaded and gated with
  `<RequireAuth role="admin">` — the exact same pattern `/admin/careers` and
  `/admin/tools` already use. **Admin-only**, per the request.
- Nav: a third quick-link ("Visual Identity →") added next to the existing
  "Careers applications →" / "ChatSched Tools →" links at the top of `Admin.tsx`.
- Assets: the three mood-photography JPGs copied to `public/visual-identity/`.

## What this does *not* touch

Per the explicit instruction to keep the current profile as-is: this page does **not**
import, modify, or wire into `PublisherCard.tsx`, `PublisherProfile.tsx`, or any other
component that renders a real publisher today. It renders its own local mock publishers
(`SAMPLE_PUBLISHERS`) and its own local render helpers (`ConceptCard`/`ConceptProfile`)
defined entirely inside the new file. Nothing a business, publisher, or logged-out
visitor sees anywhere else in the product has changed. The source workspace's page had
a "live apply to Browse & profiles" toggle (via localStorage + a shared React context);
that live-apply wiring was intentionally left out here, since building it for real would
mean touching the shared card/profile components — the thing this request said not to
do yet. The page says as much in its own copy ("Preview-only, by design").

## Open item

Adopting one of the three directions for real publisher profiles is a separate,
follow-up implementation phase — it would mean changing `PublisherCard.tsx` and
`PublisherProfile.tsx` directly, plus a product decision on which direction to ship
(the studio's own recommendation section argues for Yellow Plate as the default).
Not started here, on purpose.

Like the rest of this project's history, none of this has been run against a real
dev server from this sandbox (no `node_modules`/network available) — reviewed by
direct inspection and bracket/structure checks only.
