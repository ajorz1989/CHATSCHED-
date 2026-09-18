import { responseTimeLabel } from "../lib/responseTime";

export default function ResponseTimeBadge({ avgResponseHours, responseCount, className }: { avgResponseHours: number | null; responseCount: number; className?: string }) {
  const label = responseTimeLabel(avgResponseHours, responseCount);
  if (!label) return null;
  return (
    <span className={className ?? "inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-billboard-greenDeep"}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
        <path d="M5 1.5L1.5 6h3l-.5 2.5L8.5 4h-3l.5-2.5Z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
