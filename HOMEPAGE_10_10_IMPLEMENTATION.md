# ChatSched Homepage — 10/10 Conversion Redesign

Implemented against the previously updated ChatSched codebase and the Messaging & Branding audit.

## Homepage structure
1. Hero — “Reach local customers. Without the ad-platform headache.” with two primary paths.
2. Live aggregate proof — businesses, publisher payouts, 9 provinces.
3. Two ways to advertise — managed Agency vs Marketplace.
4. “Why not just run social ads?” comparison — no ad account, no auction/bidding workflow, chosen inventory, tracked workflow and proof.
5. Real marketplace inventory — live publisher cards from the existing publisher hook.
6. Channel discovery — live channel tabs.
7. Local-first positioning — township, transport, associations/networks and suburb/neighbourhood targeting.
8. Three Layers — Agency / Marketplace / Network.
9. Request-to-proof timeline — six clear campaign stages.
10. Trust & payment — secure payment, verification and tracked workflow.
11. ChatSched Tools — up to three active tools from Supabase, omitted when none are published.
12. Pricing — R399 business / R199 publisher once-off framing and transparent 12% commission / 88% publisher share.
13. Publisher recruitment CTA.
14. Final dual CTA — Build My Campaign / Browse Advertising.

## Removed / consolidated
- Removed the old standalone Quick Start goal/budget picker from the homepage; the homepage now prioritises the two primary conversion journeys and avoids an overly long form-like section.
- Removed the old duplicate audience split section.
- Removed the old separate payment timeline teaser.
- Removed the old generic illustrative Case Studies teaser from the homepage. Real proof can be added when actual campaign data exists.
- Removed the old animated publisher/business hero mockup and replaced it with a simpler marketplace inventory visual that explains the product faster.

## Design system
- Retains ChatSched’s existing billboard identity: yellow, green, ink, paper, hard borders and hard-edge shadows.
- Adds small homepage brand primitives for eyebrow labels and consistent CTA buttons.
- No glassmorphism, parallax, 3D or decorative interactive backgrounds.
- Existing reduced-motion accessibility remains respected.

## i18n
Homepage copy was updated in English, Afrikaans, isiZulu and isiXhosa home locale files.

## Data / architecture
- Homepage public metrics continue to use the aggregate `get_home_public_metrics` RPC.
- Publisher inventory continues to come from the existing `usePublishers` flow.
- Tools are read from the existing `tools` table and only active tools are shown.
- No browser-side AI/API calls were introduced.
- `/audience-finder` remains rule-based.
- No booking state machine, PayFast ITN logic, authentication, RLS or payment workflow was modified.
- Public pricing copy uses the established R399/R199 once-off framing; completed booking commission remains sourced from `PLATFORM_COMMISSION_RATE` and `PUBLISHER_SHARE`.

## Validation
- All four homepage locale JSON files parse successfully.
- A full TypeScript build could not be completed in the supplied environment because `node_modules` is absent and the project currently reports missing `vite/client` and `node` type definitions. No claim of a successful production build is made here.
