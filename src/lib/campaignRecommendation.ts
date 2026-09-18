import type { Publisher, Platform } from "./types";
import type { MarketingIconName } from "../components/MarketingIcon";

export interface CampaignGoal {
  id: string;
  title: string;
  icon: MarketingIconName;
  tagline: string;
  recommendedChannels: Platform[];
  suggestedDeliverables: string[];
}

export const CAMPAIGN_GOALS: CampaignGoal[] = [
  {
    id: "footfall",
    title: "Local Footfall & Store Visits",
    icon: "location",
    tagline: "Drive real foot traffic, in-person walk-ins, and venue visits in your city",
    recommendedChannels: ["Instagram", "Facebook Group", "WhatsApp Channel", "TikTok"],
    suggestedDeliverables: [
      "2x Geo-tagged Instagram Stories with location sticker",
      "1x Local creator in-store visit & reel",
      "1x Hyperlocal community group feature",
    ],
  },
  {
    id: "launch",
    title: "Product or Service Launch",
    icon: "rocket",
    tagline: "Generate high-impact buzz, word-of-mouth momentum, and first customer signups",
    recommendedChannels: ["TikTok", "Instagram", "WhatsApp Channel", "YouTube"],
    suggestedDeliverables: [
      "2x Dedicated TikTok / Reel product unboxing or demo videos",
      "3x Story announcements with direct swipe/link stickers",
      "1x WhatsApp broadcast announcement to high-engagement subscribers",
    ],
  },
  {
    id: "awareness",
    title: "Brand Awareness & Authority",
    icon: "chart",
    tagline: "Establish sustained top-of-mind recall and trusted social proof across SA",
    recommendedChannels: ["Instagram", "TikTok", "Facebook Page", "LinkedIn"],
    suggestedDeliverables: [
      "2x High-production feed carousel posts",
      "4x Story mentions highlighting brand value props",
      "1x Thought-leadership / brand narrative short video",
    ],
  },
  {
    id: "leads",
    title: "Lead Generation & Direct Inquiries",
    icon: "chat",
    tagline: "Prompt direct WhatsApp chats, quote requests, phone calls, and consultation bookings",
    recommendedChannels: ["WhatsApp Channel", "Facebook Page", "Instagram", "TikTok"],
    suggestedDeliverables: [
      "2x WhatsApp direct click-to-chat broadcast posts with promotional offer",
      "2x Story swipe-ups with direct WhatsApp lead links",
      "1x Problem-solution testimonial video",
    ],
  },
  {
    id: "sales",
    title: "E-Commerce & Online Sales",
    icon: "bag",
    tagline: "Drive high-converting website checkouts, app installs, and promo code usage",
    recommendedChannels: ["Instagram", "TikTok", "WhatsApp Channel"],
    suggestedDeliverables: [
      "3x Short-form demo videos featuring tracked promo code",
      "4x Link-in-bio & Story stickers driving direct checkout traffic",
      "1x Flash-sale WhatsApp Channel blast",
    ],
  },
  {
    id: "events",
    title: "Event Promotion & Ticket Sales",
    icon: "event",
    tagline: "Build excitement, sell out ticket tiers, and pack your upcoming event or festival",
    recommendedChannels: ["Instagram", "TikTok", "WhatsApp Channel", "Facebook Group"],
    suggestedDeliverables: [
      "2x Event lineup / venue reveal videos",
      "3x Countdown & ticket reminder story takeovers",
      "1x Ticket giveaway or exclusive subscriber discount code",
    ],
  },
];

export interface BudgetTier {
  id: string;
  title: string;
  min: number;
  max: number;
  defaultAmount: number;
  tag: string;
  reachEstimate: string;
  description: string;
}

