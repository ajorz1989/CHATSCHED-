import { useState } from "react";
import { usePublishers } from "../../hooks/usePublishers";
import { PLATFORMS } from "../../lib/constants";
import {
  emptyCampaignDraft,
  matchPublishers,
  scoreCampaignQuality,
  type CampaignDraft,
  type QualityScoreResult,
} from "../../lib/marketingSuite";
import type { Platform } from "../../lib/types";
import { formatCurrency } from "../../lib/currency";

const STEPS = ["brief", "details", "platforms", "review"] as const;
type Step = (typeof STEPS)[number];

export default function CampaignBuilder({
  onScored,
}: {
  onScored?: (draft: CampaignDraft, quality: QualityScoreResult) => void;
}) {
  const { publishers } = usePublishers();
  const [step, setStep] = useState<Step>("brief");
  const [draft, setDraft] = useState<CampaignDraft>(() => emptyCampaignDraft());
  const [quality, setQuality] = useState<QualityScoreResult | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  function update<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedNote(false);
  }

  function togglePlatform(p: Platform) {
    setDraft((d) => ({
      ...d,
      platforms: d.platforms.includes(p) ? d.platforms.filter((x) => x !== p) : [...d.platforms, p],
    }));
  }

  function finish() {
    const matches = matchPublishers(
      [draft.description, draft.businessType, draft.location, draft.goal].join(" "),
      publishers,
      { budget: draft.budget, limit: 5 }
    );
    const next: CampaignDraft = {
      ...draft,
      recommendedPublisherIds: matches.map((m) => m.publisher.id),
      postingSchedule:
        draft.goal.toLowerCase().includes("sale") || draft.goal.toLowerCase().includes("launch")
          ? ["Day 1: Launch post", "Day 3: Reminder with urgency"]
          : ["1 primary post mid-week", "Optional boost if engagement is strong"],
      // Explicit nulls — a future generation layer fills these later
      captions: { facebook: null, instagram: null, tiktok: null, whatsapp: null },
      hashtags: [],
      ctas: [],
      imagePrompts: [],
      headlines: [],
    };
    const q = scoreCampaignQuality(next, publishers);
    setDraft(next);
    setQuality(q);
    setStep("review");
    onScored?.(next, q);
    try {
      const key = "mb_campaign_drafts";
      const prev = JSON.parse(sessionStorage.getItem(key) || "[]") as CampaignDraft[];
      sessionStorage.setItem(key, JSON.stringify([next, ...prev].slice(0, 10)));
      setSavedNote(true);
    } catch {
      /* ignore quota */
    }
  }

  const inputClass = "w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
  const btnClass =
    "bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60";

  return (
    <div>
      <p className="text-sm text-billboard-inkSoft mb-4">
        Describe the campaign in plain language. We store the brief and prepare slots for generated captions,
        image ideas, publisher picks, and a schedule — without inventing copy.
      </p>

      <div className="flex gap-1 mb-5 overflow-x-auto">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded border-2 ${
              step === s ? "border-billboard-ink bg-billboard-ink text-white" : "border-billboard-inkSoft text-billboard-inkSoft"
            }`}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {step === "brief" && (
        <div className="border-[3px] border-billboard-ink rounded p-5 space-y-3 bg-billboard-paperDim">
          <label className={labelClass}>Campaign in plain language</label>
          <textarea
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            placeholder="e.g. Weekend special for our Mitchells Plain pizza shop — want local families to order Friday night"
            className={inputClass}
          />
          <button type="button" disabled={draft.description.trim().length < 10} onClick={() => setStep("details")} className={btnClass}>
            Continue
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="border-[3px] border-billboard-ink rounded p-5 space-y-3 bg-billboard-paperDim">
          <div>
            <label className={labelClass}>Business type</label>
            <input value={draft.businessType} onChange={(e) => update("businessType", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input value={draft.location} onChange={(e) => update("location", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Goal</label>
            <input
              value={draft.goal}
              onChange={(e) => update("goal", e.target.value)}
              placeholder="Awareness, leads, foot traffic…"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Budget (R, optional)</label>
            <input
              type="number"
              min={0}
              value={draft.budget ?? ""}
              onChange={(e) => update("budget", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setStep("brief")} className="font-bold px-4 py-2.5">
              Back
            </button>
            <button type="button" onClick={() => setStep("platforms")} className={btnClass}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "platforms" && (
        <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
          <label className={labelClass}>Platforms</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`font-mono text-xs border-2 border-billboard-ink rounded-full px-3 py-1.5 ${
                  draft.platforms.includes(p) ? "bg-billboard-ink text-white" : "bg-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep("details")} className="font-bold px-4 py-2.5">
              Back
            </button>
            <button type="button" onClick={finish} className={btnClass}>
              Build campaign brief
            </button>
          </div>
        </div>
      )}

      {step === "review" && quality && (
        <div className="space-y-4">
          <div className="border-[3px] border-billboard-ink rounded p-5">
            <p className="font-bold mb-1">Campaign brief saved</p>
            {savedNote && (
              <p className="text-xs text-billboard-inkSoft mb-3">Stored in this browser session for your dashboard visit.</p>
            )}
            <p className="text-sm text-billboard-inkSoft mb-3">{draft.description}</p>
            <p className="text-xs font-mono text-billboard-inkSoft">
              {draft.businessType || "—"} · {draft.location || "—"} · {draft.goal || "—"}
              {draft.budget != null ? ` · ${formatCurrency(draft.budget)}` : ""}
            </p>
            {draft.platforms.length > 0 && (
              <p className="text-xs text-billboard-inkSoft mt-1">{draft.platforms.join(" · ")}</p>
            )}
          </div>

          <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim">
            <p className="font-semibold text-sm mb-2">Placeholders (not generated)</p>
            <ul className="text-xs text-billboard-inkSoft space-y-1">
              <li>Captions (FB / IG / TikTok / WhatsApp): empty until a content provider is connected</li>
              <li>Hashtags, CTAs, headlines, image prompts: empty until a content provider is connected</li>
              <li>Recommended publishers: {draft.recommendedPublisherIds.length} matched from directory rules</li>
              <li>
                Schedule: {draft.postingSchedule.join("; ") || "—"}
              </li>
            </ul>
          </div>

          <QualityPanel quality={quality} />

          <button
            type="button"
            onClick={() => {
              setStep("brief");
              setQuality(null);
              setDraft(emptyCampaignDraft());
            }}
            className="text-xs font-semibold underline text-billboard-inkSoft"
          >
            New campaign brief
          </button>
        </div>
      )}
    </div>
  );
}

function QualityPanel({ quality }: { quality: QualityScoreResult }) {
  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="font-display text-2xl">{quality.score}</span>
        <span className="text-sm font-semibold">Campaign quality score</span>
        {!quality.providerEnhanced && (
          <span className="font-mono text-[10px] uppercase border border-billboard-inkSoft text-billboard-inkSoft px-2 py-0.5 rounded">
            Rule-based · smarter scoring later
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Audience match" value={`${quality.audienceMatch}%`} />
        <Stat label="Est. reach" value={quality.estimatedReach.toLocaleString()} />
        <Stat label="Est. clicks" value={quality.estimatedClicks.toLocaleString()} />
        <Stat label="Est. leads" value={quality.estimatedLeads.toLocaleString()} />
      </div>
      {quality.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1.5">Suggestions</p>
          <ul className="text-sm text-billboard-inkSoft list-disc pl-4 space-y-1">
            {quality.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-billboard-ink rounded p-3">
      <div className="font-display text-lg">{value}</div>
      <div className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-0.5">{label}</div>
    </div>
  );
}
