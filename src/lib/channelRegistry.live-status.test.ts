import { describe, expect, it } from "vitest";
import { getEnabledChannels, getPublisherOnboardingChannels } from "./channelRegistry";

const LIVE_CHANNELS = [
  "social-media",
  "influencer",
  "podcast",
  "website",
  "radio",
  "sports",
  "events",
  "community",
  "associations",
  "restaurants",
  "in-venue-screens",
] as const;

describe("current channel launch state", () => {
  it("keeps exactly the requested channels live by default", () => {
    const enabled = getEnabledChannels().map((m) => m.definition.slug);

    expect(enabled).toHaveLength(11);
    expect(enabled).toEqual(expect.arrayContaining(LIVE_CHANNELS));
    expect(enabled).not.toContain("transport");
    expect(enabled).not.toContain("informal-retail");
  });

  it("keeps development channels out of publisher onboarding", () => {
    const onboarding = getPublisherOnboardingChannels().map((m) => m.definition.slug);

    expect(onboarding).toHaveLength(11);
    expect(onboarding).toEqual(expect.arrayContaining(LIVE_CHANNELS));
    expect(onboarding).not.toContain("transport");
    expect(onboarding).not.toContain("informal-retail");
  });
});
