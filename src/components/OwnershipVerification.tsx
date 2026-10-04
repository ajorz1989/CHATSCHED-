import type { Publisher } from "../lib/types";
import SocialVerificationPanel from "./SocialVerificationPanel";
import WebsiteVerificationPanel from "./WebsiteVerificationPanel";

/** Channels where a code the owner places themselves is checked before approval (migration 20261005000000). */
export const OWNERSHIP_CODE_CHANNELS = ["social-media", "influencer", "website"] as const;

export function hasOwnershipCheck(channelSlug: string | null | undefined): boolean {
  return (OWNERSHIP_CODE_CHANNELS as readonly string[]).includes(channelSlug ?? "");
}

export function ownershipPanelTitle(channelSlug: string | null | undefined): string {
  return channelSlug === "website" ? "Verify your website" : "Verify your account";
}

/** The right ownership panel for the listing's channel, or nothing if it has none. */
export default function OwnershipVerification({ publisher, onChange }: { publisher: Publisher; onChange: () => void }) {
  if (publisher.channel_slug === "website") return <WebsiteVerificationPanel publisher={publisher} onChange={onChange} />;
  if (publisher.channel_slug === "social-media" || publisher.channel_slug === "influencer") {
    return <SocialVerificationPanel publisher={publisher} onChange={onChange} />;
  }
  return null;
}
