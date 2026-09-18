import { supabase } from "./supabase";
import { fetchBusinessContacts } from "./businessContact";
import type { ChannelRequest, PublisherRequest } from "./types";

/**
 * The `/campaigns/:id` workspace (CampaignWorkspace.tsx) is deliberately
 * NOT backed by a new master "campaigns" table — `:id` is the same
 * requests/channel_requests row id every other campaign-scoped page
 * already uses (getCampaignComplianceById in lib/compliance.ts checks
 * both tables the same way). This just adds one normalized shape on top
 * so the workspace's tabs don't each need their own "which flow is this"
 * branch — they read amount/status/participants off WorkspaceCampaign and
 * only fall back to `.raw` for flow-specific fields.
 *
 * Deliberately doesn't select publishers.user_id in these joins (even
 * though RLS would allow it once the row is visible at all) — same
 * narrower-surface choice CampaignCompliance.tsx makes, resolving "is the
 * current viewer the creator" via a second, targeted single-column query
 * instead. See isWorkspaceCreator() below.
 */
export type WorkspaceCampaign =
  | { kind: "channel_request"; id: string; status: string; createdAt: string; businessId: string; creatorPublisherId: string; creatorName: string; businessName: string; amount: number; summary: string; raw: ChannelRequest }
  | { kind: "request"; id: string; status: string; createdAt: string; businessId: string; creatorPublisherId: string; creatorName: string; businessName: string; amount: number | null; summary: string; raw: PublisherRequest };

export async function getWorkspaceCampaign(id: string): Promise<WorkspaceCampaign | null> {
  // business:profiles(...) used to be embedded directly here too — same
  // profiles_select_via_shared_request over-exposure PublisherDashboardView.tsx
  // and the `requests` branch below already had (see
  // src/lib/businessContact.ts), just never migrated for channel_requests
  // specifically. schema_phase98 extended business_contact_public to
  // recognise a channel_requests relationship too, so this now resolves
  // the same safe way as the `requests` branch below.
  const { data: cr, error: crError } = await supabase
    .from("channel_requests")
    .select("*, creator:publishers(id, name, city, province, channel_slug)")
    .eq("id", id)
    .maybeSingle();
  if (crError) throw crError;
  if (cr) {
    const row = cr as unknown as ChannelRequest;
    const contacts = await fetchBusinessContacts([row.business_id]);
    row.business = contacts.get(row.business_id) ?? null;
    return {
      kind: "channel_request",
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      businessId: row.business_id,
      creatorPublisherId: row.creator_id,
      creatorName: row.creator?.name ?? "Publisher",
      businessName: row.business?.company_name || row.business?.full_name || "Business",
      amount: row.proposed_amount,
      summary: row.campaign_message,
      raw: row,
    };
  }

  // business:profiles(...) used to be embedded directly here too — same
  // profiles_select_via_shared_request over-exposure as
  // PublisherDashboardView.tsx (see src/lib/businessContact.ts). Fetch the
  // request row first, then resolve the safe business contact separately.
  const { data: r, error: rError } = await supabase
    .from("requests")
    .select("*, publisher:publishers(id, name, city, province), payments(*), reviews(*)")
    .eq("id", id)
    .maybeSingle();
  if (rError) throw rError;
  if (r) {
    const row = r as unknown as PublisherRequest;
    const contacts = await fetchBusinessContacts([row.business_id]);
    row.business = contacts.get(row.business_id) ?? null;
    return {
      kind: "request",
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      businessId: row.business_id,
      creatorPublisherId: row.publisher_id,
      creatorName: row.publisher?.name ?? "Publisher",
      businessName: row.business?.company_name || row.business?.full_name || "Business",
      amount: row.agreed_amount ?? row.budget,
      summary: row.campaign_message,
      raw: row,
    };
  }

  return null;
}

/** Targeted "is this viewer the creator on this campaign" check — mirrors CampaignCompliance.tsx's isCreator lookup, without ever selecting publishers.user_id in a general join. */
export async function isWorkspaceCreator(creatorPublisherId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from("publishers").select("id").eq("id", creatorPublisherId).eq("user_id", userId).maybeSingle();
  return !!data;
}
