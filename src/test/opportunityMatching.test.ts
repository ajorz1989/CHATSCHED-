import { describe, expect, it } from "vitest";
import { scoreOpportunity } from "../lib/opportunityMatching";

const basePublisher = {
  channel_slug: "social-media" as const,
  city: "Cape Town",
  province: "Western Cape",
  category: "Fitness",
  audience: "Cape Town fitness and wellness community",
  bio: "Local fitness content and gym reviews",
  followers: 12000,
  price_per_post: 800,
  trust_score: 82,
  languages: ["English"],
};

describe("scoreOpportunity", () => {
  it("rewards a strong local channel match", () => {
    const result = scoreOpportunity({
      channel_slug: "social-media",
      target_city: "Cape Town",
      target_province: "Western Cape",
      target_audience: "fitness",
      opportunity_type: "social-media-promotion",
      budget_min: 800,
      budget_max: 1500,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      application_deadline: new Date(Date.now() + 43200000).toISOString(),
      match_keywords: ["fitness", "wellness"],
    }, basePublisher);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasons).toEqual(expect.arrayContaining(["Channel match", "City match"]));
  });

  it("handles open channel opportunities", () => {
    const result = scoreOpportunity({
      channel_slug: null,
      target_city: null,
      target_province: null,
      target_audience: "fitness",
      opportunity_type: "brand-partnership",
      budget_min: null,
      budget_max: null,
      expires_at: null,
      application_deadline: null,
      match_keywords: ["fitness"],
    }, basePublisher);

    expect(result.score).toBeGreaterThan(20);
    expect(result.reasons).toContain("Open to your channel");
  });

  it("does not award a city match to another city", () => {
    const result = scoreOpportunity({
      channel_slug: "social-media",
      target_city: "Johannesburg",
      target_province: "Gauteng",
      target_audience: "fitness",
      opportunity_type: "social-media-promotion",
      budget_min: null,
      budget_max: null,
      expires_at: null,
      application_deadline: null,
      match_keywords: [],
    }, basePublisher);

    expect(result.reasons).not.toContain("City match");
    expect(result.reasons).toContain("Channel match");
  });
});
