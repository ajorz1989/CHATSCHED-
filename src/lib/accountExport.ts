import { supabase } from "./supabase";

/**
 * Builds a full export of everything this account owns, for the POPIA
 * "right to access" self-service flow (AccountSettings.tsx). Deliberately
 * client-side rather than an Edge Function — every query here relies on
 * the exact same RLS policies already protecting these tables (a business
 * can only ever see its own requests/payments/etc, a publisher only its
 * own), so this can't accidentally return anyone else's data even if the
 * table list below gets out of sync with the schema; a query just returns
 * nothing extra, never something it shouldn't.
 *
 * Table list is exhaustive as of schema_phase32 — every table with a
 * column that's the caller's own auth.uid() (business_id, sender_id,
 * recipient_id, owner_id, reporter_id) or, for the publisher-facing
 * tables, the caller's own publisher.id. If a future migration adds a new
 * table keyed to a user, add it here too — nothing enforces that
 * automatically.
 */
export async function exportAccountData(userId: string): Promise<Record<string, unknown>> {
  const { data: publisherRows } = await supabase.from("publishers").select("id").eq("user_id", userId);
  const publisherId = publisherRows?.[0]?.id as string | undefined;

  const queries: Record<string, PromiseLike<unknown>> = {
    profile: supabase.from("profiles").select("*").eq("id", userId).single().then((r) => r.data),
    publisher_listing: publisherId
      ? supabase.from("publishers").select("*").eq("id", publisherId).single().then((r) => r.data)
      : Promise.resolve(null),
    requests_as_business: supabase.from("requests").select("*").eq("business_id", userId).then((r) => r.data),
    channel_requests_as_business: supabase.from("channel_requests").select("*").eq("business_id", userId).then((r) => r.data),
    channel_requests_as_creator: publisherId
      ? supabase.from("channel_requests").select("*").eq("creator_id", publisherId).then((r) => r.data)
      : Promise.resolve([]),
    payments: supabase.from("payments").select("*").eq("business_id", userId).then((r) => r.data),
    reviews_written: supabase.from("reviews").select("*").eq("business_id", userId).then((r) => r.data),
    messages: supabase.from("messages").select("*").eq("sender_id", userId).then((r) => r.data),
    conversations_as_business: supabase.from("conversations").select("*").eq("business_id", userId).then((r) => r.data),
    conversations_as_publisher: publisherId
      ? supabase.from("conversations").select("*").eq("publisher_id", publisherId).then((r) => r.data)
      : Promise.resolve([]),
    conversation_messages_sent: supabase.from("conversation_messages").select("*").eq("sender_id", userId).then((r) => r.data),
    disputes_as_business: supabase.from("disputes").select("*").eq("business_id", userId).then((r) => r.data),
    disputes_as_publisher: publisherId
      ? supabase.from("disputes").select("*").eq("publisher_id", publisherId).then((r) => r.data)
      : Promise.resolve([]),
    dispute_messages_sent: supabase.from("dispute_messages").select("*").eq("sender_id", userId).then((r) => r.data),
    notifications: supabase.from("notifications").select("*").eq("recipient_id", userId).then((r) => r.data),
    campaigns: supabase.from("campaigns").select("*").eq("owner_id", userId).then((r) => r.data),
    saved_lists: supabase.from("saved_lists").select("*").eq("business_id", userId).then((r) => r.data),
    content_studio_subscription: supabase.from("content_studio_subscriptions").select("*").eq("business_id", userId).maybeSingle().then((r) => r.data),
    content_studio_generations: supabase.from("content_studio_generations").select("*").eq("business_id", userId).then((r) => r.data),
    reports_filed: supabase.from("reports").select("*").eq("reporter_id", userId).then((r) => r.data),
  };

  const entries = await Promise.all(
    Object.entries(queries).map(async ([key, promise]) => [key, await promise] as const)
  );

  return {
    exported_at: new Date().toISOString(),
    note: "Every field below is exactly what's stored against your account — nothing summarized or filtered.",
    ...Object.fromEntries(entries),
  };
}

/** Triggers a browser download of the export as a formatted JSON file. */
export function downloadAccountData(data: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chatsched-account-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
