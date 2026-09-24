import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { redirectToPayfast } from "../../lib/payfastRedirect";
import { setContentStudioDraft } from "../../lib/contentStudioDraft";
import { formatCurrency } from "../../lib/currency";
import { isSubscriptionUsable } from "../../lib/subscriptions";
import {
  CONTENT_STUDIO_MONTHLY_PRICE,
  CONTENT_STUDIO_DAILY_LIMIT,
  CONTENT_STUDIO_MONTHLY_LIMIT,
  CONTENT_STUDIO_FREE_MONTHLY_LIMIT,
  CONTENT_STUDIO_FREE_DAILY_LIMIT,
} from "../../lib/constants";
import type { ContentStudioSubscription, BusinessSubscription } from "../../lib/types";
import { SkeletonBlock } from "../Skeleton";

const PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "whatsapp", label: "WhatsApp" },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

/**
 * Caption Writer generates one ready-to-post caption at a time from a
 * promotion brief. It calls the same content-studio-generate edge function
 * (and Anthropic key) as AI Content Studio, requesting just the one format
 * the person picked, rather than a separate provider/quota system — it's
 * the same job (brief → platform copy) at the same cost per call, so a
 * second quota here would just let a business double their real generation
 * limit by using both tools. That also means the same activation-fee /
 * subscription gate content-studio-generate already enforces server-side
 * applies here — see that function's header comment.
 */
