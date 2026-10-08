import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { setContentStudioDraft } from "../../lib/contentStudioDraft";
import { isSubscriptionUsable } from "../../lib/subscriptions";
import { CONTENT_STUDIO_FREE_MONTHLY_LIMIT, CONTENT_STUDIO_FREE_DAILY_LIMIT } from "../../lib/constants";
import type { BusinessSubscription } from "../../lib/types";
import { SkeletonBlock } from "../Skeleton";

const PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "whatsapp", label: "WhatsApp" },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

export default function CaptionWriter() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [activation, setActivation] = useState<BusinessSubscription | null>(null);
  const [loadingActivation, setLoadingActivation] = useState(true);
  const [description, setDescription] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [platform, setPlatform] = useState<PlatformId>("facebook");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ today: number; dailyLimit: number; month: number; monthlyLimit: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isActivated = isAdmin || (activation ? isSubscriptionUsable(activation.status) : false);

  async function loadActivation() {
    if (!user) return;
    setLoadingActivation(true);
    const { data } = await supabase
      .from("business_subscriptions")
      .select("id, business_id, status, payfast_payment_id, paid_at, created_at")
      .eq("business_id", user.id)
      .maybeSingle();
    setActivation((data ?? null) as BusinessSubscription | null);
    setLoadingActivation(false);
  }

  useEffect(() => {
    loadActivation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      if (data?.needsActivation) loadActivation();
      setGenError(data?.error ?? "Couldn't generate a caption — try again in a moment.");
      return;
    }

    setCaption(data.results?.[platform] ?? null);
    setUsage(data.usage ?? null);
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

  if (loadingActivation) {
    return <SkeletonBlock className="h-40" />;
  }

  if (!isActivated) {
    return (
      <div className="border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 bg-billboard-paperDim">
        <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-yellow px-2.5 py-1 rounded mb-3">Caption Writer</span>
        <h3 className="font-display text-xl mb-2">Included with Premium access.</h3>
        <p className="text-sm text-billboard-inkSoft max-w-lg mb-5">Caption Writer is part of your full Marketing Suite. Get Premium access to unlock it — there is no separate Caption Writer payment.</p>
        <a href="/account#premium" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
          Get Premium access →
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs text-billboard-inkSoft">
          Included with Business activation ·{" "}
          {usage
            ? `${usage.today}/${usage.dailyLimit} today · ${usage.month}/${usage.monthlyLimit} this month`
            : `up to ${CONTENT_STUDIO_FREE_DAILY_LIMIT}/day, ${CONTENT_STUDIO_FREE_MONTHLY_LIMIT}/month`}
        </p>
      </div>

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
            placeholder="Describe the image — helps the generator match the caption to it"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
          />
          <p className="text-[11px] text-billboard-inkSoft mt-1">Want to generate straight from an uploaded photo? Use AI Content Studio instead.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`font-mono text-xs border-2 border-billboard-ink rounded-full px-3 py-1.5 transition ${platform === p.id ? "bg-billboard-ink text-white" : "bg-white"}`}
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
              {PLATFORMS.find((p) => p.id === platform)?.label ?? platform} · included with Premium access
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
