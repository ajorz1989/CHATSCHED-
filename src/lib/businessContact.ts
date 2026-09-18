import { supabase } from "./supabase";
import type { BusinessVerificationLevel } from "./businessVerification";

/**
 * Fetches display-only business contact info (full_name, company_name) for
 * a set of business ids, via public.business_contact_public
 * (schema_phase84_safe_cross_party_profile_access.sql) instead of
 * embedding `profiles` directly.
 *
 * Why this exists: PublisherDashboardView.tsx, campaignWorkspace.ts, and
 * Messages.tsx all used to do `business:profiles(full_name, company_name,
 * ...)` as a PostgREST embedded resource on `requests`/`conversations`.
 * That embed relied on profiles_select_via_shared_request /
 * profiles_select_via_shared_conversation, two RLS policies that granted
 * the ENTIRE profiles row (phone, verification flags, everything) to
 * anyone who merely shared a request or conversation, because RLS can
 * restrict which rows are visible but not which columns — see
 * "Claude To fix 1..txt" item 8. Those two policies are gone now
 * (schema_phase84); this is the safe replacement. It's a separate
 * top-level query rather than an embed because business_contact_public is
 * a view, not a table with a real foreign key from requests/conversations
 * — PostgREST's embedding syntax needs an actual FK to auto-detect the
 * relationship, which a view doesn't carry, so embedding it directly
 * isn't reliable. A second query plus a client-side merge is the
 * guaranteed-correct alternative.
 */
export type BusinessContact = { full_name: string | null; company_name: string | null; verification_level: BusinessVerificationLevel | null };

export async function fetchBusinessContacts(businessIds: (string | null | undefined)[]): Promise<Map<string, BusinessContact>> {
  const uniqueIds = Array.from(new Set(businessIds.filter((id): id is string => !!id)));
  const map = new Map<string, BusinessContact>();
  if (uniqueIds.length === 0) return map;

  const { data } = await supabase.from("business_contact_public").select("id, full_name, company_name, verification_level").in("id", uniqueIds);
  for (const row of data ?? []) {
    map.set(row.id, { full_name: row.full_name, company_name: row.company_name, verification_level: row.verification_level });
  }
  return map;
}

/**
 * Same shape/pattern as fetchBusinessContacts above, but for attributing
 * a *review* to the business that wrote it (public.review_author_public,
 * schema_phase98_cross_party_contact_completeness.sql) — reviews are
 * already public content (reviews_select_public), this only resolves the
 * display name for whoever is reading them, including anonymous
 * visitors on a publisher's public profile.
 */
export async function fetchReviewAuthors(businessIds: (string | null | undefined)[]): Promise<Map<string, BusinessContact>> {
  const uniqueIds = Array.from(new Set(businessIds.filter((id): id is string => !!id)));
  const map = new Map<string, BusinessContact>();
  if (uniqueIds.length === 0) return map;

  const { data } = await supabase.from("review_author_public").select("id, full_name, company_name").in("id", uniqueIds);
  for (const row of data ?? []) {
    map.set(row.id, { full_name: row.full_name, company_name: row.company_name, verification_level: null });
  }
  return map;
}
