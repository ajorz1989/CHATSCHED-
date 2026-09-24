// Unlisted route — /activation-fee-info. Deliberately not linked from
// Header.tsx or Footer.tsx (neither auto-generates nav from routes, so
// simply not adding a link here is enough to keep it out of the main
// nav; RequireAuth below is the real access control, "unlisted" is just
// about not surfacing it in the primary IA). Reached via ActivationNudge
// on the dashboard, or a direct link.
import { useEffect, useState } from "react";
import BankDetailsPanel from "../components/BankDetailsPanel";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { redirectToPayfast } from "../lib/payfastRedirect";
import { subscriptionStatusInfo, isSubscriptionUsable } from "../lib/subscriptions";
import { BUSINESS_SUBSCRIPTION_PRICE, BUSINESS_LAUNCH_CREDIT_AMOUNT } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import Seo from "../components/Seo";
import { SkeletonBlock } from "../components/Skeleton";
import type { BusinessSubscription } from "../lib/types";

interface CreditRow {
  amount: number;
  remaining: number;
}

export default function ActivationFeeInfo() {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [credit, setCredit] = useState<CreditRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eftReference, setEftReference] = useState<string | null>(null);
  const [eftNote, setEftNote] = useState("");
  const [eftSubmitting, setEftSubmitting] = useState(false);
  const [eftSubmitted, setEftSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const [{ data: sub }, { data: creditData }] = await Promise.all([
        supabase.from("business_subscriptions").select("*").eq("business_id", user!.id).maybeSingle(),
        supabase.from("business_launch_credits").select("amount, remaining").eq("business_id", user!.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setSubscription((sub as BusinessSubscription) ?? null);
      setCredit((creditData as CreditRow) ?? null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function activate() {
    setActivating(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("business-subscribe", { body: {} });
      setActivating(false);
      if (invokeError || data?.error) {
        setError(formatSupabaseError(invokeError || data?.error, "Couldn't start activation"));
        return;
      }
      if (!data?.action_url || !data?.fields?.merchant_id || !data?.fields?.signature) {
        setError("PayFast checkout could not be prepared. You can use the EFT option below instead.");
        return;
      }
      try {
        redirectToPayfast(data.action_url, data.fields);
      } catch {
        setError("PayFast checkout could not be opened. You can use the EFT option below instead.");
      }
    } catch {
      // A genuine network failure throws here instead of returning an
      // { error } result — same pattern as SubscriptionSection.tsx.
      setActivating(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  async function startEft() {
    if (!user || !subscription?.id) {
      setError("Your activation session has not finished loading. Please refresh and try again.");
      return;
    }
    setEftSubmitting(true);
    setError(null);
    const reference = `CHS-ACT-${user.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const { error: eftError } = await supabase.from("business_activation_eft_payments").insert({
      business_id: user.id,
      subscription_id: subscription.id,
      amount: Number(BUSINESS_SUBSCRIPTION_PRICE),
      reference,
      note: eftNote.trim() || null,
    });
    setEftSubmitting(false);
    if (eftError) {
      setError(formatSupabaseError(eftError, "Couldn't start the EFT payment option"));
      return;
    }
    setEftReference(reference);
    setEftSubmitted(true);
  }

  const status = subscription?.status ?? null;
  const info = status ? subscriptionStatusInfo(status) : null;
  const activated = status ? isSubscriptionUsable(status) : false;

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Why ChatSched Business Requires Activation" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Account activation
      </span>
      <h1 className="font-display text-2xl md:text-3xl mb-3">
        Why ChatSched Business charges a once-off activation fee
      </h1>
      <p className="text-billboard-inkSoft mb-10 max-w-2xl">
        A one-time {formatCurrency(BUSINESS_SUBSCRIPTION_PRICE)} activation fee — never billed again — stands
        between your account and the parts of ChatSched that involve real publishers, real money, and real
        campaign bookings. Here's exactly what it's for and what it unlocks.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="border-[3px] border-billboard-ink rounded p-5">
          <h2 className="font-display text-base mb-2">Verification & anti-spam</h2>
          <p className="text-sm text-billboard-inkSoft">
            A real payment is the single strongest signal that a business account belongs to a real,
            operating South African SMME — not a throwaway account created to spam publishers with fake
            job briefs or scrape the opportunities board.
          </p>
        </div>
        <div className="border-[3px] border-billboard-ink rounded p-5">
          <h2 className="font-display text-base mb-2">Platform setup & security</h2>
          <p className="text-sm text-billboard-inkSoft">
            Covers the one-time work of setting up your account properly: your secure escrow arrangement
            for campaign payments, and a manual review of your profile before you can transact with
            publishers on the marketplace.
          </p>
        </div>
        <div className="border-[3px] border-billboard-ink rounded p-5">
          <h2 className="font-display text-base mb-2">What it unlocks</h2>
          <ul className="text-sm text-billboard-inkSoft space-y-1.5 list-disc pl-4">
            <li>The gated Opportunities job board</li>
            <li>Direct messaging with publishers</li>
            <li>AI Content Studio (a free monthly tier — see below)</li>
            <li>A {formatCurrency(BUSINESS_LAUNCH_CREDIT_AMOUNT)} launch credit toward your first campaign, included in the fee</li>
          </ul>
        </div>
      </div>

      <p className="text-xs text-billboard-inkSoft mb-10 max-w-2xl">
        This is a once-off fee, not a subscription — there's nothing to renew and nothing that lapses.
        {" "}AI Content Studio's paid R99/month tier (higher limits, a stronger model) is a separate,
        optional product on top of activation — activation alone already unlocks a smaller free tier of it.
      </p>

      <h2 className="font-display text-lg mb-4">Your account</h2>

      {loading || !profile ? (
        <SkeletonBlock className="h-56" />
      ) : (
        <div className="border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 bg-billboard-paperDim">
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm mb-6">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">Company name</dt>
              <dd className="font-semibold">{profile.company_name || profile.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">Business type</dt>
              <dd className="font-semibold">{profile.business_type || profile.industry || "Not yet set"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">Contact email</dt>
              <dd className="font-semibold">{user?.email || "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">Verification status</dt>
              <dd className="font-semibold">{profile.business_verified ? "✓ Verified" : "Not yet Gold verified"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">Account created</dt>
              <dd className="font-semibold">{new Date(profile.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1">Activation status</dt>
              <dd className={`font-semibold ${info?.tone === "positive" ? "text-billboard-green" : info?.tone === "negative" ? "text-billboard-red" : "text-billboard-inkSoft"}`}>
                {info?.label ?? "Not started"}
                {subscription?.paid_at && activated ? ` · ${new Date(subscription.paid_at).toLocaleDateString("en-ZA")}` : ""}
              </dd>
            </div>
          </dl>

          {credit && (
            <p className="text-sm text-billboard-inkSoft mb-5">
              Launch credit: {formatCurrency(Number(credit.remaining), { cents: true })} of {formatCurrency(Number(credit.amount), { cents: true })} remaining
            </p>
          )}

          {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}

          {activated ? (
            <p className="text-sm text-billboard-inkSoft">
              You're activated — every feature above is already unlocked on your account. Nothing further to do.
            </p>
          ) : (
            <>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={activate}
                disabled={activating || eftSubmitting}
                className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
              >
                {activating ? "Opening PayFast…" : `Pay Online — ${formatCurrency(BUSINESS_SUBSCRIPTION_PRICE)} once-off`}
              </button>
              <button
                onClick={() => { setError(null); document.getElementById("eft-fallback")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                disabled={activating || eftSubmitting}
                className="bg-white border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
              >
                Pay by EFT instead
              </button>
            </div>

            <div id="eft-fallback" className="mt-6 border-2 border-billboard-ink rounded-lg p-5 bg-white">
              <h3 className="font-display text-lg mb-2">Manual EFT fallback</h3>
              <p className="text-sm text-billboard-inkSoft mb-4">
                If PayFast does not open or you prefer a bank transfer, declare your EFT here first.
                ChatSched will keep your activation pending until an admin verifies the payment has arrived.
              </p>

              {!eftSubmitted ? (
                <>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Optional payment note</label>
                  <textarea
                    value={eftNote}
                    onChange={(e) => setEftNote(e.target.value)}
                    rows={2}
                    placeholder="For example: EFT made from ABC Business account"
                    className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm resize-y mb-4"
                  />
                  <button
                    onClick={startEft}
                    disabled={eftSubmitting}
                    className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
                  >
                    {eftSubmitting ? "Creating EFT instruction…" : "Continue with EFT"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold mb-4">
                    EFT instruction created. Use the reference below exactly, then wait for ChatSched to verify the transfer.
                  </p>
                  <BankDetailsPanel amount={BUSINESS_SUBSCRIPTION_PRICE} reference={eftReference!} />
                  <p className="text-xs text-billboard-inkSoft mt-4">
                    Do not consider the account activated until the activation status changes to Active.
                  </p>
                </>
              )}
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
