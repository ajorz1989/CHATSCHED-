// Shared with src/pages/CaseStudies.tsx (the full page) and
// src/pages/BuildMyCampaign.tsx (a single relevant scenario shown
// mid-wizard, picked via bestScenarioForCategories below). Extracted here
// so both stay in sync — a case study fixed or reworded on one page
// updates the other automatically.
import {
  CREATOR_APPROVAL_WINDOW_DAYS,
  BUSINESS_PAYMENT_WINDOW_DAYS,
  CREATOR_PAYOUT_WINDOW_HOURS,
  PLATFORM_COMMISSION_RATE,
  PUBLISHER_SHARE,
} from "./constants";

const sharePct = Math.round(PUBLISHER_SHARE * 100);
const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);

export interface Scenario {
  channel: string;
  channelIcon: import("../components/MarketingIcon").MarketingIconName;
  business: string;
  businessDetail: string;
  creator: string;
  creatorDetail: string;
  request: string;
  steps: { title: string; body: string }[];
  /** Business categories (see CATEGORIES in constants.ts) this scenario is
   * the closest real-world fit for — used by bestScenarioForCategories to
   * pick a relevant example mid-wizard, not to imply these are the only
   * categories a channel suits. */
  categoryFit: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    channel: "Social Media",
    channelIcon: "smartphone",
    business: "A boutique coffee roaster in Woodstock, Cape Town",
    businessDetail: "Wants to reach nearby coffee drinkers ahead of a new single-origin launch.",
    creator: "A Cape Town food & lifestyle Facebook page",
    creatorDetail: "Runs a local page followed mostly by people within a few suburbs of the roastery.",
    request: "A main-feed post featuring the new bean, timed to launch week.",
    categoryFit: ["food", "fitness", "family", "fashion", "tech", "local-lifestyle", "events", "social-followers", "pets"],
    steps: [
      { title: "Business browses by category and city", body: "Filters Browse to Food & Drink pages based in Cape Town, and compares a shortlist by audience size and engagement." },
      { title: "Sends a request", body: "Submits what they want featured, the launch date, and a proposed budget — no account setup beyond signing up." },
      { title: "Creator approves", body: `The page owner reviews it in their dashboard and approves within the ${CREATOR_APPROVAL_WINDOW_DAYS}-day window.` },
      { title: "Business pays — ChatSched holds it", body: `Pays by card within the ${BUSINESS_PAYMENT_WINDOW_DAYS}-day payment window — the money is held by ChatSched, not released yet.` },
      { title: "Post goes live, creator gets paid", body: `The page owner posts on launch day and marks it live. Payout follows within ${CREATOR_PAYOUT_WINDOW_HOURS} hours — ${sharePct}% to the creator, ${commissionPct}% platform commission.` },
    ],
  },
  {
    channel: "Influencer",
    channelIcon: "microphone",
    business: "An independent nail studio in Sandton, Johannesburg",
    businessDetail: "Wants to build local awareness for a new gel-extension service.",
    creator: "A Johannesburg beauty micro-influencer",
    creatorDetail: "Posts get-ready-with-me and beauty-review content to a mostly local following.",
    request: "A short-form video reviewing the new service, filmed in-studio.",
    categoryFit: ["beauty"],
    steps: [
      { title: "Business finds a fit", body: "Uses Audience Finder to describe the service and area, and gets matched against the real influencer directory." },
      { title: "Sends a channel request", body: "Requests the influencer directly — no online checkout at this stage, just the campaign details." },
      { title: "Influencer approves the brief", body: `Reviews the ask and approves within ${CREATOR_APPROVAL_WINDOW_DAYS} days, or the request closes automatically.` },
      { title: "Business pays — ChatSched holds it", body: "Pays by EFT or card — held by ChatSched until the content is posted, not paid directly to the influencer up front." },
      { title: "Video goes live, influencer gets paid", body: `Once posted and marked live, payout follows within ${CREATOR_PAYOUT_WINDOW_HOURS} hours.` },
    ],
  },
  {
    channel: "Podcast",
    channelIcon: "microphone",
    business: "A family-run hardware store in Gqeberha",
    businessDetail: "Wants awareness ahead of a Saturday in-store sale.",
    creator: "A Nelson Mandela Bay local-interest podcast",
    creatorDetail: "Covers weekend events and local business for an Eastern Cape audience.",
    request: "A short host-read sponsorship mentioning the sale, in that week's episode.",
    categoryFit: ["home", "retail", "auto", "property", "regional-news", "community-groups"],
    steps: [
      { title: "Business browses the podcast channel", body: "Filters the channel directory to Eastern Cape shows in a relevant category." },
      { title: "Sends a request with the sale date", body: "Submits the ask and timing so the host can confirm it fits an upcoming episode." },
      { title: "Host approves", body: `Approves the sponsorship slot within the ${CREATOR_APPROVAL_WINDOW_DAYS}-day window.` },
      { title: "Business pays — ChatSched holds it", body: `Pays within ${BUSINESS_PAYMENT_WINDOW_DAYS} days of approval — funds held until the episode airs.` },
      { title: "Episode airs, host gets paid", body: `Host marks it live once the episode is out; payout follows within ${CREATOR_PAYOUT_WINDOW_HOURS} hours.` },
    ],
  },
];

/** Picks the scenario whose categoryFit best matches the business's
 * selected categories (first match wins, in SCENARIOS order), falling
 * back to the Social Media scenario — the one every recommended-channel
 * combination the campaign builder can produce today actually covers. */
export function bestScenarioForCategories(selectedCategories: string[]): Scenario {
  for (const scenario of SCENARIOS) {
    if (scenario.categoryFit.some((c) => selectedCategories.includes(c))) return scenario;
  }
  return SCENARIOS[0];
}
