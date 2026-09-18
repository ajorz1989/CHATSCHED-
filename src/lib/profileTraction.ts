import { supabase } from "./supabase";

export interface ProfileTraction {
  last7Days: number;
  last30Days: number;
  allTime: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reads publisher_profile_views for one listing and buckets it into the
 * three windows PublisherDashboardView shows. A raw count, not a fancy
 * chart — see schema_phase36_profile_views.sql for why this is
 * deliberately count-only (never which viewer), and PublisherDashboardView
 * for how the numbers turn into an actual nudge rather than just sitting
 * there as a stat.
 */
export async function loadProfileTraction(publisherId: string): Promise<ProfileTraction> {
  const { data, error } = await supabase
    .from("publisher_profile_views")
    .select("viewed_date")
    .eq("publisher_id", publisherId);

  if (error || !data) return { last7Days: 0, last30Days: 0, allTime: 0 };

  const now = Date.now();
  let last7Days = 0;
  let last30Days = 0;

  for (const row of data) {
    const ageMs = now - new Date(row.viewed_date).getTime();
    if (ageMs <= 7 * DAY_MS) last7Days++;
    if (ageMs <= 30 * DAY_MS) last30Days++;
  }

  return { last7Days, last30Days, allTime: data.length };
}
