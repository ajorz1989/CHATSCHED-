import type { MarketingIconName } from "../components/MarketingIcon";

/**
 * Single source of truth for the Build My Campaign wizard's goals and step
 * labels. Shared by /build-my-campaign and the homepage campaign banner so
 * the two can't drift apart. Goal ids are also the values accepted by the
 * page's `?goal=` query parameter.
 */
export const CAMPAIGN_GOAL_OPTIONS: Array<{
  id: string;
  title: string;
  icon: MarketingIconName;
  tagline: string;
  focus: string;
}> = [
  {
    id: "cross_platform_awareness",
    title: "Cross-Platform Awareness",
    icon: "chart",
    tagline: "Build consistent visibility across multiple audiences and media touchpoints.",
    focus: "Brand visibility, recall & social proof",
  },
  {
    id: "multi_channel_leads",
    title: "Multi-Channel Lead Generation",
    icon: "chat",
    tagline: "Turn attention into WhatsApp chats, enquiries, bookings or qualified leads.",
    focus: "Enquiries, conversations & lead capture",
  },
  {
    id: "omnichannel_traffic",
    title: "Omnichannel Traffic & Conversion",
    icon: "bolt",
    tagline: "Drive measurable visits to your website, store, venue, event or offer.",
    focus: "Traffic, actions & conversion intent",
  },
  {
    id: "launch_demand",
    title: "Launch, Promotion & Demand",
    icon: "rocket",
    tagline: "Create coordinated momentum around a product, service, event or seasonal campaign.",
    focus: "Launches, promotions & demand creation",
  },
];

export const CAMPAIGN_WIZARD_STEPS = [
  { num: 1, label: "Goal" },
  { num: 2, label: "Where" },
  { num: 3, label: "Customers" },
  { num: 4, label: "Budget" },
  { num: 5, label: "Timing" },
  { num: 6, label: "Brand" },
  { num: 7, label: "Submit Campaign" },
] as const;
