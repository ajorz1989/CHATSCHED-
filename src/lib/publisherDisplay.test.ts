import { describe, it, expect } from "vitest";
import { scoreLabel, LEVEL_META } from "./publisherDisplay";

describe("scoreLabel", () => {
  it("labels the boundary and interior of each band correctly", () => {
    expect(scoreLabel(0)).toBe("Average");
    expect(scoreLabel(49)).toBe("Average");
    expect(scoreLabel(50)).toBe("Good");
    expect(scoreLabel(69)).toBe("Good");
    expect(scoreLabel(70)).toBe("Very Good");
    expect(scoreLabel(84)).toBe("Very Good");
    expect(scoreLabel(85)).toBe("Excellent");
    expect(scoreLabel(100)).toBe("Excellent");
  });
});

describe("LEVEL_META", () => {
  it("has display metadata for all four publisher levels", () => {
    for (const level of ["rising", "verified", "premium", "elite"] as const) {
      expect(LEVEL_META[level].label).toBeTruthy();
      expect(LEVEL_META[level].ringCount).toBeGreaterThan(0);
    }
  });
});
