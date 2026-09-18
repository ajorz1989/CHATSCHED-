import { describe, it, expect } from "vitest";
import { makeDefaults, matchesFilters, summarizeFilters, activeCount } from "./browseFilters";
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

  it("filters by min/max followers", () => {
    const p = makePublisher({ followers: 10000 });
    expect(matchesFilters(p, makeDefaults({ minFollowers: "5000" }))).toBe(true);
    expect(matchesFilters(p, makeDefaults({ minFollowers: "20000" }))).toBe(false);
    expect(matchesFilters(p, makeDefaults({ maxFollowers: "20000" }))).toBe(true);
    expect(matchesFilters(p, makeDefaults({ maxFollowers: "5000" }))).toBe(false);
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
