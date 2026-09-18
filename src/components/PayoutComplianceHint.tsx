import { useEffect, useState } from "react";
import RiskBadge from "./RiskBadge";
import { getCampaignComplianceById } from "../lib/compliance";

/**
 * Advisory only, meant to sit next to a "mark payout sent" / "confirm
 * payout sent" button — brief section 23 is explicit that a low AI risk
 * score must never automatically hold a creator's earnings. This never
 * disables the payout action; it just gives the admin a glance at
 * compliance status before they click it. Quiet by default: renders
 * nothing once compliance is 'ready' or has no risk signal at all.
 */
export default function PayoutComplianceHint({ campaignId }: { campaignId: string }) {
  const [risk, setRisk] = useState<{ level: string | null; score: number | null; status: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCampaignComplianceById(campaignId).then((cc) => {
      if (!cancelled && cc && (cc.risk_level || cc.status === "under_review" || cc.status === "not_eligible")) {
        setRisk({ level: cc.risk_level, score: cc.risk_score, status: cc.status });
      }
    });
    return () => { cancelled = true; };
  }, [campaignId]);

  if (!risk) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <RiskBadge level={risk.level as "low" | "medium" | "high" | null} score={risk.score} />
      {(risk.status === "under_review" || risk.status === "not_eligible") && (
        <span className="font-mono text-[10px] uppercase text-billboard-red font-semibold">compliance: {risk.status.replace("_", " ")}</span>
      )}
    </span>
  );
}
