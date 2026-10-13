import { describe, expect, it } from "vitest";
import { feeCopy } from "./fees";

// formatCurrency spaces the symbol ("R 30"); compare without the spaces.
const flat = (v: string) => v.replace(/\s/g, "");

describe("feeCopy", () => {
  it("quotes the real fee figures", () => {
    expect(flat(feeCopy.bookingFee)).toBe("R30underR500,R50fromR500");
    expect(flat(feeCopy.bookingFeeLong)).toBe("R30(bookingsunderR500)orR50(R500andover)");
    expect(feeCopy.commission).toBe("12%");
    expect(flat(feeCopy.premiumPrice)).toBe("R199");
    expect(feeCopy.payoutHours).toBe(48);
  });
});
