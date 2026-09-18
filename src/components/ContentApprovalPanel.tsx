import { useEffect, useRef, useState } from "react";
import {
  getContentApproval,
  createContentBrief,
  uploadContentAsset,
  attachContentAsset,
  getContentAssetUrl,
  submitDraft,
  requestChanges,
  approveContent,
  publishContent,
  type ContentAssetKind,
} from "../lib/contentApproval";
import {
  MAX_CONTENT_ASSET_IMAGE_BYTES,
  MAX_CONTENT_ASSET_VIDEO_BYTES,
  ALLOWED_CONTENT_ASSET_IMAGE_MIME_TYPES,
  ALLOWED_CONTENT_ASSET_VIDEO_MIME_TYPES,
} from "../lib/constants";
import type { ContentApproval } from "../lib/types";
import Button from "./Button";

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const STATUS_LABEL: Record<ContentApproval["status"], string> = {
  awaiting_draft: "Content awaiting approval",
  awaiting_review: "Awaiting business approval",
  changes_requested: "Changes requested",
  approved: "Approved — ready to publish",
  published: "Published",
};

const STATUS_STYLE: Record<ContentApproval["status"], string> = {
  awaiting_draft: "bg-billboard-paperDim text-billboard-inkSoft border-billboard-inkSoft",
  awaiting_review: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  changes_requested: "bg-white text-billboard-red border-billboard-red",
  approved: "bg-billboard-green text-white border-billboard-greenDeep",
  published: "bg-billboard-ink text-white border-billboard-ink",
};

