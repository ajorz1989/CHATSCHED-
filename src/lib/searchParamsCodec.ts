import type { Filters } from "./browseFilters";
import { makeDefaults } from "./browseFilters";
import type { Platform } from "./types";
import type { ChannelSlug } from "./channelTypes";

/**
 * Round-trips the full Filters shape through URLSearchParams — not just
 * the 4 fields Browse.tsx used to sync (category/suburb/city/channel).
 * This is what makes a saved search's "View results" link, and a saved
 * search's email alert link, actually restore the whole search rather
 * than dropping most of it.
 *
 * Only non-default values are written, so a plain `/browse` with no
 * filters stays a plain `/browse` — no noisy query string for the common
 * case.
 */
const NUMERIC_KEYS = ["minRating", "maxPrice"] as const;
const ARRAY_KEYS = ["platforms", "languages"] as const;
const BOOLEAN_KEYS = ["verifiedOnly"] as const;
const STRING_KEYS = [
  "query", "channel", "category", "province", "city", "suburb",
  "minFollowers", "maxFollowers", "minMonthlyReach", "minEngagement",
  "ageDemographic", "gender", "sortBy",
] as const;

export function filtersToSearchParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = makeDefaults({});

  for (const key of STRING_KEYS) {
    const value = f[key];
    if (value && value !== defaults[key]) params.set(key, value);
  }
  for (const key of NUMERIC_KEYS) {
    if (f[key] !== defaults[key]) params.set(key, String(f[key]));
  }
  for (const key of ARRAY_KEYS) {
    if (f[key].length) params.set(key, f[key].join(","));
  }
  for (const key of BOOLEAN_KEYS) {
    if (f[key]) params.set(key, "true");
  }
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): Filters {
  const patch: Partial<Filters> = {};

  for (const key of STRING_KEYS) {
    const value = params.get(key);
    if (value) (patch as Record<string, string>)[key] = value;
  }
  for (const key of NUMERIC_KEYS) {
    const value = params.get(key);
    if (value !== null && !Number.isNaN(Number(value))) (patch as Record<string, number>)[key] = Number(value);
  }
  for (const key of BOOLEAN_KEYS) {
    if (params.get(key) === "true") (patch as Record<string, boolean>)[key] = true;
  }
  const platforms = params.get("platforms");
  if (platforms) patch.platforms = platforms.split(",") as Platform[];
  const languages = params.get("languages");
  if (languages) patch.languages = languages.split(",");

  return makeDefaults(patch as Partial<Filters> & { channel?: ChannelSlug | "" });
}

/** Builds a `/browse?...` path from a filter set — used for saved-search "View results" links and the email alert link. */
export function browseUrlForFilters(f: Filters): string {
  const params = filtersToSearchParams(f);
  const qs = params.toString();
  return qs ? `/browse?${qs}` : "/browse";
}
