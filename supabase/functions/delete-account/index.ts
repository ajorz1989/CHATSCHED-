// Self-service account deletion (POPIA "right to erasure"), replacing what
// was previously "email our Information Officer and we'll do it by hand."
// Called from AccountSettings.tsx.
//
// Two-step, not one: first check for anything financially unresolved tied
// to this account, and refuse if so — a business or creator mid-campaign
// shouldn't be able to make an active request vanish out from under the
// other side by deleting their account. Only once nothing's outstanding
// does this actually call auth.admin.deleteUser().
//
// ── What deleting the auth user actually does to the rest of the schema ──
// Most tables below still cascade on `references auth.users(id) on delete
// cascade` (see the grep-able list of those in each schema_phase*.sql):
// messages, conversations/conversation_messages, disputes/dispute_messages,
// notifications, campaigns, saved_lists, content_studio_*, reports. That's
// the intended POPIA-erasure behaviour for personal/communication data —
// it should go when the account goes.
//
// Four tables are the deliberate exception, fixed by
// schema_phase81_delete_account_retention.sql: payments, requests,
// channel_requests (as business), and reviews. These hold completed
// financial/campaign records — the kind a *creator* still needs for their
// own income history, and the kind SARS' ~5-year financial recordkeeping
// expectations are actually about — so as of that migration their
// business_id is `on delete set null` instead of `on delete cascade`. The
// row survives deletion (amount, status, dates, publisher-side identity all
// intact); only the link back to the now-deleted business account is
// cleared. This is safe specifically because of the blockers check below:
// nothing in these four tables is ever still in an active/non-terminal
// status by the time deleteUser() actually runs, so there's no in-progress
// campaign this could silently orphan.
//
// Still open, and NOT decided by this migration or this function (needs
// product/legal/accounting sign-off before launch, not an engineering
// call): how long these orphaned rows should be kept before any separate,
// scheduled purge, and whether free-text fields on a completed record
// (`requests.campaign_message`, `channel_requests.advertising_method`)
// need their own scrub for anything personally identifying the business
// typed into them — this fix only stops the row itself from being deleted,
// it doesn't touch that free text. A publisher's own `publishers` row
// remains the one other deliberate exception: `user_id` is
// `on delete set null` (schema_phase5.sql), so a creator's listing and its
// history survive deletion, just unclaimed afterward.
//
// The admin UI (e.g. the Requests/Payouts tabs) may still assume
// business_id always joins to a live profile — a null business_id now
// means "the business deleted their account since," and any screen
// displaying these records should be able to show that gracefully instead
// of a blank/broken name. Not fixed here (out of scope for this function);
// flagging so it isn't silently missed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ACTIVE_REQUEST_STATUSES = ["pending", "contacted", "confirmed"];
const ACTIVE_CHANNEL_REQUEST_STATUSES = ["pending", "awaiting_payment", "payment_submitted", "paid", "live"];
const ACTIVE_DISPUTE_STATUSES = ["open", "awaiting_response"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // The caller's own JWT identifies them — same pattern as notify/
    // send-otp. This function never accepts a target user id from the
    // request body; it only ever acts on whoever is actually logged in.
    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ error: "Not logged in" }, 401);

    const { data: publisherRows } = await authed.from("publishers").select("id").eq("user_id", user.id);
    const publisherId = publisherRows?.[0]?.id as string | undefined;

    const blockers: string[] = [];

    const { count: activeRequests } = await authed
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.id)
      .in("status", ACTIVE_REQUEST_STATUSES);
    if ((activeRequests ?? 0) > 0) blockers.push(`${activeRequests} in-progress campaign request${activeRequests === 1 ? "" : "s"}`);

    const { count: activePayments } = await authed
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.id)
      .eq("status", "pending");
    if ((activePayments ?? 0) > 0) blockers.push(`${activePayments} pending payment${activePayments === 1 ? "" : "s"}`);

    const { count: activeChannelAsBusiness } = await authed
      .from("channel_requests")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.id)
      .in("status", ACTIVE_CHANNEL_REQUEST_STATUSES);
    if ((activeChannelAsBusiness ?? 0) > 0) blockers.push(`${activeChannelAsBusiness} active channel campaign${activeChannelAsBusiness === 1 ? "" : "s"} (as the business)`);

    const { count: activeDisputesAsBusiness } = await authed
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.id)
      .in("status", ACTIVE_DISPUTE_STATUSES);
    if ((activeDisputesAsBusiness ?? 0) > 0) blockers.push(`${activeDisputesAsBusiness} open dispute${activeDisputesAsBusiness === 1 ? "" : "s"} (as the business)`);

    if (publisherId) {
      const { count: activeChannelAsCreator } = await authed
        .from("channel_requests")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", publisherId)
        .in("status", ACTIVE_CHANNEL_REQUEST_STATUSES);
      if ((activeChannelAsCreator ?? 0) > 0) blockers.push(`${activeChannelAsCreator} active channel campaign${activeChannelAsCreator === 1 ? "" : "s"} (as the creator)`);

      const { count: activeDisputesAsPublisher } = await authed
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("publisher_id", publisherId)
        .in("status", ACTIVE_DISPUTE_STATUSES);
      if ((activeDisputesAsPublisher ?? 0) > 0) blockers.push(`${activeDisputesAsPublisher} open dispute${activeDisputesAsPublisher === 1 ? "" : "s"} (as the creator)`);
    }

    if (blockers.length > 0) {
      return json({
        error: "Can't delete yet — you have unresolved activity that affects someone else.",
        blockers,
      }, 409);
    }

    // Clear to delete. Needs the service role — auth.admin.* is never
    // available to a user's own JWT, only to a trusted server context.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (err) {
    console.error("delete-account: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
