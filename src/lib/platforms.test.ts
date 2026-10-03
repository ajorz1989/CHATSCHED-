import { describe, it, expect } from "vitest";
import { ALL_PLATFORMS, allPlatformsLabel, platformChoices, countFollowerPlatforms, getTotalFollowers, getAdPlatforms, getFollowersByPlatform, platformHeadline, platformFromOnboardingKey, joinPlatforms } from "./platforms";
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

  it("totals followers across all platforms instead of showing only the biggest account", () => {
    // Joburg City Finds: followers column stores only the Instagram figure.
    const p = { ...base({ platforms: ["Instagram", "Facebook Page", "TikTok"], channel_metadata: { followerCountByPlatform: { tiktok: 18300, facebook: 22100, instagram: 45700 } } }), followers: 45700 };
    expect(getTotalFollowers(p)).toBe(86100);
    expect(countFollowerPlatforms(p)).toBe(3);
  });

  it("falls back to the stored followers when there is no per-platform breakdown", () => {
    const p = { ...base({ platforms: ["WhatsApp Channel"], channel_metadata: { followerCountByPlatform: {} } }), followers: 49997 };
    expect(getTotalFollowers(p)).toBe(49997);
    expect(countFollowerPlatforms(p)).toBe(0);
  });

  it("offers an all-platforms package only when there is more than one platform", () => {
    expect(platformChoices(["WhatsApp Channel"]).map((c) => c.value)).toEqual(["WhatsApp Channel"]);
    const multi = platformChoices(["Instagram", "Facebook Page", "TikTok"]);
    expect(multi.map((c) => c.value)).toEqual(["Instagram", "Facebook Page", "TikTok", ALL_PLATFORMS]);
    expect(multi[3].label).toBe("All 3 platforms — package");
    expect(allPlatformsLabel(["Instagram", "TikTok"])).toBe("All platforms (Instagram and TikTok)");
  });
});
