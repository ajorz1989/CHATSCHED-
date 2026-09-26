/**
 * Channel-specific onboarding field schemas.
 *
 * `publishers.channel_metadata` (schema_phase74) is a plain `jsonb` column
 * on purpose — see that migration's own comment on why a single shared
 * typed shape across all 12 channels would force incompatible metrics to
 * look equivalent (the expansion doc's own Section 21 warning, applied to
 * schema design rather than just UI copy). But "the column is loosely
 * typed" doesn't mean the data going into it should be — these are the
 * real, precise shapes for every channel, chosen from each channel's own
 * actual advertisingMethods/description in src/channels/*\/index.ts, not
 * invented generically.
 *
 * All 12 channels now have a typed schema — CHANNEL_UPDATES_AUDIT.md's own
 * "not done" list named this gap; closed here. Podcast, Informal Retail,
 * and Sports were the original three (deliberately contrasting, chosen to
 * prove the pattern generalizes); Social Media, Website, Influencer,
 * Radio, Events, Community, Transport, Associations, and Restaurants are
 * the remaining nine, added in the same session that closed the gap.
 * Where two channels are genuinely the same shape underneath (Community's
 * and Associations' reach channels; Community's newsletter cadence and
 * Podcast's episode frequency), they share the same type rather than
 * duplicating a near-identical enum — see each section's own comment for
 * which and why.
 */

// ── Podcast ──────────────────────────────────────────────────────────────
// Broadcast-shaped: episodic, download-metered, ad-slot-positioned. None
// of this has any equivalent on a channel with no concept of an "episode."

export type PodcastAdSlot = "pre-roll" | "mid-roll" | "post-roll";
export type PodcastFrequency = "weekly" | "biweekly" | "monthly" | "irregular";

export interface PodcastOnboardingFields {
  averageDownloadsPerEpisode: number;
  episodeFrequency: PodcastFrequency;
  averageEpisodeLengthMinutes: number;
  hostingPlatform: string; // e.g. "Spotify", "Apple Podcasts", "Podbean" — free text, not a closed list; new platforms launch constantly
  adSlotsAvailable: PodcastAdSlot[];
  topListenerRegions: string[]; // South African provinces primarily, but not constrained to them — some shows have real reach beyond SA
  // 12-Channel Audit fix A4 — a real, listenable link (RSS feed or a
  // platform show page) was missing entirely; without it a buyer can't
  // sample the show before booking, and there's no future path to
  // automated download-count verification against a real feed. Optional
  // (not backfillable for existing applications) so this is a safe,
  // additive change to a jsonb column — no migration touches existing rows.
  showUrl: string | null;
  // Free text — "Tuesday evenings, commute hours" reads more naturally to
  // a publisher than structured start/end times, same reasoning as
  // InformalRetailOnboardingFields.tradingHours below already uses.
  peakListeningTimes: string | null;
}

// ── Informal Retail (Spaza Shops & Township Traders) ───────────────────
// Physical-shop-shaped: foot traffic, trading hours, whether the shop even
// has the infrastructure (till, WhatsApp list) some placements need. No
// "episode" or "listener" concept applies here at all — the contrast with
// Podcast above is the point.

export interface InformalRetailOnboardingFields {
  estimatedDailyFootTraffic: number;
  tradingHours: string; // free text — "06:00–20:00, 7 days" reads more naturally to an owner than two separate time fields
  hasElectronicTill: boolean; // gates till-slip-sponsor eligibility specifically (see src/channels/informal-retail's advertisingMethods)
  hasWhatsappBroadcastList: boolean;
  whatsappBroadcastListSize: number | null; // null unless hasWhatsappBroadcastList is true
  nearbyLandmark: string; // "opposite Shoprite on Voortrekker Rd" — spaza shops often aren't on a mapped/numbered address
  priceRangeZAR: { min: number; max: number }; // what this specific shop actually charges, vs. the channel-wide minBudgetZAR floor
  // 12-Channel Audit fix A4 — distinct from tradingHours (when the shop is
  // OPEN) — when foot traffic is actually highest, which is what an
  // advertiser buying a till-slip or in-store placement really wants to
  // know. Optional, additive.
  peakFootTrafficHours: string | null;
  municipalRegistrationConfirmed: boolean;
}

