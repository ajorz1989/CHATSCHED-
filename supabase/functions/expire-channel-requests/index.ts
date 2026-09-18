// Scheduled job — closes overdue channel_requests automatically instead of
// requiring an admin to notice and click "Close as expired" / "Cancel —
// unpaid" by hand in AdminChannelRequests.tsx. Does exactly what those two
// buttons already do (same status transitions), just on a timer. Also
// closes an un-responded counter-offer (schema_phase35) — a 'countered'
// request shares 'pending's approval_due_at clock (see that migration's
// comment for why it isn't reset), so it needs the exact same overdue
// check, just landing on 'cancelled' instead of 'declined' since the
// creator did respond — the business just didn't act on it in time.
//
// This does NOT touch the original social-media `requests` table/PayFast
// flow — that flow has no equivalent auto-expiring deadlines, so there's
// nothing there for this job to do.
//
// Not user-facing — invoked on a schedule, not by someone logged in (see
// supabase/schema_phase26_expire_channel_requests.sql for the pg_cron job
// that calls this every 30 minutes). With no Supabase user JWT to check,
// this authenticates itself differently: a shared secret in a header.
// Deploy with --no-verify-jwt, same reason as payfast-notify.
//
// Server-side, this is nothing new: enforce_channel_request_transition()
// in schema_phase17_channel_marketplace.sql already allows exactly these
// two transitions from a null-auth.uid() context ("a trusted server-side
// context... a future service-role edge function", per that file's own
// comment) — this function is that trusted context, using the service
// role key precisely so those updates pass the trigger unchanged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ExpiredRow {
  id: string;
  channel_slug: string;
  business_id: string;
  creator: { name: string } | { name: string }[] | null;
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  let authorized = Boolean(expected && provided === expected);

  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (authHeader) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseUser.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (profile?.role === "admin") {
          authorized = true;
        }
      }
    }
  }

  if (!authorized) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const nowIso = new Date().toISOString();

    // Overdue and the creator never responded — declined, same as the
    // admin's "Close as expired" button.
    const { data: expiredPending, error: pendingError } = await supabase
      .from("channel_requests")
      .update({ status: "declined" })
      .eq("status", "pending")
      .lt("approval_due_at", nowIso)
      .select("id, channel_slug, business_id, creator:publishers(name)");
    if (pendingError) throw pendingError;

    // Approved but the business never paid in time — cancelled, same as
    // the admin's "Cancel — unpaid" button.
    const { data: expiredPayment, error: paymentError } = await supabase
      .from("channel_requests")
      .update({ status: "cancelled" })
      .eq("status", "awaiting_payment")
      .lt("payment_due_at", nowIso)
      .select("id, channel_slug, business_id, creator:publishers(name)");
    if (paymentError) throw paymentError;

    // Creator countered, business never responded — cancelled (not
    // declined: the creator DID respond, the business just let the offer
    // sit past the same approval_due_at deadline).
    const { data: expiredCounter, error: counterError } = await supabase
      .from("channel_requests")
      .update({ status: "cancelled" })
      .eq("status", "countered")
      .lt("approval_due_at", nowIso)
      .select("id, channel_slug, business_id, creator:publishers(name)");
    if (counterError) throw counterError;

    const closed = [
      ...((expiredPending ?? []) as ExpiredRow[]).map((r) => ({ ...r, reason: "no_response" as const })),
      ...((expiredPayment ?? []) as ExpiredRow[]).map((r) => ({ ...r, reason: "unpaid" as const })),
      ...((expiredCounter ?? []) as ExpiredRow[]).map((r) => ({ ...r, reason: "counter_expired" as const })),
    ];

    // Best-effort — a failed email shouldn't undo the status change, which
    // already committed above. Same "never block the action that
    // triggered this" posture as the notify function.
    await Promise.all(closed.map((row) => notifyBusiness(supabase, row).catch((err) => console.error("expire-channel-requests: notify failed", row.id, err))));

    return json({
      expired_pending: expiredPending?.length ?? 0,
      expired_payment: expiredPayment?.length ?? 0,
      expired_counter: expiredCounter?.length ?? 0,
    });
  } catch (err) {
    console.error("expire-channel-requests: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

async function notifyBusiness(
  supabase: ReturnType<typeof createClient>,
  row: ExpiredRow & { reason: "no_response" | "unpaid" | "counter_expired" }
) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    // Same as every other function that sends email in this repo: fail
    // quietly rather than breaking anything, and don't pretend it sent.
    console.warn("expire-channel-requests: RESEND_API_KEY not set, skipping email for", row.id);
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(row.business_id);
  if (userError || !userData.user?.email) return;

  const creatorName = Array.isArray(row.creator) ? row.creator[0]?.name : row.creator?.name;
  const name = creatorName || "the creator";
  const siteUrl = Deno.env.get("SITE_URL") || "";

  const subject =
    row.reason === "no_response"
      ? `Your request to ${name} expired`
      : row.reason === "counter_expired"
      ? `${name}'s counter-offer expired`
      : `Your ${name} request was cancelled — payment window closed`;
  const html =
    row.reason === "no_response"
      ? `<p>Your campaign request to <strong>${escapeHtml(name)}</strong> went unanswered for 7 days, so it's automatically closed.</p><p>Feel free to try another creator on the same channel${siteUrl ? ` — <a href="${siteUrl}/browse">browse the directory</a>` : ""}.</p>`
      : row.reason === "counter_expired"
      ? `<p><strong>${escapeHtml(name)}</strong> proposed a different price for your request, but it went unanswered for too long, so it's automatically closed.</p><p>You're welcome to submit a new request if you'd still like to go ahead${siteUrl ? ` — <a href="${siteUrl}/dashboard">view your dashboard</a>` : ""}.</p>`
      : `<p>Your approved campaign with <strong>${escapeHtml(name)}</strong> was cancelled because payment wasn't completed within the 7-day window.</p><p>You're welcome to submit a new request if you'd still like to go ahead${siteUrl ? ` — <a href="${siteUrl}/dashboard">view your dashboard</a>` : ""}.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") || "ChatSched <onboarding@resend.dev>",
      to: [userData.user.email],
      subject,
      html,
    }),
  });
  if (!res.ok) console.error("expire-channel-requests: Resend error for", row.id, await res.text());
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
