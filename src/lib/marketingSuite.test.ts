import { describe, it, expect } from "vitest";
import { estimateRoi, matchPublishers, isCaptionProviderConfigured } from "./marketingSuite";
import { makePublisher } from "../test/fixtures";

describe("estimateRoi", () => {
  it("returns a zeroed estimate with a hint message for a zero or negative budget", () => {
    const result = estimateRoi(0, [makePublisher()]);
    expect(result.estimatedReach).toBe(0);
    expect(result.assumptions[0]).toMatch(/budget above r0/i);
  });

  it("returns a zeroed estimate when there is nothing priced to model against", () => {
    const unpriced = makePublisher({ price_per_post: 0 });
    const result = estimateRoi(1000, [unpriced]);
    expect(result.estimatedReach).toBe(0);
    expect(result.assumptions.some((a) => /no priced publishers/i.test(a))).toBe(true);
  });

  it("produces a positive, non-fabricated estimate for a real budget against priced publishers", () => {
    const pubs = [makePublisher({ id: "a", price_per_post: 100, followers: 10000 }), makePublisher({ id: "b", price_per_post: 150, followers: 8000 })];
    const result = estimateRoi(500, pubs);
    expect(result.budget).toBe(500);
    expect(result.estimatedReach).toBeGreaterThan(0);
    expect(result.estimatedReturnLow).toBeLessThanOrEqual(result.estimatedReturnHigh);
  });

  it("only models against the selected subset when selectedIds is given", () => {
    const pubs = [makePublisher({ id: "a", price_per_post: 100 }), makePublisher({ id: "b", price_per_post: 100 })];
    const both = estimateRoi(1000, pubs);
    const oneOnly = estimateRoi(1000, pubs, ["a"]);
    // Restricting the pool changes what's being modeled — the two calls
    // shouldn't silently produce identical output.
    expect(oneOnly).not.toEqual(both);
  });
});

describe("matchPublishers", () => {
  it("ranks a category match above an unrelated publisher for a category-specific query", () => {
    const foodPub = makePublisher({ id: "food", category: "Food & Drink", audience: "foodies who love coffee" });
    const fashionPub = makePublisher({ id: "fashion", category: "Fashion & Lifestyle", audience: "streetwear fans" });
    const results = matchPublishers("coffee shop promotion", [foodPub, fashionPub]);
    expect(results[0].publisher.id).toBe("food");
  });

  it("never returns a publisher id that wasn't in the input list", () => {
    const pubs = [makePublisher({ id: "only-one" })];
    const results = matchPublishers("anything", pubs);
    expect(results.every((r) => pubs.some((p) => p.id === r.publisher.id))).toBe(true);
  });

  it("respects the limit option", () => {
    const pubs = Array.from({ length: 10 }, (_, i) => makePublisher({ id: `p${i}` }));
    const results = matchPublishers("local business", pubs, { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

describe("isCaptionProviderConfigured", () => {
  it("returns a boolean without throwing when no provider key is present", () => {
    expect(typeof isCaptionProviderConfigured()).toBe("boolean");
  });
});
