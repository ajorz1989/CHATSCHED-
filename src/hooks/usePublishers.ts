import { useQuery } from "./useQuery";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import type { Publisher } from "../lib/types";
import { invalidate } from "../lib/queryCache";

// Highest-leverage target for the caching/dedup layer (see useQuery.ts):
// this one hook has 14 separate consumers across the app (Browse, Home,
// PublisherProfile, the marketing-suite tools, and more) — fixing it once
// here benefits all of them, rather than touching 14 files individually.
const PUBLISHERS_CACHE_KEY = "publishers:approved";

async function fetchApprovedPublishers(): Promise<Publisher[]> {
  // publishers_public (schema_phase82) instead of the base publishers
  // table — it already only contains approved rows and only the columns
  // the public directory is allowed to show, so there's no need for the
  // .eq("status", "approved") filter that used to be here.
  const { data, error } = await supabase
    .from("publishers_public")
    .select("*")
    .order("publisher_score", { ascending: false })
    .order("trust_score", { ascending: false });
  if (error) throw new Error(formatSupabaseError(error, "Couldn't load publishers"));
  return sortFeaturedFirst((data ?? []) as Publisher[]);
}

/**
 * Call after a publisher's own listing changes so their edit shows up
 * immediately wherever usePublishers() is read, instead of waiting out
 * the cache's 60s stale time. Wired into PublisherDashboardView.tsx and
 * PortfolioManager.tsx's self-service update calls.
 *
 * Deliberately NOT wired into Admin.tsx's publisher mutations (approve/
 * reject/suspend/feature/verify) — Admin.tsx queries the publishers table
 * directly for its own table view rather than through this cache, so
 * those actions don't need this to stay correct in Admin's own UI. Their
 * effect on the public-facing pages that DO use this cache (Browse, Home,
 * etc.) becomes visible within the 60s stale window — an intentional,
 * standard caching tradeoff, not an oversight. A newly-approved publisher
 * appearing in public search a few seconds to a minute later is a
 * reasonable cost for not re-fetching the entire directory on every page
 * visit; a publisher not seeing their OWN edit reflected promptly would
 * actually feel broken, which is the distinction this function exists for.
 */
export function invalidatePublishersCache(): void {
  invalidate(PUBLISHERS_CACHE_KEY);
}

export function usePublishers() {
  const { data, loading, error, refetch } = useQuery<Publisher[]>(
    isSupabaseConfigured ? PUBLISHERS_CACHE_KEY : null,
    fetchApprovedPublishers,
    { staleTimeMs: 60_000 }
  );
  return { publishers: data ?? [], loading, error: error?.message ?? null, refetch };
}

// Pulls currently-featured (and not expired) publishers to the front,
// while keeping the existing publisher_score/trust_score order within
// each group intact — client-side, matching how Browse.tsx already does
// its filtering rather than pushing this into the query itself, which is
// fine at this directory's current size.
function isCurrentlyFeatured(p: Publisher): boolean {
  return p.featured && (!p.featured_until || new Date(p.featured_until) > new Date());
}

function sortFeaturedFirst(list: Publisher[]): Publisher[] {
  const featured = list.filter(isCurrentlyFeatured);
  const rest = list.filter((p) => !isCurrentlyFeatured(p));
  return [...featured, ...rest];
}
