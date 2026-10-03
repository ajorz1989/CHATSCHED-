import type { Platform, Publisher } from "./types";
import { PLATFORMS } from "./constants";
import { getSocialMediaMetadata, getInfluencerMetadata } from "./channelOnboardingSchemas";

/**
 * Single source of truth for "which social platform(s) does this publisher
 * sell ads on". Before this existed, the Browse card / profile chips read
 * `publisher.platforms` (8 values, Facebook Page + Group separate) while the
 * profile's Audience block printed the onboarding values straight out of
 * channel_metadata (facebook, whatsapp_channel, ...), so one profile could
 * show two different lists. Everything that displays a platform now goes
 * through here.
 */

// Onboarding (channel_metadata) keys -> the canonical Platform label.
// "facebook" is ambiguous (Page vs Group); it resolves to whichever Facebook
// variant the publisher already listed, defaulting to "Facebook Page".
const ONBOARDING_KEY_TO_PLATFORM: Record<string, Platform> = {
  facebook: "Facebook Page",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp_channel: "WhatsApp Channel",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
};

export function platformFromOnboardingKey(key: string, listed: Platform[] = []): Platform | null {
  if (key === "facebook") {
    if (listed.includes("Facebook Group") && !listed.includes("Facebook Page")) return "Facebook Group";
    return "Facebook Page";
  }
  return ONBOARDING_KEY_TO_PLATFORM[key] ?? null;
}

function dedupeInCanonicalOrder(list: Platform[]): Platform[] {
  const set = new Set(list);
  return PLATFORMS.filter((p) => set.has(p));
}

/** The platforms this publisher's ads run on, in a stable canonical order. */
export function getAdPlatforms(publisher: Pick<Publisher, "platforms" | "channel_slug" | "channel_metadata">): Platform[] {
  const listed = (publisher.platforms ?? []).filter((p): p is Platform => PLATFORMS.includes(p));
  if (listed.length > 0) return dedupeInCanonicalOrder(listed);

  // Fallback for rows whose `platforms` column was never filled but whose
  // onboarding metadata names platforms.
  const derived: Platform[] = [];
  const social = getSocialMediaMetadata(publisher);
  if (social) {
    for (const key of [social.primaryPlatform, ...(social.secondaryPlatforms ?? [])]) {
      const p = platformFromOnboardingKey(String(key));
      if (p) derived.push(p);
    }
  }
  const influencer = getInfluencerMetadata(publisher);
  if (influencer?.primaryPlatform) {
    const p = platformFromOnboardingKey(String(influencer.primaryPlatform));
    if (p) derived.push(p);
  }
  return dedupeInCanonicalOrder(derived);
}

/** Followers per platform, where the publisher gave a per-platform count. */
export function getFollowersByPlatform(publisher: Pick<Publisher, "platforms" | "channel_slug" | "channel_metadata">): Partial<Record<Platform, number>> {
  const social = getSocialMediaMetadata(publisher);
  if (!social?.followerCountByPlatform) return {};
  const listed = (publisher.platforms ?? []) as Platform[];
  const out: Partial<Record<Platform, number>> = {};
  for (const [key, value] of Object.entries(social.followerCountByPlatform)) {
    const p = platformFromOnboardingKey(key, listed);
    if (p && Number(value) > 0) out[p] = (out[p] ?? 0) + Number(value);
  }
  return out;
}

/**
 * Combined followers across every platform the publisher sells on.
 * `publishers.followers` only stores the single biggest account (the primary
 * platform), so a three-platform publisher looked like it had one platform's
 * audience. Falls back to that stored number when there is no per-platform
 * breakdown (single-platform publishers, older rows, other channels).
 */
export function getTotalFollowers(publisher: Pick<Publisher, "followers" | "platforms" | "channel_slug" | "channel_metadata">): number {
  const sum = Object.values(getFollowersByPlatform(publisher)).reduce((a, b) => a + (b ?? 0), 0);
  return sum > 0 ? sum : publisher.followers;
}

/** How many platforms the total is summed over (1 when there is no breakdown). */
export function countFollowerPlatforms(publisher: Pick<Publisher, "platforms" | "channel_slug" | "channel_metadata">): number {
  return Object.keys(getFollowersByPlatform(publisher)).length;
}

/** Public profile URL the publisher gave for a platform, if any. */
export function getProfileUrlForPlatform(
  publisher: Pick<Publisher, "platforms" | "social_verification_links">,
  platform: Platform
): string | null {
  const listed = (publisher.platforms ?? []) as Platform[];
  for (const link of publisher.social_verification_links ?? []) {
    const p = PLATFORMS.includes(link.platform as Platform)
      ? (link.platform as Platform)
      : platformFromOnboardingKey(link.platform, listed);
    if (p === platform && /^https?:\/\//i.test(link.url)) return link.url;
  }
  return null;
}

/** Headline copy: "WhatsApp Channel only" vs "3 platforms". */
export function platformHeadline(platforms: Platform[]): string {
  if (platforms.length === 0) return "";
  if (platforms.length === 1) return `${platforms[0]} only`;
  return `${platforms.length} platforms`;
}

/** Plain-English list for sentences: "Instagram and TikTok", "A, B and C". */
export function joinPlatforms(platforms: Platform[]): string {
  if (platforms.length <= 1) return platforms[0] ?? "";
  return `${platforms.slice(0, -1).join(", ")} and ${platforms[platforms.length - 1]}`;
}

/** Does a publisher's channel sell ads on social platforms at all? */
export function sellsOnSocialPlatforms(publisher: Pick<Publisher, "platforms" | "channel_slug" | "channel_metadata">): boolean {
  return getAdPlatforms(publisher).length > 0;
}

/**
 * Value used for "one booking that covers every platform the publisher sells
 * on" — a package. Used by the request forms (as the chosen platform) and by
 * rate cards (as the platform a package price belongs to).
 */
export const ALL_PLATFORMS = "All platforms" as const;

/** Text written into a request / shown on a rate card line for the package. */
export function allPlatformsLabel(platforms: Platform[]): string {
  return `${ALL_PLATFORMS} (${joinPlatforms(platforms)})`;
}

/** The "pick a platform or the package" options, in display order. */
export function platformChoices(platforms: Platform[]): Array<{ value: string; label: string }> {
  const singles = platforms.map((p) => ({ value: p as string, label: p as string }));
  if (platforms.length < 2) return singles;
  return [...singles, { value: ALL_PLATFORMS, label: `All ${platforms.length} platforms — package` }];
}
