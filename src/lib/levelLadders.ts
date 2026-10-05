/**
 * The audience number each channel's publisher level is judged on, and the
 * amount needed for Rising / Verified / Premium / Elite. Must match
 * listing_audience() in migration 20261005120000_channel_aware_scoring_and_levels.sql.
 * (Verified also needs a confirmed phone and a 6-month-old account; Elite also
 * needs identity verified — those rules are the same for every channel.)
 */
import type { ChannelSlug } from "./channelTypes";

export type LevelThresholds = readonly [rising: number, verified: number, premium: number, elite: number];

export interface LevelLadder {
  channel: ChannelSlug;
  /** Plain-language name of the number, e.g. "monthly website visitors". */
  measure: string;
  thresholds: LevelThresholds;
  note?: string;
}

export const LEVEL_LADDERS: readonly LevelLadder[] = [
  { channel: "social-media",     measure: "followers",                         thresholds: [3000, 5000, 20000, 100000] },
  { channel: "influencer",       measure: "followers",                         thresholds: [3000, 5000, 20000, 100000] },
  { channel: "podcast",          measure: "downloads per episode",             thresholds: [500, 2000, 10000, 50000] },
  { channel: "website",          measure: "monthly unique visitors",           thresholds: [3000, 10000, 50000, 250000] },
  { channel: "radio",            measure: "weekly listeners",                  thresholds: [2000, 10000, 50000, 250000] },
  { channel: "events",           measure: "typical attendance",                thresholds: [100, 500, 2500, 10000] },
  { channel: "sports",           measure: "average matchday attendance",       thresholds: [100, 500, 2500, 10000] },
  { channel: "community",        measure: "members",                           thresholds: [300, 1000, 5000, 25000] },
  { channel: "associations",     measure: "members",                           thresholds: [100, 500, 2500, 10000] },
  { channel: "restaurants",      measure: "daily covers",                      thresholds: [30, 100, 300, 800] },
  { channel: "in-venue-screens", measure: "footfall per night",                thresholds: [100, 500, 2000, 8000] },
  { channel: "transport",        measure: "daily passengers",                  thresholds: [200, 1000, 5000, 20000], note: "If only a vehicle count is given: 3 / 10 / 50 / 200 vehicles." },
  { channel: "informal-retail",  measure: "daily foot traffic",                thresholds: [50, 150, 500, 1500] },
];

export function getLevelLadder(channel: string | null | undefined): LevelLadder | undefined {
  return LEVEL_LADDERS.find((l) => l.channel === channel);
}
