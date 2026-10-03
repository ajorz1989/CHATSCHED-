import { supabase } from "./supabase";
import { isSubscriptionUsable } from "./subscriptions";

/**
 * Proactive, client-side "does this user currently have a usable
 * subscription" check — for showing a clear message before someone
 * fills out a form, instead of letting them hit the raw RLS/trigger
 * rejection in schema_phase71_subscription_enforcement.sql. That
 * migration is the real gate; this is UX. See
 * isMessageSafetyPrescanEnabled() (featureFlags.ts) for the same
 * client-side-is-not-the-boundary shape applied to a different feature.
 *
 * Not wired into every entry point that schema_phase71 gates — see this
 * phase's delivery doc for exactly which pages have the proactive check
 * and which still surface a raw error on rejection until that's caught up.
 */
export async function hasUsableBusinessSubscription(businessId: string): Promise<boolean> {
  const { data } = await supabase
    .from("business_subscriptions")
    .select("status")
    .eq("business_id", businessId)
    .maybeSingle();
  return data ? isSubscriptionUsable(data.status) : false;
}

export async function hasUsablePublisherSubscription(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("publisher_subscriptions")
    .select("status")
    .eq("publisher_id", userId)
    .maybeSingle();
  if (data && isSubscriptionUsable(data.status)) return true;
  // A listing a business created from its own dashboard is covered by the
  // business activation fee — businesses can't buy Publisher Network
  // activation. Mirrors public.publisher_is_activated() in
  // 20261003120000_business_publisher_listings.sql, which is the real gate.
  const { data: own } = await supabase
    .from("publishers")
    .select("creation_source")
    .eq("user_id", userId)
    .maybeSingle();
  if (own?.creation_source === "business") return hasUsableBusinessSubscription(userId);
  return false;
}