// ── Sports Teams & Leagues ───────────────────────────────────────────────
// Organisation-shaped: competition structure, season, and — unlike the two
// above — a real authority question, because "I run this Instagram page"
// and "I can sell this club's sponsorship inventory" are different claims
// (Section 53 of the expansion doc).

export type SportsCompetitionLevel = "school" | "amateur" | "semi-professional" | "professional" | "university";
export type SponsorshipAuthorityRole = "owner" | "administrator" | "sponsorship_manager";

export interface SportsOnboardingFields {
  sport: string;
  competitionLevel: SportsCompetitionLevel;
  league: string;
  season: string; // e.g. "2026" or "2026/27" — free text, seasons aren't named consistently across sports
  squadSize: number;
  averageMatchdayAttendance: number | null; // null if not tracked/no fixed venue attendance to report
  homeVenue: string;
  sponsorshipAuthorityRole: SponsorshipAuthorityRole;
}

// ── Social Media ─────────────────────────────────────────────────────────
// Platform-and-format-shaped: which platform(s), what content format
// performs, how often. The original channel this whole architecture was
// first built around — still worth a real typed schema rather than
// leaving it on only the generic fields forever.

export type SocialMediaPlatform = "facebook" | "instagram" | "tiktok" | "whatsapp_channel" | "youtube" | "x";
export type SocialMediaContentFormat = "static_post" | "story" | "reel_or_short" | "carousel" | "live";

export interface SocialMediaOnboardingFields {
  primaryPlatform: SocialMediaPlatform;
  secondaryPlatforms: SocialMediaPlatform[];
  followerCountByPlatform: Record<string, number>; // keyed by SocialMediaPlatform value — Record<string,_> so a future platform doesn't need a schema migration to be recorded
  bestPerformingFormat: SocialMediaContentFormat;
  postsPerWeek: number;
  audienceCountry: string; // most pages are SA-focused, but not assumed — free text, not hardcoded to South Africa
  // Public profile URLs supplied during Social Media onboarding for manual verification.
  // Stored separately from channel_metadata because verification links are private.
  socialProfileLinks: Partial<Record<SocialMediaPlatform, string>>;
}

// ── Website ──────────────────────────────────────────────────────────────
// Traffic-and-placement-shaped: what independent publishing actually
// sells is attention measured in visits and placement inventory, not
// followers — a website has no "follower" concept at all.

export type WebsiteAdPlacement = "banner" | "in_article" | "sponsored_post" | "newsletter_mention" | "popup";

export interface WebsiteOnboardingFields {
  domain: string;
  monthlyUniqueVisitors: number;
  niche: string; // e.g. "parenting", "personal finance", "local news" — free text, niches are too varied to enumerate
  cms: string; // e.g. "WordPress", "Ghost", "custom" — free text, same reasoning as Podcast's hostingPlatform
  placementsAvailable: WebsiteAdPlacement[];
  averageSessionDurationSeconds: number | null; // null if not tracked — many smaller sites genuinely don't have analytics set up
}

// ── Influencer ───────────────────────────────────────────────────────────
// Person-and-format-shaped: a named individual's own reach and content
// style, distinct from Social Media above (a page/account, not
// necessarily a personal brand) even though both live on similar
// platforms — the expansion doc's own Section 21 reasoning for why these
// stay separate channels applies to their onboarding data too.

export type InfluencerContentFormat = "video" | "reel" | "post" | "story_set" | "livestream" | "blog_post";
export type InfluencerNiche = "fashion_beauty" | "food" | "fitness_health" | "tech" | "finance" | "parenting" | "travel" | "comedy_entertainment" | "gaming" | "general_lifestyle";

export interface InfluencerOnboardingFields {
  primaryPlatform: SocialMediaPlatform;
  niche: InfluencerNiche;
  contentFormats: InfluencerContentFormat[];
  averageEngagementRatePercent: number;
  pastBrandCollaborations: number; // count, not a list — the number itself signals experience level without asking for names/disclosure the publisher may not want to give at application stage
  offersUsageRights: boolean; // whether the creator will license content for the business's own use beyond the original post — a real, separately-negotiated line item in influencer deals
}

