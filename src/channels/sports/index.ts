/**
 * Sports Teams & Leagues Channel Module — NOT YET LIVE
 *
 * Feature flag: VITE_CHANNEL_SPORTS_ENABLED (default off — set to "true"
 * once real, verified team/league owners exist to list; see
 * schema_phase74_universal_channels.sql for why it ships inactive).
 *
 * Connects advertisers with sports teams, leagues, and clubs for
 * sponsorship placements — scouting reports, matchday graphics, jersey
 * and venue placement, tournament programmes. Same booking flow as the
 * other request-based channels: no separate inventory system, a team is a
 * `publishers` row on this channel_slug with its own rate card per
 * placement type, exactly like a podcast or influencer.
 *
 * Owner verification matters more here than on the other channels — a
 * team member listing sponsorship inventory needs real authority to sell
 * the club's assets, not just an account (Section 53 of the expansion
 * doc). `channels.verification_required` is true for this slug; the
 * publisher-review step (existing `status = 'reviewed'` gate) is where
 * that check actually happens today — this module doesn't add a second
 * one.
 */

import type { ChannelModule } from "../../lib/channelTypes";

const sportsModule: ChannelModule = {
  definition: {
    slug: "sports",
    name: "Sports Teams & Leagues",
    tagline: "Reach a team's fans through the club itself, not a proxy.",
    description:
      "Sponsor South African sports teams, leagues, and clubs directly — scouting report sponsorships, matchday graphics, player-of-the-match placements, tournament programmes, and venue signage. A team's own channels reach fans with a trust a generic ad never will.",
    emoji: "🏆",
    category: "sports",
    isLive: true,
    bookingFlow: "request",
    minBudgetZAR: 500,
    pricingModels: [
      {
        unit: "per_post",
        minPrice: 500,
        label: "Per placement",
        description: "A single named sponsorship of one graphic, report, or post — e.g. \"Sponsored by Brand X\".",
      },
      {
        unit: "flat_rate",
        minPrice: 1500,
        label: "Per match/event",
        description: "Fixed fee for matchday-specific placements — programme, venue signage, player-of-the-match.",
      },
      {
        unit: "retainer",
        minPrice: 5000,
        label: "Season sponsorship",
        description: "Ongoing placement across a season or tournament, negotiated with the team directly.",
      },
    ],
    audience: {
      signals: ["follower_count", "engagement_rate", "geographic_coverage", "demographic_profile"],
      typicalAudience:
        "Local and regional fans, often with strong community and family ties to the club — high loyalty, high trust in club-endorsed brands.",
      geographicScope: "regional",
    },
    availability: {
      minLeadTimeDays: 7,
      maxAdvanceBookingDays: 180,
      minCampaignDays: 1,
      supportsRecurring: true,
      schedulingNotes:
        "Matchday-specific placements (venue signage, player-of-the-match, programme) need to be booked ahead of the fixture they're tied to — check the team's own availability before proposing a date.",
    },
    analyticsMetrics: [
      { key: "reach", label: "Placement Reach", type: "count", reportingMethod: "manual", description: "Estimated audience reached by the sponsored placement (follower count, matchday attendance, or both)." },
      { key: "engagement", label: "Engagement", type: "count", reportingMethod: "manual", description: "Likes, comments, and shares on the sponsored post or graphic." },
      { key: "promo_redemptions", label: "Promo Code Redemptions", type: "count", reportingMethod: "manual", description: "Uses of a placement-specific promo code or short URL, where one was included." },
    ],
    reviewDimensions: [
      { key: "audience_fit", label: "Audience Fit", description: "Relevance of the club's fanbase to the advertiser's target market." },
      { key: "professionalism", label: "Professionalism", description: "Turnaround time, communication, and whether the placement matched what was agreed." },
      { key: "reach_accuracy", label: "Reach Accuracy", description: "Whether actual reach matched what was quoted." },
    ],
    publisherRequirements: [
      "Real authority to sell the club's sponsorship inventory — team owner, administrator, or sponsorship manager, not any club member",
      "An active, identifiable team or league presence (social account, website, or verifiable fixture history)",
      "South African team or league",
    ],
    advertiserBenefits: [
      "Direct association with a team fans already trust and follow",
      "Placements tied to real fixtures and matchday moments, not generic ad slots",
      "Local and regional reach with strong community relevance",
    ],
    exampleUseCases: [
      "Local security company sponsoring a club's monthly scouting report",
      "Sports nutrition brand on matchday graphics for a season",
      "Regional bank as a tournament's headline sponsor",
    ],
    advertisingMethods: [
      { id: "scouting_report_sponsor", label: "Scouting Report Sponsor", description: "Named sponsorship of a regular scouting report — e.g. \"August Scouting Report — Sponsored by Brand X\"." },
      { id: "matchday_graphic", label: "Matchday Graphic", description: "Sponsor logo on the team's matchday lineup or result graphic." },
      { id: "player_of_the_match", label: "Player of the Match Sponsor", description: "Named sponsorship of the team's player-of-the-match announcement." },
      { id: "tournament_programme", label: "Tournament Programme", description: "Placement in a printed or digital tournament programme." },
      { id: "team_newsletter", label: "Team Newsletter", description: "Sponsor placement in the team's own newsletter, where one exists." },
      { id: "team_social_post", label: "Team Social Post", description: "A dedicated sponsored post on the team's own social channels." },
      { id: "venue_signage", label: "Venue Signage", description: "Physical signage at the team's home venue — proof required (photo/video/date), not self-attested." },
      { id: "jersey_or_kit_placement", label: "Jersey/Training Kit Placement", description: "Logo placement on match or training kit, subject to the team's own kit-sponsorship terms." },
    ],
    eligibility: {
      metricLabel: "Verified team/league authority",
      minValue: 1,
      checks: [
        "I have real authority to sell this team or league's sponsorship inventory",
        "This team or league has an active, verifiable presence (fixtures, social account, or website)",
        "I understand physical placements (signage, kit) need photo/video proof, not just my word",
      ],
    },
  },
};

export default sportsModule;
