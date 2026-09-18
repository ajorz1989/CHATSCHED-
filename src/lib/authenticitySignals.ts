/**
 * Rule-based authenticity signals — explainable arithmetic on a publisher's
 * own stored numbers (same philosophy as pricingEngine.ts: every input maps
 * visibly to the output, nothing is a black box). These flag things worth a
 * second look during admin review; they are NOT proof of anything, and
 * legitimate publishers can trip one — a viral community group can
 * genuinely have reach well above its follower count, for example. Treat
 * this as "what would a careful reviewer double-check", not a verdict.
 */
import { calculateSuggestedPrice, MIN_PRICE_PER_POST } from "./pricingEngine";
import type { Publisher } from "./types";
import { formatCurrency, formatCurrencyRange } from "./currency";

export type SignalSeverity = "low" | "medium" | "high";

export interface AuthenticitySignal {
  id: string;
  severity: SignalSeverity;
  label: string;
  detail: string;
}

export function computeAuthenticitySignals(p: Publisher): AuthenticitySignal[] {
  const signals: AuthenticitySignal[] = [];
  const followers = p.followers ?? 0;
  const engagement = p.engagement ?? 0;

  // Engagement rate implausible for the audience size — bigger audiences
  // mechanically see lower engagement %, so a large page with a very high
  // rate is worth a second look either way.
  if (engagement > 40) {
    signals.push({ id: "engagement_implausible", severity: "high", label: "Engagement rate looks implausible", detail: `${engagement}% engagement is well outside any normal range, regardless of audience size.` });
  } else if (followers >= 50000 && engagement > 10) {
    signals.push({ id: "engagement_high_for_size", severity: "high", label: "High engagement for this audience size", detail: `${engagement}% engagement is unusually high for ${followers.toLocaleString()} followers.` });
  } else if (followers >= 10000 && engagement > 15) {
    signals.push({ id: "engagement_high_for_size", severity: "medium", label: "High engagement for this audience size", detail: `${engagement}% engagement is above what's typical for ${followers.toLocaleString()} followers.` });
  }

  // Monthly reach far exceeding followers — sometimes a genuinely viral
  // group, sometimes a sign the reach figure was invented.
  if (p.monthly_reach && followers > 0 && p.monthly_reach > followers * 10) {
    signals.push({ id: "reach_outlier", severity: "medium", label: "Monthly reach far exceeds followers", detail: `Claimed monthly reach (${p.monthly_reach.toLocaleString()}) is over 10x the follower count.` });
  }

  // Price well outside the platform's own suggested band for this size —
  // informational, not a red flag on its own, but worth knowing why.
  const { low, high } = calculateSuggestedPrice({ followers, engagement, trustScore: p.trust_score, monthlyReach: p.monthly_reach });
  if (p.price_per_post > MIN_PRICE_PER_POST && p.price_per_post < low * 0.25) {
    signals.push({ id: "priced_far_below_band", severity: "low", label: "Priced well below the suggested band", detail: `${formatCurrency(p.price_per_post)} vs. a suggested ${formatCurrencyRange(low, high)} for this size and engagement.` });
  } else if (p.price_per_post > high * 3) {
    signals.push({ id: "priced_far_above_band", severity: "low", label: "Priced well above the suggested band", detail: `${formatCurrency(p.price_per_post)} vs. a suggested ${formatCurrencyRange(low, high)} for this size and engagement.` });
  }

  // A sizeable claimed audience with zero verification on file.
  if (followers >= 15000 && !p.email_verified && !p.phone_verified) {
    signals.push({ id: "unverified_large_audience", severity: "medium", label: "Large audience, no verification on file", detail: `${followers.toLocaleString()} followers claimed with neither email nor phone verified.` });
  }

  // Minimal profile detail despite a large claimed audience.
  if (followers >= 10000 && (!p.bio || p.bio.trim().length < 15)) {
    signals.push({ id: "thin_profile_for_size", severity: "low", label: "Minimal profile detail for this size", detail: "Bio is empty or very short for an audience this large." });
  }

  return signals;
}

export function highestSeverity(signals: AuthenticitySignal[]): SignalSeverity | null {
  if (signals.some((s) => s.severity === "high")) return "high";
  if (signals.some((s) => s.severity === "medium")) return "medium";
  if (signals.length > 0) return "low";
  return null;
}

export const SEVERITY_META: Record<SignalSeverity, { label: string; className: string }> = {
  high: { label: "High", className: "border-billboard-red text-billboard-red bg-white" },
  medium: { label: "Medium", className: "border-billboard-yellowDeep text-billboard-yellowDeep bg-white" },
  low: { label: "Low", className: "border-billboard-inkSoft text-billboard-inkSoft bg-white" },
};
