import { supabase } from "./supabase";
import { isSubscriptionUsable } from "./subscriptions";

/**
 * "Does this user currently have Premium access (R199/month)?" Premium
 * unlocks the Opportunities job board and the Marketing Suite, for
 * businesses and creators alike. Booking itself is free and is NOT gated.
 *
 * Client-side UX only: the real gate is public.premium_is_active() in
 * schema_phase115 (RLS). A subscription counts while status is 'active'
 * and its current_period_end (extended by payfast-notify on every monthly
 * payment) has not passed.
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const [{ data: biz }, { data: pub }] = await Promise.all([
    supabase.from("business_subscriptions").select("status, current_period_end").eq("business_id", userId).maybeSingle(),
    supabase.from("publisher_subscriptions").select("status, current_period_end").eq("publisher_id", userId).maybeSingle(),
  ]);
  const now = Date.now();
  return [biz, pub].some(
    (row) =>
      !!row &&
      isSubscriptionUsable(row.status) &&
      (!row.current_period_end || new Date(row.current_period_end).getTime() > now),
  );
}

// Historic names kept so callers read the same; both now mean Premium.
export const hasUsableBusinessSubscription = hasPremiumAccess;
export const hasUsablePublisherSubscription = hasPremiumAccess;
