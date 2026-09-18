import TrustBadge from "./TrustBadge";
import ResponseTimeBadge from "./ResponseTimeBadge";
import LastActiveBadge from "./LastActiveBadge";
import MarketingIcon from "./MarketingIcon";
import { scoreLabel } from "../lib/publisherDisplay";
import type { PublisherLevel } from "../lib/types";

// Audit finding: trust score stars, publisher score, response-time badge,
// and last-active badge were four separately-styled, equally-weighted
// elements stuffed into one flex-wrap row (twice — once on the public
// profile, again on the publisher's own dashboard header, each hand-rolled
// slightly differently). Nothing told a viewer's eye which one mattered
// most, and every one of them was its own bordered/colored chip competing
// for attention. This makes trust score the one dominant element (real
// size, real stars) and demotes everything else to plain small text
// dividers next to it — same underlying data, one visual hierarchy,
// defined once instead of twice.
export default function PublisherTrustStrip({
  level,
  trustScore,
  publisherScore,
  avgResponseHours,
  responseCount,
  lastActiveAt,
  className = "",
}: {
  level?: PublisherLevel | null;
  trustScore: number;
  publisherScore?: number;
  avgResponseHours?: number | null;
  responseCount?: number;
  lastActiveAt?: string | null;
  className?: string;
}) {
  const hasAnything =
    !!level || trustScore > 0 || !!publisherScore || avgResponseHours != null || !!lastActiveAt;
  if (!hasAnything) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {level && <TrustBadge kind="publisher" level={level} />}

      {trustScore > 0 && (
        <span className="inline-flex items-center gap-1.5 font-semibold text-sm" aria-label={`Trust score ${trustScore} out of 100`}>
          <span className="inline-flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <MarketingIcon key={i} name="star" className={`w-4 h-4 ${i < Math.round(trustScore / 20) ? "text-billboard-yellowDeep" : "text-billboard-ink/15"}`} />
            ))}
          </span>
          <span className="text-billboard-inkSoft font-normal">Trust {trustScore}/100</span>
        </span>
      )}

      {!!publisherScore && (
        <span className="text-xs font-mono uppercase text-billboard-inkSoft">
          Publisher Score: {scoreLabel(publisherScore)}
        </span>
      )}

      {avgResponseHours != null && (
        <ResponseTimeBadge avgResponseHours={avgResponseHours} responseCount={responseCount ?? 0} className="text-xs text-billboard-inkSoft" />
      )}

      {lastActiveAt && <LastActiveBadge lastActiveAt={lastActiveAt} className="text-xs text-billboard-inkSoft" />}
    </div>
  );
}
