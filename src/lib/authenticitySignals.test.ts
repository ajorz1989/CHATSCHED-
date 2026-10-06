import { describe, it, expect } from "vitest";
import { computeAuthenticitySignals } from "./authenticitySignals";
import { suggestedPriceFor } from "./pricingEngine";
import { makePublisher } from "../test/fixtures";

const ids = (p: ReturnType<typeof makePublisher>) => computeAuthenticitySignals(p).map((s) => s.id);
const unverified = { email_verified: false, phone_verified: false, bio: "" } as const;

describe("computeAuthenticitySignals", () => {
  it("still flags an implausible engagement rate on a social listing", () => {
    expect(ids(makePublisher({ channel_slug: "social-media", engagement: 55, followers: 2000 }))).toContain("engagement_implausible");
  });

  it("does not run engagement, reach or price-band checks on a channel without followers", () => {
    const site = makePublisher({
      channel_slug: "website", engagement: 55, monthly_reach: 9_000_000, price_per_post: 99_999,
      followers: 20000, channel_metadata: { monthlyUniqueVisitors: 20000 }, email_verified: true,
    });
    const found = ids(site);
    for (const id of ["engagement_implausible", "engagement_high_for_size", "reach_outlier", "priced_far_above_band", "priced_far_below_band"]) {
      expect(found).not.toContain(id);
    }
  });

  it("judges a large audience against the channel's own ladder, in the channel's own words", () => {
    const bigPodcast = makePublisher({ channel_slug: "podcast", followers: 0, channel_metadata: { averageDownloadsPerEpisode: 12000 }, ...unverified });
    const signal = computeAuthenticitySignals(bigPodcast).find((s) => s.id === "unverified_large_audience");
    expect(signal?.detail).toContain("downloads per episode");

    const smallPodcast = makePublisher({ channel_slug: "podcast", followers: 0, channel_metadata: { averageDownloadsPerEpisode: 900 }, ...unverified });
    expect(ids(smallPodcast)).not.toContain("unverified_large_audience");
  });

  it("flags a thin profile on a big venue but not on an ordinary one", () => {
    const base = { channel_slug: "restaurants" as const, followers: 1, ...unverified };
    expect(ids(makePublisher({ ...base, channel_metadata: { estimatedDailyCovers: 150 } }))).toContain("thin_profile_for_size");
    expect(ids(makePublisher({ ...base, channel_metadata: { estimatedDailyCovers: 40 } }))).not.toContain("thin_profile_for_size");
  });

  it("never reads a typed 1 on an authority channel as an audience", () => {
    expect(ids(makePublisher({ channel_slug: "sports", followers: 1, channel_metadata: {}, ...unverified }))).toEqual([]);
  });
});

describe("suggestedPriceFor", () => {
  it("gives a followers-and-engagement suggestion for social media and influencer only", () => {
    expect(suggestedPriceFor(makePublisher({ channel_slug: "social-media", followers: 10000, engagement: 3 }))).not.toBeNull();
    expect(suggestedPriceFor(makePublisher({ channel_slug: "influencer", followers: 10000, engagement: 3 }))).not.toBeNull();
    expect(suggestedPriceFor(makePublisher({ channel_slug: "website", followers: 10000, engagement: 0 }))).toBeNull();
    expect(suggestedPriceFor(makePublisher({ channel_slug: "events", followers: 1, engagement: 0 }))).toBeNull();
  });
});
