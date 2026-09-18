import { describe, it, expect } from "vitest";
import { computePublisherChecklist, computeBusinessChecklist } from "./onboardingChecklist";
import { makePublisher } from "../test/fixtures";

describe("computePublisherChecklist", () => {
  it("returns nothing for no publisher", () => {
    expect(computePublisherChecklist(null, false, [], [], 0)).toEqual([]);
  });

  it("marks the social-connect item done once a platform is connected", () => {
    const publisher = makePublisher();
    const notConnected = computePublisherChecklist(publisher, false, [], [], 0);
    const connected = computePublisherChecklist(publisher, false, [], [], 1);

    const notConnectedItem = notConnected.find((i) => i.id === "social-connect");
    const connectedItem = connected.find((i) => i.id === "social-connect");
    expect(notConnectedItem?.done).toBe(false);
    expect(connectedItem?.done).toBe(true);
  });

  it("includes the social-connect item regardless of channel type", () => {
    const socialMedia = makePublisher({ channel_slug: "social-media" });
    const requestFlow = makePublisher({ channel_slug: "website" });
    expect(computePublisherChecklist(socialMedia, false, [], [], 0).some((i) => i.id === "social-connect")).toBe(true);
    expect(computePublisherChecklist(requestFlow, true, [], [], 0).some((i) => i.id === "social-connect")).toBe(true);
  });

  it("still shows placement-type formats for a social-media publisher", () => {
    const publisher = makePublisher({ channel_slug: "social-media", placement_types: null });
    const items = computePublisherChecklist(publisher, false, [], [], 0);
    const formats = items.find((i) => i.id === "formats");
    expect(formats?.label).toBe("Choose your placement types");
    expect(formats?.done).toBe(false);
  });

  it("shows accepted-ad-format formats for a request-flow channel, not placement types", () => {
    const publisher = makePublisher({ channel_slug: "website", accepted_ad_formats: ["Banner"] });
    const items = computePublisherChecklist(publisher, true, [], [], 0);
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
