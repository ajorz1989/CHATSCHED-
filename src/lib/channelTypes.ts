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

// Trimmed to the 5 channels the marketplace actually runs (social-media, plus
// the 4 launched in the same pass this comment was added). Eight placeholder
// channels — whatsapp, newsletter, email-campaigns, sms, community-events,
// digital-billboards, newspaper, ai-media-buying — were removed outright
// (definitions deleted, not just disabled) as part of that same change.
//
// Phase 74 added sports, events, community. Phase 75 adds two more: transport
// (minibus taxi advertising — the single largest daily-transit audience in
// the country, not covered by any of the other 9) and informal-retail (spaza
// shops/township traders — off the original expansion doc entirely, picked
// because it's the most direct match for "community markets and informal
// traders" ChatSched already says it serves). Same posture as Phase 74: own
// channel module, own feature flag, ships inactive until real owners exist.
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
  | "digital"        // online channels
  | "broadcast"      // radio, podcast
  | "print"          // newspaper, magazine
  | "outdoor"        // digital billboards
  | "direct"         // SMS, email, WhatsApp
  | "programmatic"   // automated, algorithm-driven buying
  | "sports"         // sports teams and leagues
  | "events"         // events and tournaments
  | "community"      // community groups and associations
  | "transport"      // minibus taxi and transport media
  | "informal-retail" // spaza shops and township traders
  | "associations"   // local associations and business networks
  | "food-and-beverage"; // restaurants and cafés

// Phase 76 adds one more: associations (local associations and business
// networks — member newsletters, directories, conferences). Same posture
// as every channel since Phase 74.

// ─── Pricing models ───────────────────────────────────────────────────────────

export type PricingUnit =
  | "per_post"          // single content piece
  | "per_send"          // per recipient in a bulk send
  | "per_subscriber"    // newsletter / email list size-based
  | "per_listener"      // podcast CPL
  | "per_impression"    // CPM-style
  | "per_click"         // CPC-style
  | "per_acquisition"   // CPA-style
  | "per_slot"          // time-based (radio spot, billboard rotation)
  | "per_event"         // community event sponsorship
  | "per_cm2"           // newspaper print column/cm²
  | "per_word"          // classified ads
  | "flat_rate"         // fixed fee regardless of unit
  | "retainer";         // ongoing monthly/campaign fee

export interface PricingModel {
  unit: PricingUnit;
  /** Minimum price in ZAR */
  minPrice: number;
  /** Label shown in the UI, e.g. "per post", "CPM", "per 1 000 recipients" */
  label: string;
  /** Short description explaining how this pricing works for this channel */
  description: string;
}

// ─── Audience definition ─────────────────────────────────────────────────────

export type AudienceSignal =
  | "follower_count"      // social / WhatsApp channel size
  | "subscriber_count"    // newsletter / email / SMS list size
  | "listener_count"      // podcast downloads per episode
  | "open_rate"           // email / newsletter engagement quality
  | "engagement_rate"     // social engagement as % of reach
  | "website_traffic"     // monthly unique visitors
  | "event_attendance"    // physical event footfall
  | "listener_reach"      // radio RAMS / digital radio reach
  | "circulation"         // newspaper print run
  | "estimated_impressions" // OOH / programmatic
  | "geographic_coverage" // where the audience is located
  | "demographic_profile" // age, gender, income breakdown
  | "language_profile"    // primary languages spoken
  | "industry_vertical";  // niche/topic alignment

export interface AudienceProfile {
  /** Primary signals this channel uses to describe its audience */
  signals: AudienceSignal[];
  /** Plain-English description of who this audience typically is */
  typicalAudience: string;
  /** Geographic scope */
  geographicScope: "local" | "regional" | "national" | "hyper-local";
}

// ─── Availability ─────────────────────────────────────────────────────────────

export interface AvailabilityConfig {
  /**
   * Minimum days notice required before a campaign can go live.
   * Used to block out dates in the booking calendar.
   */
  minLeadTimeDays: number;
  /**
   * Maximum days in advance a booking can be made.
   * null = no upper limit.
   */
  maxAdvanceBookingDays: number | null;
  /**
   * Minimum campaign duration in days.
   * 1 = single-day or single-send campaigns are allowed.
   */
  minCampaignDays: number;
  /**
   * Whether this channel supports recurring / always-on bookings.
   */
  supportsRecurring: boolean;
  /**
   * Scheduling notes shown during booking, e.g. "Radio spots book in
   * 30-second multiples; confirm slot availability with the station."
   */
  schedulingNotes?: string;
}

// ─── Analytics / campaign metrics ────────────────────────────────────────────

export type MetricType =
  | "count"       // raw integer (impressions, clicks)
  | "rate"        // 0–100 percent (open rate, engagement rate)
  | "currency"    // ZAR monetary value
  | "duration"    // seconds / minutes
  | "ratio";      // ratio, e.g. ROAS (revenue / spend)

