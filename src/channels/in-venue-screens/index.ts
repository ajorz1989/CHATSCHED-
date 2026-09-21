/**
 * In-Venue Screens & Displays Channel Module — LIVE
 *
 * Feature flag: VITE_CHANNEL_IN_VENUE_SCREENS_ENABLED (live by default; env var is an emergency kill switch).
 * This channel is live with a manual creative-delivery workflow (see the
 * "Phase 1" note below) rather than a fully self-serve one.
 *
 * Nightclubs, bars, restaurants, gyms, and laundromats already own a
 * genuine advertising asset — a screen, TV, or projector already running
 * in front of a captive local audience — that nothing else on ChatSched
 * currently lists.
 *
 * OPERATIONAL WORKFLOW — READ BEFORE CHANGING advertisingMethods BELOW:
 * Phase 1 (this module, as built) is deliberately manual: a business's
 * creative goes through the same request-and-approve flow as every other
 * `request`-bookingFlow channel, the venue owner downloads the approved
 * file and loads it onto their own screen/media player themselves, and
 * proof of play is a timestamped photo/video of the screen showing the ad
 * live — identical to the photo-proof requirement already in place for
 * informal-retail and restaurants. This needs zero new infrastructure and
 * was chosen specifically so this channel could ship immediately.
 *
 * A Phase 2 "ChatSched Screen Player" (a lightweight web app a venue opens
 * once on a smart TV/Fire Stick that auto-pulls and rotates its approved
 * queue) would remove the manual load step and enable true hourly-rotation
 * billing — but that's a real build (a queue-consuming player + scheduling
 * API), and is explicitly NOT part of this module. Don't assume automatic
 * rotation/scheduling exists anywhere in this code just because
 * `advertisingMethods` below includes an "hourly rotation slot" pricing
 * option — today that still means the venue owner manually swaps the file
 * at the agreed time, same as everything else in this channel.
 *
 * Eligibility follows the informal-retail/restaurants template exactly
 * (owner authority + real operating venue + photo-proof understanding)
 * rather than a follower-count metric — a venue's advertising value comes
 * from its foot traffic and screen, not a social audience.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const inVenueScreensModule: ChannelModule = {
  definition: {
    slug: "in-venue-screens",
    name: "In-Venue Screens & Displays",
    tagline: "The screen your customers are already looking at.",
    description:
      "Advertise on real screens, TVs, and projectors already running inside nightclubs, bars, restaurants, gyms, and laundromats — a captive local audience, not a passing glance. Book a single event night, an hourly rotation slot, or a full week, and the venue owner handles getting your creative on screen.",
    emoji: "📺",
    category: "outdoor",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 200,
    pricingModels: [
      {
        unit: "flat_rate",
        minPrice: 200,
        label: "Hourly rotation slot",
        description: "Your creative rotates into the venue's screen loop for an agreed number of hours — priced per hour, scaling with the venue's foot-traffic tier.",
      },
      {
        unit: "flat_rate",
        minPrice: 500,
        label: "Per-event-night",
        description: "Full-night placement during a specific high-traffic event or service period — the highest-value slot a venue offers.",
      },
      {
        unit: "flat_rate",
        minPrice: 2800,
        label: "Weekly package",
        description: "A 7-night bundle, priced at a discount to the per-night rate — best for a recurring local promotion.",
      },
    ],
    audience: {
      signals: ["geographic_coverage", "demographic_profile"],
      typicalAudience:
        "Whoever is physically in the venue during the booked window — a captive, dwell-time audience rather than a passing one. Skews toward the venue's own typical crowd: nightlife-age at a club or bar, health-conscious locals at a gym, neighbourhood households at a laundromat.",
      geographicScope: "hyper-local",
    },
    availability: {
      minLeadTimeDays: 3,
      maxAdvanceBookingDays: 60,
      minCampaignDays: 1,
      supportsRecurring: true,
      schedulingNotes:
        "A single event-night booking can be agreed with as little as 3 days' notice; weekly packages and recurring rotation slots should be booked further ahead, especially for a venue's known peak nights.",
    },
    analyticsMetrics: [
      { key: "estimated_footfall_per_night", label: "Estimated Footfall Per Night", type: "count", reportingMethod: "manual", description: "Venue owner's stated estimate of people through the venue during a typical booked night or session." },
      { key: "screen_count", label: "Number of Screens", type: "count", reportingMethod: "manual", description: "How many screens/TVs/projectors at the venue would show the placement." },
      { key: "avg_dwell_time_minutes", label: "Average Dwell Time", type: "count", reportingMethod: "manual", description: "Roughly how long a typical customer spends in view of the screen — a gym or laundromat visit runs far longer than someone walking past a poster." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the venue's typical crowd to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Whether the placement ran for the full agreed period, on the agreed screen(s)." },
      { key: "reach_accuracy", label: "Reach Accuracy", description: "Whether actual footfall matched what the venue quoted at booking." },
    ],
    publisherRequirements: [
      "The venue owner, or someone with the owner's direct authorisation to sell this screen's advertising space",
      "A real, operating venue with a working screen, TV, or projector",
      "South African venue — nightclub, bar, restaurant, café, gym, or laundromat",
    ],
    advertiserBenefits: [
      "A captive, dwell-time audience rather than a passing glance — especially at a gym or laundromat, where a visit runs far longer than a few seconds",
      "Book a single high-traffic event night without committing to a long campaign",
      "Local, physical presence that complements — rather than competes with — a business's social and digital campaigns",
    ],
    exampleUseCases: [
      "A local energy-drink brand booking event-night screen time at a nightclub during its busiest weekend slot",
      "A meal-prep delivery service running an hourly rotation slot on gym screens during peak workout hours",
      "A neighbourhood laundromat sponsoring a nearby restaurant's weekly special on its own screen for a cross-promotion",
    ],
    advertisingMethods: [
      { id: "event_night_takeover", label: "Event-Night Takeover", description: "Your creative plays through the venue's busiest night — a club event, a restaurant's weekend service, a gym's peak hours." },
      { id: "hourly_rotation", label: "Hourly Rotation Slot", description: "Your creative rotates into the venue's regular screen loop for an agreed number of hours." },
      { id: "weekly_package", label: "Weekly Package", description: "A 7-night bundle of rotation slots, agreed up front at a discount to the nightly rate." },
      { id: "qr_code_overlay", label: "Dynamic QR Code Overlay", description: "A scannable QR code shown alongside or within your creative, linking straight to a menu, offer, or booking page." },
    ],
    eligibility: {
      metricLabel: "Venue owner authority",
      minValue: 1,
      checks: [
        "I am the venue owner, or have the owner's direct authorisation to sell this screen's advertising space",
        "This is a real, operating venue with a working screen, TV, or projector",
        "I understand screen placements need photo or video proof of the ad actually playing, not just a booking confirmation",
      ],
    },
  },
};

export default inVenueScreensModule;
