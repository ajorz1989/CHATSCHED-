/**
 * Lead audience: the ONE number (and its label) a channel should lead with.
 *
 * Every listing has `followers`, `engagement` and `price_per_post` columns, but
 * only social media and influencer genuinely have followers. For every other
 * channel the real headline number lives in `channel_metadata` (visitors,
 * downloads, covers, attendance...). Browse cards, compare, saved lists,
 * search results, the Reach Checker and page descriptions all go through
 * here so a website never reads "12,000 followers · 0% engagement" and a
 * school hall never reads "1 followers".
 *
 * Rules:
 * - Never print a number we cannot stand behind. If the channel's own metric
 *   is missing, fall back to the stored `followers` ONLY where that column is
 *   known to hold a real audience figure (social, influencer, and the digital
 *   channels whose first onboarding step asks for it). For authority channels
 *   `followers` holds a typed 1 and is never used.
 * - `channel_metadata` can be null or {} (older, admin-made and
 *   business-created listings). Every read here is null-safe.
 */

import type { Publisher } from "./types";
import type { ChannelSlug } from "./channelTypes";
import { getChannelBySlug } from "./channelRegistry";
import { getTotalFollowers, countFollowerPlatforms } from "./platforms";
import {
  getPodcastMetadata, getWebsiteMetadata, getRadioMetadata, getEventsMetadata,
  getSportsMetadata, getCommunityMetadata, getAssociationsMetadata,
  getRestaurantsMetadata, getInVenueScreensMetadata, getTransportMetadata,
  getInformalRetailMetadata,
} from "./channelOnboardingSchemas";

export type LeadAudiencePublisher = Pick<
  Publisher,
  "followers" | "platforms" | "channel_slug" | "channel_metadata"
>;

export interface LeadAudience {
  /** The headline number, or null when we have nothing honest to show. */
  value: number | null;
  /** What the number counts, lower case, e.g. "monthly visitors". */
  label: string;
}

/** Channels where followers and engagement genuinely mean something. */
const SOCIAL_CHANNELS: ReadonlySet<string> = new Set(["social-media", "influencer"]);

/**
 * Channels whose `publishers.followers` holds a real audience figure typed at
 * onboarding (visitors, downloads, weekly listeners), so it is a safe fallback
 * when channel_metadata is missing. The eight authority channels are NOT here:
 * their `followers` is a typed 1.
 */
const FOLLOWERS_IS_REAL_AUDIENCE: ReadonlySet<string> = new Set([
  "social-media", "influencer", "podcast", "website", "radio",
]);

/** What `publishers.followers` counts, for the digital channels, in plain words. */
const FALLBACK_LABEL: Record<string, string> = {
  "social-media": "followers",
  influencer: "followers",
  podcast: "downloads per episode",
  website: "monthly visitors",
  radio: "weekly listeners",
};

function positive(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function none(label: string): LeadAudience {
  return { value: null, label };
}

/** Does this publisher's channel have followers and an engagement rate? */
export function showsEngagement(publisher: Pick<Publisher, "channel_slug">): boolean {
  // Legacy rows with no channel_slug were all social pages.
  return !publisher.channel_slug || SOCIAL_CHANNELS.has(publisher.channel_slug);
}

export function getLeadAudience(publisher: LeadAudiencePublisher): LeadAudience {
  const slug = (publisher.channel_slug || "social-media") as ChannelSlug;

  const fromMetadata = (value: unknown, label: string): LeadAudience | null => {
    const v = positive(value);
    return v === null ? null : { value: v, label };
  };

  let lead: LeadAudience | null = null;

  switch (slug) {
    case "social-media": {
      const total = positive(getTotalFollowers(publisher));
      lead = total === null ? null : {
        value: total,
        label: countFollowerPlatforms(publisher) > 1 ? "combined followers" : "followers",
      };
      break;
    }
    case "influencer":
      lead = fromMetadata(publisher.followers, "followers");
      break;
    case "podcast":
      lead = fromMetadata(getPodcastMetadata(publisher)?.averageDownloadsPerEpisode, "downloads per episode");
      break;
    case "website":
      lead = fromMetadata(getWebsiteMetadata(publisher)?.monthlyUniqueVisitors, "monthly visitors");
      break;
    case "radio": {
      const radio = getRadioMetadata(publisher);
      // New listings store one weekly figure; older ones may only have a separately typed daily figure.
      lead = fromMetadata(radio?.weeklyListeners, "weekly listeners")
        ?? fromMetadata(radio?.averageDailyListenership, "daily listeners");
      break;
    }
    case "events":
      lead = fromMetadata(getEventsMetadata(publisher)?.typicalAttendance, "typical attendance");
      break;
    case "sports":
      lead = fromMetadata(getSportsMetadata(publisher)?.averageMatchdayAttendance, "matchday attendance");
      break;
    case "community":
      lead = fromMetadata(getCommunityMetadata(publisher)?.memberCount, "members");
      break;
    case "associations":
      lead = fromMetadata(getAssociationsMetadata(publisher)?.memberCount, "members");
      break;
    case "restaurants":
      lead = fromMetadata(getRestaurantsMetadata(publisher)?.estimatedDailyCovers, "daily covers");
      break;
    case "in-venue-screens":
      lead = fromMetadata(getInVenueScreensMetadata(publisher)?.estimatedFootfallPerNight, "footfall per night");
      break;
    case "transport": {
      const t = getTransportMetadata(publisher);
      lead = fromMetadata(t?.estimatedDailyPassengers, "daily passengers")
        ?? fromMetadata(t?.vehicleCount, "vehicles");
      break;
    }
    case "informal-retail":
      lead = fromMetadata(getInformalRetailMetadata(publisher)?.estimatedDailyFootTraffic, "daily customers");
      break;
    default:
      break;
  }

  if (lead) return lead;

  // Metadata missing: use stored followers only where it is a real audience figure.
  if (FOLLOWERS_IS_REAL_AUDIENCE.has(slug)) {
    const stored = positive(publisher.followers);
    if (stored !== null) return { value: stored, label: FALLBACK_LABEL[slug] };
  }
  return none(FALLBACK_LABEL[slug] ?? "audience");
}

/** 1,234 -> "1.2k", 12,000 -> "12k", 1,500,000 -> "1.5M". */
export function formatAudienceCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
}

/** "12k monthly visitors", or "Audience not listed" when there is no honest number. */
export function formatLeadAudience(publisher: LeadAudiencePublisher, opts: { compact?: boolean } = {}): string {
  const { value, label } = getLeadAudience(publisher);
  if (value === null) return "Audience not listed";
  const n = opts.compact === false ? value.toLocaleString() : formatAudienceCount(value);
  return `${n} ${label}`;
}

/**
 * The unit a channel's price is quoted in, taken from the channel's own first
 * pricing model ("Per post", "Per placement", "Per 30-second spot"...).
 * The podcast and website models are quoted as CPL/CPM in the channel file,
 * but the stored `price_per_post` is a price for one ad slot / placement.
 */
export function getPriceUnit(slug: string | null | undefined): string {
  const channel = slug || "social-media";
  if (channel === "podcast") return "per ad slot";
  if (channel === "website") return "per placement";
  const label = getChannelBySlug(channel)?.definition.pricingModels[0]?.label;
  if (label && /^per\s/i.test(label)) return label.toLowerCase();
  return "per booking";
}

/** "R1 500 per placement" style suffix helper: just the unit, prefixed with a space. */
export function priceUnitSuffix(slug: string | null | undefined): string {
  return ` ${getPriceUnit(slug)}`;
}
