import { useRef, useState } from "react";
import type { CampaignProof } from "../lib/complianceTypes";
import { submitCampaignProof, uploadProofScreenshot, getProofScreenshotUrl } from "../lib/compliance";
import { MAX_PROOF_SCREENSHOT_BYTES, ALLOWED_PROOF_SCREENSHOT_MIME_TYPES } from "../lib/constants";

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const PROOF_STATUS_STYLE: Record<CampaignProof["status"], string> = {
  pending_review: "bg-white text-billboard-ink border-billboard-ink",
  verified: "bg-billboard-green text-white border-billboard-greenDeep",
  rejected: "bg-billboard-red text-white border-billboard-red",
};
const PROOF_STATUS_LABEL: Record<CampaignProof["status"], string> = {
  pending_review: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

/**
 * /campaigns/:id/proof, inlined into the compliance page rather than
 * split onto its own route for Phase 2 — brief section 10 describes this
 * as its own page; folding it in here avoids a second round trip to fetch
 * the same campaign_compliance row. Split it out later if the page gets
 * crowded.
 *
 * Screenshot upload is optional, alongside the URL — useful precisely
 * because a public post can be edited, deleted, or made private after
 * submission, and the URL alone stops proving anything if that happens.
 * Backed by the private campaign-proof-screenshots bucket
 * (schema_phase40_proof_screenshots.sql); viewing an existing screenshot
 * fetches a short-lived signed URL on click rather than storing one, since
 * a public/cached URL would defeat the point of the bucket being private.
 */
export default function ProofSubmissionCard({
  campaignComplianceId,
  platform,
  proof,
  isCreator,
  onSubmitted,
}: {
  campaignComplianceId: string;
  platform: string;
  proof: CampaignProof[];
  isCreator: boolean;
  onSubmitted: () => void;
}) {
  const [showForm, setShowForm] = useState(proof.length === 0);
  const [postUrl, setPostUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [disclosureConfirmed, setDisclosureConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasActiveSubmission = proof.some((p) => p.status === "pending_review" || p.status === "verified");

  async function handleScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setError(null);
    if (!ALLOWED_PROOF_SCREENSHOT_MIME_TYPES.includes(file.type)) {
      setError("Only JPG, PNG or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_PROOF_SCREENSHOT_BYTES) {
      setError(`That file is ${formatMB(file.size)} — the limit is ${formatMB(MAX_PROOF_SCREENSHOT_BYTES)}. Try compressing it first.`);
      return;
    }

    setUploadingScreenshot(true);
    try {
      const path = await uploadProofScreenshot(campaignComplianceId, file);
      setScreenshotPath(path);
      setScreenshotName(file.name);
    } catch {
      // The bucket's own file_size_limit/allowed_mime_types (schema_phase40)
      // can still reject something that slipped past the checks above.
      setError("Upload failed — that file may be too large or an unsupported type.");
    } finally {
      setUploadingScreenshot(false);
    }
  }

  async function viewScreenshot(proofId: string, path: string) {
    setViewingId(proofId);
    try {
      const url = await getProofScreenshotUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Couldn't open that screenshot — try again.");
    } finally {
      setViewingId(null);
    }
  }

  async function submit() {
    if (!postUrl.trim() || !disclosureConfirmed) {
      setError("Add the public post URL and confirm your disclosure is applied.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitCampaignProof({
        campaignComplianceId,
        platform,
        postUrl: postUrl.trim(),
        screenshotPath: screenshotPath ?? undefined,
        publishedAt: publishedAt || undefined,
        disclosureConfirmed,
        notes: notes.trim() || undefined,
      });
      setShowForm(false);
      setPostUrl("");
      setPublishedAt("");
      setDisclosureConfirmed(false);
      setNotes("");
      setScreenshotPath(null);
      setScreenshotName(null);
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit proof — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded bg-white p-4">
      <h3 className="font-display text-sm mb-3">Publication proof</h3>

      {proof.length > 0 && (
        <ul className="space-y-3 mb-3">
          {proof.map((p) => (
            <li key={p.id} className="border-t border-billboard-paperDim pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${PROOF_STATUS_STYLE[p.status]}`}>
                  {PROOF_STATUS_LABEL[p.status]}
                </span>
                {p.published_at && <span className="text-xs text-billboard-inkSoft">{new Date(p.published_at).toLocaleDateString()}</span>}
              </div>
              {p.post_url && (
                <a href={p.post_url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-billboard-greenDeep underline break-all">
                  {p.post_url}
                </a>
              )}
              {p.screenshot_path && (
                <button
                  onClick={() => viewScreenshot(p.id, p.screenshot_path!)}
                  disabled={viewingId === p.id}
                  className="block mt-1 font-mono text-[11px] font-semibold uppercase text-billboard-inkSoft underline disabled:opacity-60"
                >
                  {viewingId === p.id ? "Opening…" : "View screenshot"}
                </button>
              )}
              {p.status === "rejected" && p.rejection_reason && (
                <p className="text-xs text-billboard-red mt-1">{p.rejection_reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCreator && !hasActiveSubmission && (
        showForm ? (
          <div className="space-y-2.5">
            <div>
              <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Public post URL</label>
              <input
                type="url"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://…"
                className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Published on</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="border-2 border-billboard-ink rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">
                Screenshot <span className="normal-case text-billboard-inkSoft font-normal">(optional — recommended, since posts can be edited or removed later)</span>
              </label>
              {screenshotPath ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-billboard-greenDeep">✓ {screenshotName}</span>
                  <button
                    type="button"
                    onClick={() => { setScreenshotPath(null); setScreenshotName(null); }}
                    className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <input ref={fileInputRef} type="file" accept={ALLOWED_PROOF_SCREENSHOT_MIME_TYPES.join(",")} onChange={handleScreenshotSelect} className="hidden" id="proof-screenshot-input" />
                  <label
                    htmlFor="proof-screenshot-input"
                    className="inline-block font-mono text-xs font-semibold uppercase border-2 border-billboard-ink px-3 py-1.5 rounded cursor-pointer"
                  >
                    {uploadingScreenshot ? "Uploading…" : "Choose file"}
                  </label>
                </>
              )}
            </div>
            <div>
              <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={disclosureConfirmed} onChange={(e) => setDisclosureConfirmed(e.target.checked)} className="mt-0.5" />
              <span>I applied the required disclosure to this post.</span>
            </label>
            {error && <p className="text-sm text-billboard-red">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={submitting || uploadingScreenshot}
                className="font-mono text-xs font-semibold uppercase bg-billboard-ink text-white px-4 py-2 rounded disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit proof"}
              </button>
              {proof.length > 0 && (
                <button onClick={() => setShowForm(false)} className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft px-4 py-2">
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} className="font-mono text-xs font-semibold uppercase text-billboard-greenDeep underline">
            Submit publication proof
          </button>
        )
      )}

      {proof.length === 0 && !isCreator && <p className="text-sm text-billboard-inkSoft">The creator hasn't submitted proof yet.</p>}
    </div>
  );
}
