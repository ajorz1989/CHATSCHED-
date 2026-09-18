/**
 * Turns a publisher's avg_response_hours/response_count (see
 * schema_phase26_response_time.sql) into a display label, or null when
 * there isn't enough data to say anything meaningful yet.
 *
 * MIN_RESPONSES exists so a badge is never built on one lucky fast reply —
 * same reasoning as authenticitySignals.ts declining to draw conclusions
 * from a single data point. A creator with 1 response in under an hour
 * hasn't demonstrated a pattern; a creator with 5+ has.
 */
const MIN_RESPONSES = 3;

export function responseTimeLabel(avgHours: number | null, responseCount: number): string | null {
  if (avgHours == null || responseCount < MIN_RESPONSES) return null;

  if (avgHours < 1) return "Usually responds within an hour";
  if (avgHours < 24) return `Usually responds within ${Math.round(avgHours)} hours`;
  if (avgHours < 48) return "Usually responds within a day";
  if (avgHours < 24 * 7) return `Usually responds within ${Math.round(avgHours / 24)} days`;
  return "Usually responds within a week";
}
