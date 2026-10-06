/**
 * Rule-based authenticity signals — explainable arithmetic on a publisher's
 * own stored numbers (same philosophy as pricingEngine.ts: every input maps
 * visibly to the output, nothing is a black box). These flag things worth a
 * second look during admin review; they are NOT proof of anything, and
 * legitimate publishers can trip one — a viral community group can
 * genuinely have reach well above its follower count, for example. Treat
 * this as "what would a careful reviewer double-check", not a verdict.
 *
 * Channel-aware: followers, engagement rate and monthly reach exist only for
 * social media and influencer listings, so the engagement, reach and price-band
 * checks run only there. Every channel gets the audience-size checks, judged on
 * its own headline number (visitors, downloads, covers, attendance...) against
 * that channel's own level ladder instead of a follower count.
 */
import { suggestedPriceFor, MIN_PRICE_PER_POST } from "./pricingEngine";
import { getLeadAudience, showsEngagement } from "./leadAudience";
import { getLevelLadder } from "./levelLadders";
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
  const social = showsEngagement(p);
  const engagement = p.engagement ?? 0;

  // The channel's own headline audience number and what it counts.
  const lead = getLeadAudience(p);
  const audience = lead.value ?? 0;
  const ladder = getLevelLadder(p.channel_slug || "social-media");
  // "Large" for the checks below. Social media keeps its original cut-offs; other
  // channels use their own ladder (Premium for "large", Verified for "sizeable").
  const largeAudience = social ? 15000 : (ladder?.thresholds[2] ?? Infinity);
  const sizeableAudience = social ? 10000 : (ladder?.thresholds[1] ?? Infinity);

  if (social) {
    const followers = audience;

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
    const band = suggestedPriceFor(p);
    if (band) {
      const { low, high } = band;
      if (p.price_per_post > MIN_PRICE_PER_POST && p.price_per_post < low * 0.25) {
        signals.push({ id: "priced_far_below_band", severity: "low", label: "Priced well below the suggested band", detail: `${formatCurrency(p.price_per_post)} vs. a suggested ${formatCurrencyRange(low, high)} for this size and engagement.` });
      } else if (p.price_per_post > high * 3) {
        signals.push({ id: "priced_far_above_band", severity: "low", label: "Priced well above the suggested band", detail: `${formatCurrency(p.price_per_post)} vs. a suggested ${formatCurrencyRange(low, high)} for this size and engagement.` });
      }
    }
  }

  // A sizeable claimed audience with zero verification on file.
  if (audience >= largeAudience && !p.email_verified && !p.phone_verified) {
    signals.push({ id: "unverified_large_audience", severity: "medium", label: "Large audience, no verification on file", detail: `${audience.toLocaleString()} ${lead.label} claimed with neither email nor phone verified.` });
  }

  // Minimal profile detail despite a large claimed audience.
  if (audience >= sizeableAudience && (!p.bio || p.bio.trim().length < 15)) {
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
