/**
 * Turns a publisher's acceptance_rate/acceptance_sample_size (see
 * schema_phase109_publisher_acceptance_rate.sql) into a display label, or
 * null when there isn't enough data to say anything meaningful yet.
 *
 * MIN_SAMPLE mirrors responseTime.ts's MIN_RESPONSES for the same reason —
 * a rate built on 1 or 2 responded requests is a coin flip, not a pattern.
 */
const MIN_SAMPLE = 3;

export function acceptanceRateLabel(rate: number | null, sampleSize: number): string | null {
  if (rate == null || sampleSize < MIN_SAMPLE) return null;
  return `Accepts ${Math.round(rate)}% of requests`;
}
