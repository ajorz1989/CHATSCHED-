import type { CampaignStats } from "./types";

export interface WeekPoint {
  label: string;
  clicks: number;
}

export interface RollupTotals {
  clicks: number;
  visits: number;
  leads: number;
  conversions: number;
  conversionValue: number;
}

/** Sums every campaign's stats into one set of totals — the top-line numbers on CampaignRollup. */
export function computeTotals(stats: CampaignStats[]): RollupTotals {
  return stats.reduce(
    (acc, s) => ({
      clicks: acc.clicks + s.clicks,
      visits: acc.visits + s.visits,
      leads: acc.leads + s.leads,
      conversions: acc.conversions + s.conversions,
      conversionValue: acc.conversionValue + s.conversion_value,
    }),
    { clicks: 0, visits: 0, leads: 0, conversions: 0, conversionValue: 0 }
  );
}

/** The 3 campaigns with the most clicks, excluding ones with none yet (nothing useful to rank). */
export function topCampaigns(stats: CampaignStats[], limit = 3): CampaignStats[] {
  return [...stats].filter((s) => s.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, limit);
}

/**
 * Buckets a list of click-event timestamps into `weeks` consecutive
 * 7-day windows starting at `rangeStart`, for the "clicks, last N weeks"
 * bar chart. Events outside the range are clamped into the nearest edge
 * bucket rather than dropped or throwing — defensive against a
 * clock-skewed timestamp landing a day either side of the boundary.
 */
export function bucketClicksByWeek(events: { created_at: string }[], rangeStart: Date, weeks: number): WeekPoint[] {
  const buckets: WeekPoint[] = Array.from({ length: weeks }, (_, i) => {
    const weekStart = new Date(rangeStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    return { label: weekStart.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }), clicks: 0 };
  });
  for (const e of events) {
    const daysIn = Math.floor((new Date(e.created_at).getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const idx = Math.min(weeks - 1, Math.max(0, Math.floor(daysIn / 7)));
    buckets[idx].clicks++;
  }
  return buckets;
}
