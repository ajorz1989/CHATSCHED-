/**
 * Restaurants & Cafés Channel Module — NOT YET LIVE
 *
 * Feature flag: VITE_CHANNEL_RESTAURANTS_ENABLED (default off — same
 * posture as every channel added since Phase 74).
 *
 * From the original expansion doc's Section 12. Deliberately paired with
 * Informal Retail rather than picked independently: same shape of
 * business (a single owner, daily foot traffic, straightforward
 * ownership to verify), same natural inventory (menu, till/receipt, QR,
 * loyalty card), same low entry price — together they cover most of the
 * small-physical-business advertising surface in one town or township,
 * not two disconnected verticals.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const restaurantsModule: ChannelModule = {
  definition: {
    slug: "restaurants",
    name: "Restaurants & Cafés",
    tagline: "The table your customers already sit at.",
    description:
      "Advertise through restaurants and cafés — menu sponsorship, table cards, receipt and QR-code placements, loyalty-card sponsorship, waiting-screen and digital-menu placement. Daily, captive attention from customers already sitting still with time to notice.",
    emoji: "🍽️",
    category: "food-and-beverage",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 200,
    pricingModels: [
      {
        unit: "flat_rate",
        minPrice: 200,
        label: "Per placement",
        description: "A single venue's menu sponsor, table card, or receipt sponsorship for the campaign period.",
      },
      {
        unit: "retainer",
        minPrice: 800,
        label: "Monthly sponsor",
        description: "Ongoing sponsorship across a month or more, negotiated with the venue directly.",
      },
    ],
    audience: {
      signals: ["geographic_coverage", "demographic_profile", "subscriber_count"],
      typicalAudience:
        "Regular and walk-in customers of a specific venue — captive, seated attention during a meal, plus whatever reach the venue's own newsletter or loyalty list adds.",
      geographicScope: "hyper-local",
    },
    availability: {
      minLeadTimeDays: 5,
      maxAdvanceBookingDays: 90,
      minCampaignDays: 7,
      supportsRecurring: true,
      schedulingNotes:
        "Menu and table-card placements typically run until the next print/reprint cycle — agree the display period with the venue up front.",
    },
    analyticsMetrics: [
      { key: "estimated_daily_covers", label: "Estimated Daily Covers", type: "count", reportingMethod: "manual", description: "Venue's stated estimate of daily customers/covers seeing the placement." },
      { key: "promo_redemptions", label: "Promo/QR Redemptions", type: "count", reportingMethod: "manual", description: "Uses of a placement-specific promo code or QR placement, where one was included." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the venue's customer base to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Whether the placement matched what was agreed and stayed up for the agreed period." },
      { key: "reach_accuracy", label: "Reach Accuracy", description: "Whether actual covers/footfall matched what was quoted." },
    ],
    publisherRequirements: [
      "The venue owner or manager, or someone with their direct authorisation — permission to commercialise the specific advertising asset (menu, receipt, till system) matters, not just working there",
      "An active, operating restaurant or café",
      "South African venue",
    ],
    advertiserBenefits: [
      "Captive, seated attention rather than a passing glance",
      "Low entry price relative to most other channels",
      "Natural fit for local, food-adjacent, or lifestyle brands",
    ],
    exampleUseCases: [
      "Local delivery app sponsoring a café's till-slip QR code",
      "Beverage brand sponsoring a restaurant's table cards for a month",
      "Local gym cross-promoting through a nearby café's loyalty card",
    ],
    advertisingMethods: [
      { id: "menu_sponsor", label: "Menu Sponsor", description: "Branding on the back or corner of the printed or digital menu." },
      { id: "table_card", label: "Table Card", description: "A branded card or tent card on the table." },
      { id: "receipt_or_qr_sponsor", label: "Receipt/QR Sponsor", description: "Branding or a promo code printed on receipts or a QR placement at the till, where the venue has an electronic till." },
      { id: "loyalty_card_sponsor", label: "Loyalty Card Sponsor", description: "Sponsor placement on the venue's own loyalty or stamp card, where one exists." },
      { id: "waiting_screen_sponsor", label: "Waiting-Screen Sponsor", description: "Placement on a screen in the waiting or seating area, where the venue has one." },
      { id: "customer_newsletter", label: "Customer Newsletter/List Sponsor", description: "Sponsor placement in the venue's own customer newsletter or WhatsApp/SMS list, where one exists." },
    ],
    eligibility: {
      metricLabel: "Venue owner/manager authority",
      minValue: 1,
      checks: [
        "I am the owner or manager of this venue, or have their direct authorisation to sell this placement",
        "This is a real, operating restaurant or café",
        "I understand physical placements (menu, table card) need photo proof, not just my word",
      ],
    },
  },
};

export default restaurantsModule;
