import type { Platform, Publisher } from "../lib/types";
import { PLATFORM_ICONS } from "./PlatformIcons";
import { formatCurrency } from "../lib/currency";
import { useRateCardItems } from "../hooks/useRateCardItems";
import { getFollowersByPlatform, getProfileUrlForPlatform, platformHeadline } from "../lib/platforms";

function formatFollowers(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
}

/**
 * "Where your ad runs" — one row per platform with that platform's profile
 * link, follower count and starting price, so a business sees exactly what
 * it is buying and on which platform.
 */
export default function AdPlatformSection({ publisher, platforms }: { publisher: Publisher; platforms: Platform[] }) {
  const rateCards = useRateCardItems(publisher.id);
  if (platforms.length === 0) return null;

  const followersByPlatform = getFollowersByPlatform(publisher);
  const single = platforms.length === 1;

  return (
    <section className="mb-8" aria-labelledby="ad-platforms-heading">
      <div className="flex flex-wrap items-baseline gap-2 mb-2">
        <h2 id="ad-platforms-heading" className="font-display text-lg">Where your ad runs</h2>
        <span className="font-mono text-[11px] font-semibold uppercase bg-billboard-yellow border-2 border-billboard-ink rounded px-2 py-0.5">
          {platformHeadline(platforms)}
        </span>
      </div>
      <p className="text-xs text-billboard-inkSoft mb-3">
        {single
          ? `${publisher.name} sells advertising on ${platforms[0]} only. Your ad will not appear anywhere else.`
          : `${publisher.name} sells advertising on these platforms. Choose which one you want when you send your request.`}
      </p>
      <div className="flex flex-col gap-2">
        {platforms.map((p) => {
          const Icon = PLATFORM_ICONS[p];
          const url = getProfileUrlForPlatform(publisher, p);
          const followers = followersByPlatform[p] ?? (single ? publisher.followers : 0);
          const prices = (rateCards ?? []).filter((r) => r.platform === p).map((r) => r.price);
          const from = prices.length > 0 ? Math.min(...prices) : null;
          return (
            <div key={p} className="flex items-center justify-between gap-3 border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                {Icon && <Icon />}
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">{p}</p>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline text-billboard-inkSoft truncate block">
                      View their {p} page
                    </a>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {followers > 0 && <p className="text-sm font-semibold">{formatFollowers(followers)} followers</p>}
                {from != null && <p className="font-mono text-xs font-semibold text-billboard-greenDeep">from {formatCurrency(from)}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
