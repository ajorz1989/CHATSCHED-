// Called by a logged-in business (via supabase.functions.invoke) to start
// paying for a confirmed campaign request. Returns a PayFast action_url and
// signed fields for the client to POST as a redirect — the signature is
// computed here, server-side, so the PayFast passphrase never reaches the
// browser bundle.
//
// Booking checkout is OFF by default (see the BOOKING_PAYFAST_ENABLED check
// below). Launch credit no longer exists, so the full amount is charged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { signCheckoutFields, payfastHost } from "../_shared/payfast.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Booking checkout is switched off while the first 50 completed bookings
  // are paid by manual bank transfer. Turn on with:
  //   supabase secrets set BOOKING_PAYFAST_ENABLED=true
  // Subscription checkouts use their own functions and are unaffected.
  if (Deno.env.get("BOOKING_PAYFAST_ENABLED") !== "true") {
    return json({ error: "Online booking payments are switched off. Pay by bank transfer using your Payment Card." }, 403);
  }

  try {
    const { request_id } = await req.json();
    if (!request_id) return json({ error: "request_id is required" }, 400);

    // Scoped to the calling user's own JWT — every query below runs under
    // their RLS policies, so this function can only ever act on their own
    // requests and payments, the same as if they'd queried Supabase directly.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Not logged in" }, 401);

    const { data: request, error: requestError } = await supabase
      .from("requests")
      .select("*, publisher:publishers(name)")
      .eq("id", request_id)
      .single();
    if (requestError || !request) return json({ error: "Request not found" }, 404);
    if (request.business_id !== user.id) return json({ error: "Not your request" }, 403);
    if (request.status !== "confirmed") return json({ error: "This request isn't confirmed yet" }, 400);
    if (!request.agreed_amount) return json({ error: "The platform hasn't set an amount for this yet — check back soon" }, 400);

    const { data: latest } = await supabase
      .from("payments")
      .select("*")
      .eq("request_id", request_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let payment = latest;
    if (payment?.status === "paid") {
      return json({ error: "This campaign is already paid" }, 400);
    }
    if (!payment || payment.status === "failed" || payment.status === "cancelled") {
      const { data: created, error: createError } = await supabase
        .from("payments")
        .insert({ request_id, business_id: user.id, amount: request.agreed_amount })
        .select()
        .single();
      if (createError || !created) return json({ error: "Could not start payment" }, 500);
      payment = created;
    }

    // Launch credit was removed (free sign-up, Oct 2026): the full amount is charged.
    const amountDue = Number(payment.amount);

    const mode = (Deno.env.get("PAYFAST_MODE") ?? "sandbox") as "sandbox" | "live";
    const siteUrl = Deno.env.get("SITE_URL")!;
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID")!;
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY")!;
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || undefined;

    const fullName = (user.user_metadata?.full_name as string | undefined) || "Business Owner";
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
      m_payment_id: payment.id,
      amount: amountDue.toFixed(2),
      item_name: `Campaign: ${request.publisher?.name ?? "ChatSched"}`.slice(0, 100),
      item_description: (request.campaign_message ?? "").slice(0, 255),
    };

    const signature = signCheckoutFields(fields, passphrase);

    return json({
      action_url: `https://${payfastHost(mode)}/eng/process`,
      fields: { ...fields, signature },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected error starting payment" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
