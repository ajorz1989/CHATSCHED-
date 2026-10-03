import { formatCurrency } from "../lib/currency";
import { useRateCardItems } from "../hooks/useRateCardItems";
import { joinPlatforms } from "../lib/platforms";
import type { Platform } from "../lib/types";

/**
 * Renders in the same sidebar spot the flat price-per-post number always
 * has — a publisher with no rate card items sees exactly what they saw
 * before this feature existed. Only publishers who've actually filled one
 * in get the fuller breakdown. Each line says which platform it is for;
 * lines from before per-platform pricing (platform = null) show as
 * "Any platform" rather than guessing.
 */
export default function RateCardDisplay({ publisherId, fallbackPrice, platforms = [] }: { publisherId: string; fallbackPrice: number; platforms?: Platform[] }) {
  const items = useRateCardItems(publisherId);

  if (!items || items.length === 0) {
    return (
      <>
        <div className="font-mono text-3xl font-bold text-billboard-greenDeep mb-1">{formatCurrency(fallbackPrice)}</div>
        <div className="text-xs text-billboard-inkSoft mb-5">
          per post{platforms.length > 0 ? ` on ${platforms.length === 1 ? `${platforms[0]} only` : joinPlatforms(platforms)}` : ""}
        </div>
      </>
    );
  }

  return (
    <div className="mb-5">
      <div className="font-mono text-2xl font-bold text-billboard-greenDeep mb-0.5">From {formatCurrency(Math.min(...items.map((i) => i.price)))}</div>
      <div className="text-xs text-billboard-inkSoft mb-3">rate card</div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-2 border-t border-billboard-ink/10 pt-1.5 first:border-t-0 first:pt-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{item.label}</p>
              <p className="font-mono text-[10px] uppercase text-billboard-greenDeep leading-tight">{item.platform ?? "Any platform"}</p>
              {item.description && <p className="text-xs text-billboard-inkSoft leading-tight">{item.description}</p>}
            </div>
            <p className="font-mono text-sm font-semibold text-billboard-greenDeep shrink-0">{formatCurrency(item.price)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
