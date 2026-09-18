/**
 * Platform-compliance / sponsored-content types — mirrors
 * supabase/schema_phase39_compliance.sql. See that file's header for the
 * full design rationale (why "campaign" means request_id/channel_request_id,
 * why status/risk fields are never client-writable, etc.).
 *
 * Positioning rule (do not remove): ChatSched never claims to guarantee
 * approval by a third-party platform. Any UI copy built on top of these
 * types must stay within: "ChatSched helps businesses and publishers
 * prepare campaigns for applicable platform requirements. Final
 * publication, enforcement and policy decisions remain with the relevant
 * platform."
 */

export type ComplianceStatus = "not_started" | "ready" | "needs_attention" | "under_review" | "not_eligible";

export type RiskLevel = "low" | "medium" | "high";

export type CategoryStatus = "allowed" | "restricted" | "manual_review" | "not_accepted";

export type ProofStatus = "pending_review" | "verified" | "rejected";

export type ComplianceReviewStatus = "pending" | "in_review" | "approved" | "rejected" | "request_changes";

export type RiskFlagSeverity = "info" | "low" | "medium" | "high";
export type RiskFlagSource = "ai" | "rule" | "admin";

/** One row per platform ChatSched supports. Admin-editable — never hard-code these values in a component; always read from this table. */
export interface PlatformComplianceRule {
  id: string;
  platform: string; // stable slug, e.g. "tiktok"
  display_name: string;
  enabled: boolean;
  disclosure_required: boolean;
  content_restrictions: string[];
  prohibited_categories: string[];
  restricted_categories: string[];
  required_creator_actions: string[];
  required_business_actions: string[];
  required_proof: string[];
  notes: string | null;
  policy_reference: string | null;
  last_reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignCategoryRule {
  id: string;
  category: string;
  chatsched_status: CategoryStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** The compliance record for one campaign (a `requests` row or a `channel_requests` row — never both). */
export interface CampaignCompliance {
  id: string;
  request_id: string | null;
  channel_request_id: string | null;
  business_id: string;
  publisher_id: string;
  platform: string | null;
  category: string | null;
  policy_version: number | null;
  status: ComplianceStatus;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  category_assessed: boolean;
  disclosure_identified: boolean;
  creator_accepted: boolean;
  brief_supplied: boolean;
  tracking_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignDisclosure {
  id: string;
  campaign_compliance_id: string;
  acknowledged_by: string;
  platform: string;
  requirement_version: number | null;
  acknowledged_at: string;
}

export interface CampaignProof {
  id: string;
  campaign_compliance_id: string;
  submitted_by: string;
  platform: string;
  post_url: string | null;
  post_id: string | null;
  screenshot_path: string | null;
  published_at: string | null; // date
  disclosure_confirmed: boolean;
  notes: string | null;
  status: ProofStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceReview {
  id: string;
  campaign_compliance_id: string;
  status: ComplianceReviewStatus;
  flagged_reasons: string[];
  assigned_admin_id: string | null;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRiskFlag {
  id: string;
  campaign_compliance_id: string;
  flag_type: string;
  severity: RiskFlagSeverity;
  description: string;
  source: RiskFlagSource;
  resolved: boolean;
  created_at: string;
}

export type CreatorCategoryPreference = {
  id: string;
  publisher_id: string;
  category: string;
  preference: "preferred" | "excluded";
  created_at: string;
};

export interface BusinessCampaignPreferences {
  business_id: string;
  preferred_creator_categories: string[];
  excluded_creator_categories: string[];
  brand_safety_requirements: string | null;
  competitor_exclusions: string[];
  location_requirements: string | null;
  audience_requirements: string | null;
  updated_at: string;
}

/** Display copy for ComplianceBadge/StatusPill-style components — keep in sync with the UX rule in the brief: simple language, no legal jargon in the primary label. */
export const COMPLIANCE_STATUS_LABEL: Record<ComplianceStatus, string> = {
  not_started: "Not started",
  ready: "Ready",
  needs_attention: "Needs attention",
  under_review: "Under review",
  not_eligible: "Not eligible",
};

export const COMPLIANCE_STATUS_ICON: Record<ComplianceStatus, string> = {
  not_started: "○",
  ready: "✓",
  needs_attention: "⚠",
  under_review: "◷",
  not_eligible: "✕",
};

/**
 * Plain-language summary of what's still outstanding on a campaign's
 * compliance record — the logic behind CampaignComplianceStrip, pulled out
 * here so it's a pure function with no component/network dependency and
 * can be unit tested directly (see complianceTypes.test.ts).
 */
export function outstandingComplianceItems(
  compliance: Pick<CampaignCompliance, "creator_accepted" | "tracking_configured" | "status">
): string[] {
  const outstanding: string[] = [];
  if (!compliance.creator_accepted) outstanding.push("disclosure not yet acknowledged");
  if (!compliance.tracking_configured) outstanding.push("tracking not yet configured");
  if (compliance.status === "under_review") outstanding.push("under manual review");
  if (compliance.status === "not_eligible") outstanding.push("not eligible in its current category");
  return outstanding;
}
