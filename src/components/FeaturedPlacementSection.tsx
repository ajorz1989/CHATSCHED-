import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { redirectToPayfast } from "../lib/payfastRedirect";
import { FEATURED_PLACEMENT_MONTHLY_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";

/**
 * Self-serve R99/month Featured Placement purchase for a publisher's own
 * listing — item 10's "Secondary placements: from R99/month"
 * (schema_phase87_featured_placement_subscriptions.sql). Genuinely
 * recurring, unlike ChatSched Publisher Network membership above it —
 * this is the one product that still bills monthly after item 10's
 * once-off conversion.
 *
 * No self-serve cancel button here on purpose: cancel-subscription's own
 * header comment flags that it doesn't call PayFast's recurring-cancel
 * API for this product yet, so wiring a self-serve cancel button ahead of
 * that would let a publisher believe they've stopped a charge that
 * PayFast may still attempt. "Contact us to cancel" is the honest
 * interim state, same posture Content Studio's own unwired "cancel any
 * time" copy already takes elsewhere in this codebase.
 */
export default function FeaturedPlacementSection({ publisherId }: { publisherId: string }) {
  const [status, setStatus] = useState<"pending" | "active" | "past_due" | "cancelled" | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("featured_placement_subscriptions")
      .select("status, current_period_end")
      .eq("publisher_id", publisherId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setStatus(data?.status ?? null);
        setCurrentPeriodEnd(data?.current_period_end ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publisherId]);

  async function subscribe() {
    setSubscribing(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("featured-placement-subscribe", { body: {} });
    setSubscribing(false);
    if (invokeError || data?.error) {
      setError(formatSupabaseError(invokeError || data?.error, "Couldn't start Featured Placement"));
      return;
    }
    redirectToPayfast(data.action_url, data.fields);
  }

  if (loading) return null;

  return (
    <section className="border-[3px] border-billboard-ink rounded p-6 mb-6">
      <h2 className="font-display text-lg mb-1.5">Featured Placement</h2>
      <p className="text-sm text-billboard-inkSoft mb-4">
        {formatCurrency(FEATURED_PLACEMENT_MONTHLY_PRICE)}/month — boosted ranking and a Featured badge on your marketplace listing. Billed monthly via PayFast.
      </p>

      {status === "active" && (
        <p className="text-sm font-semibold text-green-700 mb-3">
          Active{currentPeriodEnd ? ` — renews ${new Date(currentPeriodEnd).toLocaleDateString("en-ZA")}` : ""}. To cancel, contact us.
        </p>
      )}
      {status === "past_due" && <p className="text-sm font-semibold text-billboard-red mb-3">Payment failed — your listing isn't Featured right now.</p>}
      {status === "cancelled" && <p className="text-sm text-billboard-inkSoft mb-3">Cancelled.</p>}

      {error && <p className="text-billboard-red text-xs font-semibold mb-3">{error}</p>}

      {status !== "active" && (
        <button
          onClick={subscribe}
          disabled={subscribing}
          className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white disabled:opacity-60"
        >
          {subscribing ? "Starting…" : `Get Featured — ${formatCurrency(FEATURED_PLACEMENT_MONTHLY_PRICE)}/month`}
        </button>
      )}
    </section>
  );
}
