import type { ComplianceStatus } from "../lib/complianceTypes";
import { COMPLIANCE_STATUS_LABEL, COMPLIANCE_STATUS_ICON } from "../lib/complianceTypes";

// Same "simple language, no legal jargon" rule as everywhere else in this
// feature (brief section 27) — the badge shows a plain word and an icon,
// never a status code.
const STATUS_STYLE: Record<ComplianceStatus, string> = {
  not_started: "bg-white text-billboard-inkSoft border-billboard-inkSoft",
  ready: "bg-billboard-green text-white border-billboard-greenDeep",
  needs_attention: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  under_review: "bg-white text-billboard-ink border-billboard-ink",
  not_eligible: "bg-billboard-red text-white border-billboard-red",
};

export default function ComplianceBadge({ status, className }: { status: ComplianceStatus; className?: string }) {
  return (
    <span
      className={
        className ??
        `inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full border-2 ${STATUS_STYLE[status]}`
      }
    >
      <span aria-hidden="true">{COMPLIANCE_STATUS_ICON[status]}</span>
      {COMPLIANCE_STATUS_LABEL[status]}
    </span>
  );
}
