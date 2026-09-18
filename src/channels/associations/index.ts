/**
 * Local Associations & Business Networks Channel Module — NOT YET LIVE
 *
 * Feature flag: VITE_CHANNEL_ASSOCIATIONS_ENABLED (default off — same
 * posture as every channel added since Phase 74).
 *
 * From the original expansion doc's Section 17. Connects advertisers with
 * chambers of commerce, industry bodies, business networking groups, and
 * professional associations through their member communications —
 * newsletters, directories, conferences, webinars. Owner verification
 * matters the same way it does for Sports/Events/Community: a member of
 * an association isn't automatically authorised to sell its sponsorship
 * inventory, so `verification_required` is true here too.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const associationsModule: ChannelModule = {
  definition: {
    slug: "associations",
    name: "Local Associations & Business Networks",
    tagline: "Reach decision-makers through the network they already belong to.",
    description:
      "Sponsor South African chambers of commerce, industry bodies, and business networking groups — member newsletter placement, directory listings, conference and webinar sponsorship. B2B reach through a source members already trust for industry information, not a cold ad.",
    emoji: "🤝",
    category: "associations",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 500,
    pricingModels: [
      {
        unit: "per_post",
        minPrice: 500,
        label: "Per placement",
        description: "A single named sponsorship of one newsletter issue, directory listing, or announcement.",
      },
      {
        unit: "per_event",
        minPrice: 1500,
        label: "Per conference/webinar",
        description: "Sponsorship tied to a specific conference, webinar, or annual event.",
      },
      {
        unit: "retainer",
        minPrice: 3000,
        label: "Annual member-network sponsor",
        description: "Ongoing placement across a year of member communications, negotiated with the association directly.",
      },
    ],
    audience: {
      signals: ["subscriber_count", "industry_vertical", "geographic_coverage"],
      typicalAudience:
        "Business owners, professionals, and decision-makers who chose to join a specific industry or business network — smaller than a mass channel, but high B2B relevance and purchasing authority.",
      geographicScope: "regional",
    },
    availability: {
      minLeadTimeDays: 10,
      maxAdvanceBookingDays: 180,
      minCampaignDays: 1,
      supportsRecurring: true,
      schedulingNotes:
        "Newsletter and directory placements follow the association's own publishing schedule; conference/webinar sponsorship is tied to a fixed event date — check both before proposing a timeline.",
    },
    analyticsMetrics: [
      { key: "member_count", label: "Member Count Reached", type: "count", reportingMethod: "manual", description: "Association's stated membership size reached by the placement." },
      { key: "webinar_attendance", label: "Webinar/Conference Attendance", type: "count", reportingMethod: "manual", description: "Attendance figure, where the placement is tied to a specific event." },
      { key: "promo_redemptions", label: "Member Offer Redemptions", type: "count", reportingMethod: "manual", description: "Uses of a placement-specific member offer or promo code, where one was included." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the association's membership to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Turnaround time, communication, and whether the placement matched what was agreed." },
      { key: "reach_accuracy", label: "Reach Accuracy", description: "Whether actual member reach matched what was quoted." },
    ],
    publisherRequirements: [
      "Real authority to sell the association's sponsorship inventory — an office-bearer, administrator, or authorised sponsorship contact, not any individual member",
      "An active, identifiable association, chamber, or business network with real membership",
      "South African association or network",
    ],
    advertiserBenefits: [
      "Direct B2B reach into an audience with real purchasing authority",
      "Trust transferred from an industry body members already rely on",
      "Conference and webinar sponsorship ties a campaign to a specific, measurable moment",
    ],
    exampleUseCases: [
      "Accounting software sponsoring a chamber of commerce's member newsletter",
      "Insurer as headline sponsor of an industry body's annual conference",
      "Local bank sponsoring a business network's member directory",
    ],
    advertisingMethods: [
      { id: "member_newsletter_sponsor", label: "Member Newsletter Sponsor", description: "Sponsor placement in the association's regular newsletter to members." },
      { id: "directory_sponsor", label: "Directory Sponsor", description: "Featured or sponsored placement in the association's member directory." },
      { id: "annual_report_sponsor", label: "Annual Report Sponsor", description: "Sponsor placement in the association's annual report, where one is published." },
      { id: "webinar_sponsor", label: "Webinar Sponsor", description: "Named sponsorship of a member webinar." },
      { id: "conference_sponsor", label: "Conference Sponsor", description: "Sponsorship of the association's conference or flagship event." },
      { id: "website_sponsor", label: "Website Sponsor", description: "Placement on the association's own website." },
      { id: "member_offer", label: "Member Offer", description: "A special offer promoted directly to members as a benefit of association membership." },
    ],
    eligibility: {
      metricLabel: "Verified association authority",
      minValue: 1,
      checks: [
        "I have real authority to sell this association or network's sponsorship inventory",
        "This association has an active, verifiable membership",
        "I understand a single membership alone isn't authority to sell on the association's behalf",
      ],
    },
  },
};

export default associationsModule;
