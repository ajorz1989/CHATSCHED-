import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { redirectToPayfast } from "../../lib/payfastRedirect";
import { setContentStudioDraft } from "../../lib/contentStudioDraft";
import { formatCurrency } from "../../lib/currency";
import { isSubscriptionUsable } from "../../lib/subscriptions";
import {
  CONTENT_STUDIO_FORMATS,
  CONTENT_STUDIO_MONTHLY_PRICE,
  CONTENT_STUDIO_DAILY_LIMIT,
  CONTENT_STUDIO_MONTHLY_LIMIT,
  CONTENT_STUDIO_FREE_MONTHLY_LIMIT,
  CONTENT_STUDIO_FREE_DAILY_LIMIT,
} from "../../lib/constants";
import type { ContentStudioSubscription, BusinessSubscription } from "../../lib/types";
import { SkeletonBlock } from "../Skeleton";

const DEFAULT_FORMAT_IDS = CONTENT_STUDIO_FORMATS.map((f) => f.id);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Results = Record<string, string>;

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(",");
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ContentStudio() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState<ContentStudioSubscription | null>(null);
  // The once-off ChatSched Business activation fee (business_subscriptions,
  // schema_phase86) — checked alongside the R99/month Content Studio
  // subscription above because activation alone now unlocks a free tier
  // of Content Studio (schema_phase103). See content-studio-generate's
  // own header comment for why this is two tiers rather than one.
  const [activation, setActivation] = useState<BusinessSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(DEFAULT_FORMAT_IDS);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [usage, setUsage] = useState<{ today: number; dailyLimit: number; month: number; monthlyLimit: number } | null>(null);
  const [tier, setTier] = useState<"subscription" | "free_activation" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === "admin";
  const isSubscribed = isAdmin || (subscription?.status === "active" && subscription.current_period_end && new Date(subscription.current_period_end) > new Date());
  const isActivated = activation ? isSubscriptionUsable(activation.status) : false;
  // A subscription is the better tier — same "activation is a floor, not
  // a ceiling" rule the edge function applies.
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
      // of a refresh. See AuthContext.tsx for the same pattern.
      setSubscribing(false);
      setSubscribeError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  function toggleFormat(id: string) {
    setSelectedFormats((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setGenError("That photo is too large — try one under 5MB.");
      return;
    }
    setGenError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleGenerate() {
    if (!prompt.trim() && !imageFile) {
      setGenError("Upload a photo or tell us what you'd like posted.");
      return;
    }
    if (selectedFormats.length === 0) {
      setGenError("Pick at least one format.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    setResults(null);

    let imageBase64: string | undefined;
    let imageMediaType: string | undefined;
    if (imageFile) {
      try {
        const encoded = await fileToBase64(imageFile);
        imageBase64 = encoded.base64;
        imageMediaType = encoded.mediaType;
      } catch {
        setGenerating(false);
        setGenError("Couldn't read that photo — try a different file.");
        return;
      }
    }

    const { data, error } = await supabase.functions.invoke("content-studio-generate", {
      body: {
        prompt: prompt.trim(),
        formats: selectedFormats,
        imageBase64,
        imageMediaType,
        businessName: profile?.company_name || profile?.full_name || undefined,
        industry: profile?.industry || undefined,
      },
    });

    setGenerating(false);

    if (error || data?.error) {
      if (data?.needsActivation) {
        // Neither an active subscription nor an active activation fee —
        // re-check both on the next render rather than guessing which
        // one lapsed.
        loadSubscription();
      }
      setGenError(data?.error ?? "Couldn't generate content — try again in a moment.");
      return;
    }

    setResults(data.results);
    setUsage(data.usage ?? null);
    setTier(data.tier ?? null);
  }

  function copyResult(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    });
  }

  function sendToCreator(text: string) {
    setContentStudioDraft(text);
    navigate("/browse");
  }

  if (loadingSub) {
    return <SkeletonBlock className="h-40" />;
  }

  if (!isActive) {
    return (
      <div>
        <div className="border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 bg-billboard-paperDim">
          <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-yellow px-2.5 py-1 rounded mb-3">AI Content Studio</span>
          <h3 className="font-display text-xl mb-2">Upload a photo. Get 9 ready-to-post pieces of content.</h3>
          <p className="text-sm text-billboard-inkSoft mb-5 max-w-lg">
            Upload one photo — or just describe what you want — and get a Facebook post, Instagram caption, LinkedIn post, TikTok caption, WhatsApp status, X post, Google Business Profile update, blog article, and email newsletter, all generated together. Copy anything straight to a creator's request.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-6">
            {CONTENT_STUDIO_FORMATS.map((f) => (
              <span key={f.id} className="font-mono text-[10px] border border-billboard-ink rounded-full px-2 py-1 bg-white">{f.label}</span>
            ))}
          </div>
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
          <p className="text-xs text-billboard-inkSoft mt-4">Billed monthly via PayFast, cancel any time. Fair-use limits apply ({CONTENT_STUDIO_DAILY_LIMIT}/day, {CONTENT_STUDIO_MONTHLY_LIMIT}/month) to keep it sustainable for everyone.</p>
          <p className="text-xs text-billboard-inkSoft mt-2">
            Already paid your once-off ChatSched Business activation fee? That alone unlocks a free tier
            ({CONTENT_STUDIO_FREE_MONTHLY_LIMIT}/month) — no subscription needed.{" "}
            <Link to="/activation-fee-info" className="font-semibold underline">Check your activation status →</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-display text-lg">Create content</h3>
          <p className="text-xs text-billboard-inkSoft mt-0.5">
            {activeTier === "subscription" ? "Active subscription" : "Free tier (via activation fee)"} ·{" "}
            {usage
              ? `${usage.today}/${usage.dailyLimit} today · ${usage.month}/${usage.monthlyLimit} this month`
              : activeTier === "subscription"
              ? `up to ${CONTENT_STUDIO_DAILY_LIMIT}/day`
              : `up to ${CONTENT_STUDIO_FREE_DAILY_LIMIT}/day, ${CONTENT_STUDIO_FREE_MONTHLY_LIMIT}/month`}
          </p>
        </div>
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
      {activeTier === "free_activation" && subscribeError && <p className="text-billboard-red text-xs font-semibold -mt-3 mb-4">{subscribeError}</p>}

      <div className="border-[3px] border-billboard-ink rounded p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Upload a photo (optional)</label>
          {imagePreview ? (
            <div className="flex items-center gap-3">
              {/* Deliberately no loading="lazy" — this is a local blob: URL
                  preview of a file the user just picked, rendered directly
                  inside the open form. It's already on screen the instant
                  it exists; there's no off-screen deferral to gain. */}
              <img src={imagePreview} alt="Upload preview" className="w-20 h-20 object-cover rounded border-2 border-billboard-ink" />
              <button type="button" onClick={clearImage} className="font-mono text-xs font-semibold underline text-billboard-inkSoft">Remove photo</button>
            </div>
          ) : (
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Tell the AI what you want{imageFile ? " (optional — the photo already helps)" : ""}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Announcing our new winter menu, launching this Friday, dine-in and collection"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Formats to generate</label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_STUDIO_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                title={f.hint}
                onClick={() => toggleFormat(f.id)}
                className={`font-mono text-xs border-2 border-billboard-ink rounded-full px-3 py-1.5 transition ${selectedFormats.includes(f.id) ? "bg-billboard-ink text-white" : "bg-white"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {genError && <p className="text-billboard-red text-sm font-semibold">{genError}</p>}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
        >
          {generating ? "Generating…" : "Generate content"}
        </button>
      </div>

      {results && (
        <div className="mt-6 space-y-4">
          <p className="font-semibold text-sm">
            Your generated content
            {tier && <span className="font-normal text-xs text-billboard-inkSoft"> · {tier === "subscription" ? "subscription tier" : "free activation tier"}</span>}
          </p>
          {selectedFormats.filter((id) => results[id]).map((id) => {
            const format = CONTENT_STUDIO_FORMATS.find((f) => f.id === id);
            const text = results[id];
            return (
              <div key={id} className="border-2 border-billboard-ink rounded p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">{format?.label ?? id}</span>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => copyResult(id, text)} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1 hover:bg-billboard-paperDim transition">
                      {copiedId === id ? "Copied ✓" : "Copy"}
                    </button>
                    <button onClick={() => sendToCreator(text)} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink bg-billboard-green text-white rounded px-2.5 py-1 hover:bg-billboard-greenDeep transition">
                      Send to Creator
                    </button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
