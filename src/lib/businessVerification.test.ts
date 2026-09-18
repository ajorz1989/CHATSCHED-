import { describe, it, expect } from "vitest";
import { computeVerificationLevel, VERIFICATION_META } from "./businessVerification";

describe("computeVerificationLevel", () => {
  it("returns null when nothing is verified", () => {
    expect(computeVerificationLevel({ email_verified: false, phone_verified: false, business_verified: false })).toBeNull();
  });

  it("returns bronze for email verification alone", () => {
    expect(computeVerificationLevel({ email_verified: true, phone_verified: false, business_verified: false })).toBe("bronze");
  });

  it("returns silver once phone is also verified", () => {
    expect(computeVerificationLevel({ email_verified: true, phone_verified: true, business_verified: false })).toBe("silver");
  });

  it("does not grant silver from phone verification alone (email is still required)", () => {
    expect(computeVerificationLevel({ email_verified: false, phone_verified: true, business_verified: false })).toBeNull();
  });

  it("returns gold once business_verified is true, regardless of the other two flags", () => {
    expect(computeVerificationLevel({ email_verified: false, phone_verified: false, business_verified: true })).toBe("gold");
    expect(computeVerificationLevel({ email_verified: true, phone_verified: true, business_verified: true })).toBe("gold");
  });

  it("has display metadata for every non-null level computeVerificationLevel can return", () => {
    expect(VERIFICATION_META.bronze.label).toBeTruthy();
    expect(VERIFICATION_META.silver.label).toBeTruthy();
    expect(VERIFICATION_META.gold.label).toBeTruthy();
  });
});
