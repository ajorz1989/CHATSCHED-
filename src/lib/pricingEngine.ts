/**
 * Creator pricing — the R50 floor and the "Suggested Price" valuation model.
 *
 * The valuation is a transparent heuristic, not a market-data model: base
 * rate per 1,000 followers, adjusted up or down by engagement relative to a
 * ~2% baseline, and by trust score once a creator has one. It's meant to
 * give a new applicant a sane starting point, not a guarantee of what
 * they'll actually earn — every input a person can already see (their own
 * follower count, engagement, trust score) maps directly and visibly to the
 * number, so nothing about it is a black box.
 */

export const MIN_PRICE_PER_POST = 50;

export interface PriceValuationInput {
  followers: number;
  engagement: number; // percent, e.g. 3.5
  /** 0–100. Omit for a brand-new applicant who doesn't have one yet — falls back to a neutral baseline. */
  trustScore?: number | null;
  /** Optional extra signal — a page whose monthly reach well exceeds its follower count is punching above its size. */
  monthlyReach?: number | null;
}

export interface PriceValuation {
  suggested: number;
  low: number;
  high: number;
}

const RATE_PER_1000_FOLLOWERS = 35; // R35 base, before adjustments
const BASELINE_ENGAGEMENT = 2; // percent — roughly the SA social-platform average this model is centred on
const NEUTRAL_TRUST_SCORE = 50; // used when a creator doesn't have a trust score yet (new applicant)

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function calculateSuggestedPrice(input: PriceValuationInput): PriceValuation {
  const followers = Math.max(0, input.followers || 0);
  const engagement = Math.max(0, input.engagement || 0);
  const trustScore = input.trustScore ?? NEUTRAL_TRUST_SCORE;

  const base = (followers / 1000) * RATE_PER_1000_FOLLOWERS;

  // Engagement above/below the baseline moves price by up to ±60% at the extremes.
  const engagementMultiplier = clamp(0.6 + (engagement / BASELINE_ENGAGEMENT) * 0.4, 0.6, 2.2);

  // Trust score of 0 → 0.85x, 100 → 1.25x. A brand-new applicant with no
  // score yet sits at the neutral baseline (1.05x), a small optimistic nudge.
  const trustMultiplier = 0.85 + (trustScore / 100) * 0.4;

  // A page whose monthly reach meaningfully exceeds its follower count
  // (shares, group activity) earns a small bonus, capped at +30%.
  const reach = input.monthlyReach ?? 0;
  const reachMultiplier = reach > followers && followers > 0
    ? 1 + clamp((reach / followers - 1) * 0.1, 0, 0.3)
    : 1;

  const raw = base * engagementMultiplier * trustMultiplier * reachMultiplier;
  const suggested = Math.max(MIN_PRICE_PER_POST, Math.round(raw / 5) * 5);

  return {
    suggested,
    low: Math.max(MIN_PRICE_PER_POST, Math.round((suggested * 0.85) / 5) * 5),
    high: Math.round((suggested * 1.2) / 5) * 5,
  };
}
