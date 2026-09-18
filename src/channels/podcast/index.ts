/**
 * Podcast Sponsorships Channel Module — LIVE
 *
 * Feature flag: VITE_CHANNEL_PODCAST_ENABLED (default on — set to "false" to
 * pull this channel back to "coming soon" without a code deploy).
 *
 * Connects advertisers with SA podcast creators for pre-roll, mid-roll, and
 * post-roll sponsorships. Podcast ads are host-read and perceived as
 * personal recommendations — among the most trusted ad formats.
 *
 * Custom "request" booking flow (no online checkout): a business submits a
 * request from the creator's profile, the creator approves or declines from
 * their dashboard, then pays the platform directly. See ChannelRequestForm
 * and PublisherDashboardView.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const podcastModule: ChannelModule = {
  definition: {
    slug: "podcast",
    name: "Podcast Sponsorships",
    tagline: "Host-read ads from voices your listeners already trust.",
    description:
      "Sponsor South African podcasts with dedicated pre-roll, mid-roll, or post-roll segments read by the host in their own voice. Podcast ads have proven recall and conversion rates because listeners have a personal relationship with the host.",
    emoji: "🎙️",
    category: "broadcast",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 1500,
    pricingModels: [
      {
        unit: "per_listener",
        minPrice: 1500,
        label: "CPL (per listener)",
        description: "Priced per average episode download — typically R5–R15 CPL.",
      },
      {
        unit: "flat_rate",
        minPrice: 2000,
        label: "Per episode sponsorship",
        description: "Fixed fee for a named sponsorship of a single episode.",
      },
      {
        unit: "retainer",
        minPrice: 5000,
        label: "Series sponsorship",
        description: "Sponsor an entire season or series of episodes at a negotiated rate.",
      },
    ],
    audience: {
      signals: [
        "listener_count",
        "engagement_rate",
        "demographic_profile",
        "geographic_coverage",
        "industry_vertical",
        "language_profile",
      ],
      typicalAudience:
        "Commuters, exercise enthusiasts, and professionals who listen on-demand. SA podcast audiences skew 25–44, urban, and high-income — strong alignment with premium consumer brands.",
      geographicScope: "national",
    },
    availability: {
      minLeadTimeDays: 14,
      maxAdvanceBookingDays: 120,
      minCampaignDays: 1,
      supportsRecurring: true,
      schedulingNotes:
        "Host-read ads require a script brief at least 14 days before the episode records. Live-read ads cannot be edited after recording. Dynamic insertion ads offer more flexibility.",
    },
    analyticsMetrics: [
      {
        key: "downloads",
        label: "Episode Downloads",
        type: "count",
        reportingMethod: "manual",
        description: "Total downloads of the sponsored episode within 30 days.",
      },
      {
        key: "listen_through_rate",
        label: "Listen-Through Rate",
        type: "rate",
        reportingMethod: "estimated",
        description: "Percentage of listeners who reached the ad segment (estimated from chapter data).",
      },
      {
        key: "promo_redemptions",
        label: "Promo Code Redemptions",
        type: "count",
        reportingMethod: "manual",
        description: "Uses of the episode-specific promo code or UTM URL.",
      },
      {
        key: "subscriber_growth",
        label: "Subscriber Growth",
        type: "count",
        reportingMethod: "manual",
        description: "New podcast subscribers attributed to the sponsored episode period.",
      },
    ],
    reviewDimensions: [
      { key: "host_read_quality", label: "Host Read Quality", description: "How authentically and naturally the host delivered the ad." },
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the podcast audience to the advertiser's target market." },
      { key: "download_accuracy", label: "Download Accuracy", description: "Whether actual downloads matched the quoted average." },
      { key: "professionalism", label: "Professionalism", description: "Script turnaround time, ease of coordination." },
    ],
    publisherRequirements: [
      "Minimum 500 downloads per episode (30-day window)",
      "Consistent release schedule for at least 6 months",
      "Hosted on a verifiable platform (Spotify, Apple, Buzzsprout, etc.)",
      "South African or SA-focused content and audience",
    ],
    advertiserBenefits: [
      "Host-read ads feel like personal recommendations, not interruptions",
      "Ad-skipping rates significantly lower than video or display",
      "Promo codes provide clear, attributable ROI",
      "Access to educated, high-income urban audiences",
    ],
    exampleUseCases: [
      "Premium coffee brand sponsoring a morning business podcast",
      "Online learning platform advertising on a skills development show",
      "Medical aid sponsoring a health and wellness podcast",
      "Investment platform running a promo code on a personal finance show",
    ],
    advertisingMethods: [
      { id: "pre_roll", label: "Pre-Roll (15–30s)", description: "A short host-read ad before the episode content starts." },
      { id: "mid_roll", label: "Mid-Roll (60s)", description: "Read partway through the episode, where listener attention peaks." },
      { id: "post_roll", label: "Post-Roll", description: "Read after the episode ends — lower cost, still-engaged listeners." },
      { id: "dedicated_episode", label: "Dedicated Episode Sponsorship", description: "Full-episode branding plus a host mention at open and close." },
      { id: "host_read_shoutout", label: "Custom Host-Read Shoutout", description: "A one-off, custom shoutout read live by the host, in their own words." },
    ],
    eligibility: {
      metricLabel: "Average downloads per episode (30-day window)",
      minValue: 500,
      checks: [
        "My podcast is publicly available on a major platform (Spotify, Apple Podcasts, etc.)",
        "My audience is primarily South African",
        "I've published an episode in the last 30 days",
      ],
    },
  },
};

export default podcastModule;
