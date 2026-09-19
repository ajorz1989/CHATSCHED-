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
    content_studio_subscription: supabase
      .from("content_studio_subscriptions")
      .select("*")
      .eq("business_id", userId)
      .maybeSingle()
      .then((r) => r.data),
    content_studio_generations: supabase
      .from("content_studio_generations")
      .select("*")
      .eq("business_id", userId)
      .then((r) => r.data),
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

// ---------------------------------------------------------------------------
// JSON download
// ---------------------------------------------------------------------------

/**
 * Triggers a browser download of the export as a formatted JSON file.
 * BUG FIX: revokeObjectURL is deferred by 60 s so the browser has time
 * to initiate the download before the blob URL is invalidated. Calling it
 * synchronously after a.click() races against the browser's download
 * initiation and silently kills the download on some browsers.
 */
export function downloadAccountData(data: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chatsched-account-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation so the browser can initiate the download first.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------------------------------------------------------------------------
// PDF download
// ---------------------------------------------------------------------------

/**
 * Generates and downloads a human-readable PDF of the account data.
 * Uses only browser-native APIs (no external library) — builds an HTML
 * string and triggers window.print() scoped to a hidden iframe so the
 * user gets a proper Save-as-PDF dialog without leaving the page.
 */
export function downloadAccountDataAsPdf(data: Record<string, unknown>) {
  const exportedAt = typeof data.exported_at === "string" ? data.exported_at : new Date().toISOString();
  const profile = (data.profile ?? {}) as Record<string, unknown>;
  const displayName =
    (profile.full_name as string) ||
    (profile.business_name as string) ||
    (profile.display_name as string) ||
    "ChatSched Account";
  const email = (profile.email as string) || "";
  const role = (profile.role as string) || "";
  const userId = (profile.id as string) || "";

  // Helper — render any section as a simple key/value table
  function sectionHtml(title: string, rows: Record<string, unknown> | null | undefined): string {
    if (!rows || Object.keys(rows).length === 0) return "";
    const cells = Object.entries(rows)
      .map(
        ([k, v]) =>
          `<tr><td class="key">${escHtml(k)}</td><td class="val">${escHtml(
            v == null ? "—" : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)
          )}</td></tr>`
      )
      .join("");
    return `<section><h2>${escHtml(title)}</h2><table>${cells}</table></section>`;
  }

  // Helper — render an array section
  function arraySection(title: string, arr: unknown[] | null | undefined): string {
    if (!arr || arr.length === 0)
      return `<section><h2>${escHtml(title)}</h2><p class="empty">No records.</p></section>`;
    return arr
      .map(
        (item, i) =>
          `<section><h2>${escHtml(title)} #${i + 1}</h2><table>${Object.entries(
            item as Record<string, unknown>
          )
            .map(
              ([k, v]) =>
                `<tr><td class="key">${escHtml(k)}</td><td class="val">${escHtml(
                  v == null ? "—" : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)
                )}</td></tr>`
            )
            .join("")}</table></section>`
      )
      .join("");
  }

  const sections = [
    sectionHtml("Profile", profile),
    sectionHtml("Publisher Listing", data.publisher_listing as Record<string, unknown> | null),
    arraySection("Requests (as Business)", data.requests_as_business as unknown[]),
    arraySection("Channel Requests (as Business)", data.channel_requests_as_business as unknown[]),
    arraySection("Channel Requests (as Creator)", data.channel_requests_as_creator as unknown[]),
    arraySection("Payments", data.payments as unknown[]),
    arraySection("Reviews Written", data.reviews_written as unknown[]),
    arraySection("Messages Sent", data.messages as unknown[]),
    arraySection("Conversations (as Business)", data.conversations_as_business as unknown[]),
    arraySection("Conversations (as Publisher)", data.conversations_as_publisher as unknown[]),
    arraySection("Conversation Messages Sent", data.conversation_messages_sent as unknown[]),
    arraySection("Disputes (as Business)", data.disputes_as_business as unknown[]),
    arraySection("Disputes (as Publisher)", data.disputes_as_publisher as unknown[]),
    arraySection("Dispute Messages Sent", data.dispute_messages_sent as unknown[]),
    arraySection("Notifications", data.notifications as unknown[]),
    arraySection("Campaigns", data.campaigns as unknown[]),
    arraySection("Saved Lists", data.saved_lists as unknown[]),
    sectionHtml("Content Studio Subscription", data.content_studio_subscription as Record<string, unknown> | null),
    arraySection("Content Studio Generations", data.content_studio_generations as unknown[]),
    arraySection("Reports Filed", data.reports_filed as unknown[]),
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>ChatSched Account Data Export</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; padding: 32px; }
  header { border-bottom: 3px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
  header h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  header .meta { margin-top: 6px; color: #555; font-size: 10px; }
  header .badge { display: inline-block; background: #FFE44D; border: 2px solid #111; border-radius: 4px; padding: 2px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  section { margin-bottom: 20px; break-inside: avoid; }
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-left: 4px solid #FFE44D; padding-left: 8px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 8px; border: 1px solid #ddd; vertical-align: top; word-break: break-word; }
  td.key { width: 35%; font-weight: 600; background: #f9f9f9; white-space: nowrap; }
  td.val { font-family: monospace; font-size: 10px; white-space: pre-wrap; }
  p.empty { color: #999; font-style: italic; font-size: 10px; }
  footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; color: #999; font-size: 9px; }
  @media print {
    body { padding: 0; }
    section { break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  <div class="badge">POPIA Data Export</div>
  <h1>ChatSched Account Data</h1>
  <div class="meta">
    <strong>Name:</strong> ${escHtml(displayName)}&nbsp;&nbsp;
    <strong>Email:</strong> ${escHtml(email)}&nbsp;&nbsp;
    <strong>Role:</strong> ${escHtml(role)}&nbsp;&nbsp;
    <strong>User ID:</strong> ${escHtml(userId)}<br/>
    <strong>Exported:</strong> ${escHtml(new Date(exportedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }))} (SAST)
  </div>
</header>
${sections}
<footer>
  This document was generated by ChatSched in response to a POPIA right-to-access request.
  It contains every record stored against this account and nothing else.
  chatsched.co.za
</footer>
</body>
</html>`;

  // Open in a hidden iframe and trigger print → Save as PDF
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: open in new tab if iframe is blocked
    const win = window.open("", "_blank");
    win?.document.write(html);
    win?.document.close();
    win?.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  // Wait for iframe to render before printing
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 2000);
  };
  // Fallback if onload already fired
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }
  }, 500);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
