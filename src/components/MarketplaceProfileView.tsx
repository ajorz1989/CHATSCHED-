import {
  getPodcastMetadata, getInformalRetailMetadata, getSportsMetadata,
  getSocialMediaMetadata, getWebsiteMetadata, getInfluencerMetadata, getRadioMetadata,
  getEventsMetadata, getCommunityMetadata, getTransportMetadata, getAssociationsMetadata, getRestaurantsMetadata,
} from "../lib/channelOnboardingSchemas";
import type { Publisher } from "../lib/types";
import { formatCurrencyRange } from "../lib/currency";

interface StatCard {
  value: string;
  label: string;
}

interface Badge {
  label: string;
  tone: "green" | "yellow" | "neutral";
}

interface ProfileContent {
  stats: StatCard[];
  badges: Badge[];
  // 12-Channel Audit fix C2 — a buyer deciding whether to sponsor a show
  // couldn't listen to it from ChatSched at all before this; a real link
  // (not a full per-platform embed player, which would need different
  // integration code for Spotify/Apple/RSS/a raw stream URL) at least lets
  // them sample it in one click instead of leaving to search independently.
  listenLink?: { url: string; label: string };
}

/**
 * Same layout for every channel — this function is the ONLY thing that
 * changes per channel, not the JSX. That's deliberate: the "dynamic
 * content-rendering system" the person asked for is the branching logic
 * here, not 12 different components that happen to look alike.
 *
 * All 12 channels get real, typed, channel-specific content now — see
 * CHANNEL_UPDATES_AUDIT.md for the session history of which three (podcast,
 * informal-retail, sports) came first to prove the pattern. Every branch
 * still falls through to the generic followers/engagement stats if a
 * publisher on that channel somehow has no channel_metadata yet (e.g. an
 * account created before this session, or a channel switch) — an honest
 * fallback, not a dead branch.
 */
