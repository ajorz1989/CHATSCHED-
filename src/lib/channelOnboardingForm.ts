/**
 * Shared channel onboarding form model.
 *
 * Used by the publisher application wizard (src/pages/PublisherApply.tsx) and
 * by the business listing creator (src/components/BusinessListingCreator.tsx),
 * so a business that lists itself is asked exactly the same channel questions
 * a normal applicant is, and they are saved in the same channel_metadata shape.
 */
import type { ChannelSlug } from "./channelTypes";
import type { Platform } from "./types";
import type {
  PodcastOnboardingFields, InformalRetailOnboardingFields, SportsOnboardingFields,
  SocialMediaOnboardingFields, SocialMediaPlatform, WebsiteOnboardingFields, InfluencerOnboardingFields, RadioOnboardingFields,
  EventsOnboardingFields, CommunityOnboardingFields, TransportOnboardingFields, AssociationsOnboardingFields, RestaurantsOnboardingFields,
  InVenueScreensOnboardingFields,
} from "./channelOnboardingSchemas";
import { isAuthorityChannel } from "./channelOnboardingSchemas";

export const SOCIAL_MEDIA_PLATFORMS: SocialMediaPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "whatsapp_channel",
  "youtube",
  "x",
];

export const SOCIAL_MEDIA_PLATFORM_LABELS: Record<SocialMediaPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp_channel: "WhatsApp Channel",
  youtube: "YouTube",
  x: "X",
};

export function isSocialMediaPlatform(value: string): value is SocialMediaPlatform {
  return SOCIAL_MEDIA_PLATFORMS.includes(value as SocialMediaPlatform);
}

