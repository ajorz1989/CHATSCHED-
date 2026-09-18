-- Phase 78: flip sports/events/community/transport/informal-retail/
-- associations/restaurants from active=false to active=true.
--
-- Explicit instruction, not the original plan for these 7 — schema_phase74
-- through 77 each shipped its channel inactive specifically until real
-- verified owners existed to list (see those migrations' own comments,
-- and the expansion doc's Sections 57/80). None of the 7 has a real
-- publisher or listing as of this migration; this makes them publicly
-- visible with nothing in them, not "launched with supply". Recorded
-- plainly here rather than silently, same as CLAUDE_2.0.md item 7.
--
-- verification_required is untouched — that's about how much scrutiny an
-- owner application gets, a separate question from whether the channel is
-- publicly visible, and none of the reasoning for keeping it true on
-- these 7 changed.

update public.channels
set active = true
where slug in ('sports', 'events', 'community', 'transport', 'informal-retail', 'associations', 'restaurants');
