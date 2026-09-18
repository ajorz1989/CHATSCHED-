import { supabase } from "./supabase";
import type { Deliverable } from "./types";

/**
 * Read/write helpers for structured deliverables — mirrors
 * lib/contentApproval.ts's shape: thin wrappers, the DB trigger
 * (enforce_deliverable_transition) is the real state-machine
 * enforcement, so a disallowed move fails with its own message rather
 * than silently doing nothing.
 */

export async function listDeliverables(campaign: { kind: "channel_request" | "request"; id: string }): Promise<Deliverable[]> {
  const column = campaign.kind === "channel_request" ? "channel_request_id" : "request_id";
  const { data, error } = await supabase.from("deliverables").select("*").eq(column, campaign.id).order("sort_order").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addDeliverable(campaign: { kind: "channel_request" | "request"; id: string }, input: { label: string; quantity: number; notes?: string; sortOrder: number }): Promise<Deliverable> {
  const column = campaign.kind === "channel_request" ? "channel_request_id" : "request_id";
  const { data, error } = await supabase
    .from("deliverables")
    .insert({ [column]: campaign.id, label: input.label.trim(), quantity: input.quantity, notes: input.notes?.trim() || null, sort_order: input.sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeDeliverable(id: string): Promise<void> {
  const { error } = await supabase.from("deliverables").delete().eq("id", id);
  if (error) throw error;
}

/** Creator submits (or resubmits, after being sent back to pending). */
export async function submitDeliverable(id: string, input: { url: string; notes?: string }): Promise<void> {
  const { error } = await supabase
    .from("deliverables")
    .update({ status: "submitted", submission_url: input.url.trim(), submission_notes: input.notes?.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

export async function sendDeliverableBack(id: string, notes: string): Promise<void> {
  const { error } = await supabase.from("deliverables").update({ status: "pending", business_notes: notes.trim() }).eq("id", id);
  if (error) throw error;
}

export async function approveDeliverable(id: string): Promise<void> {
  const { error } = await supabase.from("deliverables").update({ status: "approved" }).eq("id", id);
  if (error) throw error;
}

export async function publishDeliverable(id: string): Promise<void> {
  const { error } = await supabase.from("deliverables").update({ status: "published" }).eq("id", id);
  if (error) throw error;
}

/** Admin-only — enforced by the trigger regardless of what the client sends. */
export async function verifyDeliverable(id: string): Promise<void> {
  const { error } = await supabase.from("deliverables").update({ status: "verified" }).eq("id", id);
  if (error) throw error;
}

export async function setCampaignDuration(channelRequestId: string, durationDays: number | null): Promise<void> {
  const { error } = await supabase.from("channel_requests").update({ duration_days: durationDays }).eq("id", channelRequestId);
  if (error) throw error;
}