export const BUDGET_TIERS: BudgetTier[] = [
  {
    id: "starter",
    title: "Starter Local Push",
    min: 2500,
    max: 5000,
    defaultAmount: 3500,
    tag: "Essential",
    reachEstimate: "25,000 – 60,000 Reach",
    description: "1–2 curated local creators or community channels. Perfect for single-location promotions or initial testing.",
  },
  {
    id: "growth",
    title: "Growth & Multi-Channel",
    min: 5000,
    max: 15000,
    defaultAmount: 9500,
    tag: "Most Popular",
    reachEstimate: "75,000 – 200,000 Reach",
    description: "3–5 creators across Instagram, TikTok, and WhatsApp Channels. Multi-touchpoint brand exposure.",
  },
  {
    id: "scale",
    title: "Full Campaign Blitz",
    min: 15000,
    max: 35000,
    defaultAmount: 22000,
    tag: "High Impact",
    reachEstimate: "250,000 – 600,000+ Reach",
    description: "6–10 top publishers with dedicated video reels, story takeovers, broadcast channels, and UGC assets.",
  },
  {
    id: "enterprise",
    title: "National Takeover",
    min: 35000,
    max: 100000,
    defaultAmount: 45000,
    tag: "Enterprise",
    reachEstimate: "800,000 – 1.5M+ Reach",
    description: "Comprehensive national creator blitz across major metro centers with priority campaign manager oversight.",
  },
];

export interface CampaignBuilderInputs {
  goalId: string;
  customGoal?: string;
  targetScope: "national" | "province" | "city" | "hyperlocal";
  selectedProvinces: string[];
  selectedCities: string[];
  hyperlocalArea?: string;
  targetCategories: string[];
  targetLanguages: string[];
  budgetTierId: string;
  customBudget?: number;
  timingPreference: "immediate" | "two_weeks" | "next_month" | "custom_dates";
  customTimingDates?: string;
  durationOption: "7_days" | "14_days" | "30_days" | "monthly_retainer";
}

export interface RecommendedCampaign {
  packageName: string;
  strategySummary: string;
  estimatedReach: string;
  channels: { platform: Platform; role: string; icon: MarketingIconName }[];
  matchedPublishers: Publisher[];
  estimatedCost: {
    creatorInventoryZar: number;
    managementFeeZar: number;
    totalBudgetZar: number;
  };
  deliverables: string[];
  trackingFeatures: { title: string; description: string }[];
}