// ── Radio ────────────────────────────────────────────────────────────────
// Broadcast-shaped like Podcast, but live/scheduled rather than
// on-demand/downloaded — coverage area and listenership matter here in a
// way "downloads per episode" never captures.

export type RadioAdSlotLength = 15 | 30 | 60;

export interface RadioOnboardingFields {
  stationName: string;
  frequencyOrStream: string; // e.g. "94.5 FM" or "online-only stream URL" — one free-text field, since not every station has a terrestrial frequency
  coverageArea: string; // e.g. "Cape Town metro", "Eastern Cape province-wide"
  broadcastLanguages: string[]; // e.g. ["isiXhosa", "English"] — South Africa's 11 official languages plus others some community stations use, not a closed enum
  averageDailyListenership: number | null; // null if not independently measured — many community stations don't have formal ratings data
  availableSlotLengths: RadioAdSlotLength[];
  showSponsorshipAvailable: boolean; // whether a specific show/timeslot can be sponsored, vs. only rotation ad spots
  // 12-Channel Audit fix A4 — publisherRequirements for this channel
  // already says "Licensed South African community or commercial radio
  // station (ICASA registered)," but nothing ever captured the actual
  // licence number for admin to check against. Optional, additive.
  icasaLicenceNumber: string | null;
  peakListeningTimes: string | null; // e.g. "06:00–09:00 drive time" — same free-text reasoning as Podcast's own peakListeningTimes
}

// ── Events ───────────────────────────────────────────────────────────────
// Occasion-shaped: a specific date (or recurring series), an expected
// crowd, and — since sponsorship here is usually tiered — what tiers the
// organiser actually offers, unlike every always-on channel above.

export type EventType = "conference" | "tournament" | "festival" | "concert" | "trade_show" | "community_gathering";
export type EventFrequency = "one_off" | "annual" | "recurring_other";

export interface EventsOnboardingFields {
  eventName: string;
  eventType: EventType;
  frequency: EventFrequency;
  typicalAttendance: number;
  nextEventDate: string | null; // ISO date, null if not yet scheduled — a real annual event between editions still wants to list itself
  sponsorshipTiersOffered: string[]; // e.g. ["Bronze", "Silver", "Gold", "Headline"] — organiser-defined, not a fixed list (schema_phase74's own reasoning: incompatible structures shouldn't be forced to look equivalent)
  venueCity: string;
}

// ── Community ────────────────────────────────────────────────────────────
// Group-shaped: what kind of group, how it actually reaches its members
// (a newsletter and a WhatsApp group are very different sponsorship
// inventory even though both are "community"), and how often.

export type CommunityGroupType = "neighbourhood_association" | "hobby_or_interest_group" | "professional_network" | "club" | "religious_or_faith_group" | "school_or_alumni_group";
export type CommunityReachChannel = "newsletter" | "whatsapp_group" | "facebook_group" | "in_person_meetings" | "sms_list";

export interface CommunityOnboardingFields {
  groupType: CommunityGroupType;
  memberCount: number;
  reachChannels: CommunityReachChannel[];
  newsletterFrequency: PodcastFrequency | "none"; // reusing Podcast's cadence enum plus "none" — "how often does content go out" is genuinely the same shape as episode frequency, and forcing a fourth near-identical enum into existence would be exactly the incompatible-shapes-forced-to-look-equivalent mistake this file's header warns against in the other direction
  geographicArea: string; // e.g. "Sandton", "Stellenbosch" — most community groups are hyper-local
}

// ── Transport ────────────────────────────────────────────────────────────
// Fleet-and-route-shaped: minibus taxi advertising sells against vehicles
// and routes, not audience metrics at all — the least "media-shaped"
// channel in this set, on purpose (expansion doc's own point about
// widening what counts as a publisher).

export type TransportOperatorType = "individual_owner" | "taxi_association" | "fleet_operator";
export type TransportPlacementType = "interior_sticker" | "exterior_branding" | "rank_screen" | "headrest_placement" | "qr_code_deal";

