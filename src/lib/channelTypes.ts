/**
 * Universal Advertising Channel Model
 *
 * Every advertising channel in the ChatSched marketplace conforms to
 * this contract. Adding a new channel type means implementing these interfaces
 * for that channel — the core marketplace never changes.
 *
 * Scope rule: every type here must directly help a business discover a
 * publisher, create a campaign, buy advertising, or measure results.
 */

// ─── Channel identity ────────────────────────────────────────────────────────

export type ChannelSlug =
  | "social-media"
  | "website"
  | "podcast"
  | "influencer"
  | "radio"
  | "sports"
  | "events"
  | "community"
  | "transport"
  | "informal-retail"
  | "associations"
  | "restaurants"
  | "in-venue-screens";

export type ChannelCategory =
  | "digital"
  | "broadcast"
  | "print"
  | "outdoor"
  | "direct"
  | "programmatic"
  | "sports"
  | "events"
  | "community"
  | "transport"
  | "informal-retail"
  | "associations"
  | "food-and-beverage";

export type PricingUnit =
  | "per_post"
  | "per_send"
  | "per_subscriber"
  | "per_listener"
  | "per_impression"
  | "per_click"
  | "per_acquisition"
  | "per_slot"
  | "per_event"
  | "per_cm2"
  | "per_word"
  | "flat_rate"
  | "retainer";

export interface PricingModel {
  unit: PricingUnit;
  /** Minimum price in ZAR */
  minPrice: number;
  /** Label shown in the UI, e.g. "per post", "CPM", "per 1 000 recipients" */
  label: string;
  /** Short description explaining how this pricing works for this channel */
  description: string;
}

export type AudienceSignal =
  | "follower_count"
  | "subscriber_count"
  | "listener_count"
  | "open_rate"
  | "engagement_rate"
  | "website_traffic"
  | "event_attendance"
  | "listener_reach"
  | "circulation"
  | "estimated_impressions"
  | "geographic_coverage"
  | "demographic_profile"
  | "language_profile"
  | "industry_vertical";

export interface AudienceProfile {
  signals: AudienceSignal[];
  typicalAudience: string;
  geographicScope: "local" | "regional" | "national" | "hyper-local";
}

export interface AvailabilityConfig {
  minLeadTimeDays: number;
  maxAdvanceBookingDays: number | null;
  minCampaignDays: number;
  supportsRecurring: boolean;
  schedulingNotes?: string;
}

export type MetricType =
  | "count"
  | "rate"
  | "currency"
  | "duration"
  | "ratio";

export interface AnalyticsMetric {
  key: string;
  label: string;
  type: MetricType;
  reportingMethod: "automated" | "manual" | "estimated";
  description: string;
}

export interface ReviewDimension {
  key: string;
  label: string;
  description: string;
}

export interface ChannelDefinition {
  slug: ChannelSlug;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  category: ChannelCategory;
  isLive: boolean;
  bookingFlow: "directory" | "request";
  minBudgetZAR: number;
  pricingModels: PricingModel[];
  audience: AudienceProfile;
  availability: AvailabilityConfig;
  analyticsMetrics: AnalyticsMetric[];
  reviewDimensions: ReviewDimension[];
  publisherRequirements: string[];
  advertiserBenefits: string[];
  exampleUseCases: string[];
  advertisingMethods?: { id: string; label: string; description: string }[];
  eligibility?: { metricLabel: string; minValue: number; checks: string[] };
  /**
   * Channel-specific override for the publisher approval window.
   * When set, this value is used instead of the global CREATOR_APPROVAL_WINDOW_DAYS
   * constant from constants.ts. Applies only to channels that need a different
   * window from the platform default (e.g. Events & Tournaments need more lead
   * time for programme/signage production). Omit on all other channels.
   */
  approvalWindowDays?: number;
}

export type CampaignRequestStatus =
  | "draft"
  | "pending"
  | "negotiating"
  | "confirmed"
  | "live"
  | "completed"
  | "declined"
  | "cancelled";

export interface ChannelCampaignRequest {
  id: string;
  channelSlug: ChannelSlug;
  publisherId: string;
  businessId: string;
  campaignMessage: string;
  budgetZAR: number | null;
  agreedAmountZAR: number | null;
  status: CampaignRequestStatus;
  startDate: string | null;
  endDate: string | null;
  channelData: Record<string, unknown>;
  createdAt: string;
}

export interface ChannelModule {
  definition: ChannelDefinition;
  BrowsePage?: React.ComponentType;
  ProfilePage?: React.ComponentType<{ publisherId: string }>;
  RequestForm?: React.ComponentType<{
    publisherId: string;
    onSubmit: (req: Partial<ChannelCampaignRequest>) => void;
  }>;
  AnalyticsPanel?: React.ComponentType<{ campaignId: string }>;
}
