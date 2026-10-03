import { describe, it, expect } from "vitest";
import { computeBookingBreakdown, bookingFeeCents, computeBookingBreakdownFromRand } from "./fees";

describe("booking fee tiers", () => {
  it("charges R30 below R500", () => {
    expect(bookingFeeCents(1)).toBe(3_000);
    expect(bookingFeeCents(49_999)).toBe(3_000);
  });
  it("charges R50 from exactly R500", () => {
    expect(bookingFeeCents(50_000)).toBe(5_000);
    expect(bookingFeeCents(250_000)).toBe(5_000);
  });
});

describe("computeBookingBreakdown", () => {
  it("R299: business pays R329, creator gets R263.12, ChatSched keeps R65.88", () => {
    const b = computeBookingBreakdown(29_900);
    expect(b.totalDueCents).toBe(32_900);
    expect(b.commissionCents).toBe(3_588);
    expect(b.creatorPayoutCents).toBe(26_312);
    expect(b.bookingFeeCents).toBe(3_000);
    expect(b.platformRevenueCents).toBe(6_588);
  });
  it("R500: fee is R50, business pays R550, creator gets R440", () => {
    const b = computeBookingBreakdown(50_000);
    expect(b.totalDueCents).toBe(55_000);
    expect(b.creatorPayoutCents).toBe(44_000);
    expect(b.platformRevenueCents).toBe(11_000);
  });
  it("always balances: payout + revenue = total due", () => {
    for (const cents of [1, 99, 12_345, 49_999, 50_000, 77_777, 1_000_001]) {
      const b = computeBookingBreakdown(cents);
      expect(b.creatorPayoutCents + b.platformRevenueCents).toBe(b.totalDueCents);
    }
  });
  it("rejects non-integer or negative cents", () => {
    expect(() => computeBookingBreakdown(10.5)).toThrow();
    expect(() => computeBookingBreakdown(-1)).toThrow();
  });
  it("handles Rand input without float drift", () => {
    expect(computeBookingBreakdownFromRand(299).creatorPayoutCents).toBe(26_312);
    expect(computeBookingBreakdownFromRand(299.99).totalDueCents).toBe(32_999);
  });
});
