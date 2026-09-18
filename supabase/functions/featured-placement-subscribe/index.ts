// Starts a R99/month PayFast recurring subscription for a publisher's
// Featured Placement — item 10's "Secondary placements: from R99/month",
// publisher side (schema_phase87_featured_placement_subscriptions.sql).
// Same shape as content-studio-subscribe (recurring PayFast fields,
// routed through payfast-notify's own subscription branch), reusing the
// pattern schema_phase86 just freed up from publisher_subscriptions /
// business_subscriptions when those became once-off.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { signCheckoutFields, payfastHost } from "../_shared/payfast.ts";

// Keep in sync with FEATURED_PLACEMENT_MONTHLY_PRICE in
// src/lib/constants.ts — Deno edge functions can't import from the Vite
// app, so this is the one other place that number lives.
const MONTHLY_PRICE = 99.0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Not logged in" }, 401);

    const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "publisher") return json({ error: "Only publisher accounts can buy Featured Placement" }, 403);

    const { data: publisher } = await supabase.from("publishers").select("id").eq("user_id", user.id).maybeSingle();
    if (!publisher) return json({ error: "No publisher listing found for this account" }, 404);

    const { data: existing } = await supabase
      .from("featured_placement_subscriptions")
      .select("*")
      .eq("publisher_id", publisher.id)
      .maybeSingle();

    if (existing?.status === "active") {
      return json({ error: "This listing is already Featured" }, 400);
    }

    // service role — this function creates/updates the subscription row
    // itself (a publisher can only ever SELECT it, per schema_phase87's
    // RLS), same reasoning as content-studio-subscribe.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let subscriptionId: string;
    if (existing) {
      subscriptionId = existing.id;
      await admin.from("featured_placement_subscriptions").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      const { data: created, error: createError } = await admin
        .from("featured_placement_subscriptions")
        .insert({ publisher_id: publisher.id, status: "pending" })
        .select()
        .single();
      if (createError || !created) return json({ error: "Could not start Featured Placement" }, 500);
      subscriptionId = created.id;
    }

    const mode = (Deno.env.get("PAYFAST_MODE") ?? "sandbox") as "sandbox" | "live";
    const siteUrl = Deno.env.get("SITE_URL")!;
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID")!;
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY")!;
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || undefined;

    const fullName = profile.full_name || "Publisher";
    const [nameFirst, ...rest] = fullName.split(" ");
    const nameLast = rest.join(" ") || "-";

    const today = new Date().toISOString().slice(0, 10);

    const fields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${siteUrl}/payment/return`,
      cancel_url: `${siteUrl}/payment/cancel`,
      notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payfast-notify`,
      name_first: nameFirst,
      name_last: nameLast,
      email_address: user.email ?? "",
      m_payment_id: subscriptionId,
      amount: MONTHLY_PRICE.toFixed(2),
      item_name: "ChatSched Featured Placement (monthly)",
      item_description: "Monthly Featured Placement — boosted ranking and a Featured badge on your marketplace listing.",
      custom_str1: "featured_placement_subscription",
      subscription_type: "1",
      billing_date: today,
      recurring_amount: MONTHLY_PRICE.toFixed(2),
      frequency: "3", // PayFast: 3 = monthly
      cycles: "0", // 0 = indefinite, until cancelled
    };

    const signature = signCheckoutFields(fields, passphrase);

    return json({
      action_url: `https://${payfastHost(mode)}/eng/process`,
      fields: { ...fields, signature },
    });
  } catch (err) {
    console.error("featured-placement-subscribe: unexpected error", err);
    return json({ error: "Unexpected error starting Featured Placement" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