/** A single image/video picker — uploads immediately on select, since we need the content_approval row's id (already created by this point) to key the storage path. Shows a "view" link once a path is attached. */
function AssetField({
  label,
  contentApprovalId,
  kind,
  currentPath,
  onAttached,
}: {
  label: string;
  contentApprovalId: string;
  kind: ContentAssetKind;
  currentPath: string | null;
  onAttached: (path: string) => void;
}) {
  const isVideo = kind.endsWith("video");
  const maxBytes = isVideo ? MAX_CONTENT_ASSET_VIDEO_BYTES : MAX_CONTENT_ASSET_IMAGE_BYTES;
  const allowedTypes = isVideo ? ALLOWED_CONTENT_ASSET_VIDEO_MIME_TYPES : ALLOWED_CONTENT_ASSET_IMAGE_MIME_TYPES;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setError(null);
    if (!allowedTypes.includes(file.type)) {
      setError(isVideo ? "Only MP4 or MOV video is accepted." : "Only JPG, PNG or WebP images are accepted.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`That file is ${formatMB(file.size)} — the limit is ${formatMB(maxBytes)}.`);
      return;
    }
    setUploading(true);
    try {
      const path = await uploadContentAsset(contentApprovalId, kind, file);
      await attachContentAsset(contentApprovalId, kind, path);
      onAttached(path);
    } catch {
      setError("Upload failed — that file may be too large or an unsupported type.");
    } finally {
      setUploading(false);
    }
  }

  async function view() {
    if (!currentPath) return;
    setViewing(true);
    try {
      const url = await getContentAssetUrl(currentPath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Couldn't open that file — try again.");
    } finally {
      setViewing(false);
    }
  }

  return (
    <div>
      <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="border-2 border-billboard-ink font-semibold px-3 py-1.5 rounded text-xs hover:bg-billboard-paperDim transition disabled:opacity-60"
        >
          {uploading ? "Uploading…" : currentPath ? "Replace" : `Upload ${isVideo ? "video" : "image"}`}
        </button>
        {currentPath && (
          <button type="button" onClick={view} disabled={viewing} className="text-xs font-semibold underline text-billboard-ink disabled:opacity-60">
            {viewing ? "Opening…" : "View current"}
          </button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept={allowedTypes.join(",")} onChange={handleSelect} className="hidden" />
      {error && <p className="text-billboard-red text-xs font-semibold mt-1">{error}</p>}
    </div>
  );
}

/**
 * The content-approval workflow between 'paid' and 'live' on a
 * channel_request: business uploads a brief, creator drafts, business
 * approves or requests changes, creator publishes. See
 * schema_phase53_content_approval.sql for the full state machine this
 * mirrors — every write here goes through lib/contentApproval.ts, which
 * matches the trigger's allowed transitions exactly, so a disallowed move
 * fails with the trigger's own message rather than silently doing nothing.
 *
 * Renders nothing until the linked channel_request has reached 'paid' —
 * there's nothing to approve before payment is confirmed — and once
 * status is 'live' the parent card's own "Live since…" message already
 * covers it, so this renders nothing then either.
 */
export default function ContentApprovalPanel({
  channelRequestId,
  requestStatus,
  isCreator,
  isBusiness,
  advertisingMethod,
  onPublished,
}: {
  channelRequestId: string;
  requestStatus: string;
  isCreator: boolean;
  isBusiness: boolean;
  advertisingMethod: string;
  onPublished?: () => void;
}) {
  const [approval, setApproval] = useState<ContentApproval | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  // Business brief form
  const [briefCaption, setBriefCaption] = useState("");
  const [briefCta, setBriefCta] = useState("");
  const [briefLink, setBriefLink] = useState("");

  // Creator draft form
  const [draftCaption, setDraftCaption] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  // Business review form
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeNotes, setChangeNotes] = useState("");

  async function load() {
    try {
      const a = await getContentApproval(channelRequestId);
      setApproval(a);
      if (a) {
        setDraftCaption(a.draft_caption ?? "");
        setDraftNotes(a.draft_notes ?? "");
      }
    } catch {
      setApproval(null);
    }
  }

  useEffect(() => {
    if (requestStatus === "paid" || requestStatus === "live" || requestStatus === "completed") {
      load();
    } else {
      setApproval(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelRequestId, requestStatus]);

  if (requestStatus !== "paid") return null; // 'live'/'completed' already have their own summary in the parent card
  if (approval === undefined) return null; // still loading — render nothing rather than a flash of the wrong state

  async function submitBrief() {
    setActing(true);
    setError(null);
    try {
      const created = await createContentBrief({ channelRequestId, caption: briefCaption, ctaLabel: briefCta, link: briefLink });
      setApproval(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit that — try again.");
    } finally {
      setActing(false);
    }
  }

  async function submitOrResubmitDraft() {
    if (!approval) return;
    setActing(true);
    setError(null);
    try {
      await submitDraft(approval.id, { caption: draftCaption, notes: draftNotes });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit your draft — try again.");
    } finally {
      setActing(false);
    }
  }

  async function sendChangeRequest() {
    if (!approval || !changeNotes.trim()) {
      setError("Let the creator know what to change.");
      return;
    }
    setActing(true);
    setError(null);
    try {
      await requestChanges(approval.id, changeNotes);
      setShowChangeForm(false);
      setChangeNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that — try again.");
    } finally {
      setActing(false);
    }
  }

  async function approve() {
    if (!approval) return;
    setActing(true);
    setError(null);
    try {
      await approveContent(approval.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't approve that — try again.");
    } finally {
      setActing(false);
    }
  }

  async function publish() {
    if (!approval) return;
    setActing(true);
    setError(null);
    try {
      await publishContent(approval.id, channelRequestId);
      onPublished?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't publish that — try again.");
    } finally {
      setActing(false);
    }
  }

  const inputClass = "w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm";

  return (
    <div className="border-2 border-billboard-yellow bg-billboard-yellow/5 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[11px] font-semibold uppercase text-billboard-inkSoft">Content approval</span>
        {approval && (
          <span className={`inline-block font-mono text-[10px] font-semibold uppercase px-2.5 py-1 rounded border-2 ${STATUS_STYLE[approval.status]}`}>
            {STATUS_LABEL[approval.status]}
          </span>
        )}
      </div>

      {error && <p className="text-billboard-red text-xs font-semibold mb-3">{error}</p>}

      {/* No brief yet */}
      {!approval && isBusiness && (
        <div className="space-y-3">
          <p className="text-xs text-billboard-inkSoft">
            Upload what you'd like featured — the creator will prepare a draft from it before anything goes live.
          </p>
          <div>
            <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Caption</label>
            <textarea value={briefCaption} onChange={(e) => setBriefCaption(e.target.value)} rows={3} maxLength={600} className={inputClass} placeholder="What should the post say?" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Call to action</label>
              <input value={briefCta} onChange={(e) => setBriefCta(e.target.value)} maxLength={60} className={inputClass} placeholder="e.g. Shop now" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Link</label>
              <input type="url" value={briefLink} onChange={(e) => setBriefLink(e.target.value)} className={inputClass} placeholder="https://…" />
            </div>
          </div>
          <p className="text-xs text-billboard-inkSoft">You can attach an image or video once you've saved this brief.</p>
          <Button variant="primary" size="md" onClick={submitBrief} disabled={acting}>
            {acting ? "Saving…" : "Submit content brief"}
          </Button>
        </div>
      )}
      {!approval && isCreator && (
        <p className="text-xs text-billboard-inkSoft">Waiting on the business to upload campaign content before you can prepare a draft.</p>
      )}

      {/* Business has a brief, may still need to attach image/video */}
      {approval && isBusiness && approval.status === "awaiting_draft" && (
        <div className="space-y-3">
          <p className="text-xs text-billboard-inkSoft">Sent to the creator. Attach an image or video if you haven't already.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <AssetField label="Image" contentApprovalId={approval.id} kind="brief_image" currentPath={approval.brief_image_path} onAttached={(p) => setApproval({ ...approval, brief_image_path: p })} />
            <AssetField label="Video" contentApprovalId={approval.id} kind="brief_video" currentPath={approval.brief_video_path} onAttached={(p) => setApproval({ ...approval, brief_video_path: p })} />
          </div>
          <p className="text-xs text-billboard-inkSoft">Waiting on the creator to prepare a draft {advertisingMethod.toLowerCase()}.</p>
        </div>
      )}

      {/* Creator needs to draft (fresh brief, or after changes were requested) */}
      {approval && isCreator && (approval.status === "awaiting_draft" || approval.status === "changes_requested") && (
        <div className="space-y-3">
          {approval.status === "changes_requested" && approval.change_request_notes && (
            <div className="border-2 border-billboard-red rounded p-3 bg-white">
              <p className="text-[10px] font-mono uppercase text-billboard-red font-semibold mb-1">Changes requested</p>
              <p className="text-sm">{approval.change_request_notes}</p>
            </div>
          )}
          <div className="border-2 border-billboard-ink/15 rounded p-3">
            <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-2">Business brief</p>
            {approval.brief_caption && <p className="text-sm mb-2">{approval.brief_caption}</p>}
            <div className="flex gap-4 text-xs text-billboard-inkSoft flex-wrap">
              {approval.brief_cta_label && <span><strong className="text-billboard-ink">CTA:</strong> {approval.brief_cta_label}</span>}
              {approval.brief_link && <span><strong className="text-billboard-ink">Link:</strong> {approval.brief_link}</span>}
            </div>
            <div className="flex gap-2 mt-2">
              {approval.brief_image_path && <ViewAssetLink path={approval.brief_image_path} label="View image" />}
              {approval.brief_video_path && <ViewAssetLink path={approval.brief_video_path} label="View video" />}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Your draft caption</label>
            <textarea value={draftCaption} onChange={(e) => setDraftCaption(e.target.value)} rows={3} maxLength={600} className={inputClass} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <AssetField label="Draft image" contentApprovalId={approval.id} kind="draft_image" currentPath={approval.draft_image_path} onAttached={(p) => setApproval({ ...approval, draft_image_path: p })} />
            <AssetField label="Draft video" contentApprovalId={approval.id} kind="draft_video" currentPath={approval.draft_video_path} onAttached={(p) => setApproval({ ...approval, draft_video_path: p })} />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Notes for the business (optional)</label>
            <input value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} maxLength={300} className={inputClass} />
          </div>
          <button onClick={submitOrResubmitDraft} disabled={acting} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
            {acting ? "Submitting…" : approval.status === "changes_requested" ? "Resubmit draft" : "Submit draft for approval"}
          </button>
        </div>
      )}

      {/* Business waiting on a revised draft */}
      {approval && isBusiness && approval.status === "changes_requested" && (
        <div>
          <p className="text-xs text-billboard-inkSoft mb-1">Waiting on the creator to revise the draft.</p>
          {approval.change_request_notes && <p className="text-xs italic text-billboard-inkSoft">Your notes: "{approval.change_request_notes}"</p>}
        </div>
      )}

      {/* Draft submitted, business must decide */}
      {approval && approval.status === "awaiting_review" && (
        <div className="space-y-3">
          <div className="border-2 border-billboard-ink/15 rounded p-3 bg-white">
            <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-2">Creator's draft</p>
            {approval.draft_caption && <p className="text-sm mb-2">{approval.draft_caption}</p>}
            {approval.draft_notes && <p className="text-xs text-billboard-inkSoft italic mb-2">"{approval.draft_notes}"</p>}
            <div className="flex gap-2">
              {approval.draft_image_path && <ViewAssetLink path={approval.draft_image_path} label="View image" />}
              {approval.draft_video_path && <ViewAssetLink path={approval.draft_video_path} label="View video" />}
            </div>
          </div>
          {isBusiness && !showChangeForm && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={approve} disabled={acting} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
                {acting ? "…" : "Approve"}
              </button>
              <button onClick={() => setShowChangeForm(true)} disabled={acting} className="border-[3px] border-billboard-ink font-bold px-4 py-2 rounded text-sm hover:bg-billboard-paperDim transition disabled:opacity-60">
                Request changes
              </button>
            </div>
          )}
          {isBusiness && showChangeForm && (
            <div className="border-2 border-billboard-ink rounded p-3 bg-white">
              <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">What needs to change?</label>
              <textarea value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} rows={2} maxLength={500} className={inputClass} />
              <div className="flex gap-2 mt-2">
                <button onClick={sendChangeRequest} disabled={acting} className="border-[3px] border-billboard-ink bg-billboard-red text-white font-bold px-3 py-1.5 rounded text-xs hover:-translate-y-0.5 transition disabled:opacity-60">
                  {acting ? "Sending…" : "Send request"}
                </button>
                <button onClick={() => { setShowChangeForm(false); setChangeNotes(""); }} className="border-2 border-billboard-ink font-semibold px-3 py-1.5 rounded text-xs hover:bg-billboard-paperDim transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {isCreator && <p className="text-xs text-billboard-inkSoft">Waiting on the business to approve or request changes.</p>}
        </div>
      )}

      {/* Approved — creator can publish */}
      {approval && approval.status === "approved" && (
        <div>
          {isCreator ? (
            <div>
              <p className="text-xs text-billboard-inkSoft mb-3">Approved — publish when your {advertisingMethod.toLowerCase()} is ready to go live.</p>
              <button onClick={publish} disabled={acting} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
                {acting ? "Publishing…" : "Approved → Publish"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-billboard-inkSoft">Approved — waiting on the creator to publish.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ViewAssetLink({ path, label }: { path: string; label: string }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const url = await getContentAssetUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button type="button" onClick={open} disabled={loading} className="text-xs font-semibold underline text-billboard-ink disabled:opacity-60">
      {loading ? "Opening…" : label}
    </button>
  );
}
