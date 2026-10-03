import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PublisherRateCard } from "../lib/types";

/** A publisher's rate card line items (publicly readable). null = still loading. */
export function useRateCardItems(publisherId: string): PublisherRateCard[] | null {
  const [items, setItems] = useState<PublisherRateCard[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("publisher_rate_cards")
      .select("*")
      .eq("publisher_id", publisherId)
      .order("sort_order")
      .order("created_at")
      .then(({ data }) => { if (!cancelled) setItems((data as PublisherRateCard[]) ?? []); });
    return () => { cancelled = true; };
  }, [publisherId]);
  return items;
}
