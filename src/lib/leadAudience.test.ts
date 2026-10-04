import { describe, it, expect } from "vitest";
import {
  getLeadAudience, formatLeadAudience, formatAudienceCount, showsEngagement, getPriceUnit,
  type LeadAudiencePublisher,
} from "./leadAudience";
import type { ChannelSlug } from "./channelTypes";
import { getAllChannels } from "./channelRegistry";

function pub(slug: string | null, metadata: Record<string, unknown> | null, followers = 1): LeadAudiencePublisher {
  return {
    channel_slug: slug as ChannelSlug,
    channel_metadata: metadata,
    followers,
    platforms: [],
  };
}

// slug -> [metadata with the channel's own number, expected value, expected label]
const WITH_METADATA: Array<[string, Record<string, unknown>, number, string]> = [
  ["podcast", { averageDownloadsPerEpisode: 800 }, 800, "downloads per episode"],
  ["website", { monthlyUniqueVisitors: 12000 }, 12000, "monthly visitors"],
  ["radio", { weeklyListeners: 30000, averageDailyListenership: 4500 }, 30000, "weekly listeners"],
  ["radio", { averageDailyListenership: 4500 }, 4500, "daily listeners"], // legacy rows
  ["events", { typicalAttendance: 2500 }, 2500, "typical attendance"],
  ["sports", { averageMatchdayAttendance: 300 }, 300, "matchday attendance"],
  ["community", { memberCount: 1200 }, 1200, "members"],
  ["associations", { memberCount: 90 }, 90, "members"],
  ["restaurants", { estimatedDailyCovers: 250 }, 250, "daily covers"],
  ["in-venue-screens", { estimatedFootfallPerNight: 600 }, 600, "footfall per night"],
  ["transport", { estimatedDailyPassengers: 3000, vehicleCount: 12 }, 3000, "daily passengers"],
  ["informal-retail", { estimatedDailyFootTraffic: 150 }, 150, "daily customers"],
];

describe("getLeadAudience", () => {
  it.each(WITH_METADATA)("%s leads with its own metadata number", (slug, metadata, value, label) => {
    // followers holds a meaningless typed 1 and must never be used when metadata exists
    expect(getLeadAudience(pub(slug, metadata, 1))).toEqual({ value, label });
  });

  it("social media uses stored followers when there is no per-platform breakdown", () => {
    expect(getLeadAudience(pub("social-media", null, 8200))).toEqual({ value: 8200, label: "followers" });
  });

  it("social media sums followers across platforms and says combined", () => {
    const p = pub("social-media", { followerCountByPlatform: { instagram: 5000, tiktok: 3000 } }, 5000);
    expect(getLeadAudience(p)).toEqual({ value: 8000, label: "combined followers" });
  });

  it("influencer leads with followers on the primary platform", () => {
    expect(getLeadAudience(pub("influencer", { niche: "food" }, 15000))).toEqual({ value: 15000, label: "followers" });
  });

  it("transport falls back to vehicles when daily passengers is not tracked", () => {
    expect(getLeadAudience(pub("transport", { estimatedDailyPassengers: null, vehicleCount: 12 }))).toEqual({ value: 12, label: "vehicles" });
  });

  it("legacy rows with no channel are treated as social pages", () => {
    expect(getLeadAudience(pub(null, null, 3000))).toEqual({ value: 3000, label: "followers" });
    expect(showsEngagement({ channel_slug: null as unknown as ChannelSlug })).toBe(true);
  });
});

describe("getLeadAudience with missing metadata (null or {})", () => {
  const AUTHORITY: ChannelSlug[] = [
    "community", "events", "informal-retail", "associations", "transport", "in-venue-screens", "restaurants", "sports",
  ];

  it.each(AUTHORITY)("%s never falls back to the typed 1 in followers", (slug) => {
    for (const metadata of [null, {}]) {
      const lead = getLeadAudience(pub(slug, metadata, 1));
      expect(lead.value).toBeNull();
      expect(formatLeadAudience(pub(slug, metadata, 1))).toBe("Audience not listed");
    }
  });

  it.each([
    ["podcast", "downloads per episode"],
    ["website", "monthly visitors"],
    ["radio", "weekly listeners"],
  ])("%s falls back to the stored number with the right label", (slug, label) => {
    expect(getLeadAudience(pub(slug, {}, 12000))).toEqual({ value: 12000, label });
  });

  it("never prints a zero or a bare 1", () => {
    for (const slug of ["podcast", "website", "radio", "social-media", "influencer"]) {
      expect(getLeadAudience(pub(slug, null, 0)).value).toBeNull();
    }
    expect(formatLeadAudience(pub("sports", null, 1))).not.toMatch(/\b1 /);
  });

  it("ignores junk metadata values", () => {
    expect(getLeadAudience(pub("website", { monthlyUniqueVisitors: "lots" }, 1)).value).toBe(1);
    expect(getLeadAudience(pub("events", { typicalAttendance: -5 }, 1)).value).toBeNull();
  });
});

describe("covers all 13 channels", () => {
  it("returns a result (never throws) for every registered channel with null metadata", () => {
    const channels = getAllChannels();
    expect(channels).toHaveLength(13);
    for (const m of channels) {
      const slug = m.definition.slug;
      expect(() => getLeadAudience(pub(slug, null, 1))).not.toThrow();
      expect(typeof getLeadAudience(pub(slug, null, 1)).label).toBe("string");
    }
  });
});

describe("showsEngagement", () => {
  it("is true only for social media and influencer", () => {
    for (const m of getAllChannels()) {
      const slug = m.definition.slug;
      expect(showsEngagement({ channel_slug: slug })).toBe(slug === "social-media" || slug === "influencer");
    }
  });
});

describe("formatting", () => {
  it("formats compact counts", () => {
    expect(formatAudienceCount(950)).toBe("950");
    expect(formatAudienceCount(1200)).toBe("1.2k");
    expect(formatAudienceCount(12000)).toBe("12k");
    expect(formatAudienceCount(1_500_000)).toBe("1.5M");
  });

  it("formats the headline", () => {
    expect(formatLeadAudience(pub("website", { monthlyUniqueVisitors: 12000 }))).toBe("12k monthly visitors");
    expect(formatLeadAudience(pub("restaurants", { estimatedDailyCovers: 250 }))).toBe("250 daily covers");
    expect(formatLeadAudience(pub("website", { monthlyUniqueVisitors: 12000 }), { compact: false })).toBe("12,000 monthly visitors");
  });
});

describe("getPriceUnit", () => {
  it("uses each channel's own pricing unit instead of /post", () => {
    expect(getPriceUnit("social-media")).toBe("per post");
    expect(getPriceUnit("influencer")).toBe("per deliverable");
    expect(getPriceUnit("podcast")).toBe("per ad slot");
    expect(getPriceUnit("website")).toBe("per placement");
    expect(getPriceUnit("radio")).toBe("per 30-second spot");
    expect(getPriceUnit("transport")).toBe("per vehicle");
    expect(getPriceUnit("events")).toBe("per event");
  });

  it("has a sensible unit for every channel and for unknown or missing slugs", () => {
    for (const m of getAllChannels()) expect(getPriceUnit(m.definition.slug)).toMatch(/^per /);
    expect(getPriceUnit(null)).toBe("per post");
    expect(getPriceUnit("made-up")).toBe("per booking");
  });
});
