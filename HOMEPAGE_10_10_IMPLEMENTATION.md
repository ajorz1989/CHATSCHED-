# ChatSched Homepage — CRO / UI Refresh

Implemented against the current ChatSched homepage with a focus on conversion clarity, visual hierarchy, responsive density and truthful network proof.

## Homepage structure
1. Hero — local advertising positioning with two primary business journeys and a visible Publisher Network path.
2. Network activity proof — verified publishers, new publishers this month, and completed bookings.
3. Three entry paths — Managed Advertising / Marketplace / Publisher Network in one consolidated section.
4. Real marketplace inventory — live publisher cards from the existing publisher hook.
5. Live channel discovery — all enabled channels presented in a compact responsive grid with one shared detail panel.
6. Local-first positioning — neighbourhoods, associations, local context and channel breadth.
7. Request-to-proof + trust — one combined workflow section covering discovery, request, approval, payment, live placement, proof, verification and tracking.
8. Opportunities — compact CTA banner for targeted sponsorship / advertising briefs.
9. ChatSched Tools — up to three active tools from Supabase, omitted when none are published.
10. Pricing — R399 business activation / R199 publisher activation, both once-off.
11. Publisher recruitment CTA and final dual business CTA.

## Removed / consolidated
- Merged the previous Two Ways and Three Layers explanations into one three-path section.
- Merged the previous How It Works and Trust sections into one request-to-proof section.
- Removed the long comparison table from the homepage.
- Removed the old homepage metrics for paid-out money and nine provinces.
- Reduced card borders from 3px to 2px in most content modules; reserved heavier treatment for major frames and CTAs.
- Reduced repeated section spacing and large colored blocks so yellow/green accents remain focal rather than constant.
- Replaced the wrapping 11-channel tab bar with a compact grid plus shared detail panel.

## Navigation
- Primary desktop navigation now groups campaign discovery, browsing, audience finder and budget calculator under an Advertise menu.
- Publisher Network, Opportunities, Channels and Pricing remain first-class navigation destinations.
- Mobile navigation mirrors the same information architecture in a compact drawer.
- Saved Lists remains accessible but no longer competes with the main acquisition navigation.

## Live network metrics
The public RPC `get_home_public_metrics()` now returns:
- `verified_publishers`
- `new_publishers_this_month`
- `completed_bookings`

The RPC remains SECURITY DEFINER with a pinned `search_path` and is executable by anonymous and authenticated visitors so the homepage can render public aggregate proof without exposing private publisher data.

Migration: `supabase/migrations/20260926190000_home_network_metrics.sql`

## Design system
- Retains ChatSched's billboard identity: ink, paper, green, yellow and hard-edge framing.
- Uses 2px borders for most content cards and 3px borders only for major CTA / brand frames.
- Keeps hard shadows for selected interactive/featured components rather than every card.
- No glassmorphism, parallax, 3D or decorative interactive backgrounds.
- Existing reduced-motion accessibility remains respected.

## i18n
- Hero, metrics and pathway messaging updated in English, Afrikaans, isiZulu and isiXhosa.
- Navigation labels for Advertise and Budget Calculator added to all four common locale files.

## Validation notes
- Live Supabase metric RPC was executed after deployment.
- Current production aggregate at implementation time: 2 verified publishers, 3 new publishers this month, and 0 completed bookings.
- Full local Bun/Vite build was not available in the model runtime because the repository dependencies were not mounted; no false production-build claim is made here.
