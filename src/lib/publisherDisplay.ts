import type { PublisherLevel } from "./types";

export const LEVEL_META: Record<PublisherLevel, { label: string; ringCount: number }> = {
  rising: { label: "Rising Publisher", ringCount: 1 },
  verified: { label: "Verified Publisher", ringCount: 2 },
  premium: { label: "Premium Publisher", ringCount: 3 },
  elite: { label: "Elite Publisher", ringCount: 4 },
};

// Bands from the brief's Part 7 ("Publisher Score: Excellent / Very Good /
// Good / Average") — the thresholds are a reasonable starting split, not
// anything the brief specified exactly. Easy to retune once there's a real
// spread of scores to look at across the full publisher base.
export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Very Good";
  if (score >= 50) return "Good";
  return "Average";
}
