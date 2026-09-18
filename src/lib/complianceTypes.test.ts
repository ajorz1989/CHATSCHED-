import { describe, it, expect } from "vitest";
import {
  COMPLIANCE_STATUS_LABEL,
  COMPLIANCE_STATUS_ICON,
  outstandingComplianceItems,
  type ComplianceStatus,
} from "./complianceTypes";

const ALL_STATUSES: ComplianceStatus[] = ["not_started", "ready", "needs_attention", "under_review", "not_eligible"];

describe("COMPLIANCE_STATUS_LABEL / COMPLIANCE_STATUS_ICON", () => {
  it("has a label and an icon for every status the schema allows", () => {
    for (const status of ALL_STATUSES) {
      expect(COMPLIANCE_STATUS_LABEL[status]).toBeTruthy();
      expect(COMPLIANCE_STATUS_ICON[status]).toBeTruthy();
    }
  });

  it("uses plain language, not a status code, for every label", () => {
    // brief section 27: no raw status codes in the primary label
    for (const status of ALL_STATUSES) {
      expect(COMPLIANCE_STATUS_LABEL[status]).not.toBe(status);
      expect(COMPLIANCE_STATUS_LABEL[status]).not.toMatch(/_/);
    }
  });
});

describe("outstandingComplianceItems", () => {
  const base = { creator_accepted: true, tracking_configured: true, status: "ready" as ComplianceStatus };

  it("returns nothing when everything is in order and status is ready", () => {
    expect(outstandingComplianceItems(base)).toEqual([]);
  });

  it("flags a missing disclosure acknowledgment", () => {
    const items = outstandingComplianceItems({ ...base, creator_accepted: false });
    expect(items).toContain("disclosure not yet acknowledged");
  });

  it("flags missing tracking configuration", () => {
    const items = outstandingComplianceItems({ ...base, tracking_configured: false });
    expect(items).toContain("tracking not yet configured");
  });

  it("flags an open manual review", () => {
    const items = outstandingComplianceItems({ ...base, status: "under_review" });
    expect(items).toContain("under manual review");
  });

  it("flags a not-eligible campaign", () => {
    const items = outstandingComplianceItems({ ...base, status: "not_eligible" });
    expect(items).toContain("not eligible in its current category");
  });

  it("can report more than one outstanding item at once", () => {
    const items = outstandingComplianceItems({ creator_accepted: false, tracking_configured: false, status: "needs_attention" });
    expect(items).toHaveLength(2);
  });

  it("never flags disclosure/tracking gaps for a not_started campaign the same way as an active one", () => {
    // not_started campaigns are filtered out by CampaignComplianceStrip before
    // this ever runs (brief section 27 — don't warn before there's anything
    // to warn about) but the pure function itself should still be honest
    // about what's missing if called directly.
    const items = outstandingComplianceItems({ creator_accepted: false, tracking_configured: false, status: "not_started" });
    expect(items).toEqual(["disclosure not yet acknowledged", "tracking not yet configured"]);
  });
});
