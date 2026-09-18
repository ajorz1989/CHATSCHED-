import { useState, type FormEvent } from "react";
import { isCaptionProviderConfigured } from "../../lib/marketingSuite";

const PLATFORMS = ["Facebook", "Instagram", "TikTok", "WhatsApp"] as const;

/**
 * UI + contract for caption generation.
 * When VITE_CAPTION_PROVIDER_KEY is set, a future edge function can fill outputs.
 * Until then we never invent captions — we show a clear disconnected state.
 */
export default function CaptionWriter() {
  const providerReady = isCaptionProviderConfigured();
  const [description, setDescription] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("Facebook");
  const [attempted, setAttempted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    // Hook point: invoke supabase.functions.invoke("caption-writer", { body: { ... } })
    // when the backend exists. For now we only surface configuration state.
  }

  return (
    <div>
      <p className="text-sm text-billboard-inkSoft mb-4">
        Describe a promotion or note what your creative shows. The backend is shaped so a content
        generation service can later return platform captions, hashtags, CTAs, image prompts, and headlines.
      </p>

      {!providerReady && (
        <div className="border-[3px] border-billboard-ink rounded p-4 mb-5 bg-billboard-paperDim">
          <p className="font-mono text-xs font-semibold uppercase text-billboard-red mb-1">Not yet connected</p>
          <p className="text-sm text-billboard-inkSoft">
            Set <code className="font-mono bg-white px-1 rounded border border-billboard-inkSoft">VITE_CAPTION_PROVIDER_KEY</code>{" "}
            (and wire a caption edge function) to enable generation. Until then, write captions manually
            or use Campaign Builder to store your brief.
          </p>
        </div>
      )}

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
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Image / creative (optional)</label>
          <input
            type="text"
            value={imageNote}
            onChange={(e) => setImageNote(e.target.value)}
            placeholder="Describe the image, or paste a filename note — file upload can be added later"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Primary platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`font-mono text-xs border-2 border-billboard-ink rounded-full px-3 py-1.5 transition ${
                  platform === p ? "bg-billboard-ink text-white" : "bg-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!description.trim()}
          className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
        >
          {providerReady ? "Generate captions" : "Check connection"}
        </button>
      </form>

      {attempted && (
        <div className="mt-5 border-2 border-billboard-ink rounded p-4 space-y-3">
          <p className="font-semibold text-sm">Expected outputs (placeholders)</p>
          {(["caption", "hashtags", "CTA", "image prompt", "headline"] as const).map((label) => (
            <div key={label} className="border border-dashed border-billboard-inkSoft rounded px-3 py-2 text-sm text-billboard-inkSoft">
              <span className="font-mono text-[10px] uppercase">{platform} · {label}</span>
              <p className="mt-0.5">{providerReady ? "Waiting for response…" : "Not yet connected — no generated copy."}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
