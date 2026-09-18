import { LEVEL_META } from "../lib/publisherDisplay";
import type { PublisherLevel } from "../lib/types";
import { VERIFICATION_META, type BusinessVerificationLevel } from "../lib/businessVerification";

type PublisherBadgeProps = { kind: "publisher"; level: PublisherLevel };
type BusinessBadgeProps = { kind: "business"; level: Exclude<BusinessVerificationLevel, null> };
type TrustBadgeProps = (PublisherBadgeProps | BusinessBadgeProps) & { showLabel?: boolean; className?: string };
type TrustLevel = PublisherLevel | Exclude<BusinessVerificationLevel, null>;

const RING_COUNT: Record<TrustLevel, number> = {
  rising: 1,
  verified: 2,
  premium: 3,
  elite: 4,
  bronze: 1,
  silver: 2,
  gold: 3,
};

const RING_TONE: Record<TrustLevel, string> = {
  rising: "text-billboard-ink",
  verified: "text-billboard-green",
  premium: "text-billboard-yellowDeep",
  elite: "text-billboard-ink",
  bronze: "text-billboard-ink",
  silver: "text-billboard-green",
  gold: "text-billboard-yellowDeep",
};

function RingMark({ count, className = "w-5 h-5" }: { count: number; className?: string }) {
  const radii = [9, 6.5, 4, 1.8];
  return (
    <svg viewBox="0 0 20 20" className={`${className} shrink-0`} fill="none" aria-hidden="true">
      {radii.slice(0, count).map((radius) => (
        <circle key={radius} cx="10" cy="10" r={radius} stroke="currentColor" strokeWidth="1.6" />
      ))}
    </svg>
  );
}

export default function TrustBadge({
  kind,
  level,
  showLabel = true,
  className = "",
}: TrustBadgeProps) {
  const meta = kind === "publisher" ? LEVEL_META[level] : VERIFICATION_META[level];
  if (!meta) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 border-2 border-billboard-ink bg-billboard-yellow text-billboard-ink rounded px-2.5 py-1 font-mono text-[10px] font-semibold uppercase ${className}`}>
      <RingMark count={RING_COUNT[level]} className={`w-5 h-5 ${RING_TONE[level]}`} />
      {showLabel && meta.label}
    </span>
  );
}
