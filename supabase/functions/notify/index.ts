// Sends a notification email for a well-defined set of events. Deliberately
// does NOT accept an arbitrary to/subject/body from the client — every email
// this function can send is constructed server-side from data the caller is
// already authorized to see, via requests' own RLS policies (or, for the two
// agency-lead kinds below, via the service role reading a freshly-created
// row the caller has no other read access to at all). That's what stops a
// logged-in business — or, for the agency-lead kinds, anyone at all — from
// turning this into a way to spam anyone.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { formatCurrency } from "../_shared/currency.ts";

type Kind = "new_request" | "new_message" | "status_change" | "new_agency_lead" | "campaign_brief_confirmation";

// Kinds that don't require a logged-in caller. Both concern agency_leads,
// which has no anon or authenticated read access at all — schema_phase59's
// agency_leads_admin_only policy covers select too, and
// schema_phase91_public_form_rate_limiting.sql later removed the one anon
// path that ever existed (a narrow insert-only policy), leaving zero
// client-readable access, by design. BuildMyCampaign.tsx's wizard is
// deliberately usable logged-out (see public-form-submit's own agency_lead
// FORM_CONFIGS comment), so this function can't require a session for
// these two the way the three kinds below do — it reads the lead itself
// via the service role instead, the same "trusted server context" pattern
// public-form-submit already uses to write it in the first place.
const NO_AUTH_KINDS: Kind[] = ["new_agency_lead", "campaign_brief_confirmation"];

// How long after an agency_leads row is created this function will still
// notify about it. Not a business rule about the lead itself — purely an
// abuse guard: dropping the login requirement above means there's no
// session tying a request to "the person who actually submitted this
// lead," so without a window, anyone who obtains/guesses a lead_id could
// trigger an email about an arbitrary lead at any point in the future. An
// hour is comfortably longer than BuildMyCampaign ever takes to
// insert-then-immediately-call this function, and short enough that a
// leaked lead_id stops being useful here quickly.
const LEAD_NOTIFY_WINDOW_MS = 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as { kind: Kind; request_id?: string; lead_id?: string };
    const { kind } = body;
    if (!kind) return json({ error: "kind is required" }, 400);

    if (NO_AUTH_KINDS.includes(kind)) {
      return await handleAgencyLeadNotification(kind, body.lead_id);
    }

    const request_id = body.request_id;
    if (!request_id) return json({ error: "kind and request_id are required" }, 400);

    // Scoped to the caller's own JWT — the select below only succeeds if
    // RLS already says this caller may see this request (their own, or an
    // admin). That's the entire authorization check for this function.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not logged in" }, 401);

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.role === "admin";

    const { data: request, error: requestError } = await supabase
      .from("requests")
      .select("*, publisher:publishers(name)")
      .eq("id", request_id)
      .single();
    if (requestError || !request) return json({ error: "Request not found or not yours" }, 404);

    const siteUrl = Deno.env.get("SITE_URL")!;
    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;
    const publisherName = request.publisher?.name ?? "a publisher";

    let to: string | null = null;
    let subject = "";
    let html = "";

    if (kind === "new_request") {
      to = adminEmail;
      subject = `New request: ${publisherName}`;
      html = `<p>A business just requested a campaign with <strong>${escapeHtml(publisherName)}</strong>.</p><p><a href="${siteUrl}/admin">Open the admin panel</a></p>`;
    } else if (kind === "status_change") {
      if (!isAdmin) {
        return json({ error: "Only admins can trigger status change notifications" }, 403);
      }
      to = await lookupEmail(request.business_id);
      subject = `Your ${publisherName} campaign is now "${request.status}"`;
      html = `<p>Your campaign request with <strong>${escapeHtml(publisherName)}</strong> is now marked <strong>${escapeHtml(request.status)}</strong>.</p><p><a href="${siteUrl}/dashboard">View your dashboard</a></p>`;
    } else if (kind === "new_message") {
      const senderIsAdmin = isAdmin;
      to = senderIsAdmin ? await lookupEmail(request.business_id) : adminEmail;
      subject = `New message about your ${publisherName} campaign`;
      html = `<p>You've got a new message about the <strong>${escapeHtml(publisherName)}</strong> campaign.</p><p><a href="${siteUrl}/${senderIsAdmin ? "dashboard" : "admin"}">Read it</a></p>`;
    } else {
      return json({ error: "Unknown kind" }, 400);
    }

    return await sendEmail(to, subject, html);
  } catch (err) {
    console.error("notify: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

async function handleAgencyLeadNotification(kind: Kind, leadId: string | undefined) {
  try {
    if (!leadId) return json({ error: "lead_id is required" }, 400);

    // Service role: see NO_AUTH_KINDS' comment above for why there's no
    // anon/authenticated path available here at all.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: lead, error: leadError } = await admin
      .from("agency_leads")
      .select("business_name, contact_email, estimated_value, created_at")
      .eq("id", leadId)
      .maybeSingle();
    if (leadError || !lead) return json({ error: "Lead not found" }, 404);

    if (Date.now() - new Date(lead.created_at).getTime() > LEAD_NOTIFY_WINDOW_MS) {
      // Deliberately the same generic message as "not found" above — the
      // caller has no session to prove they're the one who actually
      // submitted this lead, so an old lead_id shouldn't distinguish
      // "expired" from "never existed" to whoever's asking.
      return json({ error: "Lead not found" }, 404);
    }

    const siteUrl = Deno.env.get("SITE_URL")!;
    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;

    let to: string | null;
    let subject: string;
    let html: string;

    if (kind === "new_agency_lead") {
      to = adminEmail;
      subject = `New campaign brief: ${lead.business_name}`;
      const valueLine = lead.estimated_value != null ? ` (est. ${formatCurrency(Number(lead.estimated_value))})` : "";
      html = `<p>A new campaign brief just came in from <strong>${escapeHtml(lead.business_name)}</strong>${valueLine}.</p><p><a href="${siteUrl}/admin">Open the admin panel</a></p>`;
    } else {
      to = lead.contact_email;
      subject = "We've got your campaign brief — ChatSched";
      html = `<p>Thanks for building your campaign with ChatSched, <strong>${escapeHtml(lead.business_name)}</strong>. Our team is reviewing your brief now and will be in touch shortly.</p><p><a href="${siteUrl}">chatsched.co.za</a></p>`;
    }

    return await sendEmail(to, subject, html);
  } catch (err) {
    console.error("notify: unexpected error (agency lead)", err);
    return json({ error: "Unexpected error" }, 500);
  }
}

async function sendEmail(to: string | null, subject: string, html: string) {
  if (!to) return json({ error: "Could not resolve a recipient" }, 500);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    // Not configured yet — fail quietly rather than breaking the action
    // that triggered this (the request/message/status change/lead itself
    // already succeeded before this function was ever called).
    console.warn("notify: RESEND_API_KEY not set, skipping email");
    return json({ skipped: true });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") || "ChatSched <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error("notify: Resend error", await res.text());
    return json({ error: "Email failed to send" }, 502);
  }

  return json({ sent: true });
}

async function lookupEmail(userId: string): Promise<string | null> {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return data.user.email ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
