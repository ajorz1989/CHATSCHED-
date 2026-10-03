import { describe, it, expect, vi } from "vitest";
import type { Publisher } from "./types";

// Captures what the generator would download instead of triggering a browser save.
const saved: Array<{ name: string; pages: number; bytes: number }> = [];
vi.mock("jspdf", async () => {
  const mod = await vi.importActual<typeof import("jspdf")>("jspdf");
  const Orig = mod.jsPDF;
  class Patched extends Orig {
    constructor(...args: ConstructorParameters<typeof Orig>) {
      super(...args);
      (this as unknown as { save: (n: string) => unknown }).save = (name: string) => {
        saved.push({ name, pages: this.getNumberOfPages(), bytes: (this.output("arraybuffer") as ArrayBuffer).byteLength });
        return this;
      };
    }
  }
  return { ...mod, jsPDF: Patched, default: Patched };
});

const base = {
  verified: true, level: "premium", city: "Cape Town", suburb: "Sea Point", province: "Western Cape", category: "Regional News",
  channel_slug: "social-media", languages: ["English"], placement_types: ["Story Post", "Carousel Post"],
  trust_score: 22, publisher_score: 40, email_verified: true, phone_verified: true, identity_verified: false,
  avg_response_hours: null, response_count: 0, created_at: "2026-09-12T00:00:00Z", monthly_reach: null,
  portfolio_images: [], intro_video_url: null, bio: "A bio", audience: "Young people", price_per_post: 299,
} as const;

describe("buildAndDownloadMediaKit", () => {
  it("builds a single-platform kit with the brand fonts and downloads it by publisher name", async () => {
    const { buildAndDownloadMediaKit } = await import("./mediaKit");
    const publisher = { ...base, id: "1", name: "Alberts marketplace", followers: 40900, engagement: 4, platforms: ["Facebook Group"], channel_metadata: null } as unknown as Publisher;
    await buildAndDownloadMediaKit({ publisher, reviews: [], completedCampaigns: 0, profileUrl: "" });
    const out = saved.at(-1)!;
    expect(out.name).toBe("chatsched-media-kit-alberts-marketplace.pdf");
    expect(out.pages).toBeGreaterThanOrEqual(1);
    expect(out.bytes).toBeGreaterThan(20000); // brand fonts are embedded
  });

  it("builds a multi-platform kit with a package price and reviews without throwing", async () => {
    const { buildAndDownloadMediaKit } = await import("./mediaKit");
    const publisher = {
      ...base, id: "2", name: "Joburg City Finds", followers: 45700, engagement: 6.7,
      platforms: ["Instagram", "Facebook Page", "TikTok"],
      channel_metadata: { primaryPlatform: "instagram", secondaryPlatforms: ["facebook", "tiktok"], followerCountByPlatform: { instagram: 45700, facebook: 22100, tiktok: 18300 }, allPlatformsPackagePrice: 2500 },
    } as unknown as Publisher;
    const reviews = [{ rating: 5, comment: "Great reach.", business: { company_name: "Table Bay Cafe" } }] as never;
    await buildAndDownloadMediaKit({ publisher, reviews, completedCampaigns: 7, profileUrl: "" });
    expect(saved.at(-1)!.name).toBe("chatsched-media-kit-joburg-city-finds.pdf");
  });
});
