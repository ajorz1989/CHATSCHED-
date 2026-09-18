// Contextual banner shown to a business account on their dashboard while
// activation_fee is unpaid (business_subscriptions.status !== 'active').
// Self-fetching, same convention BusinessDashboardBody's own header
// comment documents for its other children (ManagedCampaignsSection,
// CampaignRollup, MarketingSuite) — nothing needs to be threaded down
// from Dashboard.tsx for this to work at either of its two call sites
// (primary business view, and the publisher opt-in "show my business
// activity" view).
//
// Dismissible for THIS visit only (component state, not persisted) —
// the brief asked for this to appear "on signup or on dashboard login
// while unactivated", i.e. every time they land here unactivated, not
// once ever. A permanent localStorage dismiss would undercut that.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { isSubscriptionUsable } from "../lib/subscriptions";
import { BUSINESS_SUBSCRIPTION_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import type { BusinessSubscription } from "../lib/types";

export default function ActivationNudge() {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || profile?.role !== "business") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("business_subscriptions")
      .select("id, business_id, status, payfast_payment_id, paid_at, created_at")
      .eq("business_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSubscription((data as BusinessSubscription) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile?.role]);

  if (loading || dismissed || profile?.role !== "business") return null;
  if (subscription && isSubscriptionUsable(subscription.status)) return null;

  return (
    <div className="border-[3px] border-billboard-ink bg-billboard-yellow rounded-lg p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="flex-1">
        <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-white px-2 py-1 rounded mb-2">
          Action needed
        </span>
        <h3 className="font-display text-lg mb-1">Activate your account to unlock ChatSched Business</h3>
        <p className="text-sm text-billboard-ink/80">
          A once-off {formatCurrency(BUSINESS_SUBSCRIPTION_PRICE)} activation fee unlocks the Opportunities job
          board, direct publisher messaging, a free AI Content Studio tier, and a launch credit toward your
          first campaign.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/activation-fee-info"
          className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-white font-bold px-4 py-2.5 rounded hover:-translate-y-0.5 transition text-sm whitespace-nowrap"
        >
          Learn Why an Activation Fee is Required & Unlock Features
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
