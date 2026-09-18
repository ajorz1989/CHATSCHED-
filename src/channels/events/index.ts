/**
 * Events & Tournaments Channel Module — NOT YET LIVE
 *
 * Feature flag: VITE_CHANNEL_EVENTS_ENABLED (default off — same reasoning
 * as the sports channel: ships inactive until real verified organisers
 * exist, see schema_phase74_universal_channels.sql).
 *
 * Connects advertisers with event and tournament organisers for
 * sponsorship placements tied to a specific date rather than an ongoing
 * presence — programme sponsorship, stage sponsorship, ticket/registration
 * sponsorship. Same request-based booking flow and publishers/rate-card
 * model as every other channel here; only genuinely new field is that
 * availability is naturally a single date (or short window) rather than
 * an ongoing monthly slot — captured in publishers.channel_metadata
 * (event_date, venue) rather than a new availability system.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const eventsModule: ChannelModule = {
  definition: {
    slug: "events",
    name: "Events & Tournaments",
    tagline: "Sponsor the moment, not just the medium.",
    description:
      "Sponsor South African events, conferences, and tournaments — title sponsorship, programme placement, stage branding, ticket or registration sponsorship. Event audiences are attentive and self-selected around a shared interest, which most ad formats can't match.",
    emoji: "🎫",
    category: "events",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 1000,
    pricingModels: [
      {
        unit: "per_event",
        minPrice: 1000,
        label: "Per event",
        description: "A single named sponsorship tied to one event or tournament date.",
      },
      {
        unit: "flat_rate",
        minPrice: 2500,
        label: "Tiered sponsorship",
        description: "Bronze/Silver/Gold/Headline-style tiers, each with its own placements and benefits, set by the organiser.",
      },
    ],
    audience: {
      signals: ["event_attendance", "demographic_profile", "geographic_coverage"],
      typicalAudience:
        "Attendees who chose to be there — self-selected around the event's specific topic, industry, or interest, with attention a passive ad placement rarely gets.",
      geographicScope: "local",
    },
    availability: {
      minLeadTimeDays: 21,
      maxAdvanceBookingDays: 365,
      minCampaignDays: 1,
      supportsRecurring: false,
      schedulingNotes:
        "Tied to a fixed event date, not an ongoing slot — book well ahead, since programme/signage production usually has its own lead time separate from the sponsorship agreement itself.",
    },
    analyticsMetrics: [
      { key: "expected_attendance", label: "Expected Attendance", type: "count", reportingMethod: "manual", description: "Organiser's stated expected attendance for the event." },
      { key: "promo_redemptions", label: "Promo Code / QR Redemptions", type: "count", reportingMethod: "manual", description: "Uses of an event-specific promo code or QR placement, where one was included." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the event's attendees to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Whether the placement matched what was agreed and was delivered on time for the event." },
      { key: "attendance_accuracy", label: "Attendance Accuracy", description: "Whether actual attendance matched what was quoted." },
    ],
    publisherRequirements: [
      "Real authority as the event's organiser or an authorised sponsor-sales representative, not just an attendee or volunteer",
      "A real, dated event — not a placeholder or recurring listing with no fixed date",
      "South African event",
    ],
    advertiserBenefits: [
      "Attentive, self-selected audience around a specific interest or industry",
      "A fixed date gives a clear, easy-to-report campaign window",
      "Tiered sponsorship options for different budgets",
    ],
    exampleUseCases: [
      "Local business sponsoring a small-business networking event's programme",
      "Fintech brand as headline sponsor of a industry conference",
      "Insurer sponsoring a community fun run's registration and ticket page",
    ],
    advertisingMethods: [
      { id: "title_sponsor", label: "Event Title Sponsor", description: "Top-tier, named sponsorship of the event itself." },
      { id: "programme_sponsor", label: "Programme Sponsor", description: "Placement in the event's printed or digital programme." },
      { id: "ticket_or_registration_sponsor", label: "Ticket/Registration Sponsor", description: "Branding on the ticketing or registration page/flow." },
      { id: "stage_sponsor", label: "Stage Sponsor", description: "Branding on the main stage or presentation area." },
      { id: "venue_signage", label: "Venue Signage", description: "Physical signage at the event venue — proof required (photo/video/date)." },
      { id: "event_email_sponsor", label: "Event Email Sponsor", description: "Placement in pre- or post-event emails to registered attendees." },
      { id: "qr_campaign", label: "QR Campaign", description: "A branded QR placement at the event, trackable via scan count." },
    ],
    eligibility: {
      metricLabel: "Verified organiser authority",
      minValue: 1,
      checks: [
        "I am the organiser of this event, or an authorised sponsor-sales representative",
        "This event has a real, confirmed date and venue",
        "I understand physical placements (signage) need photo/video proof, not just my word",
      ],
    },
  },
};

export default eventsModule;
