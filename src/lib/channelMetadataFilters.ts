/**
 * Channel-specific structured filters for Browse.
 *
 * `publishers.channel_metadata` (schema_phase74) holds real, typed data
 * per channel — see channelOnboardingSchemas.ts for the full 12 shapes —
 * but until now Browse had no UI to filter on any of it, even though a
 * business searching for a specific channel (say, Sports) would
 * genuinely want to narrow by competition level or squad size the same
 * way they can already narrow by follower count for social media.
 *
 * Rather than hand-building 12 bespoke filter panels, this is a small
 * config — CHANNEL_METADATA_FILTERS — naming which 2–3 fields per
 * channel are actually decision-relevant to a buyer, plus one generic
 * matcher that reads it. Fields chosen are a deliberate subset of each
 * channel's full onboarding schema — the ones a business would filter
 * by, not every field a publisher fills in (e.g. a website's `niche` or
 * a sports team's `season` are free text/display-only, not filter
 * candidates).
 *
 * Only ever consulted when a single channel is selected in Browse
 * (filters.channel is set) — these fields have no meaning across
 * channels, unlike the generic followers/price/rating filters.
 */
import type { ChannelSlug } from "./channelTypes";
import type { Publisher } from "./types";

export type ChannelMetaFilterKind = "select" | "boolean" | "min_number";

export interface ChannelMetaFilterField {
  /** The channel_metadata key this reads, matching channelOnboardingSchemas.ts's field names exactly. */
  key: string;
  label: string;
  kind: ChannelMetaFilterKind;
  /** Required for kind "select" — value/label pairs shown in the dropdown. */
  options?: { value: string; label: string }[];
  /** Shown after the number input for kind "min_number", e.g. "members", "vehicles". */
  unit?: string;
}