export interface TransportOnboardingFields {
  operatorType: TransportOperatorType;
  vehicleCount: number;
  routesCovered: string[]; // e.g. ["Khayelitsha to Cape Town CBD"] — free text, taxi routes have no standardized naming
  estimatedDailyPassengers: number | null; // null if not tracked — most individual owners genuinely don't count this
  placementTypesAvailable: TransportPlacementType[];
  primaryRank: string; // the taxi rank this operator is most associated with, if any
  // 12-Channel Audit fix A4 — peak route/rank hours (morning commute vs.
  // evening commute vs. weekend) — directly relevant to a rank-screen or
  // vehicle-wrap buyer trying to estimate real eyeballs. Optional, additive.
  peakOperatingHours: string | null;
  authorityConfirmed: boolean;
}

// ── Associations ─────────────────────────────────────────────────────────
// Membership-body-shaped: similar reach-channel concept to Community, but
// distinctly B2B and often has a real, checkable directory-listing
// artifact — the two channels look adjacent but the audience and the
// trust claim being sold are different (same reasoning Influencer vs.
// Social Media above draws on).

export type AssociationType = "chamber_of_commerce" | "industry_body" | "networking_group" | "trade_union" | "professional_body";

export interface AssociationsOnboardingFields {
  associationType: AssociationType;
  memberCount: number;
  sectorsRepresented: string[]; // e.g. ["construction", "hospitality"] — free text, industry taxonomies vary too much to enumerate
  reachChannels: CommunityReachChannel[]; // same set of concepts as Community (newsletter/WhatsApp/etc.) — genuinely the same shape, not force-fit
  hasMemberDirectory: boolean; // gates directory-listing-sponsor eligibility specifically, same pattern as Informal Retail's hasElectronicTill gating till-slip-sponsor
  hostsRegularEvents: boolean;
  authorityConfirmed: boolean;
}

// ── Restaurants ──────────────────────────────────────────────────────────
// Venue-and-throughput-shaped: seating and daily covers, not audience —
// closest in spirit to Informal Retail (a physical venue with foot
// traffic) but with its own distinct placement inventory (menus, table
// cards, receipts) that a spaza shop doesn't have.

export type RestaurantVenueType = "sit_down_restaurant" | "cafe" | "quick_service" | "bar_or_pub" | "food_truck_or_stall";
export type RestaurantPlacementType = "menu_sponsorship" | "table_card" | "receipt_or_qr" | "loyalty_card" | "digital_menu_screen" | "waiting_area_screen";

export interface RestaurantsOnboardingFields {
  venueType: RestaurantVenueType;
  seatingCapacity: number | null; // null for food trucks/stalls with no fixed seating
  estimatedDailyCovers: number; // covers = customers served, the industry's own throughput term
  hasDigitalMenu: boolean; // gates digital-menu-screen-sponsor eligibility, same gating pattern as the two above
  placementTypesAvailable: RestaurantPlacementType[];
  cuisineType: string; // free text — too varied for a closed list
  // 12-Channel Audit fix A4 — when covers/foot traffic actually peak
  // (lunch service vs. dinner service vs. weekend brunch) — directly
  // relevant to anyone buying a waiting-area-screen or table-card slot.
  // Optional, additive.
  peakServiceTimes: string | null;
}

// ── In-Venue Screens & Displays ──────────────────────────────────────────
// Screen-shaped, not venue-type-shaped: unlike Restaurants (whose
// inventory is the venue's whole set of physical touchpoints — menus,
// table cards, receipts, and only sometimes a screen), this channel
// exists specifically because the screen/TV/projector IS the asset, and
// spans venue types Restaurants doesn't cover at all (nightclub, bar,
// gym, laundromat). A restaurant with a digital menu screen can
// reasonably list under both channels — table-card/menu sponsorship here,
// vs. dedicated screen-rotation inventory there — that's not a
// duplication bug, it's two different things the same venue happens to
// sell.

export type InVenueScreenType = "tv" | "projector" | "led_wall" | "digital_signage_display";
export type InVenueVenueType = "nightclub" | "bar_or_pub" | "restaurant_or_cafe" | "gym_or_fitness" | "laundromat" | "other";
export type InVenueFootTrafficTier = "low" | "medium" | "high" | "peak_nights_only";

