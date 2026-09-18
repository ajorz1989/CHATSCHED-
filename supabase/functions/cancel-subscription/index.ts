// Admin-only: revokes a publisher's or business's ChatSched membership
// (e.g. a refund or a policy violation), or a publisher's Featured
// Placement, by setting the relevant subscription status to 'cancelled'.
// A business also forfeits any unused launch credit, via
// forfeitBusinessLaunchCredit (_shared/launchCredit.ts) — confirmed
// product decision, not an engineering default (see that file's own
// comment).
//
// Used to be self-service (a business or publisher cancelling their own
// recurring subscription, which also called PayFast's cancel-token API).
// As of schema_phase86_once_off_activation_pricing.sql (item 10),
// publisher/business membership is a once-off activation fee with no
// renewal — there is no recurring PayFast token to cancel, and no reason
// for a fully-paid, permanent membership to have a self-service "cancel"
// action at all. This is now purely an admin action for revoking access
// after the fact; there is currently no admin UI wired up to call it for
// role=business/publisher (a real gap if ChatSched staff need to do this
// today — see the "claude fixes" writeup for item 10 for why building
// that UI was left out of this pass).
//
// role=featured_publisher (schema_phase87_featured_placement_subscriptions.sql)
// IS genuinely recurring — but this function does NOT call PayFast's
// recurring-cancel API for it (that code was removed alongside
// cancelPayfastSubscription when it had no remaining caller; see
// _shared/payfast.ts's own comment). Marking this table's row 'cancelled'
// stops ChatSched from treating the listing as Featured, but does NOT by
// itself stop PayFast from attempting the next recurring charge — a real,
// known gap, not an oversight papered over. Re-adding a recurring-cancel
// API call (from PayFast's published docs, same source the removed code
// cited) is the correct fix before this path is relied on for a real
// paying publisher; flagged plainly here and in the item 10 writeup
// rather than left to be discovered later.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { forfeitBusinessLaunchCredit } from "../_shared/launchCredit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { role, subject_id } = await req.json();
    if (role !== "business" && role !== "publisher" && role !== "featured_publisher") {
      return json({ error: "Invalid role" }, 400);
    }
    if (typeof subject_id !== "string" || !subject_id) {
      return json({ error: "subject_id is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Not logged in" }, 401);

    const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (callerProfile?.role !== "admin") return json({ error: "Admin only" }, 403);

    // featured_publisher (schema_phase87) is keyed by publishers.id, not
    // profiles.id like the other two — subject_id is a publisher listing
    // id in that case, not a user id.
    const table = role === "business" ? "business_subscriptions" : role === "publisher" ? "publisher_subscriptions" : "featured_placement_subscriptions";
    const idColumn = role === "business" ? "business_id" : role === "publisher" ? "publisher_id" : "publisher_id";

    // service role — this writes a row it doesn't own; the caller's own
    // admin-ness was already confirmed above via their own session, not
    // by trusting this elevated client.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await admin.from(table).select("id, status").eq(idColumn, subject_id).maybeSingle();
    if (!existing) return json({ error: "No subscription found" }, 404);
    if (existing.status === "cancelled") return json({ error: "Already cancelled" }, 400);

    const { error: updateError } = await admin
      .from(table)
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateError) return json({ error: "Could not cancel subscription" }, 500);

    if (role === "business") {
      await forfeitBusinessLaunchCredit(admin, subject_id);
    }

    return json({ cancelled: true });
  } catch (err) {
    console.error("cancel-subscription: unexpected error", err);
    return json({ error: "Unexpected error cancelling subscription" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
