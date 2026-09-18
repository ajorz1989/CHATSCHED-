import { supabase } from "./supabase";

export interface TransparencyStats {
  total_requests: number;
  completed_requests: number;
  completion_rate: number | null; // percent, null when there are no requests yet
  responded_requests: number;
  avg_response_hours: number | null; // null when nothing has been responded to yet
}

/**
 * Calls the public.get_marketplace_transparency_stats() RPC
 * (schema_phase49_transparency.sql) — a SECURITY DEFINER aggregate that
 * returns only platform-wide totals, never individual requests. Safe to
 * call without a session; used on the public /transparency page.
 */
export async function getTransparencyStats(): Promise<TransparencyStats | null> {
  const { data, error } = await supabase.rpc("get_marketplace_transparency_stats");
  if (error || !data || data.length === 0) return null;
  return data[0] as TransparencyStats;
}
