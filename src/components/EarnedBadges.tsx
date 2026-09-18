import type { Publisher } from "../lib/types";

/**
 * 12-Channel Audit fix D5 — earned badges, distinct from PAID Featured
 * Placement (schema_phase87_featured_placement_subscriptions.sql): these
 * cost nothing to earn and give a buyer a second, non-pay-to-win trust
 * signal, so Featured doesn't read as "whoever pays most wins."
 *
 * "Top Responder" — real, computed client-side against the same
 * category's publishers already loaded by usePublishers() (no new query).
 * Only awarded with at least 3 responses on record, so a publisher with
 * one lucky fast reply doesn't out-rank someone with a real track record.
 *
 * "Verified Since" — real, uses the existing `created_at` + `verified`
 * fields; a simple tenure signal for channels where reputation is still
 * being built.
 *
 * "Rising Publisher" (fastest-growing booking volume this month) from the
 * audit is NOT built here — no time-series booking-volume data is
 * tracked anywhere in this schema (only current-state counts), so
 * "growth" isn't a real, honest number to compute yet. Logged as a real
 * follow-on (needs a booking-history table), not faked with a plausible-
 * looking placeholder.
 */
export default function EarnedBadges({ publisher, categoryPeers }: { publisher: Publisher; categoryPeers: Publisher[] }) {
  const badges: string[] = [];

  const withEnoughResponses = categoryPeers.filter((p) => (p.response_count ?? 0) >= 3 && p.avg_response_hours != null);
  if (withEnoughResponses.length >= 2 && (publisher.response_count ?? 0) >= 3 && publisher.avg_response_hours != null) {
    const fastest = [...withEnoughResponses].sort((a, b) => (a.avg_response_hours ?? Infinity) - (b.avg_response_hours ?? Infinity))[0];
    if (fastest.id === publisher.id) badges.push("⚡ Top Responder in category");
  }

  if (publisher.verified && publisher.created_at) {
    const year = new Date(publisher.created_at).getFullYear();
    badges.push(`Verified since ${year}`);
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {badges.map((b) => (
        <span key={b} className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full border-2 border-billboard-ink bg-billboard-yellow/40">
          {b}
        </span>
      ))}
    </div>
  );
}
