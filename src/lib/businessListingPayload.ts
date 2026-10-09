/**
 * Builds and validates the payload the business listing creator sends to
 * create_business_publisher_listing(). It reuses the same channel onboarding
 * model as the publisher application (channelOnboardingForm.ts), so a listing a
 * business creates for itself carries the same channel_metadata a normal
 * application would, and the browse card / profile show the right numbers.
 */
import type { ChannelSlug } from "./channelTypes";
import type { Platform } from "./types";
import { podcastShowUrlError } from "./podcastVerification";
import { getChannelBySlug } from "./channelRegistry";
import { isAuthorityChannel, AUTHORITY_SUBJECT } from "./channelOnboardingSchemas";
import { platformFromOnboardingKey } from "./platforms";
import {
  type FormState, buildChannelMetadata, buildInfluencerLinks, withAuthorityFlag, getSelectedSocialPlatforms,
  SOCIAL_MEDIA_PLATFORM_LABELS,
} from "./channelOnboardingForm";

export interface BusinessListingGeneral {
  name: string;
  category: string;
  city: string;
  province: string;
  suburb: string;
  price: number;
  bio: string;
  audience: string;
}

export type BusinessListingResult =
  | { ok: true; payload: Record<string, unknown>; needsProof: boolean }
  | { ok: false; error: string };

/** Channels whose approval needs proof photos/video (matches channels.verification_required). */
export const PROOF_REQUIRED_CHANNELS: readonly ChannelSlug[] = [
  "sports", "events", "community", "transport", "informal-retail", "associations", "restaurants", "in-venue-screens",
];

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildBusinessListingPayload(
  channelSlug: ChannelSlug,
  general: BusinessListingGeneral,
  form: FormState,
): BusinessListingResult {
  const ch = getChannelBySlug(channelSlug)?.definition;
  if (!ch) return { ok: false, error: "Choose a channel." };

  const authority = isAuthorityChannel(channelSlug);
  const social = channelSlug === "social-media";
  const influencer = channelSlug === "influencer";

  if (authority) {
    if (!form.authorityConfirmed) {
      const subject = AUTHORITY_SUBJECT[channelSlug as keyof typeof AUTHORITY_SUBJECT];
      return { ok: false, error: `Confirm that you own or run this ${subject} and can sell advertising on it.` };
    }
  } else {
    // Digital channels keep their real minimum, same as the publisher application.
    const min = ch.eligibility?.minValue ?? 0;
    const metric = Number(form.followers);
    if (!metric || metric < min) {
      const label = (ch.eligibility?.metricLabel ?? "Audience").toLowerCase();
      return { ok: false, error: `${ch.name} listings need at least ${min.toLocaleString()} ${label}.` };
    }
  }

  // Podcasts are checked by reading the show's RSS feed, so the listing must carry it.
  if (channelSlug === "podcast") {
    const feedError = podcastShowUrlError(form.podcastShowUrl);
    if (feedError) return { ok: false, error: feedError };
  }

  // Social media: at least one public profile link per chosen platform.
  let socialLinks: Array<{ platform: string; url: string }> = [];
  let platforms: Platform[] = [];
  if (social) {
    const picked = getSelectedSocialPlatforms(form);
    if (picked.length === 0) return { ok: false, error: "Choose your primary social platform." };
    for (const p of picked) {
      const url = (form.smSocialLinks[p] ?? "").trim();
      if (!isHttpUrl(url)) {
        return { ok: false, error: `Add the public ${SOCIAL_MEDIA_PLATFORM_LABELS[p]} profile link (starting with https://).` };
      }
      socialLinks.push({ platform: p, url });
    }
    platforms = picked
      .map((p) => platformFromOnboardingKey(p))
      .filter((p): p is Platform => p !== null);
  } else if (influencer) {
    if (form.infPrimaryPlatform) {
      const p = platformFromOnboardingKey(form.infPrimaryPlatform);
      if (p) platforms = [p];
    }
    if (form.infProfileUrl.trim() && !isHttpUrl(form.infProfileUrl)) {
      return { ok: false, error: "The public profile link must start with https://." };
    }
    socialLinks = buildInfluencerLinks(form);
  }
  socialLinks = socialLinks.slice(0, 6);

  const hasEngagement = social || influencer;
  const engagement = hasEngagement
    ? Number(influencer ? form.infEngagementRate : form.engagement) || 0
    : 0;

  const metadata = withAuthorityFlag(buildChannelMetadata(channelSlug, form), channelSlug, form.authorityConfirmed);

  return {
    ok: true,
    needsProof: PROOF_REQUIRED_CHANNELS.includes(channelSlug),
    payload: {
      name: general.name.trim(),
      channel_slug: channelSlug,
      category: general.category,
      city: general.city.trim(),
      province: general.province,
      suburb: general.suburb.trim(),
      price_per_post: general.price,
      // Authority channels have no audience number to type: the real size is in channel_metadata.
      followers: authority ? 0 : Number(form.followers) || 0,
      engagement,
      monthly_reach: hasEngagement ? Number(form.monthlyReach) || null : null,
      platforms,
      accepted_ad_formats: form.adFormats,
      bio: general.bio.trim(),
      audience: general.audience.trim(),
      social_verification_links: socialLinks,
      channel_metadata: metadata ?? {},
    },
  };
}
