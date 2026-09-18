import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { redirectToPayfast } from "../lib/payfastRedirect";
import { subscriptionStatusInfo, isSubscriptionUsable, type SubscriptionStatus } from "../lib/subscriptions";
import { PUBLISHER_SUBSCRIPTION_PRICE, BUSINESS_SUBSCRIPTION_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";

// Once-off activation, no renewal, ever (item 10,
// schema_phase86_once_off_activation_pricing.sql) — this used to also
// show a "renews <date>" line and a self-service "Cancel subscription"
// flow (calling cancel-subscription, which itself called PayFast's
// recurring-cancel API). Neither makes sense once there's a single
// payment and no recurring token: there's nothing recurring to cancel,
// so cancel-subscription is now an admin-only revoke action instead
// (see that function's own header comment) with no self-service UI here.

interface Props {
  userId: string;
  role: "business" | "publisher";
}

interface SubscriptionRow {
  status: SubscriptionStatus;
  paid_at: string | null;
}

interface CreditRow {
  amount: number;
  remaining: number;
}

export default function SubscriptionSection({ userId, role }: Props) {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [credit, setCredit] = useState<CreditRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const table = role === "business" ? "business_subscriptions" : "publisher_subscriptions";
  const idColumn = role === "business" ? "business_id" : "publisher_id";
  const functionName = role === "business" ? "business-subscribe" : "publisher-subscribe";
  const price = role === "business" ? BUSINESS_SUBSCRIPTION_PRICE : PUBLISHER_SUBSCRIPTION_PRICE;
  const label = role === "business" ? "ChatSched Business" : "ChatSched Publisher Network";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from(table).select("status, paid_at").eq(idColumn, userId).maybeSingle();
      if (cancelled) return;
      setSubscription((data as SubscriptionRow) ?? null);

      if (role === "business") {
        const { data: creditData } = await supabase
          .from("business_launch_credits")
          .select("amount, remaining")
          .eq("business_id", userId)
          .maybeSingle();
        if (!cancelled) setCredit((creditData as CreditRow) ?? null);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, role, table, idColumn]);

  async function activate() {
    setSubscribing(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(functionName, { body: {} });
      setSubscribing(false);
      if (invokeError || data?.error) {
        setError(formatSupabaseError(invokeError || data?.error, "Couldn't start activation"));
        return;
      }
      redirectToPayfast(data.action_url, data.fields);
    } catch {
      // A genuine network failure throws here instead of returning an
      // { error } result — without this, setSubscribing(false) above
      // never runs and the button is stuck disabled with no way to retry
      // short of a refresh. See AuthContext.tsx for the same pattern.
      setSubscribing(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (loading) return null;

  const status = subscription?.status ?? null;
  const info = status ? subscriptionStatusInfo(status) : null;
  const usable = status ? isSubscriptionUsable(status) : false;

  const toneClass =
    info?.tone === "positive"
      ? "text-green-700"
      : info?.tone === "warning"
      ? "text-amber-700"
      : info?.tone === "negative"
      ? "text-billboard-red"
      : "text-billboard-inkSoft";

  return (
    <section className="border-[3px] border-billboard-ink rounded p-6 mb-6">
      <h2 className="font-display text-lg mb-1.5">{label}</h2>
      <p className="text-sm text-billboard-inkSoft mb-4">
        {formatCurrency(price)} once-off activation — no renewal, ever.
        {role === "business" && " Includes a R199 launch credit toward your first campaign."}
      </p>

      {status && (
        <p className={`text-sm font-semibold mb-3 ${toneClass}`}>
          Status: {info?.label}
          {subscription?.paid_at && usable ? ` — activated ${new Date(subscription.paid_at).toLocaleDateString("en-ZA")}` : ""}
        </p>
      )}

      {role === "business" && credit && (
        <p className="text-sm text-billboard-inkSoft mb-4">
          Launch credit: {formatCurrency(Number(credit.remaining), { cents: true })} of {formatCurrency(Number(credit.amount), { cents: true })} remaining
        </p>
      )}

      {error && <p className="text-billboard-red text-xs font-semibold mb-3">{error}</p>}

      {!usable && (
        <button
          onClick={activate}
          disabled={subscribing}
          className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white disabled:opacity-60"
        >
          {subscribing ? "Starting…" : status ? "Retry payment" : `Activate — ${formatCurrency(price)} once-off`}
        </button>
      )}

      {usable && (
        <p className="text-xs text-billboard-inkSoft">
          You're activated — this is a one-time fee, so there's nothing to renew or cancel. Contact us if anything about your account needs to change.
        </p>
      )}
    </section>
  );
}
