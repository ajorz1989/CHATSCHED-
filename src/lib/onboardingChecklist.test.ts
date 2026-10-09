import { describe, it, expect } from "vitest";
import { computePublisherChecklist, computeBusinessChecklist } from "./onboardingChecklist";
import { makePublisher } from "../test/fixtures";

describe("computePublisherChecklist", () => {
  it("returns nothing for no publisher", () => {
    expect(computePublisherChecklist(null, false, [], [])).toEqual([]);
  });

  it("marks the social-verify item done once an admin has confirmed the bio code", () => {
    const publisher = makePublisher({ channel_slug: "social-media" });
    const unconfirmed = computePublisherChecklist(publisher, false, [], []);
    const confirmed = computePublisherChecklist({ ...publisher, social_verification_confirmed: true }, false, [], []);

    expect(unconfirmed.find((i) => i.id === "social-verify")?.done).toBe(false);
    expect(confirmed.find((i) => i.id === "social-verify")?.done).toBe(true);
  });

  it("shows the ownership item for social media, influencer, website and podcast only", () => {
    for (const channel of ["social-media", "influencer", "website", "podcast"] as const) {
      const p = makePublisher({ channel_slug: channel });
      expect(computePublisherChecklist(p, channel !== "social-media", [], []).some((i) => i.id === "social-verify")).toBe(true);
    }
    for (const channel of ["radio", "events", "community"] as const) {
      const p = makePublisher({ channel_slug: channel });
      expect(computePublisherChecklist(p, true, [], []).some((i) => i.id === "social-verify")).toBe(false);
    }
  });

  it("calls the website step 'Verify your website'", () => {
    const p = makePublisher({ channel_slug: "website" });
    expect(computePublisherChecklist(p, true, [], []).find((i) => i.id === "social-verify")?.label).toBe("Verify your website");
  });

  it("calls the podcast step 'Verify your podcast'", () => {
    const p = makePublisher({ channel_slug: "podcast" });
    expect(computePublisherChecklist(p, true, [], []).find((i) => i.id === "social-verify")?.label).toBe("Verify your podcast");
  });

  it("still shows placement-type formats for a social-media publisher", () => {
    const publisher = makePublisher({ channel_slug: "social-media", placement_types: null });
    const items = computePublisherChecklist(publisher, false, [], []);
    const formats = items.find((i) => i.id === "formats");
    expect(formats?.label).toBe("Choose your placement types");
    expect(formats?.done).toBe(false);
  });

  it("shows accepted-ad-format formats for a request-flow channel, not placement types", () => {
    const publisher = makePublisher({ channel_slug: "website", accepted_ad_formats: ["Banner"] });
    const items = computePublisherChecklist(publisher, true, [], []);
    const formats = items.find((i) => i.id === "formats");
    expect(formats?.label).toBe("Choose the ad formats you accept");
    expect(formats?.done).toBe(true);
  });
});

describe("computeBusinessChecklist", () => {
  it("marks nothing done for a brand-new business", () => {
    const items = computeBusinessChecklist(null, [], []);
    expect(items.every((i) => !i.done)).toBe(true);
  });
});
