/**
 * Channel availability policy.
 *
 * Eleven registered channels are live. Only these two remain intentionally
 * outside the live marketplace and publisher onboarding:
 *   - transport — Minibus Taxi & Transport Media
 *   - informal-retail — Spaza Shops & Township Traders
 *
 * Channel availability is intentionally deterministic: stale or unset Vite
 * environment variables must never make a channel that has launched appear
 * offline in production. A future operational kill-switch should be a
 * separate, explicit runtime capability rather than a launch-state flag.
 */

import type { ChannelSlug } from "./channelTypes";

/** Channels intentionally kept in development. */
const DEVELOPMENT_CHANNELS = new Set<ChannelSlug>([
  "transport",
  "informal-retail",
]);

/** Returns true for every registered channel except the two development channels. */
export function isChannelEnabled(slug: ChannelSlug): boolean {
  return !DEVELOPMENT_CHANNELS.has(slug);
}

/**
 * Returns a map of all registered channel slugs and their current availability.
 * The registry remains the source of truth for which slugs exist.
 */
export function getAllChannelFlags(): Record<ChannelSlug, boolean> {
  // Importing the registry here would create a cycle, so consumers should use
  // getAllChannels() when they need the full set. This helper remains for
  // compatibility with existing callers that already provide a ChannelSlug.
  const allSlugs: ChannelSlug[] = [
    "social-media",
    "influencer",
    "podcast",
    "website",
    "radio",
    "sports",
    "events",
    "community",
    "transport",
    "informal-retail",
    "associations",
    "restaurants",
    "in-venue-screens",
  ];
  return Object.fromEntries(allSlugs.map((slug) => [slug, isChannelEnabled(slug)])) as Record<ChannelSlug, boolean>;
}

/** Whether an active ChatSched Business / Publisher Network subscription is actually required to use the marketplace. */
export function isSubscriptionEnforcementEnabled(): boolean {
  return import.meta.env.VITE_SUBSCRIPTIONS_ENFORCED === "true";
}

/** Whether the composer pre-scans a message client-side before sending. */
export function isMessageSafetyPrescanEnabled(): boolean {
  return import.meta.env.VITE_MESSAGE_SAFETY_PRESCAN_ENABLED !== "false";
}
