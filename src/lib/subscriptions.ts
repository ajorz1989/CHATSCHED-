/**
 * Premium access (R199/month, PayFast recurring) status labels and the
 * "is this usable" check. The state itself lives in business_subscriptions /
 * publisher_subscriptions (the table names are historic) and is only ever
 * written by business-subscribe, publisher-subscribe, payfast-notify and
 * the admin grant in admin-onboard-business.
 */

export type SubscriptionStatus = "pending" | "active" | "failed" | "cancelled";

export interface SubscriptionStatusInfo {
  label: string;
  /** Rough traffic-light for styling — not a fourth data source. */
  tone: "positive" | "warning" | "negative" | "neutral";
}

const STATUS_INFO: Record<SubscriptionStatus, SubscriptionStatusInfo> = {
  pending: { label: "Payment pending", tone: "neutral" },
  active: { label: "Active", tone: "positive" },
  failed: { label: "Payment failed", tone: "negative" },
  cancelled: { label: "Cancelled", tone: "negative" },
};

export function subscriptionStatusInfo(status: SubscriptionStatus): SubscriptionStatusInfo {
  return STATUS_INFO[status];
}

/** True for any status where the subscriber should still have full access. */
export function isSubscriptionUsable(status: SubscriptionStatus): boolean {
  return status === "active";
}
