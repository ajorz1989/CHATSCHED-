# ChatSched — Opportunities Engine v2 Delivery

## Delivered

The reverse-marketplace Opportunities Engine now supports:

- Admin-controlled opportunity type catalogue with 15 seeded opportunity types.
- Structured briefs: opportunity type, channel, province/city, target audience, budget, publisher quantity, application deadline, campaign window, deliverables, publisher requirements and matching keywords.
- Draft and publish workflow for business opportunities.
- Publisher discovery feed with search, type/channel/location filters and best-match/newest/budget sorting.
- Match scoring based on channel, geography, audience/category signals and publisher starting price.
- Verified + approved + activated publisher gating at the database layer.
- Verified + activated business gating at the database layer.
- Application uniqueness per publisher/opportunity.
- Publisher proposal message, placement/deliverable and proposed price.
- Atomic application acceptance into the existing ChatSched booking tables (requests or channel_requests), rather than creating a parallel booking system.
- Multi-publisher capacity enforcement through the existing acceptance trigger.
- Automatic deadline/expiry closure through pg_cron every 15 minutes.
- Targeted new-opportunity notifications to verified, activated publishers matching channel and declared geography.
- Admin operations view with status/type filters, demand metrics and opportunity-type enable/disable controls.
- Database smoke-test/pgTAP coverage for the new engine.
- Public Opportunities page updated to describe matching and on-platform proposal handling.

## Database

Production project ref: hbqobuecjrxhlfgfhdud

New/updated database surface:

- public.opportunity_types
- public.opportunities
- public.opportunity_applications
- public.expire_opportunities()
- public.accept_opportunity_application(uuid)
- public.notify_new_opportunity()
- public.enforce_opportunity_update()
- Cron job: expire-open-opportunities

The existing channel-request/request architecture remains the booking system after an opportunity is accepted.

## Source files

- src/lib/opportunityMatching.ts
- src/lib/types.ts
- src/pages/OpportunityFeed.tsx
- src/pages/BusinessOpportunities.tsx
- src/pages/AdminOpportunities.tsx
- src/pages/Opportunities.tsx
- supabase/migrations/20260926011500_opportunities_engine_v2.sql
- supabase/migrations/20260926013000_opportunities_engine_targeted_notifications.sql
- supabase/schema_phase110_opportunities_engine_v2.sql
- supabase/tests/opportunities_engine_v2_test.sql

## Verification performed

- Production has 15 active opportunity types.
- All six new opportunity fields exist on public.opportunities.
- The expiry cron is active at */15 * * * *.
- expire_opportunities() is not executable by anon or authenticated.
- accept_opportunity_application(uuid) is executable by authenticated users and not anon/public.
- Live smoke invocation of expire_opportunities() returned 0 with no errors.
- Live multi-publisher acceptance trigger was inspected and already correctly waits until publishers_needed is reached before filling the opportunity.
- The Opportunities Engine Security Advisor review still shows pre-existing global findings elsewhere in the project; those are not claimed as fixed by this delivery.

## Remaining production QA

A genuine browser-level business-to-publisher happy path should still be exercised with real test accounts:

Business verification/activation
-> create opportunity
-> publisher eligibility
-> feed match
-> publisher application
-> business acceptance
-> request/channel_request creation
-> normal payment/compliance/proof workflow.

Full repository build/lint/E2E execution still requires the project's complete local dependency environment.
