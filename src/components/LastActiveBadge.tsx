import { lastActiveInfo, type LastActiveTier } from "../lib/lastActive";

const TIER_CLASS: Record<LastActiveTier, string> = {
  recent: "text-billboard-greenDeep",
  this_week: "text-billboard-inkSoft",
  inactive: "text-billboard-inkSoft",
};

export default function LastActiveBadge({ lastActiveAt, className }: { lastActiveAt: string | null; className?: string }) {
  const info = lastActiveInfo(lastActiveAt);
  if (!info) return null;
  return (
    <span className={className ?? `inline-flex items-center gap-1 font-mono text-[10px] font-semibold ${TIER_CLASS[info.tier]}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${info.tier === "recent" ? "bg-billboard-greenDeep" : "bg-billboard-inkSoft/50"}`} />
      {info.label}
    </span>
  );
}
