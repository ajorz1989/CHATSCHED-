// PayFast's Instant Transaction Notification (ITN) webhook. PayFast calls
// this server-to-server after a payment completes — it is NOT triggered by
// the browser, so this function must be deployed with --no-verify-jwt
// (see supabase/DEPLOY.md). This is the only place a payment that actually
// goes through PayFast is ever marked "paid" — the /payment/return page
// the browser lands on is purely informational and never marks anything
// paid itself. Launch credit no longer exists, so there is no longer any
// exception: every online payment is marked paid here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signItnFields, payfastHost } from "../_shared/payfast.ts";

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);
    const entries = Array.from(params.entries());
    const data = Object.fromEntries(entries);

    const mode = (Deno.env.get("PAYFAST_MODE") ?? "sandbox") as "sandbox" | "live";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || undefined;

    // 1. Signature check.
    const expectedSignature = signItnFields(entries, passphrase);
    if (expectedSignature !== data.signature) {
      console.error("payfast-notify: signature mismatch", { received: data.signature });
      return new Response("invalid signature", { status: 200 });
    }

    // 2. Ask PayFast directly whether they actually sent this — the
    // authoritative check, since a signature alone can't rule out a replay
    // of a previously-valid payload.
    const validateRes = await fetch(`https://${payfastHost(mode)}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const validateText = (await validateRes.text()).trim();
    if (validateText !== "VALID") {
      console.error("payfast-notify: PayFast validate returned", validateText);
      return new Response("not valid", { status: 200 });
    }

    // Service role: this function runs as a trusted server (PayFast isn't a
    // Supabase-authenticated user), so it's the one legitimate place in this
    // app that bypasses RLS.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // The former Content Studio R99/month product has been retired.
    // Legacy ITNs are acknowledged without activating or renewing the old product.
    if (data.custom_str1 === "content_studio_subscription") {
      console.warn("payfast-notify: retired content studio subscription ITN ignored", { payment_id: data.m_payment_id });
      return new Response("deprecated product", { status: 200 });
    }
    if (data.custom_str1 === "publisher_subscription") {
      return handlePublisherSubscriptionItn(admin, data);
    }
    // The old once-off R399 / R199 "Pay Now" activation buttons are retired
    // (free sign-up, Oct 2026). Acknowledge any stray ITN without activating.
    if (data.custom_str1 === "business_activation_paynow" || data.custom_str1 === "publisher_activation_paynow") {
      console.warn("payfast-notify: retired Pay Now activation ITN ignored", { payment_id: data.m_payment_id });
      return new Response("deprecated product", { status: 200 });
    }
    if (data.custom_str1 === "business_subscription") {
      return handleBusinessSubscriptionItn(admin, data);
    }
    if (data.custom_str1 === "featured_placement_subscription") {
      return handleFeaturedPlacementSubscriptionItn(admin, data);
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("*")
      .eq("id", data.m_payment_id)
      .single();
    if (paymentError || !payment) {
      console.error("payfast-notify: unknown m_payment_id", data.m_payment_id);
      return new Response("unknown payment", { status: 200 });
    }

    // 3. Never trust the ITN's amount on its own — compare it to what we
    // actually charged for. A mismatch means something is wrong and the
    // payment should NOT be marked paid, even though the signature and the
    // PayFast validate check both passed.
    //
    // "What we actually charged for" is payment.amount MINUS
    // credit_applied, not the full campaign amount — payfast-checkout only
    // ever sends PayFast the post-credit amountDue (item 11,
    // schema_phase88). Before this fix this line compared against the
    // full payment.amount, which meant ANY payment that used launch
    // credit for a partial (not full) discount would always fail this
    // check and could never actually be marked paid — a real, separate
    // bug found while implementing item 11, not something that bug
    // predates: the reserve/confirm/release redesign needed a correct
    // "expected" figure to confirm against, and this was already wrong
    // before that redesign touched anything else here.
    const received = Number.parseFloat(data.amount_gross ?? "0");
    const expected = Number(payment.amount);
    if (Math.abs(received - expected) > 0.01) {
      console.error("payfast-notify: amount mismatch", { received, expected, payment_id: payment.id });
      return new Response("amount mismatch", { status: 200 });
    }

    if (data.payment_status === "COMPLETE") {
      // Guarded with .neq("status", "paid") so a retried/duplicate ITN for
      // an already-paid payment matches zero rows and `updated` is null —
      // that's what stops the launch-credit confirmation below from ever
      // firing twice for the same payment.
      const { data: updated } = await admin
        .from("payments")
        .update({ status: "paid", payfast_payment_id: data.pf_payment_id ?? null, paid_at: new Date().toISOString() })
        .eq("id", payment.id)
        .neq("status", "paid")
        .select()
        .maybeSingle();

      void updated;
    } else if (data.payment_status === "FAILED" || data.payment_status === "CANCELLED") {
      await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("payfast-notify: unexpected error", err);
    // Still 200 — PayFast otherwise retries indefinitely for something that
    // may never succeed; real failures are visible in the function logs.
    return new Response("error logged", { status: 200 });
  }
});

// deno-lint-ignore no-explicit-any
async function handlePublisherSubscriptionItn(admin: any, data: Record<string, string>) {
  return handlePremiumItn(admin, data, "publisher_subscriptions");
}

// deno-lint-ignore no-explicit-any
async function handleBusinessSubscriptionItn(admin: any, data: Record<string, string>) {
  return handlePremiumItn(admin, data, "business_subscriptions");
}

// Premium access: R199/month, PayFast recurring, for businesses and creators.
// The two tables (business_subscriptions / publisher_subscriptions) are kept
// as the access records so every existing Opportunities / Marketing Suite
// gate (status = 'active') keeps working unchanged.
// Keep PREMIUM_MONTHLY_PRICE in sync with PREMIUM_ACCESS_PRICE in
// src/lib/constants.ts and the two *-subscribe functions.
const PREMIUM_MONTHLY_PRICE = 199.0;

// deno-lint-ignore no-explicit-any
async function handlePremiumItn(admin: any, data: Record<string, string>, table: "business_subscriptions" | "publisher_subscriptions") {
  const { data: subscription, error: subError } = await admin
    .from(table)
    .select("*")
    .eq("id", data.m_payment_id)
    .maybeSingle();
  if (subError || !subscription) {
    console.error("payfast-notify: unknown premium subscription", table, data.m_payment_id);
    return new Response("unknown subscription", { status: 200 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (data.payment_status === "COMPLETE") {
    const received = Number.parseFloat(data.amount_gross ?? "0");
    if (Math.abs(received - PREMIUM_MONTHLY_PRICE) > 0.01) {
      console.error("payfast-notify: premium amount mismatch", { received, subscription_id: subscription.id });
      return new Response("amount mismatch", { status: 200 });
    }
    // Runs for the first payment AND every monthly renewal ITN: access is
    // extended a month (plus a few days' slack) each time money lands.
    const periodEnd = new Date(now.getTime() + 33 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from(table)
      .update({
        status: "active",
        payfast_payment_id: data.pf_payment_id ?? null,
        payfast_token: data.token ?? subscription.payfast_token ?? null,
        paid_at: nowIso,
        current_period_end: periodEnd,
        updated_at: nowIso,
      })
      .eq("id", subscription.id);
  } else if (data.payment_status === "FAILED") {
    // A failed first payment never activated anything. A failed renewal is
    // retried by PayFast; access lapses via current_period_end if it never lands.
    if (subscription.status !== "active") {
      await admin.from(table).update({ status: "failed", updated_at: nowIso }).eq("id", subscription.id);
    } else {
      console.error("payfast-notify: premium renewal FAILED, PayFast will retry", subscription.id);
    }
  } else if (data.payment_status === "CANCELLED") {
    // The subscriber cancelled on the PayFast side: no more charges.
    await admin.from(table).update({ status: "cancelled", updated_at: nowIso }).eq("id", subscription.id);
  }

  return new Response("ok", { status: 200 });
}

// deno-lint-ignore no-explicit-any
async function handleFeaturedPlacementSubscriptionItn(admin: any, data: Record<string, string>) {
  const { data: subscription, error: subError } = await admin
    .from("featured_placement_subscriptions")
    .select("*")
    .eq("id", data.m_payment_id)
    .maybeSingle();
  if (subError || !subscription) {
    console.error("payfast-notify: unknown featured placement subscription", data.m_payment_id);
    return new Response("unknown subscription", { status: 200 });
  }

  // R99/month is fixed — same reasoning as every other branch in this file.
  const received = Number.parseFloat(data.amount_gross ?? "0");
  if (Math.abs(received - 99.0) > 0.01 && data.payment_status === "COMPLETE") {
    console.error("payfast-notify: featured placement amount mismatch", { received, subscription_id: subscription.id });
    return new Response("amount mismatch", { status: 200 });
  }

  if (data.payment_status === "COMPLETE") {
    // Same "push the period a month further from whichever is later"
    // logic used by the remaining recurring placement product — a late-arriving
    // webhook never shortens what was already paid for.
    const base = subscription.current_period_end && new Date(subscription.current_period_end) > new Date()
      ? new Date(subscription.current_period_end)
      : new Date();
    const nextPeriodEnd = new Date(base);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

    // The trg_sync_featured_placement_status trigger (schema_phase87)
    // reads this row's own current_period_end as soon as status flips to
    // 'active', so publishers.featured/featured_until update automatically
    // — nothing else in this function needs to touch the publishers table.
    await admin.from("featured_placement_subscriptions").update({
      status: "active",
      payfast_token: data.token ?? subscription.payfast_token,
      current_period_end: nextPeriodEnd.toISOString(),
      payfast_payment_id: data.pf_payment_id ?? subscription.payfast_payment_id,
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
  } else if (data.payment_status === "FAILED") {
    // No grace period for this product (see schema_phase87's own comment
    // on why) — a failed renewal drops straight to past_due, which the
    // sync trigger immediately reads as "un-feature this listing."
    await admin.from("featured_placement_subscriptions").update({
      status: subscription.status === "active" ? "past_due" : "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
  } else if (data.payment_status === "CANCELLED") {
    await admin.from("featured_placement_subscriptions").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
  }

  return new Response("ok", { status: 200 });
}