export interface FormState {
  followers: string;
  /** Authority channels: "I own or run this and can sell advertising on it". Stored in channel_metadata, never in followers. */
  authorityConfirmed: boolean;
  check1: boolean;
  check2: boolean;
  check3: boolean;
  name: string;
  province: string;
  city: string;
  suburb: string;
  platforms: Platform[];
  placementTypes: string[];
  adFormats: string[];
  category: string;
  engagement: string;
  monthlyReach: string;
  audience: string;
  bio: string;
  pricePerPost: string;
  accountAgeMonths: string;
  postingFrequency: string;
  businessName: string;
  companyRegistration: string;
  vatNumber: string;
  acceptedTerms: boolean;
  acceptedPaymentTerms: boolean;
  // Channel-specific extra fields — only meaningful for their one channel
  // each, left at initial values and simply not read on submit for any
  // other channel. Flat strings/booleans here even where the eventual
  // channel_metadata field is typed (e.g. numbers, arrays) — parsed into
  // shape in buildChannelMetadata() below, same pattern the rest of this
  // form already uses (form.followers is a string that becomes Number()
  // on submit) rather than a special case just for these three.
  podcastDownloads: string;
  podcastFrequency: string;
  podcastEpisodeLength: string;
  podcastHostingPlatform: string;
  podcastAdSlots: string[];
  podcastRegions: string;
  // 12-Channel Audit fix A4/B4
  podcastShowUrl: string;
  podcastPeakTimes: string;
  retailFootTraffic: string;
  retailTradingHours: string;
  retailHasTill: boolean;
  retailHasWhatsapp: boolean;
  retailWhatsappSize: string;
  retailLandmark: string;
  retailPriceMin: string;
  retailPriceMax: string;
  retailPeakHours: string; // 12-Channel Audit fix A4/B4
  retailMunicipalRegistrationConfirmed: boolean;
  sportsSport: string;
  sportsLevel: string;
  sportsLeague: string;
  sportsSeason: string;
  sportsSquadSize: string;
  sportsAttendance: string;
  sportsVenue: string;
  sportsAuthorityRole: string;
  // The remaining 9 channels' extra fields — same flat-strings-parsed-on-
  // submit convention as the three above.
  smPrimaryPlatform: string;
  smSecondaryPlatforms: string[];
  smSocialLinks: Partial<Record<SocialMediaPlatform, string>>;
  smFollowerCounts: string; // "facebook:1200, instagram:3400" — parsed into Record<string,number> on submit
  smBestFormat: string;
  smPostsPerWeek: string;
  packagePrice: string; // optional all-platforms package price (ZAR), social media on 2+ platforms
  smAudienceCountry: string;
  webDomain: string;
  webMonthlyVisitors: string;
  webNiche: string;
  webCms: string;
  webPlacements: string[];
  webAvgSessionSeconds: string;
  infPrimaryPlatform: string;
  infNiche: string;
  infContentFormats: string[];
  infEngagementRate: string;
  infPastCollabs: string;
  infOffersUsageRights: boolean;
  radioStationName: string;
  radioFrequency: string;
  radioCoverageArea: string;
  radioLanguages: string; // comma-separated
  radioSlotLengths: string[];
  radioShowSponsorship: boolean;
  // 12-Channel Audit fix A4/B4
  radioIcasaLicence: string;
  radioPeakTimes: string;
  eventsName: string;
  eventsType: string;
  eventsFrequency: string;
  eventsAttendance: string;
  eventsNextDate: string;
  eventsTiers: string; // comma-separated
  eventsVenueCity: string;
  commGroupType: string;
  commMemberCount: string;
  commReachChannels: string[];
  commNewsletterFrequency: string;
  commGeographicArea: string;
  transOperatorType: string;
  transVehicleCount: string;
  transRoutes: string; // comma-separated
  transDailyPassengers: string;
  transPlacements: string[];
  transPrimaryRank: string;
  transPeakHours: string;
  assocType: string;
  assocMemberCount: string;
  assocSectors: string; // comma-separated
  assocReachChannels: string[];
  assocHasDirectory: boolean;
  assocHostsEvents: boolean;
  restVenueType: string;
  restSeatingCapacity: string;
  restDailyCovers: string;
  restHasDigitalMenu: boolean;
  restPlacements: string[];
  restCuisineType: string;
  restPeakTimes: string; // 12-Channel Audit fix A4/B4
  venueScreensVenueType: string;
  venueScreensCount: string;
  venueScreensType: string;
  venueScreensFootTrafficTier: string;
  venueScreensFootfallPerNight: string;
  venueScreensHasSound: boolean;
  venueScreensPeakTimes: string;
}

export const initialState: FormState = {
  followers: "", authorityConfirmed: false, check1: false, check2: false, check3: false,
  name: "", province: "", city: "", suburb: "", platforms: [], placementTypes: [], adFormats: [], category: "", engagement: "", monthlyReach: "",
  audience: "", bio: "", pricePerPost: "", accountAgeMonths: "", postingFrequency: "",
  businessName: "", companyRegistration: "", vatNumber: "", acceptedTerms: false, acceptedPaymentTerms: false,
  podcastDownloads: "", podcastFrequency: "", podcastEpisodeLength: "", podcastHostingPlatform: "", podcastAdSlots: [], podcastRegions: "", podcastShowUrl: "", podcastPeakTimes: "",
  retailFootTraffic: "", retailTradingHours: "", retailHasTill: false, retailHasWhatsapp: false, retailWhatsappSize: "", retailLandmark: "", retailPriceMin: "", retailPriceMax: "", retailPeakHours: "", retailMunicipalRegistrationConfirmed: false,
  sportsSport: "", sportsLevel: "", sportsLeague: "", sportsSeason: "", sportsSquadSize: "", sportsAttendance: "", sportsVenue: "", sportsAuthorityRole: "",
  smPrimaryPlatform: "", smSecondaryPlatforms: [], smSocialLinks: {}, smFollowerCounts: "", smBestFormat: "", smPostsPerWeek: "", smAudienceCountry: "", packagePrice: "",
  webDomain: "", webMonthlyVisitors: "", webNiche: "", webCms: "", webPlacements: [], webAvgSessionSeconds: "",
  infPrimaryPlatform: "", infNiche: "", infContentFormats: [], infEngagementRate: "", infPastCollabs: "", infOffersUsageRights: false,
  radioStationName: "", radioFrequency: "", radioCoverageArea: "", radioLanguages: "", radioSlotLengths: [], radioShowSponsorship: false, radioIcasaLicence: "", radioPeakTimes: "",
  eventsName: "", eventsType: "", eventsFrequency: "", eventsAttendance: "", eventsNextDate: "", eventsTiers: "", eventsVenueCity: "",
  commGroupType: "", commMemberCount: "", commReachChannels: [], commNewsletterFrequency: "", commGeographicArea: "",
  transOperatorType: "", transVehicleCount: "", transRoutes: "", transDailyPassengers: "", transPlacements: [], transPrimaryRank: "", transPeakHours: "",
  assocType: "", assocMemberCount: "", assocSectors: "", assocReachChannels: [], assocHasDirectory: false, assocHostsEvents: false,
  restVenueType: "", restSeatingCapacity: "", restDailyCovers: "", restHasDigitalMenu: false, restPlacements: [], restCuisineType: "", restPeakTimes: "",
  venueScreensVenueType: "", venueScreensCount: "", venueScreensType: "", venueScreensFootTrafficTier: "", venueScreensFootfallPerNight: "", venueScreensHasSound: false, venueScreensPeakTimes: "",
};

