/**
 * Minibus Taxi & Transport Media Channel Module — NOT YET LIVE
 *
 * Feature flag: VITE_CHANNEL_TRANSPORT_ENABLED (default off — ships
 * inactive until real verified operators/associations exist to list, same
 * posture as every channel added since Phase 74).
 *
 * Minibus taxis are the single largest daily-transit audience in South
 * Africa — a real, long-precedented OOH advertising category none of the
 * other 9 channels touch. Owners are taxi associations, individual
 * owner-operators or fleets, or rank management bodies — not any one
 * driver claiming authority over an association's vehicles, which is why
 * `verification_required` is true here, same weight as Sports.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const transportModule: ChannelModule = {
  definition: {
    slug: "transport",
    name: "Minibus Taxi & Transport Media",
    tagline: "The route your customers already take, every day.",
    description:
      "Advertise on minibus taxis, at ranks, and on the routes South Africans actually travel every day — vehicle branding, interior stickers, rank screens, and QR-code deals reaching the country's biggest daily-transit audience.",
    emoji: "🚐",
    category: "transport",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 300,
    pricingModels: [
      {
        unit: "flat_rate",
        minPrice: 300,
        label: "Per vehicle",
        description: "A single vehicle's interior sticker or headrest placement for the campaign period.",
      },
      {
        unit: "flat_rate",
        minPrice: 1500,
        label: "Per fleet/route",
        description: "Exterior branding or rank-screen placement across an operator's fleet or a specific route, negotiated with the operator or association directly.",
      },
    ],
    audience: {
      signals: ["geographic_coverage", "estimated_impressions", "demographic_profile"],
      typicalAudience:
        "Daily commuters on a specific route or rank — high-frequency, captive attention during the ride, strongly skewed toward the working commuter base most mass-market advertising underserves.",
      geographicScope: "local",
    },
    availability: {
      minLeadTimeDays: 7,
      maxAdvanceBookingDays: 90,
      minCampaignDays: 7,
      supportsRecurring: true,
      schedulingNotes:
        "Vehicle branding/stickers typically run for a set period (weeks to months) rather than a single day — agree the exact removal/renewal date with the operator up front.",
    },
    analyticsMetrics: [
      { key: "estimated_daily_ridership", label: "Estimated Daily Ridership", type: "count", reportingMethod: "manual", description: "Operator or association's stated estimate of daily passengers across the branded vehicle(s) or route." },
      { key: "promo_redemptions", label: "QR/Promo Code Redemptions", type: "count", reportingMethod: "manual", description: "Uses of a placement-specific QR code or promo code, where one was included." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the route or rank's commuters to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Turnaround time and whether the placement matched what was agreed." },
      { key: "placement_durability", label: "Placement Durability", description: "Whether branding/stickers held up for the agreed campaign period." },
    ],
    publisherRequirements: [
      "Real authority to sell advertising on the vehicle(s) or at the rank — taxi association, owner-operator, fleet owner, or rank management body, not any individual driver claiming to speak for others' vehicles",
      "An active, identifiable route, rank, or fleet",
      "South African operator or association",
    ],
    advertiserBenefits: [
      "Reaches South Africa's largest daily-transit audience directly, not through a proxy",
      "High-frequency, captive attention during the commute",
      "Low entry price relative to other out-of-home advertising",
    ],
    exampleUseCases: [
      "Local retailer branding taxi interiors on a route past their store",
      "Airtime/data provider sponsoring headrest stickers across a fleet",
      "Community clinic running a QR-code health campaign at a busy rank",
    ],
    advertisingMethods: [
      { id: "vehicle_exterior_branding", label: "Vehicle Exterior Branding", description: "Full or partial exterior branding on the vehicle — proof required (photo/video/date), not self-attested." },
      { id: "interior_sticker", label: "Interior/Headrest Sticker", description: "Interior window or headrest sticker placement, visible to seated passengers for the duration of the ride." },
      { id: "rank_screen", label: "Rank Digital Screen", description: "Placement on a digital screen at a taxi rank, where the rank has one." },
      { id: "qr_code_deal", label: "QR Code Deal", description: "A branded QR code placed in-vehicle or at the rank, trackable via scan count." },
    ],
    eligibility: {
      metricLabel: "Verified operator/association authority",
      minValue: 1,
      checks: [
        "I have real authority to sell advertising on this vehicle, fleet, or rank",
        "This is an active route, rank, or fleet with verifiable ridership",
        "I understand physical placements need photo/video proof, not just my word",
      ],
    },
  },
};

export default transportModule;
