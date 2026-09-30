import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { reportError } from "../lib/errorTracking";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { describeEdgeFunctionError } from "../lib/edgeFunctionError";
import { PLATFORMS } from "../lib/constants";
import type { Publisher } from "../lib/types";

/**
 * Replaces ConnectSocialAccounts.tsx (deleted alongside this file). That
 * component depended on OAuth against four platforms' own developer apps
 * (YouTube, Facebook Pages, Instagram, TikTok — schema_phase34), each
 * needing its own platform app-review before a real publisher could use
 * it; the button never worked outside a test user, and even working it
 * would only ever cover those four platforms, never WhatsApp Channels,
 * Facebook Groups, X, LinkedIn, or a personal Instagram account.
 *
 * This instead needs no developer-app approval and works on every
 * platform: the publisher lists their public profile URLs (unchanged —
 * social_verification_links, migration 20260926000132), generates a short
 * code, places it in that profile's bio for admin to find, and uploads a
 * screenshot of their own native analytics as supporting evidence. An
 * admin then confirms it from the review screen (Admin.tsx). See the
 * migration this panel depends on — 20260929120000_social_bio_code_verification.sql
 * — for the full reasoning and the database-side enforcement.
 */
export default function SocialVerificationPanel({ publisher, onChange }: { publisher: Publisher; onChange: () => void }) {
  const publisherId = publisher.id;
  const [links, setLinks] = useState<{ platform: string; url: string }[]>(
    publisher.social_verification_links.length > 0 ? publisher.social_verification_links : [{ platform: "", url: "" }]
  );
  const [savingLinks, setSavingLinks] = useState(false);
  const [linksSaved, setLinksSaved] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [proofPaths, setProofPaths] = useState<string[]>(publisher.verification_proof_urls ?? []);
  const [proofPreviews, setProofPreviews] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [summary, setSummary] = useState(publisher.ai_audience_summary ?? "");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (proofPaths.length === 0) {
        setProofPreviews([]);
        return;
      }
      const signed = await Promise.all(
        proofPaths.map(async (path) => {
          const { data } = await supabase.storage.from("publisher-verification-proof").createSignedUrl(path, 3600);
          return { path, url: data?.signedUrl ?? "" };
        })
      );
      if (!cancelled) setProofPreviews(signed.filter((s) => s.url));
    })();
    return () => {
      cancelled = true;
    };
  }, [proofPaths]);

  function updateLink(index: number, field: "platform" | "url", value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
    setLinksSaved(false);
  }

  function addLink() {
    if (links.length >= 6) return; // matches social_verification_links_shape's own cap
    setLinks((prev) => [...prev, { platform: "", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks((prev) => (prev.length === 1 ? [{ platform: "", url: "" }] : prev.filter((_, i) => i !== index)));
    setLinksSaved(false);
  }

  async function saveLinks() {
    setSavingLinks(true);
    setLinksError(null);
    const cleaned = links.map((l) => ({ platform: l.platform.trim(), url: l.url.trim() })).filter((l) => l.platform && l.url);
    const { error } = await supabase.from("publishers").update({ social_verification_links: cleaned }).eq("id", publisherId);
    setSavingLinks(false);
    if (error) {
      setLinksError(formatSupabaseError(error, "Couldn't save your profile links"));
      reportError(error, { source: "SocialVerificationPanel.saveLinks" });
      return;
    }
    setLinksSaved(true);
    onChange();
  }

  async function generateCode() {
    setGenerating(true);
    setCodeError(null);
    try {
      const { data, error } = await supabase.rpc("generate_social_verification_code", { p_publisher_id: publisherId });
      if (error || !data) {
        setCodeError(formatSupabaseError(error, "Couldn't generate a code — try again."));
        reportError(error, { source: "SocialVerificationPanel.generateCode" });
        setGenerating(false);
        return;
      }
      setGenerating(false);
      onChange(); // re-fetches publisher, which now carries the new code + reset confirmed flag
    } catch (err) {
      reportError(err, { source: "SocialVerificationPanel.generateCode" });
      setCodeError("Couldn't reach the server. Check your connection and try again.");
      setGenerating(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const room = 5 - proofPaths.length;
    if (room <= 0) {
      setUploadError("You've already uploaded the maximum of 5 files — remove context by asking an admin if you need to replace one.");
      return;
    }
    setUploading(true);
    const newPaths: string[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${publisherId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("publisher-verification-proof").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) {
        reportError(uploadErr, { source: "SocialVerificationPanel.upload" });
        continue;
      }
      newPaths.push(path);
    }
    if (newPaths.length === 0) {
      setUploading(false);
      setUploadError("Couldn't upload that file — try a JPG, PNG, WebP or MP4 under 5MB.");
      return;
    }
    const merged = [...proofPaths, ...newPaths];
    const { error } = await supabase.from("publishers").update({ verification_proof_urls: merged }).eq("id", publisherId);
    setUploading(false);
    if (error) {
      setUploadError(formatSupabaseError(error, "Uploaded, but couldn't save the file list — try again."));
      reportError(error, { source: "SocialVerificationPanel.upload.save" });
      return;
    }
    setProofPaths(merged);
    onChange();
  }

  const hasCode = !!publisher.social_verification_code;
  const confirmed = publisher.social_verification_confirmed;

  async function handleSummarize() {
    setSummarizing(true);
    setSummaryError(null);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-publisher-audience", { body: { publisher_id: publisherId } });
      if (error || data?.error) {
        setSummaryError(data?.error ?? (await describeEdgeFunctionError(error, "Couldn't generate a summary — try again.")));
        reportError(error ?? data?.error, { source: "SocialVerificationPanel.summarize" });
        setSummarizing(false);
        return;
      }
      setSummary(data.summary);
      setSummarizing(false);
      onChange();
    } catch (err) {
      reportError(err, { source: "SocialVerificationPanel.summarize" });
      setSummaryError("Couldn't reach the server. Check your connection and try again.");
      setSummarizing(false);
    }
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white">
      <h2 className="font-display text-lg mb-1">Verify your social account</h2>
      <p className="text-sm text-billboard-inkSoft mb-5">
        No app permissions, no login sharing — just a code in your bio and a screenshot of your own analytics. Works for any platform, including ones without a public API (WhatsApp Channels, Facebook Groups, a personal Instagram, and so on).
      </p>

      {confirmed ? (
        <div className="border-2 border-billboard-green rounded p-3 mb-5 bg-[#EAF3EC] flex items-center gap-2">
          <span className="text-billboard-greenDeep font-bold">✓</span>
          <p className="text-sm font-semibold text-billboard-greenDeep">
            Verified by ChatSched{publisher.social_verification_confirmed_at ? ` on ${new Date(publisher.social_verification_confirmed_at).toLocaleDateString("en-ZA")}` : ""}.
          </p>
        </div>
      ) : hasCode ? (
        <div className="border-2 border-billboard-yellow rounded p-3 mb-5 bg-[#FFF8E1]">
          <p className="text-sm font-semibold">Awaiting admin review.</p>
          <p className="text-xs text-billboard-inkSoft mt-0.5">We'll confirm it once we've checked your bio and screenshot — usually within a couple of days.</p>
        </div>
      ) : null}

      {/* ── Step 1: profile links ── */}
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2">Step 1 · Your public profiles</p>
      <div className="space-y-2 mb-3">
        {links.map((link, i) => (
          <div key={i} className="flex gap-2">
            <select
              value={link.platform}
              onChange={(e) => updateLink(i, "platform", e.target.value)}
              className="border-2 border-billboard-ink rounded px-2 py-2 text-sm w-40 shrink-0"
            >
              <option value="">Platform…</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="url"
              value={link.url}
              onChange={(e) => updateLink(i, "url", e.target.value)}
              placeholder="https://…"
              className="flex-1 min-w-0 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
            />
            <button type="button" onClick={() => removeLink(i)} className="text-billboard-inkSoft hover:text-billboard-red text-sm px-2" aria-label="Remove link">✕</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-6">
        {links.length < 6 && (
          <button type="button" onClick={addLink} className="text-xs font-semibold underline text-billboard-inkSoft">+ Add another platform</button>
        )}
        <button
          type="button"
          onClick={saveLinks}
          disabled={savingLinks}
          className="ml-auto text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-billboard-yellow disabled:opacity-60"
        >
          {savingLinks ? "Saving…" : linksSaved ? "Saved ✓" : "Save links"}
        </button>
      </div>
      {linksError && <p className="text-billboard-red text-xs font-semibold -mt-4 mb-4">{linksError}</p>}

      {/* ── Step 2: bio code ── */}
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2">Step 2 · Your verification code</p>
      {hasCode ? (
        <div className="border-2 border-billboard-ink rounded p-3 mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Your code</p>
            <p className="text-lg font-bold font-mono tracking-wider">{publisher.social_verification_code}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(publisher.social_verification_code ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2 py-1 hover:bg-billboard-paperDim transition shrink-0"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      ) : null}
      <p className="text-xs text-billboard-inkSoft mb-3">
        {hasCode
          ? "Add this exact code to your bio, About section or channel description on the profile(s) above, and leave it there until it's confirmed. Regenerating replaces it and clears any pending review."
          : "Generate a code, then place it in your bio so we can confirm you control the account."}
      </p>
      <button
        type="button"
        onClick={generateCode}
        disabled={generating}
        className="text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-white disabled:opacity-60 mb-1"
      >
        {generating ? "Generating…" : hasCode ? "Regenerate code" : "Get my code"}
      </button>
      {codeError && <p className="text-billboard-red text-xs font-semibold mt-1 mb-3">{codeError}</p>}

      {/* ── Step 3: screenshot ── */}
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2 mt-6">Step 3 · Analytics screenshot</p>
      <p className="text-xs text-billboard-inkSoft mb-3">
        A screenshot of your platform's own analytics (followers, reach, audience location) — make sure your account name and today's date are visible in the shot. Up to 5 files.
      </p>
      {proofPreviews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
          {proofPreviews.map((p) => (
            <a key={p.path} href={p.url} target="_blank" rel="noreferrer noopener" className="block border-2 border-billboard-ink rounded overflow-hidden aspect-square bg-billboard-paperDim">
              {/\.(mp4|mov)$/i.test(p.path) ? (
                <video src={p.url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={p.url} alt="Verification evidence" className="w-full h-full object-cover" />
              )}
            </a>
          ))}
        </div>
      )}
      <label className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-white cursor-pointer disabled:opacity-60">
        {uploading ? "Uploading…" : "Upload screenshot"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          multiple
          disabled={uploading || proofPaths.length >= 5}
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
      </label>
      {uploadError && <p className="text-billboard-red text-xs font-semibold mt-2">{uploadError}</p>}

      {/* ── Step 4: optional AI summary ── */}
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-2 mt-6">Step 4 · Audience summary (optional)</p>
      <p className="text-xs text-billboard-inkSoft mb-3">
        A short, AI-written summary of your audience for businesses browsing the marketplace, based on your own follower count and bio — nothing invented.
      </p>
      {summary && (
        <p className="text-sm border-2 border-billboard-ink rounded p-3 mb-3 bg-billboard-paperDim/40">{summary}</p>
      )}
      <button
        type="button"
        onClick={handleSummarize}
        disabled={summarizing}
        className="text-xs font-bold px-3 py-1.5 rounded border-2 border-billboard-ink bg-white disabled:opacity-60"
      >
        {summarizing ? "Generating…" : summary ? "Regenerate summary" : "Generate summary"}
      </button>
      {summaryError && <p className="text-billboard-red text-xs font-semibold mt-2">{summaryError}</p>}

      <p className="text-xs text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-6">
        We never ask for your password and never post on your behalf — this only checks that a code we generated is visible on a profile you say is yours.
      </p>
    </div>
  );
}