export interface InVenueScreensOnboardingFields {
  venueType: InVenueVenueType;
  screenCount: number;
  screenType: InVenueScreenType;
  footTrafficTier: InVenueFootTrafficTier;
  estimatedFootfallPerNight: number;
  hasSoundCapability: boolean; // gates whether a business can submit creative with audio, vs. silent/captioned only
  peakTimesOrDays: string; // free text — "Friday & Saturday nights", "weekday mornings (gym rush)" — too varied for a closed list, same reasoning as InformalRetail's tradingHours
}

// ── Discriminated access, not a discriminated union on Publisher itself ──
// Publisher.channel_metadata stays loosely typed (Record<string, unknown> |
// null) because TypeScript can't correlate it with the sibling
// channel_slug field without turning Publisher into a discriminated union
// everywhere it's used — a much bigger change than this warrants. These
// helpers give real typing at the point of use instead, where the caller
// already knows (or is checking) the channel.

import type { Publisher } from "./types";
import { formatCurrencyRange } from "./currency";

export function getPodcastMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): PodcastOnboardingFields | null {
  if (p.channel_slug !== "podcast" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as PodcastOnboardingFields;
}

export function getInformalRetailMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): InformalRetailOnboardingFields | null {
  if (p.channel_slug !== "informal-retail" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as InformalRetailOnboardingFields;
}

export function getSportsMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): SportsOnboardingFields | null {
  if (p.channel_slug !== "sports" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as SportsOnboardingFields;
}

export function getSocialMediaMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): SocialMediaOnboardingFields | null {
  if (p.channel_slug !== "social-media" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as SocialMediaOnboardingFields;
}

export function getWebsiteMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): WebsiteOnboardingFields | null {
  if (p.channel_slug !== "website" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as WebsiteOnboardingFields;
}

export function getInfluencerMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): InfluencerOnboardingFields | null {
  if (p.channel_slug !== "influencer" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as InfluencerOnboardingFields;
}

export function getRadioMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): RadioOnboardingFields | null {
  if (p.channel_slug !== "radio" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as RadioOnboardingFields;
}

export function getEventsMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): EventsOnboardingFields | null {
  if (p.channel_slug !== "events" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as EventsOnboardingFields;
}

export function getCommunityMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): CommunityOnboardingFields | null {
  if (p.channel_slug !== "community" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as CommunityOnboardingFields;
}

export function getTransportMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): TransportOnboardingFields | null {
  if (p.channel_slug !== "transport" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as TransportOnboardingFields;
}

export function getAssociationsMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): AssociationsOnboardingFields | null {
  if (p.channel_slug !== "associations" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as AssociationsOnboardingFields;
}

export function getRestaurantsMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): RestaurantsOnboardingFields | null {
  if (p.channel_slug !== "restaurants" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as RestaurantsOnboardingFields;
}

export function getInVenueScreensMetadata(p: Pick<Publisher, "channel_slug" | "channel_metadata">): InVenueScreensOnboardingFields | null {
  if (p.channel_slug !== "in-venue-screens" || !p.channel_metadata) return null;
  return p.channel_metadata as unknown as InVenueScreensOnboardingFields;
}

// ── Admin review summary ──────────────────────────────────────────────────
// CHANNEL_UPDATES_AUDIT.md's remaining "not done" item: none of the above
// was visible anywhere in the moderation queue — stored and used on the
// public profile, invisible to the person deciding whether to approve it.
// One generic formatter rather than 12 near-identical admin-side branches,
// same "one function decides content" pattern MarketplaceProfileView.tsx
// already established for the public-facing side. Every field shown, not
// a curated subset — a reviewer verifying an application's plausibility
// needs the full picture, not a summary of it.

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "—";
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, val]) => `${k}: ${val}`).join(", ");
  return String(v);
}

export interface OnboardingSummaryField {
  label: string;
  value: string;
}