export default function CaptionWriter() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState<ContentStudioSubscription | null>(null);
  const [activation, setActivation] = useState<BusinessSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [platform, setPlatform] = useState<PlatformId>("facebook");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ today: number; dailyLimit: number; month: number; monthlyLimit: number } | null>(null);
  const [tier, setTier] = useState<"subscription" | "free_activation" | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isSubscribed = isAdmin || Boolean(subscription?.status === "active" && subscription.current_period_end && new Date(subscription.current_period_end) > new Date());
  const isActivated = activation ? isSubscriptionUsable(activation.status) : false;
  const isActive = Boolean(isSubscribed || isActivated);
  const activeTier: "subscription" | "free_activation" | null = isSubscribed ? "subscription" : isActivated ? "free_activation" : null;

  async function loadSubscription() {
    if (!user) return;
    setLoadingSub(true);
    const [{ data }, { data: activationData }] = await Promise.all([
      supabase.from("content_studio_subscriptions").select("*").eq("business_id", user.id).maybeSingle(),
      supabase.from("business_subscriptions").select("id, business_id, status, payfast_payment_id, paid_at, created_at").eq("business_id", user.id).maybeSingle(),
    ]);
    setSubscription((data ?? null) as ContentStudioSubscription | null);
    setActivation((activationData ?? null) as BusinessSubscription | null);
    setLoadingSub(false);
  }

  useEffect(() => {
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function subscribe() {
    setSubscribing(true);
    setSubscribeError(null);
    try {
      const { data, error } = await supabase.functions.invoke("content-studio-subscribe", { body: {} });
      setSubscribing(false);
      if (error || data?.error) {
        setSubscribeError(data?.error ?? "Couldn't start the subscription — try again in a moment.");
        return;
      }
      redirectToPayfast(data.action_url, data.fields);
    } catch {
      // A genuine network failure throws here instead of returning an
      // { error } result — without this, setSubscribing(false) never
      // runs and the button is stuck disabled with no way to retry short
      // of a refresh. See ContentStudio.tsx / AuthContext.tsx.
      setSubscribing(false);
      setSubscribeError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || generating) return;

    setGenerating(true);
    setGenError(null);
    setCaption(null);

    const prompt = imageNote.trim()
      ? `${description.trim()}\n\nCreative note: ${imageNote.trim()}`
      : description.trim();

    const { data, error } = await supabase.functions.invoke("content-studio-generate", {
      body: {
        prompt,
        formats: [platform],
        businessName: profile?.company_name || profile?.full_name || undefined,
        industry: profile?.industry || undefined,
      },
    });

    setGenerating(false);

    if (error || data?.error) {
      if (data?.needsActivation) {
        // Neither an active subscription nor an active activation fee —
        // re-check both rather than guessing which one lapsed.
        loadSubscription();
      }
      setGenError(data?.error ?? "Couldn't generate a caption — try again in a moment.");
      return;
    }

    setCaption(data.results?.[platform] ?? null);
    setUsage(data.usage ?? null);
    setTier(data.tier ?? null);
  }

  function copyCaption() {
    if (!caption) return;
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function sendToCreator() {
    if (!caption) return;
    setContentStudioDraft(caption);
    navigate("/browse");
  }

  if (loadingSub) {
    return <SkeletonBlock className="h-40" />;
  }

  if (!isActive) {
    return (
      <div className="border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 bg-billboard-paperDim">
        <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-yellow px-2.5 py-1 rounded mb-3">Caption Writer</span>
        <h3 className="font-display text-xl mb-2">Describe a promotion. Get one ready-to-post caption.</h3>
        <p className="text-sm text-billboard-inkSoft mb-5 max-w-lg">
          Caption Writer runs on the same generator, quota and pricing as AI Content Studio — activating one
          activates both. Want several formats from one photo at once instead? Use AI Content Studio above.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={subscribe}
            disabled={subscribing}
            className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {subscribing ? "Redirecting…" : `Subscribe — ${formatCurrency(CONTENT_STUDIO_MONTHLY_PRICE)}/month`}
          </button>
          {subscription?.status === "past_due" && <span className="text-xs font-semibold text-billboard-red">Your last payment didn't go through — subscribe again to reactivate.</span>}
          {subscription?.status === "cancelled" && <span className="text-xs text-billboard-inkSoft">Your subscription was cancelled — resubscribe any time.</span>}
        </div>
        {subscribeError && <p className="text-billboard-red text-xs font-semibold mt-3">{subscribeError}</p>}
        <p className="text-xs text-billboard-inkSoft mt-4">
          Billed monthly via PayFast, cancel any time. Fair-use limits apply ({CONTENT_STUDIO_DAILY_LIMIT}/day, {CONTENT_STUDIO_MONTHLY_LIMIT}/month) to keep it sustainable for everyone.
        </p>
        <p className="text-xs text-billboard-inkSoft mt-2">
          Already paid your once-off ChatSched Business activation fee? That alone unlocks a free tier
          ({CONTENT_STUDIO_FREE_MONTHLY_LIMIT}/month) — no subscription needed.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs text-billboard-inkSoft">
          {activeTier === "subscription" ? "Active subscription" : "Free tier (via activation fee)"} — shared with AI Content Studio ·{" "}
          {usage
            ? `${usage.today}/${usage.dailyLimit} today · ${usage.month}/${usage.monthlyLimit} this month`
            : activeTier === "subscription"
            ? `up to ${CONTENT_STUDIO_DAILY_LIMIT}/day`
            : `up to ${CONTENT_STUDIO_FREE_DAILY_LIMIT}/day, ${CONTENT_STUDIO_FREE_MONTHLY_LIMIT}/month`}
        </p>
        {activeTier === "free_activation" && (
          <button
            onClick={subscribe}
            disabled={subscribing}
            className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:bg-billboard-paperDim transition disabled:opacity-60 whitespace-nowrap"
          >
            {subscribing ? "Redirecting…" : `Upgrade — ${formatCurrency(CONTENT_STUDIO_MONTHLY_PRICE)}/mo for more`}
          </button>
        )}
      </div>
      {activeTier === "free_activation" && subscribeError && <p className="text-billboard-red text-xs font-semibold -mt-2 mb-4">{subscribeError}</p>}

      <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Promotion / offer</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. 2-for-1 large pizzas this Friday — dine-in or collection only"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Image / creative note (optional)</label>
          <input
            type="text"
            value={imageNote}
            onChange={(e) => setImageNote(e.target.value)}
            placeholder="Describe the image — helps the AI match the caption to it"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
          />
          <p className="text-[11px] text-billboard-inkSoft mt-1">
            Want to generate straight from an uploaded photo? Use AI Content Studio instead.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`font-mono text-xs border-2 border-billboard-ink rounded-full px-3 py-1.5 transition ${
                  platform === p.id ? "bg-billboard-ink text-white" : "bg-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {genError && <p className="text-billboard-red text-sm font-semibold">{genError}</p>}

        <button
          type="submit"
          disabled={!description.trim() || generating}
          className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
        >
          {generating ? "Generating…" : "Generate caption"}
        </button>
      </form>

      {caption && (
        <div className="mt-5 border-2 border-billboard-ink rounded p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">
              {PLATFORMS.find((p) => p.id === platform)?.label ?? platform}
              {tier && ` · ${tier === "subscription" ? "subscription tier" : "free activation tier"}`}
            </span>
            <div className="flex gap-2 shrink-0">
              <button onClick={copyCaption} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1 hover:bg-billboard-paperDim transition">
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button onClick={sendToCreator} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink bg-billboard-green text-white rounded px-2.5 py-1 hover:bg-billboard-greenDeep transition">
                Send to Creator
              </button>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap">{caption}</p>
        </div>
      )}
    </div>
  );
}
