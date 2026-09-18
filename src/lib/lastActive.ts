/**
 * Turns a publisher's last_active_at into a coarse, human label — never
 * exact timestamps, minutes, or "last seen HH:MM" precision. A business
 * doesn't need to know *exactly* when someone was last online, and
 * showing that level of detail is more surveillance than trust signal.
 * Same reasoning as responseTimeLabel(): a handful of wide buckets, not a
 * live clock.
 *
 * Bucketing:
 *   < 6h    → "Active N hours ago"
 *   < 24h   → "Active today"
 *   < 7d    → "Active N days ago"
 *   >= 7d   → "Inactive for N days" (capped at 90+, see below)
 *
 * last_active_at is set by touch_publisher_activity() (see
 * schema_phase31_last_active.sql) — called once per session on login/token
 * refresh for signed-in publishers, so it tracks real usage, not a
 * fabricated number.
 */
export type LastActiveTier = "recent" | "this_week" | "inactive";

export interface LastActiveInfo {
  label: string;
  tier: LastActiveTier;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const INACTIVE_CAP_DAYS = 90;

export function lastActiveInfo(lastActiveAt: string | null, now: Date = new Date()): LastActiveInfo | null {
  if (!lastActiveAt) return null;
  const then = new Date(lastActiveAt).getTime();
  const diffMs = now.getTime() - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;

  if (diffMs < 6 * HOUR_MS) {
    const hours = Math.max(1, Math.round(diffMs / HOUR_MS));
    return { label: `Active ${hours} hour${hours === 1 ? "" : "s"} ago`, tier: "recent" };
  }
  if (diffMs < DAY_MS) {
    return { label: "Active today", tier: "recent" };
  }
  if (diffMs < 7 * DAY_MS) {
    const days = Math.max(1, Math.round(diffMs / DAY_MS));
    return { label: `Active ${days} day${days === 1 ? "" : "s"} ago`, tier: "this_week" };
  }
  const days = Math.round(diffMs / DAY_MS);
  const capped = Math.min(days, INACTIVE_CAP_DAYS);
  return { label: `Inactive for ${capped}${days > INACTIVE_CAP_DAYS ? "+" : ""} days`, tier: "inactive" };
}

/** Convenience for callers that only want the string (matches responseTimeLabel's shape). */
export function lastActiveLabel(lastActiveAt: string | null, now?: Date): string | null {
  return lastActiveInfo(lastActiveAt, now)?.label ?? null;
}