/**
 * Flattens whichever of the 12 typed schemas matches this publisher's
 * channel into label/value pairs for admin display. Returns an empty
 * array for a publisher with no channel_metadata yet (pre-Phase-74
 * applications, or any application that hasn't reached that step) —
 * an empty list, not an error, since plenty of real applications
 * predate this column existing at all.
 */
export function getOnboardingSummaryFields(p: Pick<Publisher, "channel_slug" | "channel_metadata">): OnboardingSummaryField[] {
  const podcast = getPodcastMetadata(p);
  if (podcast) {
    return [
      { label: "Avg. downloads/episode", value: fmt(podcast.averageDownloadsPerEpisode) },
      { label: "Episode frequency", value: fmt(podcast.episodeFrequency) },
      { label: "Episode length", value: `${fmt(podcast.averageEpisodeLengthMinutes)} min` },
      { label: "Hosting platform", value: fmt(podcast.hostingPlatform) },
      { label: "Ad slots offered", value: fmt(podcast.adSlotsAvailable) },
      { label: "Top listener regions", value: fmt(podcast.topListenerRegions) },
    ];
  }
  const retail = getInformalRetailMetadata(p);
  if (retail) {
    return [
      { label: "Daily foot traffic (est.)", value: fmt(retail.estimatedDailyFootTraffic) },
      { label: "Trading hours", value: fmt(retail.tradingHours) },
      { label: "Electronic till", value: fmt(retail.hasElectronicTill) },
      { label: "WhatsApp broadcast list", value: retail.hasWhatsappBroadcastList ? fmt(retail.whatsappBroadcastListSize) : "No" },
      { label: "Nearby landmark", value: fmt(retail.nearbyLandmark) },
      { label: "Price range", value: formatCurrencyRange(retail.priceRangeZAR?.min ?? 0, retail.priceRangeZAR?.max ?? 0) },
    ];
  }
  const sports = getSportsMetadata(p);
  if (sports) {
    return [
      { label: "Sport", value: fmt(sports.sport) },
      { label: "Competition level", value: fmt(sports.competitionLevel) },
      { label: "League", value: fmt(sports.league) },
      { label: "Season", value: fmt(sports.season) },
      { label: "Squad size", value: fmt(sports.squadSize) },
      { label: "Matchday attendance", value: fmt(sports.averageMatchdayAttendance) },
      { label: "Home venue", value: fmt(sports.homeVenue) },
      { label: "Sponsorship authority", value: fmt(sports.sponsorshipAuthorityRole) },
    ];
  }
  const social = getSocialMediaMetadata(p);
  if (social) {
    return [
      { label: "Primary platform", value: fmt(social.primaryPlatform) },
      { label: "Secondary platforms", value: fmt(social.secondaryPlatforms) },
      { label: "Followers by platform", value: fmt(social.followerCountByPlatform) },
      { label: "Best-performing format", value: fmt(social.bestPerformingFormat) },
      { label: "Posts/week", value: fmt(social.postsPerWeek) },
      { label: "Audience country", value: fmt(social.audienceCountry) },
    ];
  }
  const website = getWebsiteMetadata(p);
  if (website) {
    return [
      { label: "Domain", value: fmt(website.domain) },
      { label: "Monthly unique visitors", value: fmt(website.monthlyUniqueVisitors) },
      { label: "Niche", value: fmt(website.niche) },
      { label: "CMS", value: fmt(website.cms) },
      { label: "Placements available", value: fmt(website.placementsAvailable) },
      { label: "Avg. session duration", value: website.averageSessionDurationSeconds != null ? `${website.averageSessionDurationSeconds}s` : "—" },
    ];
  }
  const influencer = getInfluencerMetadata(p);
  if (influencer) {
    return [
      { label: "Primary platform", value: fmt(influencer.primaryPlatform) },
      { label: "Niche", value: fmt(influencer.niche) },
      { label: "Content formats", value: fmt(influencer.contentFormats) },
      { label: "Avg. engagement rate", value: `${fmt(influencer.averageEngagementRatePercent)}%` },
      { label: "Past brand collaborations", value: fmt(influencer.pastBrandCollaborations) },
      { label: "Offers usage rights", value: fmt(influencer.offersUsageRights) },
    ];
  }
  const radio = getRadioMetadata(p);
  if (radio) {
    return [
      { label: "Station name", value: fmt(radio.stationName) },
      { label: "Frequency/stream", value: fmt(radio.frequencyOrStream) },
      { label: "Coverage area", value: fmt(radio.coverageArea) },
      { label: "Broadcast languages", value: fmt(radio.broadcastLanguages) },
      { label: "Avg. daily listenership", value: fmt(radio.averageDailyListenership) },
      { label: "Slot lengths available", value: fmt(radio.availableSlotLengths.map((s) => `${s}s`)) },
      { label: "Show sponsorship available", value: fmt(radio.showSponsorshipAvailable) },
    ];
  }
  const events = getEventsMetadata(p);
  if (events) {
    return [
      { label: "Event name", value: fmt(events.eventName) },
      { label: "Event type", value: fmt(events.eventType) },
      { label: "Frequency", value: fmt(events.frequency) },
      { label: "Typical attendance", value: fmt(events.typicalAttendance) },
      { label: "Next event date", value: fmt(events.nextEventDate) },
      { label: "Sponsorship tiers offered", value: fmt(events.sponsorshipTiersOffered) },
      { label: "Venue city", value: fmt(events.venueCity) },
    ];
  }
  const community = getCommunityMetadata(p);
  if (community) {
    return [
      { label: "Group type", value: fmt(community.groupType) },
      { label: "Member count", value: fmt(community.memberCount) },
      { label: "Reach channels", value: fmt(community.reachChannels) },
      { label: "Newsletter frequency", value: fmt(community.newsletterFrequency) },
      { label: "Geographic area", value: fmt(community.geographicArea) },
    ];
  }
  const transport = getTransportMetadata(p);
  if (transport) {
    return [
      { label: "Operator type", value: fmt(transport.operatorType) },
      { label: "Vehicle count", value: fmt(transport.vehicleCount) },
      { label: "Routes covered", value: fmt(transport.routesCovered) },
      { label: "Daily passengers (est.)", value: fmt(transport.estimatedDailyPassengers) },
      { label: "Placement types available", value: fmt(transport.placementTypesAvailable) },
      { label: "Primary rank", value: fmt(transport.primaryRank) },
    ];
  }
  const associations = getAssociationsMetadata(p);
  if (associations) {
    return [
      { label: "Association type", value: fmt(associations.associationType) },
      { label: "Member count", value: fmt(associations.memberCount) },
      { label: "Sectors represented", value: fmt(associations.sectorsRepresented) },
      { label: "Reach channels", value: fmt(associations.reachChannels) },
      { label: "Has member directory", value: fmt(associations.hasMemberDirectory) },
      { label: "Hosts regular events", value: fmt(associations.hostsRegularEvents) },
    ];
  }
  const restaurants = getRestaurantsMetadata(p);
  if (restaurants) {
    return [
      { label: "Venue type", value: fmt(restaurants.venueType) },
      { label: "Seating capacity", value: fmt(restaurants.seatingCapacity) },
      { label: "Daily covers (est.)", value: fmt(restaurants.estimatedDailyCovers) },
      { label: "Has digital menu", value: fmt(restaurants.hasDigitalMenu) },
      { label: "Placement types available", value: fmt(restaurants.placementTypesAvailable) },
      { label: "Cuisine type", value: fmt(restaurants.cuisineType) },
    ];
  }
  const inVenueScreens = getInVenueScreensMetadata(p);
  if (inVenueScreens) {
    return [
      { label: "Venue type", value: fmt(inVenueScreens.venueType) },
      { label: "Screen count", value: fmt(inVenueScreens.screenCount) },
      { label: "Screen type", value: fmt(inVenueScreens.screenType) },
      { label: "Foot traffic tier", value: fmt(inVenueScreens.footTrafficTier) },
      { label: "Estimated footfall/night", value: fmt(inVenueScreens.estimatedFootfallPerNight) },
      { label: "Sound capability", value: fmt(inVenueScreens.hasSoundCapability) },
      { label: "Peak times/days", value: fmt(inVenueScreens.peakTimesOrDays) },
    ];
  }
  return [];
}
