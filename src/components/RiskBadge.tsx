import type { RiskLevel } from "../lib/complianceTypes";

const RISK_STYLE: Record<RiskLevel, string> = {
  low: "bg-billboard-green text-white border-billboard-greenDeep",
  medium: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  high: "bg-billboard-red text-white border-billboard-red",
};

const RISK_LABEL: Record<RiskLevel, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };

/**
 * Shows a ChatSched safety score, never framed as a final legal/compliance
 * decision — brief section 6 is explicit that the AI/rule score assists
 * screening, it does not decide eligibility. Pass score to show "NN/100";
 * omit it if a screening hasn't run yet.
 */
export default function RiskBadge({ level, score, className }: { level: RiskLevel | null; score?: number | null; className?: string }) {
  if (!level) {
    return <span className={className ?? "font-mono text-[11px] text-billboard-inkSoft"}>Not yet screened</span>;
  }
  return (
    <span
      className={
        className ??
        `inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full border-2 ${RISK_STYLE[level]}`
      }
    >
      {RISK_LABEL[level]}
      {typeof score === "number" && <span className="opacity-80">· {score}/100</span>}
    </span>
  );
}