function buildProfileContent(publisher: Publisher, liveRating: number | null, liveReviewCount: number): ProfileContent {
  const ratingStat: StatCard = {
    value: liveRating ? `★ ${liveRating.toFixed(1)}` : "New",
    label: `${liveReviewCount} review${liveReviewCount === 1 ? "" : "s"}`,
  };

  const podcast = getPodcastMetadata(publisher);
  if (podcast) {
    return {
      stats: [
        { value: podcast.averageDownloadsPerEpisode.toLocaleString(), label: "Avg. downloads/episode" },
        { value: `${podcast.averageEpisodeLengthMinutes} min`, label: "Episode length" },
        ratingStat,
      ],
      badges: [
        { label: podcast.episodeFrequency, tone: "neutral" },
        { label: podcast.hostingPlatform, tone: "neutral" },
        ...podcast.adSlotsAvailable.map((slot) => ({ label: slot, tone: "green" as const })),
        ...podcast.topListenerRegions.slice(0, 3).map((region) => ({ label: region, tone: "yellow" as const })),
      ],
      ...(podcast.showUrl ? { listenLink: { url: podcast.showUrl, label: "🎧 Listen to the show" } } : {}),
    };
  }

  const retail = getInformalRetailMetadata(publisher);
  if (retail) {
    return {
      stats: [
        { value: retail.estimatedDailyFootTraffic.toLocaleString(), label: "Daily customers (est.)" },
        {
          value: retail.hasWhatsappBroadcastList && retail.whatsappBroadcastListSize ? retail.whatsappBroadcastListSize.toLocaleString() : "—",
          label: "WhatsApp list size",
        },
        ratingStat,
      ],
      badges: [
        ...(retail.hasElectronicTill ? [{ label: "Electronic till", tone: "green" as const }] : []),
        ...(retail.hasWhatsappBroadcastList ? [{ label: "WhatsApp broadcast list", tone: "green" as const }] : []),
        { label: formatCurrencyRange(retail.priceRangeZAR.min, retail.priceRangeZAR.max), tone: "yellow" as const },
      ],
    };
  }

  const sports = getSportsMetadata(publisher);
  if (sports) {
    return {
      stats: [
        { value: sports.averageMatchdayAttendance != null ? sports.averageMatchdayAttendance.toLocaleString() : "—", label: "Matchday attendance" },
        { value: String(sports.squadSize), label: "Squad size" },
        ratingStat,
      ],
      badges: [
        { label: sports.competitionLevel.replace("-", " "), tone: "neutral" },
        ...(sports.league ? [{ label: sports.league, tone: "yellow" as const }] : []),
        { label: `Verified: ${sports.sponsorshipAuthorityRole.replace("_", " ")}`, tone: "green" },
      ],
    };
  }

  const socialMedia = getSocialMediaMetadata(publisher);
  if (socialMedia) {
    const totalFollowers = Object.values(socialMedia.followerCountByPlatform).reduce((a, b) => a + b, 0);
    return {
      stats: [
        { value: totalFollowers > 0 ? totalFollowers.toLocaleString() : publisher.followers.toLocaleString(), label: "Total followers" },
        { value: `${socialMedia.postsPerWeek}/wk`, label: "Posting frequency" },
        ratingStat,
      ],
      badges: [
        { label: socialMedia.primaryPlatform.replace("_", " "), tone: "green" },
        ...socialMedia.secondaryPlatforms.map((p) => ({ label: p.replace("_", " "), tone: "neutral" as const })),
        { label: socialMedia.bestPerformingFormat.replace(/_/g, " "), tone: "yellow" },
      ],
    };
  }

  const website = getWebsiteMetadata(publisher);
  if (website) {
    return {
      stats: [
        { value: website.monthlyUniqueVisitors.toLocaleString(), label: "Monthly unique visitors" },
        { value: website.averageSessionDurationSeconds != null ? `${website.averageSessionDurationSeconds}s` : "—", label: "Avg. session duration" },
        ratingStat,
      ],
      badges: [
        ...(website.niche ? [{ label: website.niche, tone: "neutral" as const }] : []),
        ...website.placementsAvailable.map((p) => ({ label: p.replace(/_/g, " "), tone: "green" as const })),
      ],
    };
  }

  const influencer = getInfluencerMetadata(publisher);
  if (influencer) {
    return {
      stats: [
        { value: `${influencer.averageEngagementRatePercent}%`, label: "Engagement rate" },
        { value: String(influencer.pastBrandCollaborations), label: "Past brand collabs" },
        ratingStat,
      ],
      badges: [
        { label: influencer.niche.replace(/_/g, " "), tone: "neutral" },
        ...influencer.contentFormats.map((f) => ({ label: f.replace(/_/g, " "), tone: "green" as const })),
        ...(influencer.offersUsageRights ? [{ label: "Offers usage rights", tone: "yellow" as const }] : []),
      ],
    };
  }

  const radio = getRadioMetadata(publisher);
  if (radio) {
    return {
      stats: [
        { value: radio.averageDailyListenership != null ? radio.averageDailyListenership.toLocaleString() : "—", label: "Daily listenership" },
        { value: radio.coverageArea || "—", label: "Coverage area" },
        ratingStat,
      ],
      badges: [
        ...radio.availableSlotLengths.map((s) => ({ label: `${s}s slot`, tone: "green" as const })),
        ...(radio.showSponsorshipAvailable ? [{ label: "Show sponsorship available", tone: "yellow" as const }] : []),
        ...(radio.icasaLicenceNumber ? [{ label: "ICASA licensed", tone: "yellow" as const }] : []),
      ],
      // frequencyOrStream is free text — "94.5 FM" for terrestrial stations
      // don't get a listen link — only genuinely online-only stations
      // that entered a real stream URL do.
      ...(radio.frequencyOrStream?.startsWith("http") ? { listenLink: { url: radio.frequencyOrStream, label: "📻 Listen live" } } : {}),
    };
  }

  const events = getEventsMetadata(publisher);
  if (events) {
    return {
      stats: [
        { value: events.typicalAttendance.toLocaleString(), label: "Typical attendance" },
        { value: events.nextEventDate ?? "TBC", label: "Next event date" },
        ratingStat,
      ],
      badges: [
        { label: events.eventType.replace(/_/g, " "), tone: "neutral" },
        { label: events.frequency.replace(/_/g, " "), tone: "yellow" },
        ...events.sponsorshipTiersOffered.map((t) => ({ label: t, tone: "green" as const })),
      ],
    };
  }

  const community = getCommunityMetadata(publisher);
  if (community) {
    return {
      stats: [
        { value: community.memberCount.toLocaleString(), label: "Members" },
        { value: community.geographicArea || "—", label: "Area" },
        ratingStat,
      ],
      badges: [
        { label: community.groupType.replace(/_/g, " "), tone: "neutral" },
        ...community.reachChannels.map((c) => ({ label: c.replace(/_/g, " "), tone: "green" as const })),
      ],
    };
  }

  const transport = getTransportMetadata(publisher);
  if (transport) {
    return {
      stats: [
        { value: String(transport.vehicleCount), label: "Vehicles" },
        { value: transport.estimatedDailyPassengers != null ? transport.estimatedDailyPassengers.toLocaleString() : "—", label: "Daily passengers (est.)" },
        ratingStat,
      ],
      badges: [
        { label: transport.operatorType.replace(/_/g, " "), tone: "neutral" },
        ...transport.placementTypesAvailable.map((p) => ({ label: p.replace(/_/g, " "), tone: "green" as const })),
      ],
    };
  }

  const associations = getAssociationsMetadata(publisher);
  if (associations) {
    return {
      stats: [
        { value: associations.memberCount.toLocaleString(), label: "Members" },
        { value: associations.sectorsRepresented[0] ?? "—", label: "Primary sector" },
        ratingStat,
      ],
      badges: [
        { label: associations.associationType.replace(/_/g, " "), tone: "neutral" },
        ...(associations.hasMemberDirectory ? [{ label: "Member directory", tone: "green" as const }] : []),
        ...(associations.hostsRegularEvents ? [{ label: "Hosts regular events", tone: "yellow" as const }] : []),
      ],
    };
  }

  const restaurants = getRestaurantsMetadata(publisher);
  if (restaurants) {
    return {
      stats: [
        { value: restaurants.estimatedDailyCovers.toLocaleString(), label: "Daily covers" },
        { value: restaurants.seatingCapacity != null ? String(restaurants.seatingCapacity) : "—", label: "Seating capacity" },
        ratingStat,
      ],
      badges: [
        { label: restaurants.venueType.replace(/_/g, " "), tone: "neutral" },
        ...(restaurants.hasDigitalMenu ? [{ label: "Digital menu", tone: "green" as const }] : []),
        ...restaurants.placementTypesAvailable.map((p) => ({ label: p.replace(/_/g, " "), tone: "yellow" as const })),
      ],
    };
  }

  // Fallback for a publisher with no channel_metadata yet on a channel that
  // does have a typed schema (e.g. an account created before this session).
  return {
    stats: [
      { value: publisher.followers.toLocaleString(), label: "Followers" },
      { value: `${publisher.engagement}%`, label: "Engagement rate" },
      ratingStat,
    ],
    badges: [],
  };
}

