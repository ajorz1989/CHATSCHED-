import { describe, it, expect } from "vitest";
import { makeDefaults, matchesFilters, summarizeFilters, activeCount, applySort, getMatchReason, socialFiltersApply } from "./browseFilters";
import { makePublisher } from "../test/fixtures";

describe("matchesFilters", () => {
  it("matches everything with default (empty) filters", () => {
    const p = makePublisher();
    expect(matchesFilters(p, makeDefaults({}))).toBe(true);
  });

  it("filters by category", () => {
    const p = makePublisher({ category: "Food & Drink" });
    expect(matchesFilters(p, makeDefaults({ category: "Food & Drink" }))).toBe(true);
    expect(matchesFilters(p, makeDefaults({ category: "Fitness" }))).toBe(false);
  });

  it("filters by verifiedOnly", () => {
    const unverified = makePublisher({ verified: false });
    const verified = makePublisher({ verified: true });
    const filters = makeDefaults({ verifiedOnly: true });
    expect(matchesFilters(unverified, filters)).toBe(false);
    expect(matchesFilters(verified, filters)).toBe(true);
  });

  it("filters by min/max followers when a social channel is selected", () => {
    const p = makePublisher({ followers: 10000, platforms: [], channel_metadata: null });
    const f = (patch: object) => makeDefaults({ channel: "social-media", ...patch });
    expect(matchesFilters(p, f({ minFollowers: "5000" }))).toBe(true);
    expect(matchesFilters(p, f({ minFollowers: "20000" }))).toBe(false);
    expect(matchesFilters(p, f({ maxFollowers: "20000" }))).toBe(true);
    expect(matchesFilters(p, f({ maxFollowers: "5000" }))).toBe(false);
  });

  it("ignores follower, reach and engagement filters unless social media or influencer is selected", () => {
    const venue = makePublisher({ channel_slug: "restaurants", followers: 0, engagement: 0, monthly_reach: null });
    const filters = { minFollowers: "5000", minMonthlyReach: "1000", minEngagement: "3" };
    expect(socialFiltersApply(makeDefaults({}))).toBe(false);
    expect(socialFiltersApply(makeDefaults({ channel: "influencer" }))).toBe(true);
    expect(matchesFilters(venue, makeDefaults(filters))).toBe(true);
    expect(matchesFilters(venue, makeDefaults({ ...filters, channel: "restaurants" }))).toBe(true);
    expect(activeCount(makeDefaults(filters))).toBe(0);
    expect(summarizeFilters(makeDefaults(filters))).toBe("Every publisher in the directory");
    // and they bite again for a social channel
    const social = makePublisher({ channel_slug: "influencer", followers: 100, engagement: 1 });
    expect(matchesFilters(social, makeDefaults({ ...filters, channel: "influencer" }))).toBe(false);
  });

  it("filters by max price", () => {
    const p = makePublisher({ price_per_post: 1500 });
    expect(matchesFilters(p, makeDefaults({ maxPrice: 2000 }))).toBe(true);
    expect(matchesFilters(p, makeDefaults({ maxPrice: 1000 }))).toBe(false);
  });

  it("filters by platform overlap", () => {
    const p = makePublisher({ platforms: ["Instagram", "TikTok"] });
    expect(matchesFilters(p, makeDefaults({ platforms: ["TikTok"] }))).toBe(true);
    expect(matchesFilters(p, makeDefaults({ platforms: ["YouTube"] }))).toBe(false);
  });

  it("matches keyword against name, bio, audience, and city", () => {
    const p = makePublisher({ name: "Cape Town Foodies", bio: "local eats", audience: "foodies", city: "Cape Town" });
    expect(matchesFilters(p, makeDefaults({ query: "foodies" }))).toBe(true);
    expect(matchesFilters(p, makeDefaults({ query: "somethingelse" }))).toBe(false);
  });
});

describe("activeCount", () => {
  it("is zero for default filters", () => {
    expect(activeCount(makeDefaults({}))).toBe(0);
  });

  it("counts each active filter once", () => {
    const f = makeDefaults({ category: "Food & Drink", verifiedOnly: true, platforms: ["Instagram"] });
    expect(activeCount(f)).toBe(3);
  });
});

describe("summarizeFilters", () => {
  it("describes an empty filter set as everything", () => {
    expect(summarizeFilters(makeDefaults({}))).toBe("Every publisher in the directory");
  });

  it("joins active filters into a readable summary", () => {
    const summary = summarizeFilters(makeDefaults({ category: "Food & Drink", verifiedOnly: true }));
    expect(summary).toContain("Food & Drink");
    expect(summary).toContain("Verified only");
  });
});

describe("applySort: Largest audience", () => {
  it("orders by each listing's own headline number and puts unlisted audiences last", () => {
    const site = makePublisher({ id: "site", channel_slug: "website", followers: 0, channel_metadata: { monthlyUniqueVisitors: 50000 } });
    const hall = makePublisher({ id: "hall", channel_slug: "events", followers: 1, channel_metadata: { typicalAttendance: 300 } });
    const unknown = makePublisher({ id: "unknown", channel_slug: "restaurants", followers: 1, channel_metadata: {} });
    const sorted = applySort([unknown, hall, site], "followers_desc").map((p) => p.id);
    expect(sorted).toEqual(["site", "hall", "unknown"]);
  });
});

describe("getMatchReason", () => {
  const base = { rating: null, verified: false, trust_score: 0, avg_response_hours: null } as const;
  it("does not praise engagement or follower counts for a channel that has neither", () => {
    const venue = makePublisher({ ...base, channel_slug: "restaurants", engagement: 9, followers: 50000, channel_metadata: {} });
    expect(getMatchReason(venue)).toBeNull();
  });
  it("calls an audience large only against the channel's own Premium level", () => {
    const podcastBig = makePublisher({ ...base, channel_slug: "podcast", engagement: 0, followers: 0, channel_metadata: { averageDownloadsPerEpisode: 12000 } });
    const podcastSmall = makePublisher({ ...base, channel_slug: "podcast", engagement: 0, followers: 0, channel_metadata: { averageDownloadsPerEpisode: 900 } });
    expect(getMatchReason(podcastBig)).toBe("Large, established audience");
    expect(getMatchReason(podcastSmall)).toBeNull();
  });
});
