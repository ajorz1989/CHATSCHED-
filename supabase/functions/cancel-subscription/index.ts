// Admin-only: revokes a creator's or business's Premium access (e.g. a refund or
// a policy violation), or a publisher's Featured Placement, by setting the
// relevant subscription status to 'cancelled'. Launch credit no longer exists.
//
// Known gap: this does NOT call PayFast's recurring-cancel API. Marking a
// Premium or Featured Placement row 'cancelled' stops ChatSched treating the
// account as paying, but PayFast may still attempt the next monthly charge
// until the subscriber (or ChatSched on PayFast's dashboard) cancels it there.
// Re-add the recurring-cancel API call before relying on this for a real payer.
//
// featured_publisher is keyed by publishers.id; the other two by profiles.id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

    return json({ cancelled: true });
  } catch (err) {
    console.error("cancel-subscription: unexpected error", err);
    return json({ error: "Unexpected error cancelling subscription" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
