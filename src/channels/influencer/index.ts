/**
 * Influencer Campaigns Channel Module — LIVE
 *
 * Feature flag: VITE_CHANNEL_INFLUENCER_ENABLED (default on — set to "false"
 * to pull this channel back to "coming soon" without a code deploy).
 *
 * Purpose-built for influencer marketing: longer-form content collaborations,
 * brand ambassador relationships, and creator campaigns. Differs from the
 * social-media channel in that the booking flow centres on the creator's
 * identity and narrative — not just a one-off post placement.
 *
 * Custom "request" booking flow (no online checkout): a business submits a
 * request from the creator's profile, the creator approves or declines from
 * their dashboard, then pays the platform directly. See ChannelRequestForm
 * and PublisherDashboardView.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const influencerModule: ChannelModule = {
  definition: {
    slug: "influencer",
    name: "Influencer Campaigns",
    tagline: "Authentic creator content that converts followers into customers.",
    description:
      "Commission South African content creators for multi-platform campaigns, unboxing videos, review posts, and brand ambassador partnerships. Influencer content feels organic, earns long-tail SEO value, and builds brand preference through trusted personal narratives.",
    emoji: "⭐",
    category: "digital",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 2000,
    pricingModels: [
      {
        unit: "per_post",
        minPrice: 2000,
        label: "Per deliverable",
        description: "Fixed fee per content piece (video, reel, post, story set).",
      },
      {
        unit: "retainer",
        minPrice: 5000,
        label: "Monthly retainer",
        description: "Ongoing brand ambassador arrangement with agreed content volume.",
      },
      {
        unit: "flat_rate",
        minPrice: 3000,
        label: "Campaign package",
        description: "Bundled deliverables across platforms for a defined campaign period.",
      },
      {
        unit: "per_acquisition",
        minPrice: 0,
        label: "Performance (affiliate)",
        description: "Commission per sale or sign-up driven by the creator's unique link.",
      },
    ],
    audience: {
      signals: [
        "follower_count",
        "engagement_rate",
        "demographic_profile",
        "geographic_coverage",
        "industry_vertical",
        "language_profile",
      ],
      typicalAudience:
        "Aspirational consumers who follow creators for lifestyle inspiration, product discovery, and entertainment. Strong millennial and Gen Z reach with high purchase intent driven by social proof.",
      geographicScope: "national",
    },
    availability: {
      minLeadTimeDays: 7,
      maxAdvanceBookingDays: 90,
      minCampaignDays: 1,
      supportsRecurring: true,
      schedulingNotes:
        "Allow 7 days for briefing and creative concept approval. Video deliverables require 10–14 days. Brand usage rights for creator content must be agreed upfront.",
    },
    analyticsMetrics: [
      {
        key: "total_reach",
        label: "Total Reach",
        type: "count",
        reportingMethod: "manual",
        description: "Unique accounts reached across all deliverables.",
      },
      {
        key: "engagement_rate",
        label: "Engagement Rate",
        type: "rate",
        reportingMethod: "manual",
        description: "Average engagement rate across all campaign content.",
      },
      {
        key: "story_views",
        label: "Story / Short-form Views",
        type: "count",
        reportingMethod: "manual",
        description: "Total views on Stories, Reels, or TikTok videos.",
      },
      {
        key: "link_clicks",
        label: "Link-in-Bio / Swipe-Up Clicks",
        type: "count",
        reportingMethod: "manual",
        description: "Clicks on the tracked link shared by the creator.",
      },
      {
        key: "affiliate_conversions",
        label: "Affiliate Conversions",
        type: "count",
        reportingMethod: "automated",
        description: "Sales or sign-ups via the creator's unique affiliate link or code.",
      },
      {
        key: "earned_media_value",
        label: "Earned Media Value",
        type: "currency",
        reportingMethod: "estimated",
        description: "Estimated equivalent ad spend for the organic reach generated.",
      },
    ],
    reviewDimensions: [
      { key: "content_quality", label: "Content Quality", description: "Creativity, production quality, and brand alignment of the content." },
      { key: "brief_adherence", label: "Brief Adherence", description: "How closely the deliverables matched the agreed campaign brief." },
      { key: "timeliness", label: "Timeliness", description: "Whether content was delivered and posted on schedule." },
      { key: "engagement_accuracy", label: "Engagement Accuracy", description: "Whether actual engagement matched the creator's benchmarks." },
      { key: "professionalism", label: "Professionalism", description: "Communication, revision willingness, and business conduct." },
    ],
    publisherRequirements: [
      "Minimum 5 000 followers on primary platform",
      "Average engagement rate of 2.5% or higher",
      "Past brand work examples or media kit",
      "South African creator or SA-focused audience",
      "Transparent about follower authenticity (no purchased followers)",
    ],
    advertiserBenefits: [
      "Authentic storytelling that social ads cannot replicate",
      "Long-tail value — content lives on after the campaign",
      "SEO benefit from blog and YouTube content",
      "Access to micro-influencers with hyper-engaged niche audiences",
    ],
    exampleUseCases: [
      "Skincare brand gifting a creator for an honest review video",
      "Fitness supplement company running a 30-day challenge with a gym influencer",
      "Restaurant inviting a food creator for a dedicated dining feature",
      "Tech brand seeding a new product to relevant SA creators pre-launch",
    ],
    advertisingMethods: [
      { id: "unboxing_review", label: "Unboxing / Product Review", description: "An in-depth video or post reviewing or unboxing your product." },
      { id: "brand_ambassador", label: "Brand Ambassador Package", description: "An ongoing monthly retainer with regular content." },
      { id: "product_highlight", label: "Dedicated Product Highlight", description: "A standalone post or video focused entirely on your product." },
      { id: "event_coverage", label: "Event Attendance / Live Coverage", description: "The creator attends and covers your event live, in person or online." },
    ],
    eligibility: {
      metricLabel: "Follower count (primary platform)",
      minValue: 5000,
      checks: [
        "My page/profile is public",
        "My audience is primarily South African",
        "I've posted in the last 30 days",
      ],
    },
  },
};

export default influencerModule;
