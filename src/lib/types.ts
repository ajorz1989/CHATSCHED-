import type { ChannelSlug } from "./channelTypes";
import type { FlagReason } from "./messageSafety";
import type { BusinessVerificationLevel } from "./businessVerification";

export type Platform = "Facebook Page" | "Facebook Group" | "Instagram" | "TikTok" | "WhatsApp Channel" | "X" | "LinkedIn" | "YouTube";

export interface PublisherRateCard {
  id: string;
  publisher_id: string;
  label: string;
  price: number;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Publisher {
  id: string;
  name: string;
  city: string;
  province: string;
  suburb: string | null;
  category: string;
  platforms: Platform[];
  placement_types: string[] | null;
  accepted_ad_formats: string[] | null;
  followers: number;
  engagement: number;
  price_per_post: number;
  rating: number | null;
  reviews: number;
  verified: boolean;
  bio: string;
  audience: string;
  initials: string;
  swatch: string;
  created_at?: string;
  user_id: string | null;
  email: string | null;
  mobile_number: string | null;
  monthly_reach: number | null;
  languages: string[];
  account_age_months: number | null;
  posting_frequency: string | null;
  business_name: string | null;
  company_registration: string | null;
  vat_number: string | null;
  status: PublisherStatus;
  level: PublisherLevel | null;
  trust_score: number;
  publisher_score: number;
  avg_response_hours: number | null;
  response_count: number;
  // schema_phase109 — aggregate-only, same pattern as avg_response_hours
  // above. acceptance_rate is a 0-100 percentage, null until this
  // publisher has at least one responded request; acceptance_sample_size
  // is how many responded requests it's computed from (worth hiding the
  // rate in the UI below some minimum sample size).
  acceptance_rate: number | null;
  acceptance_sample_size: number;
  last_active_at: string | null;
  ai_audience_summary: string | null;
  ai_audience_summary_generated_at: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  identity_verified: boolean;
  admin_notes: string | null;
  authenticity_risk: "low" | "medium" | "high" | null;
  authenticity_notes: string | null;
  authenticity_checked_at: string | null;
  intro_video_url: string | null;
  portfolio_images: string[];
  profile_image_url: string | null;
  verification_proof_urls: string[];
  rejected_reason: string | null;
  featured: boolean;
  featured_until: string | null;
  reviewed_at: string | null;
  channel_slug: ChannelSlug;
  channel_metadata: Record<string, unknown> | null;
}

export type PublisherStatus = "pending_review" | "approved" | "rejected" | "suspended";
export type PublisherLevel = "rising" | "verified" | "premium" | "elite";

export interface Category {
  slug: string;
  name: string;
  icon: "food" | "fitness" | "beauty" | "home" | "family" | "auto" | "fashion" | "tech"
    | "lifestyle" | "news" | "community" | "retail" | "property" | "pets" | "events" | "social"
    | "sports" | "transport" | "township" | "business";
}

export type UserRole = "business" | "admin" | "publisher";

export type ContentStudioSubscriptionStatus = "pending" | "active" | "past_due" | "cancelled";

export interface ContentStudioSubscription {
  id: string;
  business_id: string;
  status: ContentStudioSubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
}

// ChatSched Business's once-off R399 activation fee (schema_phase86) —
// same shape SubscriptionSection.tsx already selects, lifted out into a
// real type so ActivationFeeInfo.tsx and ActivationNudge.tsx don't each
// redeclare an inline row shape for the same table.
export type BusinessSubscriptionStatus = "pending" | "active" | "failed" | "cancelled";

export interface BusinessSubscription {
  id: string;
  business_id: string;
  status: BusinessSubscriptionStatus;
  payfast_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
}

// Same once-off shape as BusinessSubscription, for the R199 publisher
// activation fee (schema_phase86) — used by PublisherActivationNudge.tsx.
export interface PublisherSubscription {
  id: string;
  publisher_id: string;
  status: BusinessSubscriptionStatus;
  payfast_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export type ReportReason = "fake_followers" | "no_response" | "inappropriate_content" | "scam_or_fraud" | "other";
export type ReportStatus = "open" | "reviewed" | "dismissed";

export interface Report {
  id: string;
  reporter_id: string;
  publisher_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  publisher?: Pick<Publisher, "name"> | null;
}

export type DisputeCategory = "payment_issue" | "quality_issue" | "non_delivery" | "communication" | "other";
export type DisputeStatus = "open" | "awaiting_response" | "resolved" | "closed";
export type DisputeOutcome = "refund_business" | "release_to_publisher" | "partial" | "no_action" | "other";
export type DisputeSenderRole = "business" | "publisher" | "admin";

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_role: DisputeSenderRole;
  body: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  request_id: string | null;
  channel_request_id: string | null;
  business_id: string;
  publisher_id: string;
  opened_by_role: "business" | "publisher";
  category: DisputeCategory;
  subject: string;
  status: DisputeStatus;
  resolution_outcome: DisputeOutcome | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  publisher?: Pick<Publisher, "name"> | null;
  business?: Pick<Profile, "full_name" | "company_name"> | null;
  dispute_messages?: DisputeMessage[];
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  created_at: string;
  province: string | null;
  city: string | null;
  industry: string | null;
  business_type: string | null;
  opportunity_preferences: string[];
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  business_verified: boolean;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  vat_number: string | null;
}

export type RequestStatus = "pending" | "contacted" | "confirmed" | "declined" | "completed";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export type PayoutStatus = "unpaid" | "paid";

export type PaymentMethod = "payfast" | "eft";

export interface Payment {
  id: string;
  request_id: string;
  business_id: string;
  amount: number;
  status: PaymentStatus;
  payfast_payment_id: string | null;
  payout_status: PayoutStatus;
  payout_date: string | null;
  created_at: string;
  paid_at: string | null;
  method: PaymentMethod;
  eft_reference: string | null;
  eft_confirmed_by_business_at: string | null;
}

export type ReviewAuthorRole = "business" | "publisher";

export interface Review {
  id: string;
  request_id: string;
  publisher_id: string;
  business_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author_role: ReviewAuthorRole;
  communication_rating: number | null;
  professionalism_rating: number | null;
  quality_rating: number | null;
  timeliness_rating: number | null;
  value_rating: number | null;
  business?: Pick<Profile, "full_name" | "company_name"> | null;
}

export interface PublisherRequest {
  id: string;
  publisher_id: string;
  business_id: string;
  campaign_message: string;
  budget: number | null;
  agreed_amount: number | null;
  status: RequestStatus;
  created_at: string;
  agency_campaign_id: string | null;
  publisher?: Pick<Publisher, "id" | "name" | "city" | "province"> | null;
  business?: (Pick<Profile, "full_name" | "company_name"> & { verification_level?: BusinessVerificationLevel | null }) | null;
  payments?: Payment[];
  reviews?: Review[];
}

export type SenderRole = "business" | "admin" | "publisher";

export interface Message {
  id: string;
  request_id: string | null;
  channel_request_id: string | null;
  sender_id: string;
  sender_role: SenderRole;
  body: string;
  created_at: string;
  read_at: string | null;
  flagged: boolean;
  flag_reason: FlagReason | null;
  flagged_at: string | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

export type CareerStatus = "draft" | "active" | "paused" | "closed";

export type CareerRemoteType = "onsite" | "hybrid" | "remote";
export type CareerEmploymentType = "full_time" | "part_time" | "contract" | "freelance" | "internship";
export type CareerSalaryPeriod = "hour" | "month" | "year" | "project" | "unspecified";

export interface Career {
  id: string;
  slug: string;
  job_title: string;
  department: string;
  location: string;
  remote_type: CareerRemoteType;
  employment_type: CareerEmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: CareerSalaryPeriod;
  short_summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  status: CareerStatus;
  application_deadline: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CareerApplicationStatus = "new" | "reviewing" | "interview" | "offer" | "hired" | "rejected";

export interface CareerApplication {
  id: string;
  career_id: string | null;
  name: string;
  email: string;
  role: string;
  cv_path: string;
  cv_filename: string;
  portfolio_url: string | null;
  linkedin_url: string | null;
  location: string;
  cover_letter: string;
  status: CareerApplicationStatus;
  interview_date: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export type WorkWithUsCategory =
  | "developers" | "designers" | "sales" | "marketing" | "creators"
  | "community_managers" | "sales_representatives" | "freelancers" | "internships";

export type WorkWithUsStatus = "new" | "contacted" | "archived";

export interface WorkWithUsApplication {
  id: string;
  name: string;
  email: string;
  category: WorkWithUsCategory;
  location: string;
  message: string;
  portfolio_url: string | null;
  linkedin_url: string | null;
  attachment_path: string | null;
  attachment_filename: string | null;
  status: WorkWithUsStatus;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export type PartnerCategory =
  | "marketing_agencies" | "web_developers" | "pr_agencies" | "photographers"
  | "event_companies" | "payment_providers" | "software_companies"
  | "creator_networks" | "media_organisations" | "business_associations";

export type PartnerStatus = "new" | "contacted" | "in_discussion" | "active" | "declined";

export type PartnerType = "agency" | "technology" | "media" | "community" | "referral";

export interface PartnerApplication {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  category: PartnerCategory | null;
  partner_type: PartnerType | null;
  website: string | null;
  message: string;
  status: PartnerStatus;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export type AdvertiseProduct =
  | "website_advertising" | "newsletter_sponsorship" | "featured_placement"
  | "sponsored_article" | "brand_partnership";

export type AdvertiseStatus = "new" | "contacted" | "in_discussion" | "active" | "declined";

export interface AdvertiseInquiry {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  product: AdvertiseProduct;
  budget_range: string | null;
  message: string;
  status: AdvertiseStatus;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface CommunityAnnouncement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type CommunityEventType = "webinar" | "in_person" | "online";

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  event_type: CommunityEventType;
  starts_at: string;
  ends_at: string | null;
  location_or_link: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type CommunityQuestionCategory = "publisher" | "business" | "marketing";
export type CommunityQuestionStatus = "pending" | "answered" | "published";

export interface CommunityQuestion {
  id: string;
  category: CommunityQuestionCategory;
  question: string;
  asked_by_name: string | null;
  asked_by_email: string | null;
  answer: string | null;
  status: CommunityQuestionStatus;
  admin_notes: string | null;
  created_at: string;
  answered_at: string | null;
}

export interface Conversation {
  id: string;
  business_id: string;
  publisher_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  created_at: string;
  publisher?: Pick<Publisher, "id" | "name" | "initials" | "city" | "province" | "swatch"> | null;
  business?: Pick<Profile, "full_name" | "company_name"> | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: SenderRole;
  body: string;
  created_at: string;
  read_at: string | null;
  flagged: boolean;
  flag_reason: FlagReason | null;
  flagged_at: string | null;
}

export type ChannelRequestStatus =
  | "pending"
  | "countered"
  | "declined"
  | "cancelled"
  | "awaiting_payment"
  | "payment_submitted"
  | "paid"
  | "live"
  | "completed";

export type CampaignStatus = "active" | "paused" | "archived";
export type CampaignEventType = "click" | "visit" | "lead" | "conversion";

export interface Campaign {
  id: string;
  owner_id: string;
  request_id: string | null;
  channel_request_id: string | null;
  name: string;
  slug: string;
  destination_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  status: CampaignStatus;
  created_at: string;
}

export interface CampaignStats {
  campaign_id: string;
  owner_id: string;
  slug: string;
  name: string;
  status: CampaignStatus;
  clicks: number;
  visits: number;
  leads: number;
  conversions: number;
  conversion_value: number;
  last_event_at: string | null;
}

export interface SavedSearch {
  id: string;
  business_id: string;
  name: string;
  filters: Record<string, unknown>;
  alerts_enabled: boolean;
  last_alerted_at: string | null;
  created_at: string;
}

export interface ChannelRequest {
  id: string;
  channel_slug: ChannelSlug;
  creator_id: string;
  business_id: string;
  campaign_message: string;
  advertising_method: string;
  proposed_amount: number;
  status: ChannelRequestStatus;
  created_at: string;
  approval_due_at: string;
  responded_at: string | null;
  counter_amount: number | null;
  counter_note: string | null;
  countered_at: string | null;
  payment_due_at: string | null;
  payment_submitted_at: string | null;
  paid_at: string | null;
  live_at: string | null;
  payout_due_at: string | null;
  completed_at: string | null;
  duration_days: number | null;
  request_metadata: Record<string, unknown> | null;
  agency_campaign_id: string | null;
  creator?: Pick<Publisher, "id" | "name" | "city" | "province" | "channel_slug"> | null;
  business?: (Pick<Profile, "full_name" | "company_name"> & { verification_level?: BusinessVerificationLevel | null }) | null;
}

export type ContentApprovalStatus =
  | "awaiting_draft"
  | "awaiting_review"
  | "changes_requested"
  | "approved"
  | "published";

export interface ContentApproval {
  id: string;
  channel_request_id: string;
  status: ContentApprovalStatus;
  brief_image_path: string | null;
  brief_video_path: string | null;
  brief_caption: string | null;
  brief_cta_label: string | null;
  brief_link: string | null;
  submitted_at: string;
  draft_image_path: string | null;
  draft_video_path: string | null;
  draft_caption: string | null;
  draft_notes: string | null;
  draft_submitted_at: string | null;
  change_request_notes: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  published_at: string | null;
}

export type DeliverableStatus = "pending" | "submitted" | "approved" | "published" | "verified";

export interface Deliverable {
  id: string;
  channel_request_id: string | null;
  request_id: string | null;
  label: string;
  quantity: number;
  notes: string | null;
  sort_order: number;
  status: DeliverableStatus;
  submission_url: string | null;
  submission_notes: string | null;
  submitted_at: string | null;
  business_notes: string | null;
  approved_at: string | null;
  published_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
}

export type AgencyLeadStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost" | "campaign" | "renewal";

export interface AgencyLead {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_id: string | null;
  stage: AgencyLeadStage;
  source: string | null;
  estimated_value: number | null;
  campaign_manager_id: string | null;
  publisher_manager_id: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_due: string | null;
  created_at: string;
  updated_at: string;
  campaign_manager?: Pick<Profile, "full_name"> | null;
  publisher_manager?: Pick<Profile, "full_name"> | null;
}

export type AgencyServiceLevel = "self_service" | "assisted" | "managed";
export type AgencyRenewalStatus = "none" | "upcoming" | "due" | "overdue" | "renewed";

export interface AgencyClient {
  id: string;
  business_id: string;
  service_level: AgencyServiceLevel;
  campaign_manager_id: string | null;
  lead_id: string | null;
  renewal_status: AgencyRenewalStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  business?: Pick<Profile, "full_name" | "company_name" | "phone"> | null;
  campaign_manager?: Pick<Profile, "full_name"> | null;
}

export interface AgencyClientTotals {
  lifetime_spend: number;
  campaign_count: number;
  last_campaign_at: string | null;
}

export type AgencyCampaignStatus = "draft" | "proposed" | "payment_pending" | "planning" | "in_progress" | "reporting" | "completed" | "cancelled";

export interface AgencyCampaign {
  id: string;
  client_id: string;
  campaign_manager_id: string | null;
  publisher_manager_id: string | null;
  name: string;
  objective: string | null;
  brief: string | null;
  target_audience: string | null;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  status: AgencyCampaignStatus;
  created_at: string;
  updated_at: string;
  package_price: number | null;
  package_payment_status: "unpaid" | "payment_submitted" | "paid";
  package_payment_reference: string | null;
  package_payment_submitted_at: string | null;
  package_paid_at: string | null;
}

export interface AgencyCampaignTotals {
  linked_requests: number;
  paid_requests: number;
  total_spend: number;
}

export interface LinkableRequest {
  id: string;
  kind: "request" | "channel_request";
  label: string;
  agency_campaign_id: string | null;
}

export interface PublisherRelationship {
  publisher_id: string;
  publisher_name: string;
  channel_slug: ChannelSlug;
  city: string;
  province: string;
  campaign_count: number;
  total_spent: number;
  last_campaign_at: string | null;
  avg_rating: number | null;
}

export interface BusinessRelationship {
  business_id: string;
  business_name: string;
  campaign_count: number;
  total_spent: number;
  last_campaign_at: string | null;
}

export interface MyManagedCampaign {
  id: string;
  name: string;
  objective: string | null;
  brief: string | null;
  target_audience: string | null;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  status: AgencyCampaignStatus;
  campaign_manager_name: string | null;
  created_at: string;
  package_price: number | null;
  package_payment_status: "unpaid" | "payment_submitted" | "paid";
  package_payment_reference: string | null;
  package_paid_at: string | null;
}

export interface MyManagedCampaignBooking {
  id: string;
  kind: "request" | "channel_request";
  status: string;
  amount: number | null;
  created_at: string;
}

export interface AdminAuditLogEntry {
  id: string;
  admin_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export type OpportunityStatus = "draft" | "open" | "filled" | "closed" | "cancelled";
export type OpportunityApplicationStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface OpportunityType {
  slug: string;
  label: string;
  description: string;
  suggested_channel_slug: ChannelSlug | null;
  active: boolean;
}

export interface Opportunity {
  id: string;
  business_id: string;
  title: string;
  brief: string;
  opportunity_type: string | null;
  target_province: string | null;
  target_city: string | null;
  target_audience: string | null;
  channel_slug: ChannelSlug | null;
  budget_min: number | null;
  budget_max: number | null;
  publishers_needed: number;
  status: OpportunityStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityApplication {
  id: string;
  opportunity_id: string;
  publisher_id: string;
  message: string;
  advertising_method: string | null;
  proposed_amount: number | null;
  status: OpportunityApplicationStatus;
  created_at: string;
  updated_at: string;
}

export type ToolCategory = "get_customers" | "convert" | "keep_customers" | "advertise" | "measure";
export type ToolType = "native" | "integrated" | "white_label" | "service";
export type ToolStatus = "draft" | "coming_soon" | "active" | "paused" | "archived";
export type ToolPricingModel = "free" | "included" | "paid_once" | "paid_monthly" | "paid_annual" | "custom" | "tbd";

export interface Tool {
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category: ToolCategory;
  tool_type: ToolType;
  icon: string | null;
  image_url: string | null;
  badge: string | null;
  status: ToolStatus;
  featured: boolean;
  sort_order: number;
  cta_label: string;
  cta_url: string | null;
  requires_auth: boolean;
  pricing_model: ToolPricingModel;
  setup_price: number | null;
  monthly_price: number | null;
  annual_price: number | null;
  target_customer: string | null;
  provider_name: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolFeature {
  id: string;
  tool_slug: string;
  title: string;
  description: string;
  sort_order: number;
}

export interface ToolBenefit {
  id: string;
  tool_slug: string;
  title: string;
  description: string;
  sort_order: number;
}

export interface ToolFaq {
  id: string;
  tool_slug: string;
  question: string;
  answer: string;
  sort_order: number;
}