export function generateCampaignRecommendation(
  inputs: CampaignBuilderInputs,
  availablePublishers: Publisher[]
): RecommendedCampaign {
  const goal = CAMPAIGN_GOALS.find((g) => g.id === inputs.goalId) || CAMPAIGN_GOALS[0];
  const budgetTier = BUDGET_TIERS.find((b) => b.id === inputs.budgetTierId) || BUDGET_TIERS[1];
  const totalBudget = inputs.customBudget && inputs.customBudget > 0 ? inputs.customBudget : budgetTier.defaultAmount;

  // Split budget: 80% direct creator inventory, 20% managed agency fee (or min R500)
  const managementFeeZar = Math.max(500, Math.round(totalBudget * 0.18));
  const creatorInventoryZar = Math.max(0, totalBudget - managementFeeZar);

  // Channels selection
  const channels = goal.recommendedChannels.slice(0, 3).map((platform) => {
    let role = "Brand amplification and high engagement";
    let icon: MarketingIconName = "smartphone";
    if (platform === "WhatsApp Channel") {
      role = "Direct push notifications & high-click WhatsApp engagement";
      icon = "chat";
    } else if (platform === "TikTok") {
      role = "Viral algorithm reach & authentic creator UGC";
      icon = "bolt";
    } else if (platform === "Instagram") {
      role = "Visual storytelling, Reels & high-intent swipe links";
      icon = "camera";
    } else if (platform === "Facebook Group" || platform === "Facebook Page") {
      role = "Suburban community trust & word-of-mouth recommendations";
      icon = "people";
    } else if (platform === "YouTube") {
      role = "Deep-dive evergreen video reviews & product demonstrations";
      icon = "camera";
    } else if (platform === "LinkedIn") {
      role = "B2B credibility and professional network reach";
      icon = "briefcase";
    }
    return { platform, role, icon };
  });

  // Filter & match publishers
  let matched = [...availablePublishers];

  // 1. Geographic match
  if (inputs.targetScope === "province" && inputs.selectedProvinces.length > 0) {
    const geoFiltered = matched.filter((p) => inputs.selectedProvinces.includes(p.province));
    if (geoFiltered.length >= 2) matched = geoFiltered;
  } else if (inputs.targetScope === "city" && inputs.selectedCities.length > 0) {
    const cityFiltered = matched.filter((p) => inputs.selectedCities.some((c) => p.city?.toLowerCase().includes(c.toLowerCase())));
    if (cityFiltered.length >= 2) matched = cityFiltered;
  }

  // 2. Category / Interest match
  if (inputs.targetCategories.length > 0) {
    const catFiltered = matched.filter((p) =>
      inputs.targetCategories.some((cat) => p.category.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(p.category.toLowerCase()))
    );
    if (catFiltered.length >= 2) matched = catFiltered;
  }

  // Fallback: If matched is still empty, grab highest-scoring approved publishers
  if (matched.length === 0) {
    matched = [...availablePublishers];
  }

  // Pick balanced selection of 2 to 4 publishers fitting the inventory budget
  const selectedPublishers: Publisher[] = [];
  let allocated = 0;

  for (const pub of matched) {
    if (selectedPublishers.length >= 4) break;
    const rate = pub.price_per_post || 1000;
    if (allocated + rate <= creatorInventoryZar * 1.25 || selectedPublishers.length < 2) {
      selectedPublishers.push(pub);
      allocated += rate;
    }
  }

  // If still fewer than 2, fill with top available
  if (selectedPublishers.length < 2 && availablePublishers.length > 0) {
    for (const p of availablePublishers) {
      if (!selectedPublishers.some((sp) => sp.id === p.id)) {
        selectedPublishers.push(p);
        if (selectedPublishers.length >= 2) break;
      }
    }
  }

  // Calculate dynamic reach estimate
  const totalFollowers = selectedPublishers.reduce((acc, p) => acc + (p.followers || 15000), 0);
  const estimatedReachRange = totalFollowers > 0
    ? `${Math.round(totalFollowers * 0.4).toLocaleString()} – ${Math.round(totalFollowers * 1.1).toLocaleString()} Estimated Impressions`
    : budgetTier.reachEstimate;

  // Build package name
  const locLabel =
    inputs.targetScope === "national"
      ? "National"
      : inputs.selectedCities[0] || inputs.selectedProvinces[0] || "Targeted";
  const packageName = `${locLabel} ${goal.title} Campaign`;

  // Build deliverables list
  const deliverables = [...goal.suggestedDeliverables];
  if (inputs.durationOption === "14_days" || inputs.durationOption === "30_days") {
    deliverables.push("Mid-flight creative optimization & story repost push");
  }
  deliverables.push("High-res creator UGC assets licensed for your own brand channels");

  const trackingFeatures = [
    {
      title: "Custom Tracked Shortlinks & UTM Parameters",
      description: "ChatSched generates unique, tamper-proof tracking URLs for every creator post to log clicks, referrers, and conversions in real-time.",
    },
    {
      title: "Dedicated WhatsApp & Promo Code Attribution",
      description: "Custom discount vouchers or direct WhatsApp click-to-chat triggers to measure exact customer conversations.",
    },
    {
      title: "Verified Screenshot Proof & Post-Mortem Report",
      description: "Full proof of publication with engagement metrics, view counts, and executive ROI summary upon campaign completion.",
    },
    {
      title: "100% Payment Protection",
      description: "Publisher payouts are strictly held by ChatSched until live deliverables are verified and approved.",
    },
  ];

  return {
    packageName,
    strategySummary: `A managed multi-publisher campaign engineered for ${goal.title.toLowerCase()} across ${locLabel}, pairing verified creators with multi-channel distribution.`,
    estimatedReach: estimatedReachRange,
    channels,
    matchedPublishers: selectedPublishers,
    estimatedCost: {
      creatorInventoryZar,
      managementFeeZar,
      totalBudgetZar: totalBudget,
    },
    deliverables,
    trackingFeatures,
  };
}
