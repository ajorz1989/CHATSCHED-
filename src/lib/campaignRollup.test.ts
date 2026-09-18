import { describe, it, expect } from "vitest";
import { computeTotals, topCampaigns, bucketClicksByWeek } from "./campaignRollup";
import type { CampaignStats } from "./types";

function makeStats(overrides: Partial<CampaignStats> = {}): CampaignStats {
  return {
    campaign_id: "camp-1",
    owner_id: "owner-1",
    slug: "winter-sale",
    name: "Winter Sale",
    status: "active",
    clicks: 0,
    visits: 0,
    leads: 0,
    conversions: 0,
    conversion_value: 0,
    last_event_at: null,
    ...overrides,
  };
}

describe("computeTotals", () => {
  it("returns all zeros for no campaigns", () => {
    expect(computeTotals([])).toEqual({ clicks: 0, visits: 0, leads: 0, conversions: 0, conversionValue: 0 });
  });

  it("sums across multiple campaigns", () => {
    const stats = [
      makeStats({ campaign_id: "a", clicks: 10, visits: 5, leads: 2, conversions: 1, conversion_value: 100 }),
      makeStats({ campaign_id: "b", clicks: 20, visits: 15, leads: 3, conversions: 2, conversion_value: 250 }),
    ];
    expect(computeTotals(stats)).toEqual({ clicks: 30, visits: 20, leads: 5, conversions: 3, conversionValue: 350 });
  });
});

describe("topCampaigns", () => {
  it("excludes campaigns with zero clicks", () => {
    const stats = [makeStats({ campaign_id: "a", clicks: 0 }), makeStats({ campaign_id: "b", clicks: 5 })];
    const top = topCampaigns(stats);
    expect(top.map((s) => s.campaign_id)).toEqual(["b"]);
  });

  it("ranks by clicks descending and respects the limit", () => {
    const stats = [
      makeStats({ campaign_id: "low", clicks: 3 }),
      makeStats({ campaign_id: "high", clicks: 50 }),
      makeStats({ campaign_id: "mid", clicks: 10 }),
      makeStats({ campaign_id: "extra", clicks: 20 }),
    ];
    const top = topCampaigns(stats, 3);
    expect(top.map((s) => s.campaign_id)).toEqual(["high", "extra", "mid"]);
  });
});

describe("bucketClicksByWeek", () => {
  const rangeStart = new Date("2026-06-01T00:00:00Z");

  it("returns the requested number of buckets, all zero, for no events", () => {
    const buckets = bucketClicksByWeek([], rangeStart, 8);
    expect(buckets).toHaveLength(8);
    expect(buckets.every((b) => b.clicks === 0)).toBe(true);
  });

  it("places an event on day 0 into the first bucket", () => {
    const buckets = bucketClicksByWeek([{ created_at: "2026-06-01T12:00:00Z" }], rangeStart, 8);
    expect(buckets[0].clicks).toBe(1);
    expect(buckets.slice(1).every((b) => b.clicks === 0)).toBe(true);
  });

  it("places an event on day 10 into the second bucket (week 2)", () => {
    const buckets = bucketClicksByWeek([{ created_at: "2026-06-11T00:00:00Z" }], rangeStart, 8);
    expect(buckets[1].clicks).toBe(1);
  });

  it("clamps an event slightly before rangeStart into the first bucket rather than dropping it", () => {
    const buckets = bucketClicksByWeek([{ created_at: "2026-05-31T23:00:00Z" }], rangeStart, 8);
    expect(buckets[0].clicks).toBe(1);
  });

  it("clamps an event past the end of the range into the last bucket", () => {
    const buckets = bucketClicksByWeek([{ created_at: "2026-08-01T00:00:00Z" }], rangeStart, 8);
    expect(buckets[7].clicks).toBe(1);
  });

  it("counts multiple events in the same week together", () => {
    const buckets = bucketClicksByWeek(
      [{ created_at: "2026-06-02T00:00:00Z" }, { created_at: "2026-06-03T00:00:00Z" }, { created_at: "2026-06-04T00:00:00Z" }],
      rangeStart,
      8
    );
    expect(buckets[0].clicks).toBe(3);
  });
});
