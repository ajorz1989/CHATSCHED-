/**
 * Radio Advertising Channel Module — LIVE
 *
 * Feature flag: VITE_CHANNEL_RADIO_ENABLED (default on — set to "false" to
 * pull this channel back to "coming soon" without a code deploy).
 *
 * Connects advertisers with community radio stations, online radio streams,
 * and hybrid podcast-radio shows operating across South Africa. Community
 * radio in SA reaches millions of listeners in their home language —
 * a massively underserved advertising channel for local businesses.
 *
 * Custom "request" booking flow (no online checkout): a business submits a
 * request from the creator's profile, the creator approves or declines from
 * their dashboard, then pays the platform directly. See ChannelRequestForm
 * and PublisherDashboardView.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const radioModule: ChannelModule = {
  definition: {
    slug: "radio",
    name: "Radio Advertising",
    tagline: "Reach mass local audiences in their home language.",
    description:
      "Book 15, 30, or 60-second ad spots on South African community radio stations and online radio streams. Radio reaches audiences that social media misses — older, blue-collar, and rural demographics — and delivers high-frequency, memorable brand messages in the listener's first language.",
    emoji: "📻",
    category: "broadcast",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 2500,
    pricingModels: [
      {
        unit: "per_slot",
        minPrice: 2500,
        label: "Per 30-second spot",
        description: "Rate per 30-second ad slot in regular programming rotation.",
      },
      {
        unit: "flat_rate",
        minPrice: 5000,
        label: "Sponsorship package",
        description: "Sponsor a specific show or time slot — includes mention + spots.",
      },
      {
        unit: "retainer",
        minPrice: 8000,
        label: "Monthly station buy",
        description: "Agreed number of spots per week across a full month.",
      },
    ],
    audience: {
      signals: [
        "listener_reach",
        "geographic_coverage",
        "demographic_profile",
        "language_profile",
        "industry_vertical",
      ],
      typicalAudience:
        "Broad demographic reach with strong penetration in working-class, rural, and older audiences. Community radio listeners are highly loyal and local — listening average 3–4 hours per day.",
      geographicScope: "regional",
    },
    availability: {
      minLeadTimeDays: 14,
      maxAdvanceBookingDays: 90,
      minCampaignDays: 7,
      supportsRecurring: true,
      schedulingNotes:
        "Ad scripts must be approved by the station at least 10 days before air date. Production (voice recording) is typically arranged through the station. Spots air at agreed times within a ±30 min window.",
    },
    analyticsMetrics: [
      {
        key: "listener_reach",
        label: "Listener Reach",
        type: "count",
        reportingMethod: "estimated",
        description: "Estimated unique listeners reached during the campaign period (RAMS / streaming data).",
      },
      {
        key: "spot_frequency",
        label: "Spot Frequency",
        type: "count",
        reportingMethod: "automated",
        description: "Total number of times your ad aired during the campaign.",
      },
      {
        key: "avg_frequency",
        label: "Avg. Listener Frequency",
        type: "count",
        reportingMethod: "estimated",
        description: "Estimated times an average listener heard your ad.",
      },
      {
        key: "promo_redemptions",
        label: "Promo Code Redemptions",
        type: "count",
        reportingMethod: "manual",
        description: "Uses of any station-specific promo code included in the ad.",
      },
      {
        key: "brand_recall",
        label: "Brand Recall",
        type: "rate",
        reportingMethod: "manual",
        description: "Recall score from post-campaign listener survey (optional add-on).",
      },
    ],
    reviewDimensions: [
      { key: "reach_accuracy", label: "Reach Accuracy", description: "Whether actual listener reach matched the quoted figures." },
      { key: "production_quality", label: "Production Quality", description: "Audio quality and professionalism of the recorded spot." },
      { key: "slot_delivery", label: "Slot Delivery", description: "Whether spots aired as confirmed in the schedule." },
      { key: "audience_fit", label: "Audience Fit", description: "How well the station's listener demographic matched the target market." },
      { key: "communication", label: "Communication", description: "Ease of working with the station team." },
    ],
    publisherRequirements: [
      "Licensed South African community or commercial radio station (ICASA registered)",
      "Minimum 10 000 weekly listener reach (RAMS report or streaming listener stats)",
      "Ability to produce ads in-house or refer to a production partner",
      "Defined broadcast area and primary language(s)",
    ],
    advertiserBenefits: [
      "Reaches demographics that social media misses",
      "High-frequency exposure builds strong brand recall",
      "Community radio listeners trust their station deeply — ads benefit from that trust",
      "Home-language advertising improves comprehension and connection",
    ],
    exampleUseCases: [
      "Furniture store running a sale promotion on a regional community station",
      "Government services campaign targeting rural listeners in Zulu or Sotho",
      "Supermarket chain announcing weekly specials on a township radio station",
      "Car dealership sponsoring a morning traffic show in their city",
    ],
    advertisingMethods: [
      { id: "spot_30s", label: "30-Second Commercial Spot", description: "Standard rotation slot in regular programming." },
      { id: "spot_60s", label: "60-Second Commercial Spot", description: "Extended slot for a fuller message." },
      { id: "host_live_read", label: "Host Live Read", description: "The host reads your ad live, in their own words and voice." },
      { id: "segment_sponsorship", label: "Dedicated Segment Sponsorship", description: "Your brand named as the sponsor of a regular show or segment." },
    ],
    eligibility: {
      metricLabel: "Weekly listener reach",
      minValue: 10000,
      checks: [
        "My station is ICASA-licensed and currently broadcasting",
        "My listenership is primarily South African",
        "I've been on air within the last 30 days",
      ],
    },
  },
};

export default radioModule;
