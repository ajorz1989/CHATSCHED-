-- ChatSched — Phase 98 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase97_verification_proof_upload.sql.
--
-- Found while fixing the Layer 2 QA build (production build was failing
-- on `tsc -b`, per the Layer 2 audit's own Definition of Done). Not
-- something the audit itself flagged — traced from a real TypeScript
-- error back to its actual runtime cause, three genuine regressions left
-- over from schema_phase84_safe_cross_party_profile_access.sql's own fix
-- not being propagated everywhere it needed to be:
--
--   1. business_contact_public (phase84) only recognises a cross-party
--      relationship through public.requests. It was never extended to
--      public.channel_requests — the newer per-channel booking table
--      (schema_phase17 onward, used by every "request flow" channel:
--      influencer, website, podcast, radio, and the ones added since).
--      Confirmed directly: src/components/PublisherDashboardView.tsx and
--      src/lib/campaignWorkspace.ts both still embed
--      `business:profiles(full_name, company_name, phone)` straight off
--      channel_requests, relying on the exact
--      profiles_select_via_shared_request policy phase84 already
--      dropped. There is no replacement policy for channel_requests, so
--      today this embed silently returns null for every publisher who
--      isn't the business or an admin — real bookings on five-plus
--      channels show a blank/"Business" placeholder where the business's
--      name belongs. Not a security hole (RLS fails closed), but a real
--      functional regression, and the fix is the same pattern already
--      established: extend the one safe view rather than reopen the
--      table-level policy.
--
--   2. Testimonials on the actual public marketplace pages are broken
--      the same way. src/pages/PublisherProfile.tsx (the public profile
--      page — reachable by anonymous visitors) and src/pages/MediaKit.tsx
--      both query `reviews...business:profiles(full_name, company_name)`
--      to attribute a review to the business that wrote it. reviews
--      themselves are already fully public (reviews_select_public,
--      schema_phase2.sql) — the review text, rating, and everything else
--      renders fine — but the attribution silently disappears for the
--      same reason: profiles has had no non-owner/non-admin SELECT
--      policy since phase84. Every testimonial on every publisher's
--      public profile has been rendering with no business name attached
--      since that migration ran. This is exactly the "Proof/trust" layer
--      the Layer 2 audit's own homepage-structure section (§19) and
--      Definition of Done ("UX: buyer/publisher journey is obvious")
--      care about, so it's fixed here rather than left for a future
--      pass. The content is already public; only the name resolution
--      was silently dropped. A dedicated view — scoped to exactly
--      "businesses who have an actual public review on file" — restores
--      it without reopening profiles generally.
--
--   3. The publisher-facing "is this business verified" badge
--      (src/components/PublisherDashboardView.tsx, computeVerificationLevel)
--      also depended on the same dropped embed, but for
--      email_verified/phone_verified/business_verified — three raw
--      booleans that phase84 was correct never to re-expose wholesale
--      (that's real internal-verification-state, not a display name).
--      Rather than either leaving this badge permanently broken or
--      quietly reintroducing the raw booleans, business_contact_public
--      gets one computed, derived column instead — same shape as
--      publishers_public already does for the symmetric case (it exposes
--      `level`/`trust_score`, computed signals, never the raw
--      email_verified/phone_verified/identity_verified booleans
--      themselves). The case logic below is a direct mirror of
--      src/lib/businessVerification.ts's computeVerificationLevel() —
--      keep the two in sync if that function ever changes.

-- ── 1. business_contact_public: recognise channel_requests too, plus a
--       derived (not raw) verification signal ─────────────────────────
create or replace view public.business_contact_public
with (security_invoker = false)
as
select
  p.id,
  p.full_name,
  p.company_name,
  case
    when p.business_verified then 'gold'
    when p.phone_verified and p.email_verified then 'silver'
    when p.email_verified then 'bronze'
    else null
  end as verification_level
from public.profiles p
where
  p.id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.requests r
    join public.publishers pub on pub.id = r.publisher_id
    where r.business_id = p.id and pub.user_id = auth.uid()
  )
  or exists (
    select 1 from public.channel_requests cr
    join public.publishers pub on pub.id = cr.creator_id
    where cr.business_id = p.id and pub.user_id = auth.uid()
  );

comment on view public.business_contact_public is
  'Safe cross-party read surface for a business''s display name, for a publisher who shares an actual booking relationship (via requests OR channel_requests) with that business, plus a derived verification_level (bronze/silver/gold/null — mirrors src/lib/businessVerification.ts, never the raw email_verified/phone_verified/business_verified booleans themselves). Never exposes phone or any other profiles column. Query via src/lib/businessContact.ts rather than embedding profiles directly — see that file and schema_phase84_safe_cross_party_profile_access.sql for why.';

grant select on public.business_contact_public to authenticated;

-- ── 2. review_author_public: restore public testimonial attribution ────
-- reviews themselves are already public (reviews_select_public,
-- schema_phase2.sql) — this exposes only full_name/company_name, and
-- only for a profile that actually has a public business review on file,
-- so it adds no new visibility beyond "who wrote the review you can
-- already read".
create or replace view public.review_author_public
with (security_invoker = false)
as
select distinct p.id, p.full_name, p.company_name
from public.profiles p
where exists (
  select 1 from public.reviews r
  where r.business_id = p.id and r.author_role = 'business'
);

comment on view public.review_author_public is
  'Public read surface for a review''s author display name — full_name and company_name only, and only for profiles that have an actual public business review on file (reviews themselves are already public per reviews_select_public). Restores the attribution that used to come from an embed against profiles directly, which stopped working for anonymous/non-admin viewers once schema_phase84_safe_cross_party_profile_access.sql dropped the over-broad shared-access policies. Query this and merge client-side (same pattern as business_contact_public/fetchBusinessContacts) rather than embedding profiles from reviews — a view has no FK for PostgREST to embed through anyway.';

grant select on public.review_author_public to anon, authenticated;
