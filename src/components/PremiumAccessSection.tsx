import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { redirectToPayfast } from "../lib/payfastRedirect";
import { subscriptionStatusInfo, isSubscriptionUsable, type SubscriptionStatus } from "../lib/subscriptions";
import { PREMIUM_ACCESS_NAME, PREMIUM_ACCESS_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";

// Premium access: R199/month via PayFast (recurring), for businesses and
// creators. Unlocks the Opportunities job board and the Marketing Suite.
// Signing up, browsing, listing and booking are all free.

interface Props {
  userId: string;
  role: "business" | "publisher";
}

interface SubscriptionRow {
  status: SubscriptionStatus;
  paid_at: string | null;
  current_period_end: string | null;
}

export default function PremiumAccessSection({ userId, role }: Props) {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const table = role === "business" ? "business_subscriptions" : "publisher_subscriptions";
  const idColumn = role === "business" ? "business_id" : "publisher_id";
  const functionName = role === "business" ? "business-subscribe" : "publisher-subscribe";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from(table).select("status, paid_at, current_period_end").eq(idColumn, userId).maybeSingle();
      if (cancelled) return;
      setSubscription((data as SubscriptionRow) ?? null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, table, idColumn]);

  async function subscribe() {
    setSubscribing(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(functionName, { body: {} });
      setSubscribing(false);
      if (invokeError || data?.error) {
        setError(formatSupabaseError(invokeError || data?.error, "Couldn't start Premium access"));
        return;
      }
      redirectToPayfast(data.action_url, data.fields);
    } catch {
      setSubscribing(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (loading) return null;

  const status = subscription?.status ?? null;
  const info = status ? subscriptionStatusInfo(status) : null;
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const usable = status ? isSubscriptionUsable(status) && (!periodEnd || periodEnd.getTime() > Date.now()) : false;

  const toneClass =
    info?.tone === "positive" ? "text-green-700" : info?.tone === "warning" ? "text-amber-700" : info?.tone === "negative" ? "text-billboard-red" : "text-billboard-inkSoft";

  return (
    <section id="premium" className="border-[3px] border-billboard-ink rounded p-6 mb-6">
      <h2 className="font-display text-lg mb-1.5">{PREMIUM_ACCESS_NAME}</h2>
      <p className="text-sm text-billboard-inkSoft mb-4">
        {formatCurrency(PREMIUM_ACCESS_PRICE)} per month. Unlocks the Opportunities job board and the Marketing Suite. Everything else on ChatSched is free, including booking. Cancel any time on PayFast.
      </p>

      {status && (
        <p className={`text-sm font-semibold mb-3 ${toneClass}`}>
          Status: {usable ? "Active" : info?.label}
          {usable && periodEnd ? ` — paid up to ${periodEnd.toLocaleDateString("en-ZA")}` : ""}
        </p>
      )}

      {error && <p className="text-billboard-red text-xs font-semibold mb-3">{error}</p>}

      {!usable && (
        <button
          onClick={subscribe}
          disabled={subscribing}
          className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm disabled:opacity-60 w-fit"
        >
          {subscribing ? "Starting…" : `Get Premium access: ${formatCurrency(PREMIUM_ACCESS_PRICE)}/month`}
        </button>
      )}

      {usable && (
        <p className="text-xs text-billboard-inkSoft">
          You have Premium access. It renews monthly through PayFast; to stop it, cancel the subscription in your PayFast account.
        </p>
      )}
    </section>
  );
}
