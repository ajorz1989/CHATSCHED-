import { describe, it, expect } from "vitest";
import { subscriptionStatusInfo, isSubscriptionUsable } from "./subscriptions";

describe("subscriptionStatusInfo", () => {
  it("labels active as positive", () => {
    expect(subscriptionStatusInfo("active")).toEqual({ label: "Active", tone: "positive" });
  });

  it("labels failed and cancelled as negative", () => {
    expect(subscriptionStatusInfo("failed").tone).toBe("negative");
    expect(subscriptionStatusInfo("cancelled").tone).toBe("negative");
  });
});

describe("isSubscriptionUsable", () => {
  it("treats active as usable", () => {
    expect(isSubscriptionUsable("active")).toBe(true);
  });

  it("treats everything else as not usable", () => {
    expect(isSubscriptionUsable("pending")).toBe(false);
    expect(isSubscriptionUsable("failed")).toBe(false);
    expect(isSubscriptionUsable("cancelled")).toBe(false);
  });
});
