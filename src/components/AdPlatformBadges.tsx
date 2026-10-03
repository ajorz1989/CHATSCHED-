import type { Platform } from "../lib/types";
import { PLATFORM_ICONS } from "./PlatformIcons";
import { platformHeadline } from "../lib/platforms";

/**
 * The one place a publisher's ad platforms are shown on a card. Always
 * labelled "Ads run on", and a single-platform publisher gets an explicit
 * "<Platform> only" so a business can't mistake a WhatsApp-only listing for a
 * multi-platform one.
 */
export default function AdPlatformBadges({ platforms }: { platforms: Platform[] }) {
  if (platforms.length === 0) return null;
  const single = platforms.length === 1;
  return (
    <div className="my-2.5" aria-label={`Ads run on ${platforms.join(", ")}`}>
      <p className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft mb-1">
        Ads run on · <span className="font-semibold text-billboard-ink">{platformHeadline(platforms)}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {platforms.map((p) => {
          const Icon = PLATFORM_ICONS[p];
          return (
            <span
              key={p}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold border-2 border-billboard-ink rounded-full pl-1 pr-2.5 py-0.5 ${single ? "bg-billboard-yellow" : "bg-billboard-paperDim"}`}
            >
              {Icon && <Icon />}
              {p}
            </span>
          );
        })}
      </div>
    </div>
  );
}
