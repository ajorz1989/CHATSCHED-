# ChatSched — Business Value Proposition & Gated Opportunities Engine

**Build:** Phase 81 — Business Value Proposition & Job Opportunities Engine  
**Date:** 16 September 2026  
**Basis:** Current ChatSched Phase-15 opportunity build, existing Layer 2 engineering audit, and the actual repository in `chatsched-final`.

> **Integration note (merged into the Phase100 repository):** this document
> describes the build as it was originally shipped. It has since been
> merged onto the further-evolved `chatsched-final-form` (Phase100)
> codebase, which already had its own `schema_phase81_...sql` migration
> for an unrelated fix. To avoid a collision, the database migration
> described in Section 3 below ships in the merged repository as
> `supabase/schema_phase101_business_opportunities_engine.sql` instead of
> `schema_phase81_...sql`, rewritten to layer on top of that branch's own
> later opportunity-marketplace work (multi-publisher acceptance, all-12-
> channel support, the atomic `accept_opportunity_application()` RPC, and
> subscription-gated posting). The route, UI and type-system changes in
> Sections 5–14 were ported the same way — added alongside this branch's
> newer features (the publisher channel picker at signup, the atomic
> accept RPC, bundle suggestions, subscription gating) rather than
> replacing them. See that migration file's own header for the exact
> mapping. Everything else in this document reflects the feature as
> designed.

## 1. Executive audit

ChatSched already contains a reverse-marketplace foundation: `opportunities`, `opportunity_applications`, a business posting page, a publisher opportunity feed, multi-acceptance support, and an admin Opportunities tab. The earlier implementation therefore did **not** need a second opportunity marketplace. The correct architecture is an additive hardening/extension of the existing system.

The current implementation had four material gaps against the requested engine:

1. Business `industry` was a free-text field rather than a controlled business-type profile.
2. There was no structured business opportunity-preference profile.
3. Existing opportunity access was role-gated but not verification-gated at the route/database boundary.
4. Opportunity records lacked structured opportunity type and target location/audience fields, and the business UI did not provide an edit flow.

The build closes those gaps while retaining the existing booking/request architecture. This is consistent with the Layer 2 principle that ChatSched should make the existing marketplace transactional rather than create parallel systems.

## 2. Existing capability retained

The repository already had:

- `src/pages/BusinessOpportunities.tsx` for business postings.
- `src/pages/OpportunityFeed.tsx` for publisher applications.
- `src/pages/AdminOpportunities.tsx` and an admin Opportunities tab.
- `supabase/schema_phase68_opportunity_marketplace.sql` for opportunities and applications.
- `supabase/schema_phase69_opportunity_multi_accept.sql` for multiple publisher acceptance.
- Existing publisher verification fields (`verified`, `status`).
- Existing business verification (`business_verified`).
- Existing profile `industry`, province and city fields.
- Existing campaign/request tables used after an opportunity application is accepted.

The prior repository audit explicitly identified the reverse marketplace as an existing capability and described the opportunity feed as a later phase, rather than a missing first-principles architecture.

## 3. Database changes introduced

### Migration

**New:** `supabase/schema_phase81_business_opportunities_engine.sql`

This migration is append-only and intended to run after the existing profile/verification and opportunity migrations.

### 3.1 `profiles` additions

Added:

- `business_type text`
- `opportunity_preferences text[] not null default '{}'`

`business_type` is constrained to the supported onboarding taxonomy:

- Educational Institution / School
- Retail / SMME
- Event Organizer
- Corporate Brand
- Venue Owner
- Non-profit / Community Organisation
- Sports Club / Organisation
- Media / Publisher
- Other

This keeps the business profile machine-readable while retaining the existing `industry` field for broader industry information.

### 3.2 `opportunities` additions

Added:

- `opportunity_type text`
- `target_province text`
- `target_city text`
- `target_audience text`

These fields support targeted opportunity discovery without replacing the existing `channel_slug` architecture.

Added indexes for:

- open opportunity type
- open opportunity province/city

### 3.3 Opportunity lifecycle

Extended the existing status constraint to include:

`draft → open → filled / closed / cancelled`

