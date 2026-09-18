// Starts a R399 ONCE-OFF PayFast payment for ChatSched Business
// activation — no renewal, ever (item 10, schema_phase86). The R199
// launch credit is INCLUDED in this fee, not a separate purchase; it's
// still granted by payfast-notify on this payment's COMPLETE, same
// mechanism as before ("first-ever completed payment" and "the only
// payment" are now the same event, so nothing about the credit-granting
// logic itself needed to change). Used to be a R199/month recurring
// subscription; the recurring-specific PayFast fields (subscription_type/
// billing_date/recurring_amount/frequency/cycles) are gone, this is now
// the same shape as a plain payfast-checkout payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { signCheckoutFields, payfastHost } from "../_shared/payfast.ts";

// Keep in sync with BUSINESS_SUBSCRIPTION_PRICE in src/lib/constants.ts —
// Deno edge functions can't import from the Vite app, so this is the one
// other place that number lives.
const ACTIVATION_PRICE = 399.0;

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

    const { data: profile } = await supabase.from("profiles").select("role, full_name, company_name").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "business") return json({ error: "Only business accounts can activate ChatSched Business" }, 403);

    const { data: existing } = await supabase
      .from("business_subscriptions")
      .select("*")
      .eq("business_id", user.id)
      .maybeSingle();

    if (existing?.status === "active") {
      return json({ error: "You're already activated on ChatSched Business" }, 400);
    }

    // service role — this function creates/updates the subscription row
    // itself (a business can only ever SELECT it, per schema_phase55's
    // RLS), same reasoning as content-studio-subscribe.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let subscriptionId: string;
    if (existing) {
      subscriptionId = existing.id;
      await admin.from("business_subscriptions").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      const { data: created, error: createError } = await admin
        .from("business_subscriptions")
        .insert({ business_id: user.id, status: "pending" })
        .select()
        .single();
      if (createError || !created) return json({ error: "Could not start activation" }, 500);
      subscriptionId = created.id;
    }

    const mode = (Deno.env.get("PAYFAST_MODE") ?? "sandbox") as "sandbox" | "live";
    const siteUrl = Deno.env.get("SITE_URL")!;
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID")!;
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY")!;
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || undefined;

    const fullName = profile.company_name || profile.full_name || "Business Owner";
    const [nameFirst, ...rest] = fullName.split(" ");
    const nameLast = rest.join(" ") || "-";

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
      amount: ACTIVATION_PRICE.toFixed(2),
      item_name: "ChatSched Business activation",
      item_description: "One-time ChatSched Business activation — marketplace access, managed advertising, campaign tools and reporting. Includes a R199 launch credit. No renewal, ever.",
      custom_str1: "business_subscription",
    };

    const signature = signCheckoutFields(fields, passphrase);

    return json({
      action_url: `https://${payfastHost(mode)}/eng/process`,
      fields: { ...fields, signature },
    });
  } catch (err) {
    console.error("business-subscribe: unexpected error", err);
    return json({ error: "Unexpected error starting activation" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
