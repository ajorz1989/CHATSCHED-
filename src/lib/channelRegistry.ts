/**
 * Channel Registry
 *
 * The single source of truth for every advertising channel in the marketplace.
 * To add a new channel:
 *   1. Create src/channels/<slug>/index.ts exporting a ChannelModule
 *   2. Add its flag to src/lib/featureFlags.ts
 *   3. Import it below and add one entry to CHANNEL_REGISTRY
 *   — no other file needs to change —
 *
 * Scope rule: only channels that help businesses discover publishers,
 * create campaigns, buy advertising, or measure results belong here.
 */

import type { ChannelSlug, ChannelModule } from "./channelTypes";
import { isChannelEnabled } from "./featureFlags";

// Channel module imports
import socialMediaModule from "../channels/social-media";
import websiteModule     from "../channels/website";
import podcastModule     from "../channels/podcast";
import influencerModule  from "../channels/influencer";
import radioModule       from "../channels/radio";
import sportsModule      from "../channels/sports";
import eventsModule      from "../channels/events";
import communityModule   from "../channels/community";
import transportModule       from "../channels/transport";
import informalRetailModule  from "../channels/informal-retail";
import associationsModule    from "../channels/associations";
import restaurantsModule     from "../channels/restaurants";
import inVenueScreensModule  from "../channels/in-venue-screens";

/** Ordered list of all registered channel modules. Order controls display in the hub. */
const CHANNEL_REGISTRY: ChannelModule[] = [
  socialMediaModule,
  influencerModule,
  podcastModule,
  websiteModule,
  radioModule,
  sportsModule,
  eventsModule,
  communityModule,
  transportModule,
  informalRetailModule,
  associationsModule,
  restaurantsModule,
  inVenueScreensModule,
];

// ─── Registry accessors ───────────────────────────────────────────────────────

/** Returns all channel modules regardless of their enabled state. */
export function getAllChannels(): ChannelModule[] {
  return CHANNEL_REGISTRY;
}

/** Returns only the channels whose feature flag is currently on. */
export function getEnabledChannels(): ChannelModule[] {
  return CHANNEL_REGISTRY.filter((m) => isChannelEnabled(m.definition.slug));
}

/** Channels intentionally kept in development and excluded from publisher onboarding. */
const PUBLISHER_ONBOARDING_EXCLUDED: ChannelSlug[] = ["transport", "informal-retail"];

/** Returns live channels that can currently be selected during publisher onboarding. */
export function getPublisherOnboardingChannels(): ChannelModule[] {
  return getEnabledChannels().filter(
    (m) => !PUBLISHER_ONBOARDING_EXCLUDED.includes(m.definition.slug),
  );
}

/** Safely checks whether a channel is eligible for the public publisher onboarding flow. */
export function isPublisherOnboardingChannel(slug: string): boolean {
  return getPublisherOnboardingChannels().some((m) => m.definition.slug === slug);
}

/** Looks up a channel module by slug. Returns undefined if not registered. */
export function getChannelBySlug(slug: string): ChannelModule | undefined {
  return CHANNEL_REGISTRY.find((m) => m.definition.slug === slug);
}

/**
 * Returns the enabled state of a specific channel.
 * Safe to call with an unrecognised slug — returns false.
 */
export function isSlugEnabled(slug: string): boolean {
  const module = getChannelBySlug(slug);
  if (!module) return false;
  return isChannelEnabled(module.definition.slug as ChannelSlug);
}

// ─── Channel category grouping ────────────────────────────────────────────────

export type ChannelGroup = {
  label: string;
  channels: ChannelModule[];
};

/** Groups all channels by category for use in filtered views. */
export function getChannelsByCategory(): ChannelGroup[] {
  const order = ["digital", "direct", "broadcast", "outdoor", "print", "programmatic", "sports", "events", "community", "transport", "informal-retail", "associations", "food-and-beverage"] as const;
  const labels: Record<string, string> = {
    digital:      "Digital & Social",
    direct:       "Direct & Messaging",
    broadcast:    "Broadcast",
    outdoor:      "Out-of-Home",
    print:        "Print",
    programmatic: "Programmatic",
    sports:       "Sports Teams & Leagues",
    events:       "Events & Tournaments",
    community:    "Community Groups",
    transport:    "Minibus Taxi & Transport",
    "informal-retail": "Spaza Shops & Township Traders",
    associations: "Associations & Business Networks",
    "food-and-beverage": "Restaurants & Cafés",
  };

  return order
    .map((cat) => ({
      label: labels[cat],
      channels: CHANNEL_REGISTRY.filter((m) => m.definition.category === cat),
    }))
    .filter((g) => g.channels.length > 0);
}