/**
 * Builds the typed channel_metadata payload for every channel — see
 * channelOnboardingSchemas.ts for the full set of 12 typed shapes (closed
 * this session; see CHANNEL_UPDATES_AUDIT.md for the history of which
 * three were done first and why).
 */
export function buildChannelMetadata(channelSlug: ChannelSlug, form: FormState): Record<string, unknown> | null {
  if (channelSlug === "podcast") {
    const fields: PodcastOnboardingFields = {
      averageDownloadsPerEpisode: Number(form.podcastDownloads) || 0,
      episodeFrequency: (form.podcastFrequency || "irregular") as PodcastOnboardingFields["episodeFrequency"],
      averageEpisodeLengthMinutes: Number(form.podcastEpisodeLength) || 0,
      hostingPlatform: form.podcastHostingPlatform,
      adSlotsAvailable: form.podcastAdSlots as PodcastOnboardingFields["adSlotsAvailable"],
      topListenerRegions: form.podcastRegions.split(",").map((r) => r.trim()).filter(Boolean),
      showUrl: form.podcastShowUrl || null,
      peakListeningTimes: form.podcastPeakTimes || null,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "informal-retail") {
    const fields: InformalRetailOnboardingFields = {
      estimatedDailyFootTraffic: Number(form.retailFootTraffic) || 0,
      tradingHours: form.retailTradingHours,
      hasElectronicTill: form.retailHasTill,
      hasWhatsappBroadcastList: form.retailHasWhatsapp,
      whatsappBroadcastListSize: form.retailHasWhatsapp ? Number(form.retailWhatsappSize) || 0 : null,
      nearbyLandmark: form.retailLandmark,
      priceRangeZAR: { min: Number(form.retailPriceMin) || 150, max: Number(form.retailPriceMax) || 150 },
      peakFootTrafficHours: form.retailPeakHours || null,
      municipalRegistrationConfirmed: form.retailMunicipalRegistrationConfirmed,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "sports") {
    const fields: SportsOnboardingFields = {
      sport: form.sportsSport,
      competitionLevel: (form.sportsLevel || "amateur") as SportsOnboardingFields["competitionLevel"],
      league: form.sportsLeague,
      season: form.sportsSeason,
      squadSize: Number(form.sportsSquadSize) || 0,
      averageMatchdayAttendance: form.sportsAttendance ? Number(form.sportsAttendance) : null,
      homeVenue: form.sportsVenue,
      sponsorshipAuthorityRole: (form.sportsAuthorityRole || "administrator") as SportsOnboardingFields["sponsorshipAuthorityRole"],
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "social-media") {
    const followerCountByPlatform: Record<string, number> = {};
    form.smFollowerCounts.split(",").forEach((pair) => {
      const [k, v] = pair.split(":").map((s) => s.trim());
      if (k && v) followerCountByPlatform[k] = Number(v) || 0;
    });
    const fields: SocialMediaOnboardingFields = {
      primaryPlatform: (form.smPrimaryPlatform || "facebook") as SocialMediaOnboardingFields["primaryPlatform"],
      secondaryPlatforms: form.smSecondaryPlatforms as SocialMediaOnboardingFields["secondaryPlatforms"],
      followerCountByPlatform,
      bestPerformingFormat: (form.smBestFormat || "static_post") as SocialMediaOnboardingFields["bestPerformingFormat"],
      postsPerWeek: Number(form.smPostsPerWeek) || 0,
      audienceCountry: form.smAudienceCountry || "South Africa",
      ...(Number(form.packagePrice) > 0 && form.platforms.length > 1 ? { allPlatformsPackagePrice: Number(form.packagePrice) } : {}),
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "website") {
    const fields: WebsiteOnboardingFields = {
      domain: form.webDomain,
      monthlyUniqueVisitors: Number(form.webMonthlyVisitors) || 0,
      niche: form.webNiche,
      cms: form.webCms,
      placementsAvailable: form.webPlacements as WebsiteOnboardingFields["placementsAvailable"],
      averageSessionDurationSeconds: form.webAvgSessionSeconds ? Number(form.webAvgSessionSeconds) : null,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "influencer") {
    const fields: InfluencerOnboardingFields = {
      primaryPlatform: (form.infPrimaryPlatform || "instagram") as InfluencerOnboardingFields["primaryPlatform"],
      niche: (form.infNiche || "general_lifestyle") as InfluencerOnboardingFields["niche"],
      contentFormats: form.infContentFormats as InfluencerOnboardingFields["contentFormats"],
      averageEngagementRatePercent: Number(form.infEngagementRate) || 0,
      pastBrandCollaborations: Number(form.infPastCollabs) || 0,
      offersUsageRights: form.infOffersUsageRights,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "radio") {
    const fields: RadioOnboardingFields = {
      stationName: form.radioStationName,
      frequencyOrStream: form.radioFrequency,
      coverageArea: form.radioCoverageArea,
      broadcastLanguages: form.radioLanguages.split(",").map((l) => l.trim()).filter(Boolean),
      // One radio audience number: the weekly reach given at the eligibility step.
      weeklyListeners: Number(form.followers) > 0 ? Number(form.followers) : null,
      averageDailyListenership: null,
      availableSlotLengths: form.radioSlotLengths.map((s) => Number(s)) as RadioOnboardingFields["availableSlotLengths"],
      showSponsorshipAvailable: form.radioShowSponsorship,
      icasaLicenceNumber: form.radioIcasaLicence || null,
      peakListeningTimes: form.radioPeakTimes || null,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "events") {
    const fields: EventsOnboardingFields = {
      eventName: form.eventsName,
      eventType: (form.eventsType || "community_gathering") as EventsOnboardingFields["eventType"],
      frequency: (form.eventsFrequency || "annual") as EventsOnboardingFields["frequency"],
      typicalAttendance: Number(form.eventsAttendance) || 0,
      nextEventDate: form.eventsNextDate || null,
      sponsorshipTiersOffered: form.eventsTiers.split(",").map((t) => t.trim()).filter(Boolean),
      venueCity: form.eventsVenueCity,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "community") {
    const fields: CommunityOnboardingFields = {
      groupType: (form.commGroupType || "hobby_or_interest_group") as CommunityOnboardingFields["groupType"],
      memberCount: Number(form.commMemberCount) || 0,
      reachChannels: form.commReachChannels as CommunityOnboardingFields["reachChannels"],
      newsletterFrequency: (form.commNewsletterFrequency || "none") as CommunityOnboardingFields["newsletterFrequency"],
      geographicArea: form.commGeographicArea,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "transport") {
    const fields: TransportOnboardingFields = {
      operatorType: (form.transOperatorType || "individual_owner") as TransportOnboardingFields["operatorType"],
      vehicleCount: Number(form.transVehicleCount) || 0,
      routesCovered: form.transRoutes.split(",").map((r) => r.trim()).filter(Boolean),
      estimatedDailyPassengers: form.transDailyPassengers ? Number(form.transDailyPassengers) : null,
      placementTypesAvailable: form.transPlacements as TransportOnboardingFields["placementTypesAvailable"],
      primaryRank: form.transPrimaryRank,
      peakOperatingHours: form.transPeakHours || null,
      authorityConfirmed: form.authorityConfirmed,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "associations") {
    const fields: AssociationsOnboardingFields = {
      associationType: (form.assocType || "networking_group") as AssociationsOnboardingFields["associationType"],
      memberCount: Number(form.assocMemberCount) || 0,
      sectorsRepresented: form.assocSectors.split(",").map((s) => s.trim()).filter(Boolean),
      reachChannels: form.assocReachChannels as AssociationsOnboardingFields["reachChannels"],
      hasMemberDirectory: form.assocHasDirectory,
      hostsRegularEvents: form.assocHostsEvents,
      authorityConfirmed: form.authorityConfirmed,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "restaurants") {
    const fields: RestaurantsOnboardingFields = {
      venueType: (form.restVenueType || "sit_down_restaurant") as RestaurantsOnboardingFields["venueType"],
      seatingCapacity: form.restSeatingCapacity ? Number(form.restSeatingCapacity) : null,
      estimatedDailyCovers: Number(form.restDailyCovers) || 0,
      hasDigitalMenu: form.restHasDigitalMenu,
      placementTypesAvailable: form.restPlacements as RestaurantsOnboardingFields["placementTypesAvailable"],
      cuisineType: form.restCuisineType,
      peakServiceTimes: form.restPeakTimes || null,
    };
    return fields as unknown as Record<string, unknown>;
  }
  if (channelSlug === "in-venue-screens") {
    const fields: InVenueScreensOnboardingFields = {
      venueType: (form.venueScreensVenueType || "restaurant_or_cafe") as InVenueScreensOnboardingFields["venueType"],
      screenCount: Number(form.venueScreensCount) || 1,
      screenType: (form.venueScreensType || "tv") as InVenueScreensOnboardingFields["screenType"],
      footTrafficTier: (form.venueScreensFootTrafficTier || "medium") as InVenueScreensOnboardingFields["footTrafficTier"],
      estimatedFootfallPerNight: Number(form.venueScreensFootfallPerNight) || 0,
      hasSoundCapability: form.venueScreensHasSound,
      peakTimesOrDays: form.venueScreensPeakTimes,
    };
    return fields as unknown as Record<string, unknown>;
  }
  return null;
}

/** Stamp the ownership confirmation onto an authority channel's metadata. */
export function withAuthorityFlag(meta: Record<string, unknown> | null, channelSlug: ChannelSlug, confirmed: boolean): Record<string, unknown> | null {
  if (!meta || !isAuthorityChannel(channelSlug)) return meta;
  return { ...meta, authorityConfirmed: confirmed };
}

/** Platforms the applicant picked for social-media verification links, de-duplicated. */
export function getSelectedSocialPlatforms(form: Pick<FormState, "smPrimaryPlatform" | "smSecondaryPlatforms">): SocialMediaPlatform[] {
  const selected = [form.smPrimaryPlatform, ...form.smSecondaryPlatforms].filter(isSocialMediaPlatform);
  return [...new Set(selected)];
}
