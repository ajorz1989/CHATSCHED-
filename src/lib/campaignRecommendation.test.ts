import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_GOALS,
  BUDGET_TIERS,
  generateCampaignRecommendation,
  type CampaignBuilderInputs,
} from "./campaignRecommendation";
import type { Publisher } from "./types";
import { makePublisher } from "../test/fixtures";

const mockPublishers: Publisher[] = [
  makePublisher({
    id: "pub-1",
    name: "Cape Town Vibes",
    city: "Cape Town",
    province: "Western Cape",
    suburb: "CBD",
    category: "food",
    platforms: ["Instagram", "TikTok"],
    placement_types: ["Short-form Video (Reels / TikTok / Shorts)", "Story Post"],
    accepted_ad_formats: null,
    followers: 45000,
    engagement: 4.8,
    price_per_post: 2500,
    rating: 4.9,
    reviews: 12,
    verified: true,
    bio: "The best food & lifestyle across Cape Town.",
    audience: "Foodies aged 22-38",
    initials: "CV",
    swatch: "from-orange-500 to-amber-500",
    user_id: "user-1",
    email: "ct@vibes.co.za",
    mobile_number: "0821112222",
    monthly_reach: 120000,
    languages: ["English", "Afrikaans"],
    account_age_months: 24,
    posting_frequency: "Daily",
    business_name: "Cape Town Vibes Media",
    company_registration: null,
    vat_number: null,
    status: "approved",
  }),
  makePublisher({
    id: "pub-2",
    name: "Joburg Tech Hub",
    city: "Johannesburg",
    province: "Gauteng",
    suburb: "Rosebank",
    category: "tech",
    platforms: ["LinkedIn", "WhatsApp Channel"],
    placement_types: ["Main Feed / Page Post"],
    accepted_ad_formats: null,
    followers: 28000,
    engagement: 5.2,
    price_per_post: 3000,
    rating: 4.8,
    reviews: 8,
    verified: true,
    bio: "Startup news and software tools in Gauteng.",
    audience: "Entrepreneurs & professionals",
    initials: "JT",
    swatch: "from-blue-600 to-indigo-600",
    user_id: "user-2",
    email: "jt@techhub.co.za",
    mobile_number: "0823334444",
    monthly_reach: 80000,
    languages: ["English", "isiZulu"],
    account_age_months: 18,
    posting_frequency: "3x / week",
    business_name: null,
    company_registration: null,
    vat_number: null,
    status: "approved",
  }),
];

describe("campaignRecommendation", () => {
  it("defines standard goals and budget tiers", () => {
    expect(CAMPAIGN_GOALS.length).toBeGreaterThanOrEqual(5);
    expect(BUDGET_TIERS.length).toBeGreaterThanOrEqual(4);
  });

  it("generates a complete recommended campaign with channels, deliverables, and cost breakdown", () => {
    const inputs: CampaignBuilderInputs = {
      goalId: "launch",
      targetScope: "city",
      selectedProvinces: ["Western Cape"],
      selectedCities: ["Cape Town"],
      targetCategories: ["food"],
      targetLanguages: ["English"],
      budgetTierId: "growth",
      timingPreference: "two_weeks",
      durationOption: "14_days",
    };

    const rec = generateCampaignRecommendation(inputs, mockPublishers);

    expect(rec.packageName).toContain("Launch");
    expect(rec.channels.length).toBeGreaterThan(0);
    expect(rec.deliverables.length).toBeGreaterThan(0);
    expect(rec.trackingFeatures.length).toBeGreaterThan(0);
    expect(rec.estimatedCost.totalBudgetZar).toBe(9500);
    expect(rec.estimatedCost.creatorInventoryZar + rec.estimatedCost.managementFeeZar).toBe(9500);
    expect(rec.matchedPublishers.length).toBeGreaterThan(0);
  });

  it("handles custom budget gracefully", () => {
    const inputs: CampaignBuilderInputs = {
      goalId: "footfall",
      targetScope: "national",
      selectedProvinces: [],
      selectedCities: [],
      targetCategories: [],
      targetLanguages: [],
      budgetTierId: "starter",
      customBudget: 8000,
      timingPreference: "immediate",
      durationOption: "7_days",
    };

    const rec = generateCampaignRecommendation(inputs, mockPublishers);
    expect(rec.estimatedCost.totalBudgetZar).toBe(8000);
    expect(rec.estimatedCost.creatorInventoryZar + rec.estimatedCost.managementFeeZar).toBe(8000);
  });

  it("handles empty publisher lists without throwing", () => {
    const inputs: CampaignBuilderInputs = {
      goalId: "awareness",
      targetScope: "national",
      selectedProvinces: [],
      selectedCities: [],
      targetCategories: [],
      targetLanguages: [],
      budgetTierId: "growth",
      timingPreference: "immediate",
      durationOption: "7_days",
    };

    const rec = generateCampaignRecommendation(inputs, []);
    expect(rec.matchedPublishers).toEqual([]);
    expect(rec.channels.length).toBeGreaterThan(0);
    expect(rec.deliverables.length).toBeGreaterThan(0);
  });
});
