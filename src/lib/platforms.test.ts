import { describe, it, expect } from "vitest";
import { getAdPlatforms, getFollowersByPlatform, platformHeadline, platformFromOnboardingKey, joinPlatforms } from "./platforms";
import type { Publisher } from "./types";

type P = Pick<Publisher, "platforms" | "channel_slug" | "channel_metadata">;
const base = (over: Partial<P>): P => ({ platforms: [], channel_slug: "social-media", channel_metadata: null, ...over }) as P;

describe("platforms", () => {
  it("uses the listed platforms in canonical order and keeps Facebook Page/Group separate", () => {
    expect(getAdPlatforms(base({ platforms: ["TikTok", "Facebook Group", "Facebook Page"] }))).toEqual(["Facebook Page", "Facebook Group", "TikTok"]);
  });

  it("falls back to onboarding metadata when platforms is empty", () => {
    const p = base({ channel_metadata: { primaryPlatform: "whatsapp_channel", secondaryPlatforms: ["instagram"], followerCountByPlatform: {} } });
    expect(getAdPlatforms(p)).toEqual(["Instagram", "WhatsApp Channel"]);
  });

  it("returns nothing for channels with no social platforms", () => {
    expect(getAdPlatforms(base({ channel_slug: "radio" }))).toEqual([]);
  });

  it("headlines a single platform as 'only'", () => {
    expect(platformHeadline(["WhatsApp Channel"])).toBe("WhatsApp Channel only");
    expect(platformHeadline(["Instagram", "TikTok"])).toBe("2 platforms");
    expect(joinPlatforms(["Instagram", "TikTok", "X"])).toBe("Instagram, TikTok and X");
  });

  it("maps onboarding 'facebook' to the Facebook variant the publisher listed", () => {
    expect(platformFromOnboardingKey("facebook", ["Facebook Group"])).toBe("Facebook Group");
    expect(platformFromOnboardingKey("facebook", [])).toBe("Facebook Page");
  });

  it("splits followers per platform", () => {
    const p = base({ platforms: ["Instagram", "WhatsApp Channel"], channel_metadata: { followerCountByPlatform: { instagram: 4000, whatsapp_channel: 8000 } } });
    expect(getFollowersByPlatform(p)).toEqual({ Instagram: 4000, "WhatsApp Channel": 8000 });
  });
});
