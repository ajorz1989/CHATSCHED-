import { supabase } from "./supabase";
import type {
  PlatformComplianceRule,
  CampaignCategoryRule,
  CampaignCompliance,
  CampaignDisclosure,
  CampaignProof,
  ComplianceReview,
  CampaignRiskFlag,
  CreatorCategoryPreference,
  BusinessCampaignPreferences,
} from "./complianceTypes";

/**
 * Read/write helpers for the platform-compliance system
 * (schema_phase39_compliance.sql). Every write that changes
 * campaign_compliance.status/risk/checklist goes through a database RPC,
 * not a raw .update() — see that file's header for why. There is
 * deliberately no function here that sets status/risk_score/risk_level
 * directly; only the server computes those.
 */

// ── platform + category config (public reads) ─────────────────────────────

export async function getEnabledPlatformRules(): Promise<PlatformComplianceRule[]> {
  const { data, error } = await supabase
    .from("platform_compliance_rules")
    .select("*")
    .eq("enabled", true)
    .order("display_name");
  if (error) throw error;
  return data ?? [];
}

export async function getPlatformRule(platform: string): Promise<PlatformComplianceRule | null> {
  const { data, error } = await supabase
    .from("platform_compliance_rules")
    .select("*")
    .eq("platform", platform)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCategoryRules(): Promise<CampaignCategoryRule[]> {
  const { data, error } = await supabase.from("campaign_category_rules").select("*").order("category");
  if (error) throw error;
  return data ?? [];
}

// ── campaign compliance ────────────────────────────────────────────────────

/** Fetches the compliance record for a campaign by its own id (request_id OR channel_request_id — the :id param on /campaigns/:id/compliance doesn't say which flow it came from, so this checks both in one query). */
export async function getCampaignComplianceById(campaignId: string): Promise<CampaignCompliance | null> {
  const { data, error } = await supabase
    .from("campaign_compliance")
    .select("*")
    .or(`request_id.eq.${campaignId},channel_request_id.eq.${campaignId}`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Fetches the compliance record for a campaign. Every requests/channel_requests row gets exactly one of these automatically on creation — this should never return null for a real campaign id. */
export async function getCampaignCompliance(params: {
  requestId?: string;
  channelRequestId?: string;
}): Promise<CampaignCompliance | null> {
  let query = supabase.from("campaign_compliance").select("*");
  query = params.requestId ? query.eq("request_id", params.requestId) : query.eq("channel_request_id", params.channelRequestId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/** Business declares which platform + category a campaign is for. Server derives required policy_version and recomputes the checklist/status. */
export async function setCampaignComplianceContext(
  campaignComplianceId: string,
  platform: string,
  category: string
): Promise<CampaignCompliance> {
  const { data, error } = await supabase.rpc("set_campaign_compliance_context", {
    p_campaign_compliance_id: campaignComplianceId,
    p_platform: platform,
    p_category: category,
  });
  if (error) throw error;
  return data;
}

export async function getComplianceChecklist(campaignComplianceId: string): Promise<{
  disclosures: CampaignDisclosure[];
  proof: CampaignProof[];
  riskFlags: CampaignRiskFlag[];
}> {
  const [disclosures, proof, riskFlags] = await Promise.all([
    supabase.from("campaign_disclosures").select("*").eq("campaign_compliance_id", campaignComplianceId),
    supabase.from("campaign_proof").select("*").eq("campaign_compliance_id", campaignComplianceId).order("created_at", { ascending: false }),
    supabase.from("campaign_risk_flags").select("*").eq("campaign_compliance_id", campaignComplianceId).order("created_at", { ascending: false }),
  ]);
  if (disclosures.error) throw disclosures.error;
  if (proof.error) throw proof.error;
  if (riskFlags.error) throw riskFlags.error;
  return { disclosures: disclosures.data ?? [], proof: proof.data ?? [], riskFlags: riskFlags.data ?? [] };
}

// ── creator disclosure ─────────────────────────────────────────────────────

/** Records the "I understand the disclosure requirement" click. Only callable by the campaign's own creator — enforced server-side, not just hidden in the UI. */
export async function acknowledgeCampaignDisclosure(campaignComplianceId: string, platform: string): Promise<CampaignDisclosure> {
  const { data, error } = await supabase.rpc("acknowledge_campaign_disclosure", {
    p_campaign_compliance_id: campaignComplianceId,
    p_platform: platform,
  });
  if (error) throw error;
  return data;
}

// ── publication proof ──────────────────────────────────────────────────────

const PROOF_SCREENSHOT_BUCKET = "campaign-proof-screenshots";

/**
 * Uploads a proof screenshot to the private campaign-proof-screenshots
 * bucket (schema_phase40_proof_screenshots.sql) and returns the storage
 * path to pass into submitCampaignProof's screenshotPath — mirrors
 * PortfolioManager.tsx's upload shape, except this bucket is private (no
 * getPublicUrl; see getProofScreenshotUrl below for reading it back) and
 * the path is keyed by campaign, not by uploader, since the business side
 * of the campaign needs to read it too. Client-side type/size checks
 * belong in the caller (see MAX_PROOF_SCREENSHOT_BYTES /
 * ALLOWED_PROOF_SCREENSHOT_MIME_TYPES in lib/constants.ts) — the bucket's
 * own file_size_limit/allowed_mime_types is the real enforcement, this is
 * just a fast, friendly error before a slow upload.
 */
export async function uploadProofScreenshot(campaignComplianceId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${campaignComplianceId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(PROOF_SCREENSHOT_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

/** Private bucket, so there's no public URL — this generates one short-lived signed URL on demand, only issued to a caller who already passes the bucket's own participant/admin SELECT policy. */
export async function getProofScreenshotUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PROOF_SCREENSHOT_BUCKET).createSignedUrl(path, 300); // 5 minutes — long enough to open, short enough not to matter if it leaks
  if (error) throw error;
  return data.signedUrl;
}

export async function submitCampaignProof(input: {
  campaignComplianceId: string;
  platform: string;
  postUrl?: string;
  postId?: string;
  screenshotPath?: string;
  publishedAt?: string; // YYYY-MM-DD
  disclosureConfirmed: boolean;
  notes?: string;
}): Promise<CampaignProof> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("campaign_proof")
    .insert({
      campaign_compliance_id: input.campaignComplianceId,
      submitted_by: userData.user?.id,
      platform: input.platform,
      post_url: input.postUrl ?? null,
      post_id: input.postId ?? null,
      screenshot_path: input.screenshotPath ?? null,
      published_at: input.publishedAt ?? null,
      disclosure_confirmed: input.disclosureConfirmed,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Admin-only — verified/rejected. Not exposed to business/creator dashboards. */
export async function reviewCampaignProof(proofId: string, status: "verified" | "rejected", rejectionReason?: string): Promise<CampaignProof> {
  const { data, error } = await supabase.rpc("review_campaign_proof", {
    p_proof_id: proofId,
    p_status: status,
    p_rejection_reason: rejectionReason ?? null,
  });
  if (error) throw error;
  return data;
}

// ── admin review queue ─────────────────────────────────────────────────────

export async function getPendingComplianceReviews(): Promise<ComplianceReview[]> {
  const { data, error } = await supabase
    .from("compliance_reviews")
    .select("*")
    .in("status", ["pending", "in_review"])
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function decideComplianceReview(
  reviewId: string,
  status: "in_review" | "approved" | "rejected" | "request_changes",
  decisionNotes?: string
): Promise<ComplianceReview> {
  const { data, error } = await supabase.rpc("decide_compliance_review", {
    p_review_id: reviewId,
    p_status: status,
    p_decision_notes: decisionNotes ?? null,
  });
  if (error) throw error;
  return data;
}

// ── AI screening (brief section 6/7) ────────────────────────────────────

/** Business or admin only — runs the AI-assisted screen on a campaign's brief text. Never a final decision: writes risk_score/risk_level and campaign_risk_flags, and may open a compliance_reviews entry on a high-severity flag, but campaign_compliance.status is always computed server-side afterward. */
export async function runComplianceScreening(campaignComplianceId: string): Promise<{ risk_score: number; risk_level: string; flags: unknown[] }> {
  const { data, error } = await supabase.functions.invoke("campaign-compliance-screen", { body: { campaign_compliance_id: campaignComplianceId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── admin platform-rule editing ────────────────────────────────────────────

export async function savePlatformComplianceRule(rule: Omit<PlatformComplianceRule, "id" | "version" | "created_at" | "updated_at" | "last_reviewed_at">): Promise<PlatformComplianceRule> {
  const { data, error } = await supabase.rpc("set_platform_compliance_rule", {
    p_platform: rule.platform,
    p_display_name: rule.display_name,
    p_enabled: rule.enabled,
    p_disclosure_required: rule.disclosure_required,
    p_content_restrictions: rule.content_restrictions,
    p_prohibited_categories: rule.prohibited_categories,
    p_restricted_categories: rule.restricted_categories,
    p_required_creator_actions: rule.required_creator_actions,
    p_required_business_actions: rule.required_business_actions,
    p_required_proof: rule.required_proof,
    p_notes: rule.notes,
    p_policy_reference: rule.policy_reference,
  });
  if (error) throw error;
  return data;
}

// ── category preferences (brief sections 17/18) ────────────────────────────

export async function getCreatorCategoryPreferences(publisherId: string): Promise<CreatorCategoryPreference[]> {
  const { data, error } = await supabase.from("creator_category_preferences").select("*").eq("publisher_id", publisherId);
  if (error) throw error;
  return data ?? [];
}

export async function setCreatorCategoryPreference(publisherId: string, category: string, preference: "preferred" | "excluded"): Promise<void> {
  const { error } = await supabase
    .from("creator_category_preferences")
    .upsert({ publisher_id: publisherId, category, preference }, { onConflict: "publisher_id,category" });
  if (error) throw error;
}

export async function removeCreatorCategoryPreference(publisherId: string, category: string): Promise<void> {
  const { error } = await supabase.from("creator_category_preferences").delete().eq("publisher_id", publisherId).eq("category", category);
  if (error) throw error;
}

export async function getBusinessCampaignPreferences(businessId: string): Promise<BusinessCampaignPreferences | null> {
  const { data, error } = await supabase.from("business_campaign_preferences").select("*").eq("business_id", businessId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveBusinessCampaignPreferences(prefs: BusinessCampaignPreferences): Promise<void> {
  const { error } = await supabase.from("business_campaign_preferences").upsert(prefs, { onConflict: "business_id" });
  if (error) throw error;
}
