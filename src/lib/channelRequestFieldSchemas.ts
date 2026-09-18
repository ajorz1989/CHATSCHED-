/**
 * Channel-specific BUSINESS-REQUEST field schemas.
 *
 * The request-side counterpart to channelOnboardingSchemas.ts. That file
 * covers what a publisher/creator provides when applying to list a
 * channel; this one covers what a business provides when requesting a
 * placement on one, beyond the generic advertising method / campaign
 * message / proposed budget / duration already on channel_requests.
 *
 * Stored in channel_requests.request_metadata, a plain jsonb column for
 * the same reason publishers.channel_metadata is — a single rigid shared
 * shape across 11 different channel types would force incompatible
 * fields to look equivalent. Read by ChannelRequestForm.tsx (business
 * fills it in) and by whoever reviews the request
 * (PublisherDashboardView.tsx, AdminChannelRequests.tsx) — not queried
 * structurally.
 *
 * social-media is deliberately absent — it uses a different flow
 * entirely (the sidebar campaign-request + PayFast checkout on
 * PublisherProfile.tsx, not ChannelRequestForm.tsx), so it never reads
 * this file.
 */

// ── Podcast ──────────────────────────────────────────────────────────────
export interface PodcastRequestFields {
  preferredAirWindow: string; // free text — "first two weeks of October", "next available episode"
  scriptProvided: boolean; // true = business will supply a script; false = host reads in their own words
  promoCodeOrLink: string; // optional — e.g. "Use code CHAT10 at checkout"
}

// ── Website ──────────────────────────────────────────────────────────────
export interface WebsiteRequestFields {
  landingPageUrl: string; // where the placement should link to
  preferredStartDate: string; // ISO date, optional
  hasCreativeReady: boolean; // has a banner/asset ready vs needs the publisher's help
}

// ── Influencer ───────────────────────────────────────────────────────────
export interface InfluencerRequestFields {
  productOrServiceName: string;
  willShipProduct: boolean; // physical product being sent for review/unboxing
  preferredPostDate: string; // ISO date, optional
  needsUsageRights: boolean; // business wants to repost the creator's content on its own channels
}

// ── Radio ────────────────────────────────────────────────────────────────
export interface RadioRequestFields {
  preferredFlightWindow: string; // free text — "1-15 October", "next available slot"
  scriptProvided: boolean; // true = business will supply a script; false = live host read
  preferredDaypart: string; // optional free text — "morning drive", "no preference"
}

// ── Sports Teams & Leagues ─────────────────────────────────────────────
export interface SportsRequestFields {
  specificFixtureOrDate: string; // optional — a named match/date for matchday graphic, POTM, venue signage
  hasArtworkReady: boolean;
}

// ── Events & Tournaments ─────────────────────────────────────────────────
export interface EventsRequestFields {
  hasArtworkReady: boolean;
  needsProofSameDay: boolean; // proof of physical placement (signage) captured on the event day itself
}

// ── Community Groups ─────────────────────────────────────────────────────
export interface CommunityRequestFields {
  targetIssueOrDate: string; // "which newsletter issue" / "which announcement date"
}

// ── Minibus Taxi & Transport Media ──────────────────────────────────────
export interface TransportRequestFields {
  numberOfVehicles: number | null; // optional — null means "whatever's available"
  campaignDurationWeeks: number;
  hasArtworkReady: boolean;
}

// ── Spaza Shops & Township Traders ──────────────────────────────────────
export interface InformalRetailRequestFields {
  campaignDurationWeeks: number;
  hasArtworkReady: boolean;
}

// ── Local Associations & Business Networks ──────────────────────────────
export interface AssociationsRequestFields {
  targetPublicationOrEventDate: string; // "Q4 newsletter", "the annual conference on 14 Nov"
  hasArtworkReady: boolean;
}

// ── Restaurants & Cafés ──────────────────────────────────────────────────
export interface RestaurantsRequestFields {
  campaignDurationWeeks: number;
  quantity: number | null; // e.g. "how many tables" for table cards — optional, not every method needs a count
  hasArtworkReady: boolean;
}

// ── In-Venue Screens & Displays ─────────────────────────────────────────
// bookingType and "is this a QR code" are deliberately NOT fields here —
// they're already captured by the generic advertising_method field every
// request form has, since this channel's own advertisingMethods list
// (event_night_takeover / hourly_rotation / weekly_package /
// qr_code_overlay) already covers exactly that choice. Duplicating it
// here would just be the same answer asked twice.
export interface InVenueScreensRequestFields {
  eventOrStartDate: string; // ISO date — the specific event night, or the start date for a rotation/weekly booking
  hasCreativeReady: boolean;
}

export type ChannelRequestMetadata =
  | ({ channelSlug: "podcast" } & PodcastRequestFields)
  | ({ channelSlug: "website" } & WebsiteRequestFields)
  | ({ channelSlug: "influencer" } & InfluencerRequestFields)
  | ({ channelSlug: "radio" } & RadioRequestFields)
  | ({ channelSlug: "sports" } & SportsRequestFields)
  | ({ channelSlug: "events" } & EventsRequestFields)
  | ({ channelSlug: "community" } & CommunityRequestFields)
  | ({ channelSlug: "transport" } & TransportRequestFields)
  | ({ channelSlug: "informal-retail" } & InformalRetailRequestFields)
  | ({ channelSlug: "associations" } & AssociationsRequestFields)
  | ({ channelSlug: "restaurants" } & RestaurantsRequestFields)
  | ({ channelSlug: "in-venue-screens" } & InVenueScreensRequestFields);

/** Human-readable labels for rendering saved request_metadata back to
 * whoever reviews the request (creator, admin) — keyed by field name
 * per channel, since the same field name can mean different things
 * (or not appear at all) on a different channel. */
export const REQUEST_FIELD_LABELS: Record<string, Record<string, string>> = {
  podcast: {
    preferredAirWindow: "Preferred air window",
    scriptProvided: "Script provided by business",
    promoCodeOrLink: "Promo code / link",
  },
  website: {
    landingPageUrl: "Landing page URL",
    preferredStartDate: "Preferred start date",
    hasCreativeReady: "Creative ready",
  },
  influencer: {
    productOrServiceName: "Product / service",
    willShipProduct: "Shipping a physical product",
    preferredPostDate: "Preferred post date",
    needsUsageRights: "Needs usage rights to repost",
  },
  radio: {
    preferredFlightWindow: "Preferred flight window",
    scriptProvided: "Script provided by business",
    preferredDaypart: "Preferred daypart",
  },
  sports: {
    specificFixtureOrDate: "Specific fixture / date",
    hasArtworkReady: "Artwork ready",
  },
  events: {
    hasArtworkReady: "Artwork ready",
    needsProofSameDay: "Needs proof same day",
  },
  community: {
    targetIssueOrDate: "Target issue / date",
  },
  transport: {
    numberOfVehicles: "Number of vehicles",
    campaignDurationWeeks: "Campaign duration (weeks)",
    hasArtworkReady: "Artwork ready",
  },
  "informal-retail": {
    campaignDurationWeeks: "Campaign duration (weeks)",
    hasArtworkReady: "Artwork ready",
  },
  associations: {
    targetPublicationOrEventDate: "Target publication / event date",
    hasArtworkReady: "Artwork ready",
  },
  restaurants: {
    campaignDurationWeeks: "Campaign duration (weeks)",
    quantity: "Quantity",
    hasArtworkReady: "Artwork ready",
  },
  "in-venue-screens": {
    eventOrStartDate: "Event / start date",
    hasCreativeReady: "Creative ready",
  },
};
