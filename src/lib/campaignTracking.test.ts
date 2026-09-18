import { describe, it, expect } from "vitest";
import { utmTaggedUrl } from "./campaignTracking";

describe("utmTaggedUrl", () => {
  it("appends UTM params to a plain destination URL", () => {
    const url = utmTaggedUrl({
      destination_url: "https://yourbusiness.co.za",
      utm_source: "chatsched",
      utm_medium: "referral",
      utm_campaign: "winter-sale",
    });
    expect(url).toBe("https://yourbusiness.co.za/?utm_source=chatsched&utm_medium=referral&utm_campaign=winter-sale");
  });

  it("merges with an existing query string rather than clobbering it", () => {
    const url = utmTaggedUrl({
      destination_url: "https://yourbusiness.co.za/shop?category=shoes",
      utm_source: "chatsched",
      utm_medium: "referral",
      utm_campaign: "winter-sale",
    });
    expect(url).toContain("category=shoes");
    expect(url).toContain("utm_campaign=winter-sale");
  });

  it("includes utm_content only when provided", () => {
    const withContent = utmTaggedUrl({
      destination_url: "https://yourbusiness.co.za",
      utm_source: "chatsched",
      utm_medium: "referral",
      utm_campaign: "winter-sale",
      utm_content: "story-link",
    });
    const withoutContent = utmTaggedUrl({
      destination_url: "https://yourbusiness.co.za",
      utm_source: "chatsched",
      utm_medium: "referral",
      utm_campaign: "winter-sale",
    });
    expect(withContent).toContain("utm_content=story-link");
    expect(withoutContent).not.toContain("utm_content");
  });

  it("falls back to the raw destination_url if it isn't a valid absolute URL", () => {
    const url = utmTaggedUrl({
      destination_url: "not-a-url",
      utm_source: "chatsched",
      utm_medium: "referral",
      utm_campaign: "winter-sale",
    });
    expect(url).toBe("not-a-url");
  });
});
