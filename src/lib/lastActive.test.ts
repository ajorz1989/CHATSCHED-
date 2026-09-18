import { describe, it, expect } from "vitest";
import { lastActiveInfo, lastActiveLabel } from "./lastActive";

const NOW = new Date("2026-08-15T12:00:00Z");

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
}

describe("lastActiveInfo", () => {
  it("returns null when there's no signal at all", () => {
    expect(lastActiveInfo(null, NOW)).toBeNull();
  });

  it("labels very recent activity in hours, tier recent", () => {
    const info = lastActiveInfo(hoursAgo(2), NOW);
    expect(info?.label).toBe("Active 2 hours ago");
    expect(info?.tier).toBe("recent");
  });

  it("rounds sub-hour activity up to 1 hour rather than 0", () => {
    const info = lastActiveInfo(hoursAgo(0.2), NOW);
    expect(info?.label).toBe("Active 1 hour ago");
  });

  it("uses singular phrasing for exactly 1 hour", () => {
    expect(lastActiveInfo(hoursAgo(1), NOW)?.label).toBe("Active 1 hour ago");
  });

  it("labels same-day-but-not-recent activity as 'Active today'", () => {
    const info = lastActiveInfo(hoursAgo(20), NOW);
    expect(info?.label).toBe("Active today");
    expect(info?.tier).toBe("recent");
  });

  it("labels multi-day activity within a week in days, tier this_week", () => {
    const info = lastActiveInfo(daysAgo(3), NOW);
    expect(info?.label).toBe("Active 3 days ago");
    expect(info?.tier).toBe("this_week");
  });

  it("labels a week or more as 'Inactive for N days', tier inactive", () => {
    const info = lastActiveInfo(daysAgo(14), NOW);
    expect(info?.label).toBe("Inactive for 14 days");
    expect(info?.tier).toBe("inactive");
  });

  it("caps extremely stale accounts at a '90+' label instead of an exact huge number", () => {
    const info = lastActiveInfo(daysAgo(400), NOW);
    expect(info?.label).toBe("Inactive for 90+ days");
  });

  it("treats a slightly-in-the-future timestamp (clock skew) as no signal rather than negative", () => {
    expect(lastActiveInfo(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBeNull();
  });
});

describe("lastActiveLabel", () => {
  it("returns just the string form", () => {
    expect(lastActiveLabel(daysAgo(3), NOW)).toBe("Active 3 days ago");
    expect(lastActiveLabel(null, NOW)).toBeNull();
  });
});
