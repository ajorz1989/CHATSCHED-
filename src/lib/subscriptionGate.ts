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
  return data ? isSubscriptionUsable(data.status) : false;
}
