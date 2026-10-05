import { describe, expect, it } from "vitest";
import { LEVEL_LADDERS, getLevelLadder } from "./levelLadders";
import { getAllChannels } from "./channelRegistry";

describe("LEVEL_LADDERS", () => {
  it("has exactly one ladder for every channel", () => {
    expect(LEVEL_LADDERS.map((l) => l.channel).sort()).toEqual(getAllChannels().map((c) => c.definition.slug).sort());
  });

  it("climbs strictly from Rising to Elite", () => {
    for (const l of LEVEL_LADDERS) {
      const [a, b, c, d] = l.thresholds;
      expect(a, l.channel).toBeGreaterThan(0);
      expect(b, l.channel).toBeGreaterThan(a);
      expect(c, l.channel).toBeGreaterThan(b);
      expect(d, l.channel).toBeGreaterThan(c);
    }
  });

  it("keeps the original follower ladder for social media and influencer", () => {
    expect(getLevelLadder("social-media")?.thresholds).toEqual([3000, 5000, 20000, 100000]);
    expect(getLevelLadder("influencer")?.thresholds).toEqual([3000, 5000, 20000, 100000]);
  });

  it("starts radio at its 2,000 weekly-listener minimum", () => {
    expect(getLevelLadder("radio")?.thresholds[0]).toBe(2000);
  });

  it("returns undefined for an unknown channel", () => {
    expect(getLevelLadder("nope")).toBeUndefined();
    expect(getLevelLadder(null)).toBeUndefined();
  });
});
