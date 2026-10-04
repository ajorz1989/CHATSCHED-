import { describe, it, expect } from "vitest";
import { buildPaymentCardModel, splitPlatformFromMessage } from "./paymentCard";
import type { ChannelRequest } from "./types";

const base = {
  id: "abcdef12-0000-0000-0000-000000000000",
  channel_slug: "social-media",
  creator_id: "c1",
  business_id: "b1",
  campaign_message: "Platform: All platforms (Instagram, TikTok)\n\nPromote our winter menu.",
  advertising_method: "Story Post",
  proposed_amount: 299,
  status: "awaiting_payment",
  created_at: "2026-10-01T10:00:00Z",
  responded_at: "2026-10-02T10:00:00Z",
  payment_due_at: "2026-10-09T10:00:00Z",
  scheduled_live_at: "2026-10-20T09:00:00Z",
  request_metadata: { preferredPostDate: "2026-10-18" },
  creator: { id: "c1", name: "Thandi's Page" },
} as unknown as ChannelRequest;

describe("splitPlatformFromMessage", () => {
  it("splits the platform prefix from the message", () => {
    expect(splitPlatformFromMessage("Platform: Instagram (only)\n\nHello")).toEqual({ platform: "Instagram", rest: "Hello" });
    expect(splitPlatformFromMessage("No prefix here").platform).toBeNull();
  });
});

describe("buildPaymentCardModel", () => {
  it("computes R299 -> R30 fee -> R329 due and a CS reference", () => {
    const m = buildPaymentCardModel(base, { company_name: "Thabo's Cafe", full_name: null });
    expect(m.creatorPriceCents).toBe(29900);
    expect(m.bookingFeeCents).toBe(3000);
    expect(m.totalDueCents).toBe(32900);
    expect(m.reference).toBe("CS-ABCDEF12");
    expect(m.platform).toBe("All platforms (Instagram, TikTok)");
    expect(m.billedTo).toBe("Thabo's Cafe");
    expect(m.summary).toBe("Promote our winter menu.");
  });
  it("prefers the stored snapshot over recomputing", () => {
    const m = buildPaymentCardModel({ ...base, creator_price_cents: 29900, commission_cents: 3588, booking_fee_cents: 9999, total_due_cents: 39899, creator_payout_cents: 26312, payment_reference: "CS-ZZZZ0000" } as ChannelRequest, null);
    expect(m.bookingFeeCents).toBe(9999);
    expect(m.reference).toBe("CS-ZZZZ0000");
    expect(m.billedTo).toBe("Your business");
  });
});