export interface AnalyticsMetric {
  key: string;
  label: string;
  type: MetricType;
  /** Whether this metric can be delivered programmatically or requires manual reporting */
  reportingMethod: "automated" | "manual" | "estimated";
  /** Brief note explaining what this metric measures in this channel's context */
  description: string;
}

// ─── Review dimensions ────────────────────────────────────────────────────────

export interface ReviewDimension {
  key: string;
  label: string;
  description: string;
}

// ─── The full channel definition ──────────────────────────────────────────────

export interface ChannelDefinition {
  slug: ChannelSlug;
  name: string;
  tagline: string;
  description: string;
  /** Emoji used as a quick icon in lists and badges */
  emoji: string;
  category: ChannelCategory;
  /** The existing social-media channel maps to the live marketplace flow */
  isLive: boolean;
  /**
   * How a business actually books this channel once it's live:
   *  - "directory" — the original flow: browse publishers, request, pay via
   *    PayFast checkout (/browse). Only ever "social-media" — the always-on,
   *    hand-built marketplace core this whole model wraps around.
   *  - "request"   — submit a request that routes to the specific creator's
   *    dashboard for a self-serve approve/decline; no online checkout — the
   *    business pays the platform directly once approved. See ChannelPage's
   *    request section and PublisherDashboardView's creator queue.
   */
  bookingFlow: "directory" | "request";
  /** Minimum recommended campaign budget in ZAR */
  minBudgetZAR: number;
  pricingModels: PricingModel[];
  audience: AudienceProfile;
  availability: AvailabilityConfig;
  analyticsMetrics: AnalyticsMetric[];
  reviewDimensions: ReviewDimension[];
  /**
   * Publisher-facing notes: what kind of publisher fits this channel,
   * what they need to supply when they apply.
   */
  publisherRequirements: string[];
  /**
   * Advertiser-facing value proposition bullets shown on the channel hub card.
   */
  advertiserBenefits: string[];
  /**
   * Example use cases to help businesses understand when to use this channel.
   */
  exampleUseCases: string[];
  /**
   * Specific, channel-appropriate ad formats a business can pick from when
   * submitting a request (e.g. pre-roll audio for podcasts, banner
   * placements for websites). Rendered on the channel page and, for
   * "request"-flow channels, populates the request form's method picker.
   * Only channels with bookingFlow "request" need to supply this.
   */
  advertisingMethods?: { id: string; label: string; description: string }[];
  /**
   * The eligibility gate shown on the creator application form — lets one
   * shared wizard (PublisherApply) ask "follower count" for influencers but
   * "monthly unique visitors" for a website, etc, with 3 channel-appropriate
   * checkbox statements alongside the numeric threshold. Only channels with
   * bookingFlow "request" need to supply this; the original social-media
   * application hardcodes its own copy and ignores this field entirely.
   */
  eligibility?: { metricLabel: string; minValue: number; checks: string[] };
}

// ─── Campaign request ─────────────────────────────────────────────────────────

export type CampaignRequestStatus =
  | "draft"
  | "pending"
  | "negotiating"
  | "confirmed"
  | "live"
  | "completed"
  | "declined"
  | "cancelled";

/**
 * A generic campaign request that works across all channel types.
 * Channel-specific fields live in the `channelData` bag.
 */
export interface ChannelCampaignRequest {
  id: string;
  channelSlug: ChannelSlug;
  publisherId: string;
  businessId: string;
  /** The advertiser's campaign brief */
  campaignMessage: string;
  budgetZAR: number | null;
  agreedAmountZAR: number | null;
  status: CampaignRequestStatus;
  /** ISO date the campaign should go live */
  startDate: string | null;
  /** ISO date the campaign ends */
  endDate: string | null;
  /** Channel-specific booking data (e.g. slot time for radio, page URL for website) */
  channelData: Record<string, unknown>;
  createdAt: string;
}

// ─── Channel module interface ─────────────────────────────────────────────────

/**
 * Every advertising channel must export an object of this shape.
 * The channel registry collects these; the router renders them.
 * React components are optional — placeholder channels may omit them
 * and fall back to the generic ChannelPage renderer.
 */
export interface ChannelModule {
  definition: ChannelDefinition;
  /** Custom browse/listing page for this channel's publishers. Optional. */
  BrowsePage?: React.ComponentType;
  /** Custom publisher profile page for this channel. Optional. */
  ProfilePage?: React.ComponentType<{ publisherId: string }>;
  /** Custom booking/request form. Optional. */
  RequestForm?: React.ComponentType<{
    publisherId: string;
    onSubmit: (req: Partial<ChannelCampaignRequest>) => void;
  }>;
  /** Custom analytics panel for a completed campaign. Optional. */
  AnalyticsPanel?: React.ComponentType<{ campaignId: string }>;
}
