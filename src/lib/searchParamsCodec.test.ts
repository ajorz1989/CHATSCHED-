import { describe, it, expect } from "vitest";
import { filtersToSearchParams, searchParamsToFilters, browseUrlForFilters } from "./searchParamsCodec";
import { makeDefaults } from "./browseFilters";

describe("filtersToSearchParams / searchParamsToFilters round-trip", () => {
  it("produces an empty query string for default filters", () => {
    const params = filtersToSearchParams(makeDefaults({}));
    expect(params.toString()).toBe("");
  });

  it("round-trips a full filter set, including verifiedOnly", () => {
    const original = makeDefaults({
      category: "Food & Drink",
      province: "Western Cape",
      city: "Cape Town",
      platforms: ["Instagram", "TikTok"],
      languages: ["English", "Afrikaans"],
      verifiedOnly: true,
      minFollowers: "5000",
      maxPrice: 2000,
      minRating: 4,
    });
    const params = filtersToSearchParams(original);
    const restored = searchParamsToFilters(params);
    expect(restored.category).toBe("Food & Drink");
    expect(restored.province).toBe("Western Cape");
    expect(restored.city).toBe("Cape Town");
    expect(restored.platforms).toEqual(["Instagram", "TikTok"]);
    expect(restored.languages).toEqual(["English", "Afrikaans"]);
    expect(restored.verifiedOnly).toBe(true);
    expect(restored.minFollowers).toBe("5000");
    expect(restored.maxPrice).toBe(2000);
    expect(restored.minRating).toBe(4);
  });

  it("leaves verifiedOnly false when absent from the URL", () => {
    const restored = searchParamsToFilters(new URLSearchParams("category=Food"));
    expect(restored.verifiedOnly).toBe(false);
  });

  it("omits default values entirely so a plain search stays a plain URL", () => {
    const params = filtersToSearchParams(makeDefaults({ sortBy: "score", maxPrice: 5000 }));
    expect(params.toString()).toBe("");
  });
});

describe("browseUrlForFilters", () => {
  it("returns a bare /browse for default filters", () => {
    expect(browseUrlForFilters(makeDefaults({}))).toBe("/browse");
  });

  it("builds a query string for active filters", () => {
    const url = browseUrlForFilters(makeDefaults({ category: "Food & Drink", province: "Western Cape" }));
    expect(url).toContain("/browse?");
    expect(url).toContain("category=Food");
    expect(url).toContain("province=Western");
  });
});
