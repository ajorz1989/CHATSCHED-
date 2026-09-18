/**
 * Social Media Channel Module
 *
 * This is the LIVE channel — it maps directly to the existing ChatSched
 * marketplace (Browse, Search, Publisher Profiles, Campaign Requests).
 * No custom BrowsePage / ProfilePage / RequestForm needed here; the core app
 * routes handle everything.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const socialMediaModule: ChannelModule = {
  definition: {
    slug: "social-media",
    name: "Social Media Posts",
    tagline: "Reach engaged local audiences through trusted community pages.",
    description:
      "Partner with Facebook Page owners, Instagram creators, TikTok publishers, and WhatsApp Channel operators who have built loyal, engaged audiences in your target market. Pay per post and get authentic content that speaks your customers' language.",
    emoji: "📱",
    category: "digital",
    isLive: true,
    bookingFlow: "directory",
    minBudgetZAR: 250,
    pricingModels: [
      {
        unit: "per_post",
        minPrice: 250,
        label: "Per post",
        description: "Fixed fee for a single sponsored post on the publisher's platform.",
      },
      {
        unit: "flat_rate",
        minPrice: 1000,
        label: "Campaign package",
        description: "Bundle of posts across a campaign period at an agreed rate.",
      },
    ],
    audience: {
      signals: [
        "follower_count",
        "engagement_rate",
        "geographic_coverage",
        "demographic_profile",
        "language_profile",
        "industry_vertical",
      ],
      typicalAudience:
        "Local community members, interest-based followers, and niche audiences on Facebook, Instagram, TikTok, and WhatsApp Channels.",
      geographicScope: "local",
    },
    availability: {
      minLeadTimeDays: 3,
      maxAdvanceBookingDays: 90,
      minCampaignDays: 1,
      supportsRecurring: true,
      schedulingNotes:
        "Most publishers require 3 days notice. Confirm exact post timing with the publisher after booking.",
    },
    analyticsMetrics: [
      {
        key: "impressions",
        label: "Impressions",
        type: "count",
        reportingMethod: "manual",
        description: "Total times the post was displayed in a feed.",
      },
      {
        key: "reach",
        label: "Reach",
        type: "count",
        reportingMethod: "manual",
        description: "Unique accounts that saw the post.",
      },
      {
        key: "engagement_rate",
        label: "Engagement Rate",
        type: "rate",
        reportingMethod: "manual",
        description: "Likes + comments + shares as a percentage of reach.",
      },
      {
        key: "link_clicks",
        label: "Link Clicks",
        type: "count",
        reportingMethod: "manual",
        description: "Clicks on any link included in the post.",
      },
      {
        key: "saves",
        label: "Saves",
        type: "count",
        reportingMethod: "manual",
        description: "Number of times followers saved the post.",
      },
    ],
    reviewDimensions: [
      { key: "content_quality", label: "Content Quality", description: "How well the post represented the brand." },
      { key: "timeliness", label: "Timeliness", description: "Whether the post went live on the agreed date." },
      { key: "communication", label: "Communication", description: "Responsiveness and professionalism." },
      { key: "audience_fit", label: "Audience Fit", description: "How well the audience matched the target market." },
      { key: "results", label: "Results", description: "Overall impact on brand awareness or sales." },
    ],
    publisherRequirements: [
      "Minimum 1 000 followers on at least one platform",
      "Engagement rate of 2% or higher",
      "Active posting history of at least 6 months",
      "South African–based or SA-focused audience",
    ],
    advertiserBenefits: [
      "Authentic posts from trusted community voices",
      "Reach highly specific local audiences",
      "Low minimum spend — start from R250 per post",
      "Browse, compare, and book without a media buyer",
    ],
    exampleUseCases: [
      "Restaurant promoting a new menu to a local foodie page",
      "Gym running a membership drive via a fitness community",
      "Retailer announcing a sale on a regional shopping group",
      "New business building brand awareness in a suburb community",
    ],
  },
};

export default socialMediaModule;
