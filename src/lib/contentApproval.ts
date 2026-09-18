import { supabase } from "./supabase";
import type { ContentApproval } from "./types";

/**
 * Read/write helpers for the content-approval system
 * (schema_phase53_content_approval.sql) — the business's creative brief,
 * the creator's draft, and the approve/request-changes/publish workflow
 * that gates channel_requests' paid -> live transition. Deliberately thin:
 * every write here is a plain insert/update, with the real state-machine
 * enforcement living in the database trigger (same split the rest of this
 * app uses for channel_requests/campaign_proof/etc), so a write that
 * breaks the rules fails loudly with the trigger's own message rather than
 * silently succeeding client-side.
 */

const CONTENT_ASSET_BUCKET = "content-approval-assets";

export async function getContentApproval(channelRequestId: string): Promise<ContentApproval | null> {
  const { data, error } = await supabase
    .from("content_approvals")
    .select("*")
    .eq("channel_request_id", channelRequestId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Business creates the content_approvals row with the text parts of the brief. Image/video paths are filled in afterwards via uploadContentAsset + attachContentAsset, once this row's id exists to key the upload path on. */
export async function createContentBrief(input: {
  channelRequestId: string;
  caption?: string;
  ctaLabel?: string;
  link?: string;
}): Promise<ContentApproval> {
  const { data, error } = await supabase
    .from("content_approvals")
    .insert({
      channel_request_id: input.channelRequestId,
      brief_caption: input.caption?.trim() || null,
      brief_cta_label: input.ctaLabel?.trim() || null,
      brief_link: input.link?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type ContentAssetKind = "brief_image" | "brief_video" | "draft_image" | "draft_video";

/** Uploads to the private content-approval-assets bucket, keyed by this content_approval row's id (mirrors uploadProofScreenshot's shape) — returns the storage path to pass into attachContentAsset. */
export async function uploadContentAsset(contentApprovalId: string, kind: ContentAssetKind, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || (kind.endsWith("video") ? "mp4" : "jpg");
  const path = `${contentApprovalId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(CONTENT_ASSET_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

/** Saves an uploaded asset's path onto the row — a plain column update, no status change, so it passes the trigger untouched regardless of who's calling (business for brief_*, creator for draft_*). */
export async function attachContentAsset(contentApprovalId: string, kind: ContentAssetKind, path: string): Promise<void> {
  const column = kind === "brief_image" ? "brief_image_path" : kind === "brief_video" ? "brief_video_path" : kind === "draft_image" ? "draft_image_path" : "draft_video_path";
  const { error } = await supabase.from("content_approvals").update({ [column]: path }).eq("id", contentApprovalId);
  if (error) throw error;
}

/** Private bucket — generates a short-lived signed URL, only issued to a caller who already passes the bucket's own participant/admin SELECT policy. */
export async function getContentAssetUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(CONTENT_ASSET_BUCKET).createSignedUrl(path, 300); // 5 minutes
  if (error) throw error;
  return data.signedUrl;
}

/** Creator submits (or resubmits, after changes were requested) a draft — draft fields plus the status change land in one call. */
export async function submitDraft(contentApprovalId: string, input: {
  caption?: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("content_approvals")
    .update({
      status: "awaiting_review",
      draft_caption: input.caption?.trim() || null,
      draft_notes: input.notes?.trim() || null,
    })
    .eq("id", contentApprovalId);
  if (error) throw error;
}

export async function requestChanges(contentApprovalId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("content_approvals")
    .update({ status: "changes_requested", change_request_notes: notes.trim() })
    .eq("id", contentApprovalId);
  if (error) throw error;
}

export async function approveContent(contentApprovalId: string): Promise<void> {
  const { error } = await supabase.from("content_approvals").update({ status: "approved" }).eq("id", contentApprovalId);
  if (error) throw error;
}

/**
 * Publishes the approved content and moves the linked channel_request to
 * 'live' — two sequential updates, not a single transaction (this app
 * doesn't have an RPC layer for multi-table writes elsewhere either; see
 * e.g. respond() in PublisherDashboardView.tsx). If the second
 * update fails after the first succeeds, content_approvals is left at
 * 'published' with channel_requests still 'paid' — re-running this
 * function is safe, since the first update is a same-status no-op the
 * trigger passes straight through.
 */
export async function publishContent(contentApprovalId: string, channelRequestId: string): Promise<void> {
  const { error: publishError } = await supabase
    .from("content_approvals")
    .update({ status: "published" })
    .eq("id", contentApprovalId);
  if (publishError) throw publishError;

  const { error: liveError } = await supabase
    .from("channel_requests")
    .update({ status: "live" })
    .eq("id", channelRequestId);
  if (liveError) throw liveError;
}
