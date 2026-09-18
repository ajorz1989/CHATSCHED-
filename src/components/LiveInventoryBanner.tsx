import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * 12-Channel Audit fix D2 — a real, honest "live inventory" signal on
 * channel hub pages. The audit's own example copy ("3 radio stations have
 * availability this week") implies per-slot/per-week booking-calendar
 * data that doesn't exist anywhere in this codebase (AvailabilityConfig,
 * channelTypes.ts, only models lead-time/campaign-length CONSTRAINTS, not
 * actual real-time slot counts) — inventing that number would mean
 * fabricating data with nothing real behind it. What IS real and
 * queryable: how many approved, active publishers exist on this channel
 * right now. Shown as that, not dressed up as fake urgency it can't back
 * up.
 */
export default function LiveInventoryBanner({ channelSlug }: { channelSlug: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("publishers_public")
      .select("id", { count: "exact", head: true })
      .eq("channel_slug", channelSlug)
      .then(({ count: c }) => {
        if (!cancelled) setCount(c ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [channelSlug]);

  if (count === null || count === 0) return null;

  return (
    <div className="inline-flex items-center gap-2 border-2 border-billboard-green text-billboard-greenDeep bg-billboard-green/10 rounded-full px-3 py-1.5 text-sm font-semibold mb-4">
      <span className="w-2 h-2 rounded-full bg-billboard-green animate-pulse" />
      {count} verified publisher{count === 1 ? "" : "s"} live on this channel right now
    </div>
  );
}