const BADGE_TONE_CLASS: Record<Badge["tone"], string> = {
  green: "border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep",
  yellow: "border-billboard-ink bg-billboard-yellow/40 text-billboard-ink",
  neutral: "border-billboard-inkSoft bg-white text-billboard-inkSoft",
};

/**
 * Renders the "Audience"/metrics section of a publisher's profile page —
 * same three-card grid and heading PublisherProfile.tsx already used, same
 * classNames, same structural position. Only the values, labels, and an
 * added badge row underneath vary by channel. Drop-in replacement for the
 * hardcoded followers/engagement block that used to live inline in
 * PublisherProfile.tsx.
 */
export default function MarketplaceProfileView({
  publisher,
  liveRating,
  liveReviewCount,
}: {
  publisher: Publisher;
  liveRating: number | null;
  liveReviewCount: number;
}) {
  const { stats, badges, listenLink } = buildProfileContent(publisher, liveRating, liveReviewCount);

  return (
    <>
      <h2 className="font-display text-lg mb-3">Audience</h2>
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="border-2 border-billboard-ink rounded p-4">
            <div className="font-display text-xl">{s.value}</div>
            <div className="text-xs font-mono uppercase text-billboard-inkSoft mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      {listenLink && (
        <a href={listenLink.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border-2 border-billboard-ink rounded px-3 py-1.5 text-sm font-semibold mb-4 hover:-translate-y-0.5 transition bg-billboard-paperDim">
          {listenLink.label} →
        </a>
      )}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {badges.map((b) => (
            <span key={b.label} className={`font-mono text-xs border-2 rounded-full px-3 py-1 ${BADGE_TONE_CLASS[b.tone]}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
