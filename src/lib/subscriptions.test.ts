import { describe, it, expect } from "vitest";
import { subscriptionStatusInfo, isSubscriptionUsable, applyLaunchCredit } from "./subscriptions";

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

describe("applyLaunchCredit", () => {
  it("covers the full campaign when credit is more than enough", () => {
    expect(applyLaunchCredit(150, 199)).toEqual({ creditApplied: 150, amountDue: 0 });
  });

  it("applies only what's available and leaves the rest due", () => {
    expect(applyLaunchCredit(500, 199)).toEqual({ creditApplied: 199, amountDue: 301 });
  });

  it("applies nothing when there's no credit left", () => {
    expect(applyLaunchCredit(500, 0)).toEqual({ creditApplied: 0, amountDue: 500 });
  });

  it("never goes negative on a bad input", () => {
    expect(applyLaunchCredit(-50, 199)).toEqual({ creditApplied: 0, amountDue: 0 });
    expect(applyLaunchCredit(500, -10)).toEqual({ creditApplied: 0, amountDue: 500 });
  });

  it("handles ordinary cent amounts without floating-point drift", () => {
    expect(applyLaunchCredit(100.5, 49.99)).toEqual({ creditApplied: 49.99, amountDue: 50.51 });
  });
});
