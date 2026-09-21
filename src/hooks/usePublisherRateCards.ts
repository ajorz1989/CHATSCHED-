import { useQuery } from "./useQuery";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";

// Which publishers have published at least one rate card line item
// (publisher_rate_cards, schema_phase38_rate_cards.sql — publicly
// readable, same as the rest of a listing). Browse's own price filter
// and sort already reflect rate-card pricing indirectly, since
// price_per_post is kept in sync with the cheapest line item by that
// migration's trigger — what's missing, and what this hook is for, is
// letting a business filter for "has published structured pricing at
// all" as its own signal: a publisher who bothered to break out Story
// vs Reel vs bundle pricing is telling you more about how they'd work
// with you than one flat number does.
//
// Only publisher_id is selected (not price/label/description) since all
// this needs is a membership check — fetching full rate card rows for
// every publisher just to compute a boolean would be wasteful.
const RATE_CARD_PUBLISHER_IDS_CACHE_KEY = "rate_cards:publisher_ids";

async function fetchRateCardPublisherIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("publisher_rate_cards")
    .select("publisher_id");
  if (error) throw new Error(formatSupabaseError(error, "Couldn't load rate card data"));
  return new Set((data ?? []).map((r) => r.publisher_id as string));
}

export function usePublisherRateCards() {
  const { data, loading, error } = useQuery<Set<string>>(
    isSupabaseConfigured ? RATE_CARD_PUBLISHER_IDS_CACHE_KEY : null,
    fetchRateCardPublisherIds,
    { staleTimeMs: 60_000 }
  );
  return { rateCardPublisherIds: data ?? new Set<string>(), loading, error: error?.message ?? null };
}
