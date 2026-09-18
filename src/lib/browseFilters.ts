import type { Platform, Publisher } from "./types";
import type { ChannelSlug } from "./channelTypes";
import { formatCurrency } from "./currency";

/**
 * Shared with Browse.tsx (the source this was extracted from) and
 * SavedSearches.tsx (which needs the same shape to compute "N publishers
 * currently match" against a saved filter set, and to serialize/restore
 * filters via the URL — see searchParamsCodec.ts).
 */
export interface Filters {
  query: string;
  channel: ChannelSlug | "";
  category: string;
  province: string;
  city: string;
  suburb: string;
  platforms: Platform[];
  verifiedOnly: boolean;
  minRating: number;
  minFollowers: string;
  maxFollowers: string;
  minMonthlyReach: string;
  minEngagement: string;
  maxPrice: number;
  languages: string[];
  ageDemographic: string;
  gender: string;
  sortBy: string;
}

export function makeDefaults(initial: Partial<Filters>): Filters {
  return {
    query: "", channel: "", category: "", province: "", city: "", suburb: "",
    platforms: [], verifiedOnly: false, minRating: 0,
    minFollowers: "", maxFollowers: "", minMonthlyReach: "", minEngagement: "",
    maxPrice: 5000, languages: [], ageDemographic: "", gender: "",
    sortBy: "score",
    ...initial,
  };
}

export function matchesGender(p: Publisher, gender: string): boolean {
  if (!gender) return true;
  const txt = p.audience.toLowerCase();
  if (gender === "women") return /women|female|ladies|moms|mothers|girls/.test(txt);
  if (gender === "men") return /\bmen\b|\bmale\b|guys|dads|fathers/.test(txt);
  return true; // mixed: show all
}

export function matchesAge(p: Publisher, age: string): boolean {
  if (!age) return true;
  const txt = p.audience.toLowerCase();
  if (age === "18-24") return /18.{0,3}24|gen.?z|student|young adult/.test(txt);
  if (age === "25-34") return /25.{0,3}34|millennial|young professional/.test(txt);
  if (age === "35-44") return /35.{0,3}44|parent|professional/.test(txt);
  if (age === "45-54") return /45.{0,3}54|mature/.test(txt);
  if (age === "55+") return /55\+|senior|retirement/.test(txt);
  return true;
}

/** The full match predicate Browse.tsx filters against — including the fuzzy keyword/age/gender fields. Saved-search alerts (server-side) only use the structured subset of this — see schema_phase33_saved_searches.sql's comment for why. */
export function matchesFilters(p: Publisher, f: Filters): boolean {
  const q = f.query.toLowerCase();
  if (q && ![p.name, p.bio, p.audience, p.city].some((t) => t.toLowerCase().includes(q))) return false;
  if (f.channel && p.channel_slug !== f.channel) return false;
  if (f.category && p.category !== f.category) return false;
  if (f.province && p.province !== f.province) return false;
  if (f.city && !p.city.toLowerCase().includes(f.city.toLowerCase())) return false;
  if (f.suburb && p.suburb !== f.suburb) return false;
  if (f.platforms.length && !f.platforms.some((pl) => p.platforms.includes(pl))) return false;
  if (f.verifiedOnly && !p.verified) return false;
  if (f.minRating > 0 && (p.rating ?? 0) < f.minRating) return false;
  if (f.minFollowers && p.followers < Number(f.minFollowers)) return false;
  if (f.maxFollowers && p.followers > Number(f.maxFollowers)) return false;
  if (f.minMonthlyReach && (p.monthly_reach ?? 0) < Number(f.minMonthlyReach)) return false;
  if (f.minEngagement && p.engagement < Number(f.minEngagement)) return false;
  if (p.price_per_post > f.maxPrice) return false;
  if (f.languages.length && !f.languages.some((l) => p.languages.includes(l))) return false;
  if (!matchesAge(p, f.ageDemographic)) return false;
  if (!matchesGender(p, f.gender)) return false;
  return true;
}

// Best-match sort ranks by publisher_score (calculate_publisher_score in
// schema_phase5.sql: engagement 30%, completion rate 25%, review average
// 20%, followers 5%). This surfaces which of THOSE real, already-visible
// fields is the standout one for a given publisher — never an invented
// or LLM-guessed reason, just naming the strongest signal that's already
// driving their score. Returns null rather than a filler string when
// nothing stands out, so PublisherCard only shows a reason when there
// genuinely is one.
export function getMatchReason(p: Publisher): string | null {
  if (p.rating != null && p.rating >= 4.5) return `Rated ${p.rating}★ by businesses`;
  if (p.verified && p.trust_score >= 70) return "Verified, with a strong trust score";
  if (p.avg_response_hours != null && p.avg_response_hours <= 24) return "Responds within a day, on average";
  if (p.engagement >= 5) return "Above-average engagement";
  if (p.trust_score >= 60) return "Strong trust score";
  if (p.followers >= 20000) return "Large, established audience";
  return null;
}

export function applySort(list: Publisher[], sortBy: string): Publisher[] {
  const s = [...list];
  switch (sortBy) {
    case "followers_desc": return s.sort((a, b) => b.followers - a.followers);
    case "price_asc": return s.sort((a, b) => a.price_per_post - b.price_per_post);
    case "price_desc": return s.sort((a, b) => b.price_per_post - a.price_per_post);
    case "rating_desc": return s.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "engagement_desc": return s.sort((a, b) => b.engagement - a.engagement);
    case "reach_desc": return s.sort((a, b) => (b.monthly_reach ?? 0) - (a.monthly_reach ?? 0));
    default: return s.sort((a, b) => b.publisher_score - a.publisher_score);
  }
}

export function activeCount(f: Filters): number {
  return [
    f.query, f.channel, f.category, f.province, f.city, f.suburb,
    f.platforms.length, f.verifiedOnly, f.minRating,
    f.minFollowers, f.maxFollowers, f.minMonthlyReach, f.minEngagement,
    f.maxPrice < 5000, f.languages.length, f.ageDemographic, f.gender,
  ].filter(Boolean).length;
}

/**
 * A short, plain-language summary of a filter set — "Food & Drink ·
 * Western Cape · Verified only · Under R2 000" — used on the Saved
 * Searches page instead of dumping raw filter keys at someone.
 */
export function summarizeFilters(f: Filters): string {
  const parts: string[] = [];
  if (f.query) parts.push(`"${f.query}"`);
  if (f.channel) parts.push(f.channel.replace(/-/g, " "));
  if (f.category) parts.push(f.category);
  if (f.suburb) parts.push(f.suburb);
  else if (f.city) parts.push(f.city);
  else if (f.province) parts.push(f.province);
  if (f.platforms.length) parts.push(f.platforms.join(" + "));
  if (f.verifiedOnly) parts.push("Verified only");
  if (f.minRating > 0) parts.push(`${f.minRating}+ stars`);
  if (f.minFollowers) parts.push(`${Number(f.minFollowers).toLocaleString()}+ followers`);
  if (f.minEngagement) parts.push(`${f.minEngagement}%+ engagement`);
  if (f.maxPrice < 5000) parts.push(`Under ${formatCurrency(f.maxPrice)}`);
  if (f.languages.length) parts.push(f.languages.join(" + "));
  return parts.length ? parts.join(" · ") : "Every publisher in the directory";
}