export const CHANNEL_METADATA_FILTERS: Partial<Record<ChannelSlug, ChannelMetaFilterField[]>> = {
  "social-media": [
    {
      key: "primaryPlatform", label: "Primary platform", kind: "select",
      options: [
        { value: "facebook", label: "Facebook" }, { value: "instagram", label: "Instagram" },
        { value: "tiktok", label: "TikTok" }, { value: "whatsapp_channel", label: "WhatsApp Channel" },
        { value: "youtube", label: "YouTube" }, { value: "x", label: "X" },
      ],
    },
    {
      key: "bestPerformingFormat", label: "Best-performing format", kind: "select",
      options: [
        { value: "static_post", label: "Static post" }, { value: "story", label: "Story" },
        { value: "reel_or_short", label: "Reel / Short" }, { value: "carousel", label: "Carousel" },
        { value: "live", label: "Live" },
      ],
    },
  ],
  website: [
    { key: "monthlyUniqueVisitors", label: "Min. monthly unique visitors", kind: "min_number", unit: "visitors" },
  ],
  influencer: [
    {
      key: "niche", label: "Niche", kind: "select",
      options: [
        { value: "fashion_beauty", label: "Fashion & Beauty" }, { value: "food", label: "Food" },
        { value: "fitness_health", label: "Fitness & Health" }, { value: "tech", label: "Tech" },
        { value: "finance", label: "Finance" }, { value: "parenting", label: "Parenting" },
        { value: "travel", label: "Travel" }, { value: "comedy_entertainment", label: "Comedy & Entertainment" },
        { value: "gaming", label: "Gaming" }, { value: "general_lifestyle", label: "General Lifestyle" },
      ],
    },
    { key: "offersUsageRights", label: "Offers usage rights", kind: "boolean" },
  ],
  radio: [
    { key: "showSponsorshipAvailable", label: "Show sponsorship available", kind: "boolean" },
    { key: "averageDailyListenership", label: "Min. avg. daily listenership", kind: "min_number", unit: "listeners" },
  ],
  podcast: [
    {
      key: "episodeFrequency", label: "Episode frequency", kind: "select",
      options: [
        { value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Biweekly" },
        { value: "monthly", label: "Monthly" }, { value: "irregular", label: "Irregular" },
      ],
    },
    { key: "averageDownloadsPerEpisode", label: "Min. avg. downloads/episode", kind: "min_number", unit: "downloads" },
  ],
  sports: [
    {
      key: "competitionLevel", label: "Competition level", kind: "select",
      options: [
        { value: "school", label: "School" }, { value: "amateur", label: "Amateur" },
        { value: "semi-professional", label: "Semi-professional" }, { value: "professional", label: "Professional" },
        { value: "university", label: "University" },
      ],
    },
    { key: "averageMatchdayAttendance", label: "Min. matchday attendance", kind: "min_number", unit: "attendees" },
  ],
  events: [
    {
      key: "eventType", label: "Event type", kind: "select",
      options: [
        { value: "conference", label: "Conference" }, { value: "tournament", label: "Tournament" },
        { value: "festival", label: "Festival" }, { value: "concert", label: "Concert" },
        { value: "trade_show", label: "Trade show" }, { value: "community_gathering", label: "Community gathering" },
      ],
    },
    { key: "typicalAttendance", label: "Min. typical attendance", kind: "min_number", unit: "attendees" },
  ],
  community: [
    {
      key: "groupType", label: "Group type", kind: "select",
      options: [
        { value: "neighbourhood_association", label: "Neighbourhood association" }, { value: "hobby_or_interest_group", label: "Hobby / interest group" },
        { value: "professional_network", label: "Professional network" }, { value: "club", label: "Club" },
        { value: "religious_or_faith_group", label: "Religious / faith group" }, { value: "school_or_alumni_group", label: "School / alumni group" },
      ],
    },
    { key: "memberCount", label: "Min. member count", kind: "min_number", unit: "members" },
  ],
  transport: [
    {
      key: "operatorType", label: "Operator type", kind: "select",
      options: [
        { value: "individual_owner", label: "Individual owner" }, { value: "taxi_association", label: "Taxi association" },
        { value: "fleet_operator", label: "Fleet operator" },
      ],
    },
    { key: "vehicleCount", label: "Min. vehicle count", kind: "min_number", unit: "vehicles" },
  ],
  associations: [
    {
      key: "associationType", label: "Association type", kind: "select",
      options: [
        { value: "chamber_of_commerce", label: "Chamber of commerce" }, { value: "industry_body", label: "Industry body" },
        { value: "networking_group", label: "Networking group" }, { value: "trade_union", label: "Trade union" },
        { value: "professional_body", label: "Professional body" },
      ],
    },
    { key: "hasMemberDirectory", label: "Has member directory", kind: "boolean" },
  ],
  restaurants: [
    {
      key: "venueType", label: "Venue type", kind: "select",
      options: [
        { value: "sit_down_restaurant", label: "Sit-down restaurant" }, { value: "cafe", label: "Café" },
        { value: "quick_service", label: "Quick service" }, { value: "bar_or_pub", label: "Bar / pub" },
        { value: "food_truck_or_stall", label: "Food truck / stall" },
      ],
    },
    { key: "hasDigitalMenu", label: "Has digital menu", kind: "boolean" },
  ],
  "in-venue-screens": [
    {
      key: "venueType", label: "Venue type", kind: "select",
      options: [
        { value: "nightclub", label: "Nightclub" }, { value: "bar_or_pub", label: "Bar / pub" },
        { value: "restaurant_or_cafe", label: "Restaurant / café" }, { value: "gym_or_fitness", label: "Gym / fitness" },
        { value: "laundromat", label: "Laundromat" }, { value: "other", label: "Other" },
      ],
    },
    { key: "hasSoundCapability", label: "Has sound capability", kind: "boolean" },
  ],
  "informal-retail": [
    { key: "hasElectronicTill", label: "Has electronic till", kind: "boolean" },
    { key: "hasWhatsappBroadcastList", label: "Has WhatsApp broadcast list", kind: "boolean" },
    { key: "estimatedDailyFootTraffic", label: "Min. daily foot traffic", kind: "min_number", unit: "visitors" },
  ],
};

/**
 * Matches a publisher's channel_metadata against a set of channel-filter
 * values. Called only when filters.channel is set (channel-specific
 * fields have no meaning otherwise) and only for publishers already on
 * that channel — see browseFilters.ts's matchesFilters, which checks
 * p.channel_slug === f.channel before ever reaching this.
 *
 * A publisher with no channel_metadata at all (pre-Phase-74 applications)
 * fails any active channel filter rather than being silently included —
 * there's no data to check the filter against, so "matches" would be a
 * guess, not a fact.
 */
export function matchesChannelMetadataFilters(
  p: Pick<Publisher, "channel_slug" | "channel_metadata">,
  channel: ChannelSlug,
  values: Record<string, string>
): boolean {
  const fields = CHANNEL_METADATA_FILTERS[channel];
  if (!fields) return true; // channel has no configured filters — nothing to check
  const active = Object.entries(values).filter(([, v]) => v !== "" && v !== undefined);
  if (active.length === 0) return true;
  if (!p.channel_metadata) return false;

  const metadata = p.channel_metadata as Record<string, unknown>;
  for (const [key, value] of active) {
    const field = fields.find((f) => f.key === key);
    if (!field) continue;
    if (field.kind === "select") {
      if (metadata[key] !== value) return false;
    } else if (field.kind === "boolean") {
      if (Boolean(metadata[key]) !== (value === "true")) return false;
    } else if (field.kind === "min_number") {
      const raw = metadata[key];
      const num = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(num) || num < Number(value)) return false;
    }
  }
  return true;
}
