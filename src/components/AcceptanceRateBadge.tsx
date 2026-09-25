export default function AcceptanceRateBadge({
  acceptanceRate,
  acceptanceSampleSize,
  className = "",
}: {
  acceptanceRate: number;
  acceptanceSampleSize: number;
  className?: string;
}) {
  const rate = Math.round(acceptanceRate * 100);

  return (
    <span className={`text-xs text-billboard-inkSoft ${className}`}>
      Acceptance Rate: {rate}%
      {acceptanceSampleSize > 0 && (
        <span className="text-billboard-ink/50"> ({acceptanceSampleSize})</span>
      )}
    </span>
  );
}
