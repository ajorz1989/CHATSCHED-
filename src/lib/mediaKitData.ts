import { supabase } from "./supabase";

/**
 * Completed campaigns for a publisher, counted across both booking flows —
 * the original directory `requests` table (publisher_id) and the newer
 * multi-channel `channel_requests` table (creator_id, same publishers row).
 * Used for the "Campaign History" section of the media kit; a head-count
 * query on each, summed, since neither flow alone tells the whole story
 * for a channel that's had both kinds of bookings over time.
 */
export async function getCompletedCampaignCount(publisherId: string): Promise<number> {
  const [{ count: requestsCount }, { count: channelRequestsCount }] = await Promise.all([
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("publisher_id", publisherId).eq("status", "completed"),
    supabase.from("channel_requests").select("id", { count: "exact", head: true }).eq("creator_id", publisherId).eq("status", "completed"),
  ]);
  return (requestsCount ?? 0) + (channelRequestsCount ?? 0);
}
