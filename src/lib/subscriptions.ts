/**
 * Shared logic for the ChatSched Publisher Network (R199 once-off) and
 * ChatSched Business (R399 once-off, launch credit included) activation
 * fees — status labels and the launch-credit-application math, kept here
 * as pure functions so they're testable without a live Supabase
 * connection. The actual state (what a subscription's status is right
 * now) lives in publisher_subscriptions / business_subscriptions
 * (schema_phase55, simplified by schema_phase86 for the once-off model)
 * and is only ever written by publisher-subscribe, business-subscribe,
 * and payfast-notify.
 *
 * "subscriptions" and "SubscriptionStatus" are the names this module and
 * its tables have always had (schema_phase55) and are kept rather than
 * renamed — these are still membership records with a lifecycle, just a
 * one-time one now instead of a recurring one. See
 * schema_phase86_once_off_activation_pricing.sql for why past_due /
 * grace_period / suspended were removed: none of those states can occur
 * once there's no recurring payment left to lapse from.
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

/**
 * How much of a campaign's amount should be covered by launch credit, and
 * what's left for PayFast to actually charge. Never applies more credit
 * than either the campaign costs or the business has remaining — the
 * campaign amount is always the tighter cap, so a partially-used credit
 * carries the rest forward rather than being lost.
 */
export interface CreditApplication {
  creditApplied: number;
  amountDue: number;
}

export function applyLaunchCredit(campaignAmount: number, availableCredit: number): CreditApplication {
  const safeAmount = Math.max(0, campaignAmount);
  const safeCredit = Math.max(0, availableCredit);
  const creditApplied = Math.round(Math.min(safeAmount, safeCredit) * 100) / 100;
  const amountDue = Math.round((safeAmount - creditApplied) * 100) / 100;
  return { creditApplied, amountDue };
}