Existing records remain valid. No existing table is replaced.

A server-side `publish_opportunity(uuid)` function was added for a future/explicit draft-to-published workflow. It requires an authenticated verified business and only publishes that business's own draft.

### 3.4 Signup profile provisioning

`handle_new_user()` was replaced with a safer version that:

- permits only `business` or `publisher` from public signup metadata;
- falls back to `business` for invalid/missing roles;
- stores `business_type`;
- stores `opportunity_preferences`;
- preserves email verification handling.

This directly addresses the previously identified critical role-escalation risk around signup metadata.

## 4. RLS / security changes

### 4.1 Verified business opportunity posting

The old `opportunities_insert_own` policy was replaced.

A business may insert an opportunity only when:

- `business_id = auth.uid()`;
- the profile role is `business`;
- `business_verified = true`.

This prevents an unverified account from bypassing the UI and inserting opportunities through the Supabase API.

### 4.2 Verified business editing

The business update policy now requires the caller to be the opportunity owner and a verified business.

This protects the edit workflow at the database layer rather than relying on React controls.

### 4.3 Verified publisher opportunity feed

The old publisher feed policy checked `status = approved` only.

It is now restricted to a publisher record where:

- `user_id = auth.uid()`;
- `status = approved`;
- `verified = true`.

This makes the requested Opportunities directory a verified-member marketplace rather than a general publisher-only page.

### 4.4 Verified publisher applications

Application insertion now requires the publisher to be:

- linked to the authenticated user;
- approved;
- verified;
- applying to an open opportunity.

### 4.5 Existing security architecture retained

The build does not weaken existing RLS on applications, admin access, or profile verification. Admin access continues to use the existing admin/MFA architecture.

## 5. Route architecture

### New canonical route

`/opportunities`

This is now the single user-facing entry point.

It is handled by the new:

`src/pages/OpportunityGate.tsx`

The gate determines access from the authenticated profile and publisher verification state.

### Business access

Verified business → `BusinessOpportunities`.

### Publisher access

Approved + verified publisher → `OpportunityFeed`.

### Guest/unverified access

Guest, wrong role, unverified business, or unverified publisher → `/opportunities/preview`.

### Admin access

Admin → `/admin`.

### Backward compatibility

The previous routes remain safe redirects:

- `/business/opportunities` → `/opportunities`
- `/publisher/opportunities` → `/opportunities`

This avoids stale bookmarks while consolidating the product architecture.

## 6. Verification preview UX

**New:** `src/pages/OpportunityPreview.tsx`

The preview is intentionally not a public opportunity feed. It contains no opportunity data.

It explains the value proposition:

> Find advertising opportunities — or post what you need.

It explains both sides:

### Businesses

Post briefs for:

- school partnerships
- venue displays
- newsletters
- influencer placements
- radio
- podcasts
- other targeted sponsorships

### Publishers

Browse briefs and submit proposals without exposing private contact details.

Primary CTAs:

- Create business account
- Join as publisher
- Log in

This creates a conversion surface rather than simply returning a `403` or blank page.

## 7. Business onboarding changes

**Updated:** `src/pages/Register.tsx`

Business signup now asks for:

### Business type

Controlled dropdown rather than free text.

### Opportunity interests

A contextual multi-select is generated from the selected business type.

Examples:

**Educational Institution / School**

- School Partnership
- Event Sponsorship
- Newsletter Sponsorship
- Sports Sponsorship

**Retail / SMME**

- Influencer Product Placement
- Social Media Promotion
- Local Event Sponsorship
- In-Venue Screen Display

**Event Organizer**

- Event Sponsorship
- Venue Display
- Radio / Podcast Spot
- Influencer Product Placement

**Corporate Brand**

- School Partnership
- Event Sponsorship
- Newsletter Sponsorship
- Radio / Podcast Spot
- Sports Sponsorship

**Venue Owner**

- In-Venue Screen Display
- Event Sponsorship
- Local Business Promotion

Additional contextual sets are included for non-profit/community, sports, media/publisher and other businesses.

The selections are persisted in signup metadata and written to the profile by the database trigger.

## 8. Business dashboard changes

