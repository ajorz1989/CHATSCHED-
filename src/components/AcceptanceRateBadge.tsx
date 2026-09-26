import { acceptanceRateLabel } from "../lib/acceptanceRate";

export default function AcceptanceRateBadge({ acceptanceRate, acceptanceSampleSize, className }: { acceptanceRate: number | null; acceptanceSampleSize: number; className?: string }) {
  const label = acceptanceRateLabel(acceptanceRate, acceptanceSampleSize);
  if (!label) return null;
  return (
    <span className={className ?? "inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-billboard-greenDeep"}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
        <path d="M2 5.2l2 2L8 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}
