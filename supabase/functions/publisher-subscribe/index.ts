// Starts ChatSched Premium access: R199/month, PayFast recurring billing,
// for both businesses and creators. Unlocks the Opportunities job board and
// the Marketing Suite. Sign-up and booking are free. payfast-notify marks the
// subscription active on the first payment and pushes current_period_end a
// month further on every renewal (schema_phase115).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { signCheckoutFields, payfastHost } from "../_shared/payfast.ts";

// Keep in sync with PREMIUM_ACCESS_PRICE in src/lib/constants.ts and PREMIUM_MONTHLY_PRICE in payfast-notify.
const PREMIUM_PRICE = 199.0;

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
    if (!profile || profile.role !== "publisher") return json({ error: "Only publisher accounts can buy Premium access here" }, 403);

    const { data: existing } = await supabase
      .from("publisher_subscriptions")
      .select("*")
      .eq("publisher_id", user.id)
      .maybeSingle();

    const stillPaidUp = existing?.status === "active" &&
      (!existing.current_period_end || new Date(existing.current_period_end).getTime() > Date.now());
    if (stillPaidUp) {
      return json({ error: "You already have Premium access" }, 400);
    }

    // service role — this function creates/updates the subscription row
    // itself (a publisher can only ever SELECT it, per schema_phase55's
    // RLS), same reasoning as content-studio-subscribe.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let subscriptionId: string;
    if (existing) {
      subscriptionId = existing.id;
      await admin.from("publisher_subscriptions").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      const { data: created, error: createError } = await admin
        .from("publisher_subscriptions")
        .insert({ publisher_id: user.id, status: "pending" })
        .select()
        .single();
      if (createError || !created) return json({ error: "Could not start Premium access" }, 500);
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
      amount: PREMIUM_PRICE.toFixed(2),
      item_name: "ChatSched Premium access (monthly)",
      item_description: "Monthly Premium access: the Opportunities job board and the Marketing Suite. Cancel any time on PayFast.",
      custom_str1: "publisher_subscription",
      subscription_type: "1",
      billing_date: new Date().toISOString().slice(0, 10),
      recurring_amount: PREMIUM_PRICE.toFixed(2),
      frequency: "3", // PayFast: 3 = monthly
      cycles: "0", // 0 = until cancelled
    };

    const signature = signCheckoutFields(fields, passphrase);

    return json({
      action_url: `https://${payfastHost(mode)}/eng/process`,
      fields: { ...fields, signature },
    });
  } catch (err) {
    console.error("publisher-subscribe: unexpected error", err);
    return json({ error: "Unexpected error starting Premium access" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
