/**
 * Community Groups Channel Module — NOT YET LIVE
 *
 * Feature flag: VITE_CHANNEL_COMMUNITY_ENABLED (default off — same
 * reasoning as sports/events, see schema_phase74_universal_channels.sql).
 *
 * Connects advertisers with neighbourhood, hobby, professional, and other
 * approved community groups for sponsored announcements and newsletters.
 * The highest-scrutiny channel of the three added in Phase 74 —
 * `channels.verification_required` is true here specifically because
 * anyone can claim to run a WhatsApp group or Facebook community; the
 * expansion doc's own Section 52 is explicit that "I own this WhatsApp
 * group" isn't authority on its own. That check happens at the existing
 * publisher-review step (`status = 'reviewed'`), same gate every other
 * channel already goes through — this module doesn't invent a second,
 * community-specific approval flow.
 *
 * Note: this is a different, narrower concept than the existing
 * `community_announcements`/`community_events`/`community_questions`
 * tables (schema_phase52) — those are ChatSched's own internal
 * announcements/Q&A board for its existing users, not third-party groups
 * selling ad space. Checked directly before building this — no overlap,
 * nothing reused from there, nothing renamed.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const communityModule: ChannelModule = {
  definition: {
    slug: "community",
    name: "Community Groups",
    tagline: "Reach a community through someone it already trusts.",
    description:
      "Sponsor South African community groups — neighbourhood associations, hobby and interest groups, professional networks, clubs — through their own newsletters and announcements. Community-native placements carry a trust generic advertising can't buy.",
    emoji: "📣",
    category: "community",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 300,
    pricingModels: [
      {
        unit: "per_post",
        minPrice: 300,
        label: "Per announcement",
        description: "A single named sponsorship of one announcement or newsletter issue.",
      },
      {
        unit: "flat_rate",
        minPrice: 800,
        label: "Weekly/monthly sponsor",
        description: "Recurring named sponsorship across a set period, negotiated with the group directly.",
      },
    ],
    audience: {
      signals: ["geographic_coverage", "demographic_profile", "engagement_rate"],
      typicalAudience:
        "Members of a specific neighbourhood, interest group, or professional network — smaller reach than mass channels, but high relevance and trust within that group.",
      geographicScope: "local",
    },
    availability: {
      minLeadTimeDays: 5,
      maxAdvanceBookingDays: 90,
      minCampaignDays: 1,
      supportsRecurring: true,
      schedulingNotes:
        "Most groups communicate on a fixed cadence (weekly digest, monthly newsletter) — check the group's own schedule before proposing a date.",
    },
    analyticsMetrics: [
      { key: "reach", label: "Group Reach", type: "count", reportingMethod: "manual", description: "Estimated size of the group or newsletter list reached by the placement." },
      { key: "promo_redemptions", label: "Promo Code Redemptions", type: "count", reportingMethod: "manual", description: "Uses of a placement-specific promo code, where one was included." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the group's membership to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Turnaround time, communication, and whether the placement matched what was agreed." },
      { key: "reach_accuracy", label: "Reach Accuracy", description: "Whether actual reach matched what was quoted." },
    ],
    publisherRequirements: [
      "Real, verifiable authority to commercialise the group — administrator or owner role, not just membership",
      "An active, identifiable community (neighbourhood association, hobby/interest group, professional network, club, or other approved community type)",
      "South African community",
    ],
    advertiserBenefits: [
      "Reach a specific, self-selected community through a source its members already trust",
      "Lower minimum spend than most other channels — accessible for very local or small-budget campaigns",
      "Direct relevance for hyperlocal businesses",
    ],
    exampleUseCases: [
      "Local plumber sponsoring a neighbourhood association's monthly newsletter",
      "Pet store sponsoring a dog-owners' community group's weekly digest",
      "Local restaurant sponsoring a professional network's event announcement",
    ],
    advertisingMethods: [
      { id: "community_newsletter", label: "Community Newsletter", description: "Sponsor placement in the group's regular newsletter." },
      { id: "sponsored_announcement", label: "Sponsored Announcement", description: "A single named sponsorship of one announcement to the group." },
      { id: "event_sponsor", label: "Event Sponsor", description: "Sponsorship of a group-run event or gathering." },
      { id: "pinned_announcement", label: "Pinned/Promoted Announcement", description: "A time-limited pinned or promoted post, where the group's platform supports it." },
      { id: "local_guide_sponsor", label: "Local Guide Sponsor", description: "Sponsor placement in a group-run local guide or resource list, where one exists." },
    ],
    eligibility: {
      metricLabel: "Verified group authority",
      minValue: 1,
      checks: [
        "I have real, verifiable authority to commercialise this community (administrator or owner, not just a member)",
        "This is an active, identifiable community — not a placeholder group created for this application",
        "I understand \"I own this group\" alone isn't authority where real commercial value is involved — verification may ask for more",
      ],
    },
  },
};

export default communityModule;
