/**
 * Spaza Shops & Township Traders Channel Module — NOT YET LIVE
 *
 * Feature flag: VITE_CHANNEL_INFORMAL_RETAIL_ENABLED (default off — same
 * posture as every channel added since Phase 74).
 *
 * Not part of the original Universal Advertising Inventory Expansion doc —
 * added on top of it. Over 100,000 spaza shops nationally are the daily
 * retail touchpoint for townships and informal settlements, an audience
 * formal advertising barely reaches, through an owner who's usually a
 * known, trusted figure on that specific street or block. It's also the
 * most direct match for what ChatSched already says it's for: community
 * markets and informal traders, not just creators and publishers.
 *
 * Verification is lighter here than Sports/Events/Transport — a shop
 * owner is usually straightforwardly the authority over their own shop —
 * so `verification_required` is true but the bar the existing publisher-
 * review step applies can reasonably be lower-friction than for a channel
 * where someone could plausibly claim authority over an asset they don't
 * actually control.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const informalRetailModule: ChannelModule = {
  definition: {
    slug: "informal-retail",
    name: "Spaza Shops & Township Traders",
    tagline: "The shop on the corner your customers already trust.",
    description:
      "Advertise through spaza shops and township traders — till-point cards, window posters, till-slip sponsorship, and WhatsApp broadcast-list sponsorship reaching the daily retail touchpoint for townships and informal settlements. Lower minimum spend than any other channel, by design: this is the tier that opens ChatSched to campaigns without a marketing budget behind them.",
    emoji: "🏪",
    category: "informal-retail",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 150,
    pricingModels: [
      {
        unit: "flat_rate",
        minPrice: 150,
        label: "Per shop",
        description: "A single shop's till-point card, window poster, or till-slip sponsorship for the campaign period.",
      },
      {
        unit: "flat_rate",
        minPrice: 600,
        label: "Multi-shop / association",
        description: "Placement across several shops through a regional spaza or informal-trader association, negotiated directly.",
      },
    ],
    audience: {
      signals: ["geographic_coverage", "subscriber_count", "demographic_profile"],
      typicalAudience:
        "Regular local customers of a specific shop — daily or near-daily foot traffic, high trust in the shop owner, strong reach into households formal retail advertising rarely touches directly.",
      geographicScope: "hyper-local",
    },
    availability: {
      minLeadTimeDays: 3,
      maxAdvanceBookingDays: 60,
      minCampaignDays: 7,
      supportsRecurring: true,
      schedulingNotes:
        "Most placements (till-point card, window poster) run for weeks at a time rather than a single day — agree the display period with the shop owner up front.",
    },
    analyticsMetrics: [
      { key: "estimated_daily_footfall", label: "Estimated Daily Footfall", type: "count", reportingMethod: "manual", description: "Shop owner's stated estimate of daily customers passing the placement." },
      { key: "whatsapp_list_size", label: "WhatsApp Broadcast List Size", type: "count", reportingMethod: "manual", description: "Size of the shop's own WhatsApp broadcast list, where the sponsored method is a broadcast placement." },
      { key: "promo_redemptions", label: "Promo Code Redemptions", type: "count", reportingMethod: "manual", description: "Uses of a placement-specific promo code, where one was included." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the shop's regular customers to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Whether the placement matched what was agreed and stayed up for the agreed period." },
      { key: "reach_accuracy", label: "Reach Accuracy", description: "Whether actual footfall or list size matched what was quoted." },
    ],
    publisherRequirements: [
      "The shop owner, or someone with the owner's direct authorisation — usually straightforward to establish for a single small shop, unlike a shared community asset",
      "An active, operating shop or trading stall",
      "South African informal trader",
    ],
    advertiserBenefits: [
      "Reaches households and informal-economy customers formal advertising rarely touches directly",
      "The lowest minimum spend on the platform — accessible for genuinely small local budgets",
      "Trust transfers from a known local shop owner, not a stranger's ad",
    ],
    exampleUseCases: [
      "Airtime/data reseller sponsoring till-slip prints at five shops in one area",
      "Local clinic or NGO sponsoring a shop's WhatsApp broadcast for a health campaign",
      "Small FMCG brand running a window-poster campaign across a township",
    ],
    advertisingMethods: [
      { id: "till_point_card", label: "Till-Point Counter Card", description: "A branded card displayed at the till, seen by every paying customer." },
      { id: "window_poster", label: "Shop-Window Poster", description: "A poster displayed in the shop's window or entrance." },
      { id: "till_slip_sponsor", label: "Till-Slip Sponsor", description: "Branding or a promo code printed on the shop's till slips, where the shop has an electronic till." },
      { id: "loyalty_card_sponsor", label: "Loyalty Card Sponsor", description: "Sponsor placement on the shop's own loyalty or stamp card, where one exists." },
      { id: "whatsapp_broadcast_sponsor", label: "WhatsApp Broadcast Sponsor", description: "A sponsored mention in the shop's own WhatsApp broadcast list to regulars — already how many shops tell customers about stock and specials." },
    ],
    eligibility: {
      metricLabel: "Shop owner authority",
      minValue: 1,
      checks: [
        "I am the shop owner, or have the owner's direct authorisation to sell this placement",
        "This is a real, operating shop or trading stall",
        "I understand physical placements (till card, poster) need photo proof, not just my word",
      ],
    },
  },
};

export default informalRetailModule;