**Updated:** `src/pages/Dashboard.tsx`

Business profile settings now expose:

- Business type
- Opportunity interests

The existing industry field remains available.

Opportunity interests can be maintained as comma-separated values in dashboard settings, keeping the profile editable without introducing another settings page.

## 9. Opportunity posting workflow

**Updated:** `src/pages/BusinessOpportunities.tsx`

The business posting form now captures:

- opportunity title
- full brief
- opportunity type
- target province
- target city
- target audience
- advertising channel
- minimum budget
- maximum budget
- number of publishers needed

Examples of opportunity types include:

- Newsletter Sponsorship
- School Partnership
- Event Sponsorship
- In-Venue Screen Display
- Influencer Product Placement
- Radio / Podcast Spot
- Sports Sponsorship
- Website Advertising
- Community Sponsorship
- Social Media Promotion

### Create

A verified business can publish an opportunity directly.

### Edit

Existing open/draft opportunities now have an Edit action that reloads their data into the posting form.

### Publish

The normal business CTA publishes immediately. The database also supports an explicit draft state and secure server-side publish function for workflows that need review/draft mode later.

## 10. Matching and proposals

The existing application model remains the proposal mechanism.

Publisher workflow:

1. Open `/opportunities`.
2. View verified business briefs.
3. Filter/match by publisher channel and opportunity data.
4. Open a brief.
5. Submit a proposal.
6. Provide proposed delivery method.
7. Optionally provide proposed amount.
8. Business reviews the proposal.
9. Accepted proposals continue into the existing request/channel-request system.

The build intentionally does not create a second booking table.

## 11. Anti-bypass design

The opportunity engine does not expose publisher private contact details as part of the proposal flow.

The proposal is an in-platform application. Once accepted, the existing ChatSched request/campaign machinery remains the transaction path.

This is aligned with the established operating model:

**Discover → Request through ChatSched → Approve → Pay → Go Live → Proof**

The previous Layer 2 audit explicitly required platform-mediated campaign relationships and avoidance of unrestricted direct publisher contact.

## 12. Admin architecture

The existing `AdminOpportunities.tsx` and admin Opportunities tab are retained.

No second admin opportunity system was created.

The admin can continue to:

- inspect opportunities;
- inspect applications;
- see opportunity owners;
- see publisher applicants;
- moderate/cancel postings.

The business remains the decision-maker for selecting applicants in the existing application flow.

## 13. Type system changes

**Updated:** `src/lib/types.ts`

`Profile` now includes:

- `business_type`
- `opportunity_preferences`

`OpportunityStatus` now includes:

- `draft`

`Opportunity` now includes:

- `opportunity_type`
- `target_province`
- `target_city`
- `target_audience`

This keeps TypeScript aligned with the new schema.

## 14. Auth metadata changes

**Updated:** `src/contexts/AuthContext.tsx`

`SignUpMeta` now accepts:

- `business_type?: string`
- `opportunity_preferences?: string[]`

Only public business/publisher roles remain accepted by the client type and server-side trigger.

## 15. Files changed

### New

- `src/pages/OpportunityGate.tsx`
- `src/pages/OpportunityPreview.tsx`
- `supabase/schema_phase81_business_opportunities_engine.sql`
- `CHATSCHED_BUSINESS_VALUE_OPPORTUNITIES_ENGINE_AUDIT.md`

### Updated

- `src/App.tsx`
- `src/pages/Register.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/BusinessOpportunities.tsx`
- `src/pages/AdminOpportunities.tsx`
- `src/lib/types.ts`
- `src/contexts/AuthContext.tsx`

## 16. Existing architecture intentionally not duplicated

The following were deliberately reused:

- `opportunities`
- `opportunity_applications`
- `requests`
- `channel_requests`
- publisher verification
- business verification
- existing Admin Opportunities tab
- existing campaign/payment/compliance flow
- existing profile model

This avoids introducing competing concepts such as `jobs`, `sponsorship_jobs`, `opportunity_bookings`, or a second transaction engine.

## 17. Important implementation notes

### Verification semantics

For businesses, `business_verified = true` is the database gate.

For publishers, both `status = approved` and `verified = true` are required.

