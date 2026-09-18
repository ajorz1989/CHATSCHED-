import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { parseVideoUrl } from "../lib/videoEmbed";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { MAX_PORTFOLIO_IMAGES, MAX_PORTFOLIO_IMAGE_BYTES, ALLOWED_PORTFOLIO_MIME_TYPES } from "../lib/constants";
import { invalidatePublishersCache } from "../hooks/usePublishers";
import type { Publisher } from "../lib/types";

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function PortfolioManager({ publisher, onChange }: { publisher: Publisher; onChange: () => void }) {
  const [videoUrl, setVideoUrl] = useState(publisher.intro_video_url ?? "");
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = publisher.portfolio_images ?? [];
  const atLimit = images.length >= MAX_PORTFOLIO_IMAGES;

  async function saveVideo() {
    setSavingVideo(true);
    setVideoError(null);
    const trimmed = videoUrl.trim();
    if (trimmed && !parseVideoUrl(trimmed)) {
      setSavingVideo(false);
      setVideoError("That doesn't look like a valid URL.");
      return;
    }
    const { error } = await supabase.from("publishers").update({ intro_video_url: trimmed || null }).eq("id", publisher.id);
    setSavingVideo(false);
    if (error) {
      setVideoError(formatSupabaseError(error, "Couldn't save intro video"));
      return;
    }
    invalidatePublishersCache();
    onChange();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setUploadError(null);

    if (atLimit) {
      setUploadError(`You've reached the ${MAX_PORTFOLIO_IMAGES}-image limit — remove one to add another.`);
      return;
    }
    if (!ALLOWED_PORTFOLIO_MIME_TYPES.includes(file.type)) {
      setUploadError("Only JPG, PNG or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) {
      setUploadError(`That file is ${formatMB(file.size)} — the limit is ${formatMB(MAX_PORTFOLIO_IMAGE_BYTES)}. Try compressing it first.`);
      return;
    }

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      setUploadError("You need to be logged in.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("portfolio-images").upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadErr) {
      setUploading(false);
      setUploadError(formatSupabaseError(uploadErr, "Upload failed"));
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("portfolio-images").getPublicUrl(path);
    const { error: updateErr } = await supabase.from("publishers").update({
      portfolio_images: [...images, publicUrlData.publicUrl],
    }).eq("id", publisher.id);

    setUploading(false);
    if (updateErr) {
      setUploadError(formatSupabaseError(updateErr, "Uploaded, but couldn't add it to your profile"));
      return;
    }
    invalidatePublishersCache();
    onChange();
  }

  async function removeImage(url: string) {
    if (!confirm("Remove this image from your portfolio?")) return;
    const remaining = images.filter((u) => u !== url);
    await supabase.from("publishers").update({ portfolio_images: remaining }).eq("id", publisher.id);

    // Best-effort storage cleanup — the path is everything after the bucket's
    // public URL prefix. If this fails the object is just orphaned (still
    // capped by the bucket's own limits), not a correctness problem.
    const marker = "/portfolio-images/";
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = url.slice(idx + marker.length);
      await supabase.storage.from("portfolio-images").remove([path]);
    }
    invalidatePublishersCache();
    onChange();
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 mb-10">
      <h2 className="font-display text-lg mb-1">Video &amp; portfolio</h2>
      <p className="text-xs text-billboard-inkSoft mb-4">Show businesses your work — a short intro video and a few examples of past placements.</p>

      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Intro video link</label>
        <p className="text-xs text-billboard-inkSoft mb-2">Paste a link to a video you've already posted — YouTube, Vimeo, TikTok or Instagram. Nothing to upload here.</p>
        <div className="flex gap-2">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
          />
          <button onClick={saveVideo} disabled={savingVideo} className="border-2 border-billboard-ink font-bold px-4 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60 shrink-0">
            {savingVideo ? "Saving…" : "Save"}
          </button>
        </div>
        {videoError && <p className="text-billboard-red text-xs font-semibold mt-1.5">{videoError}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide">Portfolio images</label>
          <span className="font-mono text-[10px] text-billboard-inkSoft">{images.length}/{MAX_PORTFOLIO_IMAGES}</span>
        </div>
        <p className="text-xs text-billboard-inkSoft mb-3">JPG, PNG or WebP, up to {formatMB(MAX_PORTFOLIO_IMAGE_BYTES)} each.</p>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mb-3">
          {images.map((url) => (
            <div key={url} className="relative aspect-square border-2 border-billboard-ink rounded overflow-hidden group">
              <img src={url} alt="Portfolio" className="w-full h-full object-cover" loading="lazy" />
              <button
                onClick={() => removeImage(url)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-billboard-ink text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          {!atLimit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square border-2 border-dashed border-billboard-inkSoft rounded flex items-center justify-center text-billboard-inkSoft hover:border-billboard-ink hover:text-billboard-ink transition disabled:opacity-60"
            >
              {uploading ? <span className="text-xs">Uploading…</span> : <span className="text-2xl leading-none">+</span>}
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
        {uploadError && <p className="text-billboard-red text-xs font-semibold">{uploadError}</p>}
      </div>
    </div>
  );
}
