/**
 * Website Advertising Channel Module — LIVE
 *
 * Feature flag: VITE_CHANNEL_WEBSITE_ENABLED (default on — set to "false" to
 * pull this channel back to "coming soon" without a code deploy).
 *
 * Enables businesses to place banner ads, sponsored content, and sidebar
 * placements on niche South African websites and blogs.
 *
 * Custom "request" booking flow (no online checkout): a business submits a
 * request from the creator's profile, the creator approves or declines from
 * their dashboard, then pays the platform directly. See ChannelRequestForm
 * and PublisherDashboardView.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const websiteModule: ChannelModule = {
  definition: {
    slug: "website",
    name: "Website Advertising",
    tagline: "Place your brand on niche South African websites and blogs.",
    description:
      "Sponsor content, banner placements, and in-article ads on independently owned websites and blogs with proven niche readership. Get in front of readers who actively seek out content in your category.",
    emoji: "🌐",
    category: "digital",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 500,
    pricingModels: [
      {
        unit: "per_impression",
        minPrice: 500,
        label: "CPM (per 1 000 impressions)",
        description: "Pay per thousand ad impressions served on the website.",
      },
      {
        unit: "per_click",
        minPrice: 500,
        label: "CPC (per click)",
        description: "Pay only when a visitor clicks your ad.",
      },
      {
        unit: "flat_rate",
        minPrice: 800,
        label: "Monthly sponsorship",
        description: "Fixed monthly fee for a dedicated placement slot.",
      },
    ],
    audience: {
      signals: [
        "website_traffic",
        "engagement_rate",
        "geographic_coverage",
        "demographic_profile",
        "industry_vertical",
        "language_profile",
      ],
      typicalAudience:
        "Active blog readers and content consumers in specific niches — food, fitness, parenting, DIY, tech — with high intent and lower ad fatigue than social media.",
      geographicScope: "regional",
    },
    availability: {
      minLeadTimeDays: 5,
      maxAdvanceBookingDays: 90,
      minCampaignDays: 7,
      supportsRecurring: true,
      schedulingNotes:
        "Allow 5 business days for creative review and slot setup. Monthly placements renew automatically unless cancelled 14 days before renewal.",
    },
    analyticsMetrics: [
      {
        key: "impressions",
        label: "Impressions",
        type: "count",
        reportingMethod: "automated",
        description: "Total ad impressions served on the website.",
      },
      {
        key: "clicks",
        label: "Clicks",
        type: "count",
        reportingMethod: "automated",
        description: "Clicks on the ad unit.",
      },
      {
        key: "ctr",
        label: "Click-Through Rate",
        type: "rate",
        reportingMethod: "automated",
        description: "Percentage of impressions that resulted in a click.",
      },
      {
        key: "avg_time_on_site",
        label: "Avg. Time on Site",
        type: "duration",
        reportingMethod: "estimated",
        description: "Average session duration for visitors referred by the ad.",
      },
      {
        key: "conversions",
        label: "Conversions",
        type: "count",
        reportingMethod: "manual",
        description: "Goal completions tracked via UTM parameters.",
      },
    ],
    reviewDimensions: [
      { key: "placement_quality", label: "Placement Quality", description: "Visibility and prominence of the ad placement." },
      { key: "audience_fit", label: "Audience Fit", description: "How relevant the website's audience was for the campaign." },
      { key: "traffic_accuracy", label: "Traffic Accuracy", description: "Whether delivered impressions matched the quoted volume." },
      { key: "communication", label: "Communication", description: "Ease of working with the publisher." },
    ],
    publisherRequirements: [
      "Minimum 5 000 unique monthly visitors (verified via analytics export)",
      "Original, regularly updated content in a defined niche",
      "South African–based or SA-focused readership",
      "No traffic sourced from paid-to-click or bot networks",
    ],
    advertiserBenefits: [
      "Context-matched ads — your brand appears beside relevant editorial",
      "Lower CPMs than mainstream ad networks",
      "Direct relationship with the publisher, no middleman auction",
      "Niche audiences with strong purchase intent",
    ],
    exampleUseCases: [
      "Kitchen appliance brand sponsoring a popular SA food blog",
      "Insurance company placing banner ads on a personal finance website",
      "Gym equipment retailer advertising on a fitness and wellness blog",
      "Property developer sponsoring content on a home décor website",
    ],
    advertisingMethods: [
      { id: "header_banner", label: "Header Banner Ad", description: "Full-width banner at the top of every page." },
      { id: "sidebar_banner", label: "Sidebar Banner Ad", description: "Standard display unit alongside the site's content." },
      { id: "in_article_banner", label: "In-Article Banner Ad", description: "An ad unit placed naturally within article content." },
      { id: "sponsored_post", label: "Sponsored Guest Post / Article", description: "A dedicated article written or approved by your brand." },
      { id: "homepage_takeover", label: "Homepage Takeover", description: "Featured, high-visibility placement on the site's homepage." },
    ],
    eligibility: {
      metricLabel: "Monthly unique visitors",
      minValue: 5000,
      checks: [
        "My website is live and publicly accessible",
        "My readership is primarily South African",
        "I've published new content in the last 30 days",
      ],
    },
  },
};

export default websiteModule;