This deliberately uses the repository's existing verification vocabulary rather than inventing a new verification table.

### Opportunity categories

`opportunity_type` is currently free text at the database level because the product already uses channel-specific advertising architecture. The UI supplies a controlled catalogue. If ChatSched later needs admin-managed opportunity categories, the next additive phase should introduce an `opportunity_types` catalogue table rather than another hard-coded frontend list.

### Location

`target_province` and `target_city` are intentionally separate from the business's own province/city. This allows a Cape Town business, for example, to request a campaign targeting Gauteng without changing its company profile.

## 18. QA performed in this build

A TypeScript parser pass was run against all modified TypeScript/TSX files using TypeScript 5.8.3.

Result:

**9/9 modified TypeScript/TSX files parsed successfully with zero parser diagnostics.**

A full `npm run build` could not be completed in the current sandbox because the repository's dependency installation was incomplete and the environment could not fetch one missing npm package from the registry. Therefore this artifact does **not** claim a clean production build, lint run, or live Supabase RLS test.

Before production deployment, run:

```text
npm ci
npm run build
npm run lint
npm test -- --run
```

Then apply the migration in a staging Supabase project and execute the RLS/security suite.

## 19. Recommended staging security tests

At minimum verify:

1. Guest visits `/opportunities` → preview.
2. Unverified business visits `/opportunities` → preview.
3. Verified business visits `/opportunities` → business opportunity manager.
4. Approved but unverified publisher → preview.
5. Approved + verified publisher → opportunity feed.
6. Unverified business cannot insert an opportunity through Supabase.
7. Verified business cannot update another business's opportunity.
8. Unverified publisher cannot select open opportunities through Supabase.
9. Unverified publisher cannot insert an application.
10. Verified publisher cannot apply twice to the same opportunity.
11. Public users cannot read private application/business information.
12. Public signup metadata containing `role=admin` creates a normal business profile rather than an admin profile.
13. A business cannot directly set `business_verified=true` through profile update.
14. Existing accepted opportunity applications continue into normal request/channel-request records.

## 20. Product value proposition

The resulting feature can be positioned as a distinct ChatSched network layer:

### For businesses

**Post what you need. Let verified advertising partners come to you.**

Instead of manually searching for every advertising opportunity, a verified business can publish a targeted brief and receive proposals from relevant publishers.

### For publishers

**Find brands looking for exactly what you offer.**

Verified publishers can discover targeted briefs instead of relying only on inbound profile requests.

### For ChatSched

The feature creates a reverse-marketplace loop:

**Business need → Opportunity brief → Publisher proposal → ChatSched-managed campaign → Payment → Proof → Repeat**

## 21. Final audit status

| Area | Status |
|---|---|
| Existing opportunity architecture reused | PASS |
| Business type onboarding | IMPLEMENTED |
| Dynamic opportunity interests | IMPLEMENTED |
| Verified business route gate | IMPLEMENTED |
| Verified publisher route gate | IMPLEMENTED |
| Public verification preview | IMPLEMENTED |
| Structured opportunity type | IMPLEMENTED |
| Target location | IMPLEMENTED |
| Target audience | IMPLEMENTED |
| Business create flow | IMPLEMENTED |
| Business edit flow | IMPLEMENTED |
| Publish support | IMPLEMENTED |
| Publisher proposal flow | RETAINED / HARDENED |
| Admin opportunity surface | RETAINED |
| Append-only migration | PASS |
| Signup role escalation mitigation | IMPLEMENTED |
| TypeScript parser validation | PASS |
| Full production build | NOT VERIFIED IN SANDBOX |
| Live Supabase/RLS tests | NOT RUN IN SANDBOX |

## 22. Architecture conclusion

This implementation turns the existing reverse marketplace into a more structured **Business Opportunities Engine** without rebuilding ChatSched.

The key architecture is:

**Business profile → business type → opportunity interests → verified access → opportunity brief → verified publisher proposals → existing ChatSched request/campaign flow.**

The database, not the React UI, is the final authorization boundary.

The next production step is staging deployment and real RLS/security testing before enabling the `/opportunities` route for live users.
