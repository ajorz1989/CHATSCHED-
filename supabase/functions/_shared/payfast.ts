// Shared PayFast helpers used by both payfast-checkout and payfast-notify.
//
// The field order below is NOT alphabetical — PayFast's own docs explicitly
// warn against alphabetical order (that's a different, API-only format).
// The signature is built from fields in the order PayFast documents them.
// Source: https://developers.payfast.co.za/docs (Custom Integration → signature).
import { createHash } from "node:crypto";

export const PAYFAST_FIELD_ORDER = [
  "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
  "name_first", "name_last", "email_address", "cell_number",
  "m_payment_id", "amount", "item_name", "item_description",
  "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
  "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
  "email_confirmation", "confirmation_address",
  "payment_method",
  // Recurring billing fields — only present on subscription checkouts (see
  // content-studio-subscribe). PayFast documents these as the last block in
  // signature order, after payment_method.
  "subscription_type", "billing_date", "recurring_amount", "frequency", "cycles",
] as const;

// PayFast wants application/x-www-form-urlencoded-style escaping: spaces as
// '+' and uppercase hex. encodeURIComponent already gives uppercase hex, so
// the only gap is the space -> '+' swap.
function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function paramStringFromEntries(entries: [string, string][], passphrase?: string): string {
  const parts = entries
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${pfEncode(String(v))}`);
  let out = parts.join("&");
  // Only appended when a passphrase is actually set on the account — an
  // empty/placeholder passphrase must be omitted entirely, not sent as "".
  if (passphrase) out += `&passphrase=${pfEncode(passphrase)}`;
  return out;
}

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/** Signs an outgoing checkout request using PayFast's fixed field order. */
export function signCheckoutFields(data: Record<string, string | undefined>, passphrase?: string): string {
  const entries: [string, string][] = [];
  for (const key of PAYFAST_FIELD_ORDER) {
    const value = data[key];
    if (value !== undefined && value !== "") entries.push([key, value]);
  }
  return md5(paramStringFromEntries(entries, passphrase));
}

/**
 * Recomputes the signature for an inbound ITN using the order the fields
 * actually arrived in (PayFast documents ITN verification this way, distinct
 * from the fixed checkout field order above — do not reuse PAYFAST_FIELD_ORDER
 * here).
 */
export function signItnFields(orderedEntries: [string, string][], passphrase?: string): string {
  const withoutSignature = orderedEntries.filter(([k]) => k !== "signature");
  return md5(paramStringFromEntries(withoutSignature, passphrase));
}

export function payfastHost(mode: "sandbox" | "live"): string {
  return mode === "sandbox" ? "sandbox.payfast.co.za" : "www.payfast.co.za";
}

// The PayFast recurring-billing API (subscription cancel/pause/unpause,
// api.payfast.co.za) that used to live below this point was removed
// alongside cancelPayfastSubscription — see cancel-subscription/index.ts's
// own header comment: once-off activation fees (item 10,
// schema_phase86_once_off_activation_pricing.sql) have no recurring
// PayFast token to ever cancel. If a genuinely recurring product needs
// this again later (Content Studio's own cancellation is still an open
// gap — see that component's TODO), it's straightforward to re-add from
// PayFast's published API docs (https://developers.payfast.co.za/api,
// "Recurring Billing" section) rather than resurrect this exact code,
// since it was never exercised by anything except the now-removed
// once-off subscriptions.
