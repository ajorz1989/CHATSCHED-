/**
 * Feature Flags — Advertising Channels
 *
 * Each non-core channel is gated behind a Vite environment variable, but the
 * *meaning* of that variable differs by channel maturity:
 *
 *   - social-media  — always on, not a flag at all (the core marketplace).
 *   - influencer / podcast / website / radio — launched. Default ON. Their
 *     env var is a kill switch: set it to "false" to pull one back into
 *     "coming soon" without a code deploy. Leaving it unset means live.
 *   - sports / events / community / associations / restaurants /
 *     in-venue-screens — live by default. Their env vars remain emergency
 *     kill switches so an individual channel can be temporarily pulled
 *     back without a code deploy if operations require it.
 *   - transport / informal-retail — intentionally kept in development and
 *     disabled from the public marketplace/onboarding until those channels
 *     are ready to launch.
 *
 * Adding a new (not-yet-launched) channel:
 *   1. Add the slug to ChannelSlug in channelTypes.ts
 *   2. Add its env key to FLAG_ENV_KEYS below (it will default OFF —
 *      only slugs listed in DEFAULT_ON default to true when unset)
 *   3. Create the channel module in src/channels/<slug>/index.ts
 *   4. Register it in src/lib/channelRegistry.ts
 *   Done — no other file needs to change.
 */

import type { ChannelSlug } from "./channelTypes";

/**
 * Maps each channel slug to the Vite env variable that controls it.
 * null = channel is always on (the core social-media marketplace).
 */
const FLAG_ENV_KEYS: Record<ChannelSlug, string | null> = {
  "social-media": null, // always enabled — this is the live marketplace
  "influencer":   "VITE_CHANNEL_INFLUENCER_ENABLED",
  "podcast":      "VITE_CHANNEL_PODCAST_ENABLED",
  "website":      "VITE_CHANNEL_WEBSITE_ENABLED",
  "radio":        "VITE_CHANNEL_RADIO_ENABLED",
  "sports":           "VITE_CHANNEL_SPORTS_ENABLED",
  "events":           "VITE_CHANNEL_EVENTS_ENABLED",
  "community":        "VITE_CHANNEL_COMMUNITY_ENABLED",
  "transport":        "VITE_CHANNEL_TRANSPORT_ENABLED",
  "informal-retail":  "VITE_CHANNEL_INFORMAL_RETAIL_ENABLED",
  "associations":     "VITE_CHANNEL_ASSOCIATIONS_ENABLED",
  "restaurants":      "VITE_CHANNEL_RESTAURANTS_ENABLED",
  "in-venue-screens": "VITE_CHANNEL_IN_VENUE_SCREENS_ENABLED",
};

/**
 * Channels that default to ON when their env var is unset or empty — i.e.
 * live by default the moment this code ships, no deploy-environment env var
 * required. Everything else defaults OFF until explicitly turned on.
 */
const DEFAULT_ON: ChannelSlug[] = [
  "influencer",
  "podcast",
  "website",
  "radio",
  "sports",
  "events",
  "community",
  "associations",
  "restaurants",
  "in-venue-screens",
];

/** Channels intentionally kept in development and never enabled by env flags. */
const DEVELOPMENT_CHANNELS = new Set<ChannelSlug>([
  "transport",
  "informal-retail",
]);

/**
 * Whether an active ChatSched Business / Publisher Network subscription is
 * actually required to use the marketplace. Unlike the channel flags
 * above, this has no DEFAULT_ON list — it defaults OFF unconditionally.
 * The subscriptions (schema_phase55) are real and billable the moment
 * they ship; whether to start blocking non-subscribers from using
 * features they currently get for free is a separate, deliberate product
 * decision, not something that should flip on by omission. Nothing in
 * this codebase currently checks this flag yet — it exists so that
 * decision has somewhere to land without a schema change.
 */
export function isSubscriptionEnforcementEnabled(): boolean {
  return import.meta.env.VITE_SUBSCRIPTIONS_ENFORCED === "true";
}

/**
 * Whether the composer pre-scans a message client-side before sending —
 * instant "we removed contact details" feedback instead of waiting on a
 * round trip. Defaults ON: unlike the channel flags above this isn't a
 * maturity gate, and unlike subscription enforcement it isn't a held-back
 * product decision — it's exactly what "route through ChatSched" meant.
 *
 * IMPORTANT — read before treating this as a kill switch: it only
 * controls the client-side pre-scan in MessageThread.tsx / Messages.tsx.
 * It does NOT disable the trigger in schema_phase57_message_safety.sql —
 * that fires on every insert to messages and conversation_messages
 * regardless, because a Vite env var can't reach into Postgres. Flipping
 * this off just means the sender finds out their message was redacted
 * when it reloads instead of instantly — still correct, still redacted,
 * still flagged. A real database-level kill switch means disabling the
 * trigger, which is a migration, not an env var.
 */
export function isMessageSafetyPrescanEnabled(): boolean {
  return import.meta.env.VITE_MESSAGE_SAFETY_PRESCAN_ENABLED !== "false";
}

/** Returns true if the channel is ready for public use. */
export function isChannelEnabled(slug: ChannelSlug): boolean {
  if (DEVELOPMENT_CHANNELS.has(slug)) return false;
  const key = FLAG_ENV_KEYS[slug];
  if (key === null) return true; // always-on channel

  const raw = import.meta.env[key];
  if (raw === undefined || raw === "") return DEFAULT_ON.includes(slug);
  return raw === "true";
}

/**
 * Returns a map of all channel slugs and their enabled state.
 * Useful for the admin panel and channel hub overview.
 */
export function getAllChannelFlags(): Record<ChannelSlug, boolean> {
  return Object.fromEntries(
    (Object.keys(FLAG_ENV_KEYS) as ChannelSlug[]).map((slug) => [
      slug,
      isChannelEnabled(slug),
    ])
  ) as Record<ChannelSlug, boolean>;
}
