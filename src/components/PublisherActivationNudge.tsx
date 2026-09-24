import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { isSubscriptionUsable } from "../lib/subscriptions";
import { PUBLISHER_SUBSCRIPTION_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import type { PublisherSubscription } from "../lib/types";

export default function PublisherActivationNudge() {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<PublisherSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || profile?.role !== "publisher") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("publisher_subscriptions")
      .select("id, publisher_id, status, payfast_payment_id, paid_at, created_at")
      .eq("publisher_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSubscription((data as PublisherSubscription) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile?.role]);

  if (loading || dismissed || profile?.role !== "publisher") return null;
  if (subscription && isSubscriptionUsable(subscription.status)) return null;

  return (
    <div className="border-[3px] border-billboard-ink bg-billboard-yellow rounded-lg p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="flex-1">
        <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-white px-2 py-1 rounded mb-2">
          Action needed
        </span>
        <h3 className="font-display text-lg mb-1">Activate to accept bookings</h3>
        <p className="text-sm text-billboard-ink/80">
          You're listed and visible to businesses, but a once-off {formatCurrency(PUBLISHER_SUBSCRIPTION_PRICE)} activation
          fee unlocks accepting or countering real bookings, and applying to Opportunities.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/account"
          className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-white font-bold px-4 py-2.5 rounded hover:-translate-y-0.5 transition text-sm whitespace-nowrap"
        >
          Activate now
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs font-semibold text-billboard-ink/70 hover:text-billboard-ink underline whitespace-nowrap"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
