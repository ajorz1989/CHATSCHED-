import { supabase } from "./supabase";
import type { Publisher } from "./types";

/**
 * Reuses publisher_profile_views (the traction-tracking table from Phase
 * 37) rather than a separate "recently viewed" table — same event, two
 * uses. Returns full Publisher rows, most recently viewed first, deduped
 * to one entry per listing (a business who checked the same profile on
 * three different days should see it once, at its latest position, not
 * three times).
 */
export async function loadRecentlyViewed(userId: string, limit = 8): Promise<Publisher[]> {
  // Over-fetch raw view rows before deduping — a business could have
  // viewed the same handful of publishers repeatedly, so N rows doesn't
  // guarantee N distinct listings. 5x the limit is generous without being
  // wasteful for how small this table stays per user in practice.
  const { data: views, error: viewsError } = await supabase
    .from("publisher_profile_views")
    .select("publisher_id, created_at")
    .eq("viewer_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit * 5);

  if (viewsError || !views || views.length === 0) return [];

  const orderedUniqueIds: string[] = [];
  for (const row of views) {
    if (!orderedUniqueIds.includes(row.publisher_id)) orderedUniqueIds.push(row.publisher_id);
    if (orderedUniqueIds.length >= limit) break;
  }

  // publishers_public (schema_phase82) instead of the base publishers
  // table — a business looking at its own view history is still just
  // public marketplace browsing of OTHER publishers' listings, so it
  // only needs the same safe columns the directory exposes. The view is
  // already approved-only, so a listing suspended/removed since the view
  // still won't resurface here, same as the .eq("status", "approved")
  // this replaces.
  const { data: publishers, error: publishersError } = await supabase
    .from("publishers_public")
    .select("*")
    .in("id", orderedUniqueIds);

  if (publishersError || !publishers) return [];

  // The .in() query doesn't preserve order — re-sort to match the
  // most-recently-viewed order computed above.
  const byId = new Map(publishers.map((p) => [p.id, p as Publisher]));
  return orderedUniqueIds.map((id) => byId.get(id)).filter((p): p is Publisher => p != null);
}
