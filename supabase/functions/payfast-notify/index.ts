// PayFast's Instant Transaction Notification (ITN) webhook. PayFast calls
// this server-to-server after a payment completes — it is NOT triggered by
// the browser, so this function must be deployed with --no-verify-jwt
// (see supabase/DEPLOY.md). This is the only place a payment that actually
// goes through PayFast is ever marked "paid" — the /payment/return page
// the browser lands on is purely informational and never marks anything
// paid itself. The one deliberate exception is payfast-checkout marking a
// payment paid directly when it's fully covered by launch credit, since
// there's no PayFast leg to notify about in that case.
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

    // AI Content Studio's recurring subscription is a separate table from
    // one-off campaign `payments` — routed here by the custom_str1 flag set
    // in content-studio-subscribe, checked before the payments lookup below
    // so the two flows never collide on m_payment_id.
    if (data.custom_str1 === "content_studio_subscription") {
      return handleContentStudioSubscriptionItn(admin, data);
    }
    if (data.custom_str1 === "publisher_subscription") {
      return handlePublisherSubscriptionItn(admin, data);
    }
    if (data.custom_str1 === "business_activation_paynow") {
      return handlePayNowActivationItn(admin, data, "business");
    }
    if (data.custom_str1 === "publisher_activation_paynow") {
      return handlePayNowActivationItn(admin, data, "publisher");
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
    const expected = Number(payment.amount) - Number(payment.credit_applied ?? 0);
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

      // The actual credit deduction already happened atomically at
      // checkout time (reserve_launch_credit_for_payment, item 11,
      // schema_phase88) — this just closes out that reservation as
      // confirmed. No balance math here anymore; see that function's own
      // comment for why the deduction couldn't wait until this point for
      // every case (the fully-covered checkout path has no later
      // confirmation step to defer to).
      if (updated && Number(payment.credit_applied) > 0) {
        await admin.rpc("confirm_launch_credit_redemption", { p_payment_id: payment.id });
      }
    } else if (data.payment_status === "FAILED" || data.payment_status === "CANCELLED") {
      await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      // Give back whatever credit this payment had reserved — it never
      // completed, so the credit shouldn't be spent. release_launch_credit_redemption
      // is a no-op if nothing was reserved (amount 0, or already
      // confirmed/released), so this is safe to call unconditionally.
      await admin.rpc("release_launch_credit_redemption", { p_payment_id: payment.id });
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
async function handleContentStudioSubscriptionItn(admin: any, data: Record<string, string>) {
  const { data: subscription, error: subError } = await admin
    .from("content_studio_subscriptions")
    .select("*")
    .eq("id", data.m_payment_id)
    .maybeSingle();
  if (subError || !subscription) {
    console.error("payfast-notify: unknown content studio subscription", data.m_payment_id);
    return new Response("unknown subscription", { status: 200 });
  }

  // Same reasoning as the amount check above for one-off payments — never
  // trust the ITN amount blindly. R99/month is fixed, so any mismatch means
  // something's wrong (a tampered request, a stale price on an old link) and
  // this subscription should not be activated off the back of it.
  const received = Number.parseFloat(data.amount_gross ?? "0");
  if (Math.abs(received - 99.0) > 0.01 && data.payment_status === "COMPLETE") {
    console.error("payfast-notify: content studio amount mismatch", { received, subscription_id: subscription.id });
    return new Response("amount mismatch", { status: 200 });
  }

  if (data.payment_status === "COMPLETE") {
    // Each successful ITN (first payment or a monthly recurring charge)
    // pushes the period a month further out from whichever is later — the
    // stored period end or now — so a late-arriving webhook never shortens
    // what was already paid for.
    const base = subscription.current_period_end && new Date(subscription.current_period_end) > new Date()
      ? new Date(subscription.current_period_end)
      : new Date();
    const nextPeriodEnd = new Date(base);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

    await admin.from("content_studio_subscriptions").update({
      status: "active",
      payfast_token: data.token ?? subscription.payfast_token,
      current_period_end: nextPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
  } else if (data.payment_status === "FAILED") {
    await admin.from("content_studio_subscriptions").update({
      status: subscription.status === "active" ? "past_due" : "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
  } else if (data.payment_status === "CANCELLED") {
    await admin.from("content_studio_subscriptions").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
  }

  return new Response("ok", { status: 200 });
}

// deno-lint-ignore no-explicit-any
async function handlePublisherSubscriptionItn(admin: any, data: Record<string, string>) {
  const { data: subscription, error: subError } = await admin
    .from("publisher_subscriptions")
    .select("*")
    .eq("id", data.m_payment_id)
    .maybeSingle();
  if (subError || !subscription) {
    console.error("payfast-notify: unknown publisher subscription", data.m_payment_id);
    return new Response("unknown subscription", { status: 200 });
  }

  // R199 once-off is fixed — same reasoning as the branches above.
  const received = Number.parseFloat(data.amount_gross ?? "0");
  if (Math.abs(received - 199.0) > 0.01 && data.payment_status === "COMPLETE") {
    console.error("payfast-notify: publisher activation amount mismatch", { received, subscription_id: subscription.id });
    return new Response("amount mismatch", { status: 200 });
  }

  if (data.payment_status === "COMPLETE") {
    // No renewal, ever (item 10) — once this lands the membership is
    // permanent. Guarded with .neq("status", "active") for the same
    // reason payments.status is guarded elsewhere: a retried/duplicate
    // ITN for an already-active membership should be a clean no-op, not
    // re-set fields that are already correct.
    await admin.from("publisher_subscriptions")
      .update({
        status: "active",
        payfast_payment_id: data.pf_payment_id ?? null,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .neq("status", "active");
  } else if (data.payment_status === "FAILED") {
    // Can retry any time by starting the activation flow again
    // (publisher-subscribe resets an existing non-active row back to
    // 'pending') — there's no grace period or forfeiture to consider for
    // a payment that never activated anything in the first place.
    await admin.from("publisher_subscriptions").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", subscription.id);
  } else if (data.payment_status === "CANCELLED") {
    // Not an expected event for a once-off payment (there's no recurring
    // token for PayFast to report cancelling) — logged rather than acted
    // on, since guessing at an unexpected transition here risks doing the
    // wrong thing to a real membership record.
    console.error("payfast-notify: unexpected CANCELLED for a once-off publisher activation", subscription.id);
  }

  return new Response("ok", { status: 200 });
}

// deno-lint-ignore no-explicit-any
async function handleBusinessSubscriptionItn(admin: any, data: Record<string, string>) {
  const { data: subscription, error: subError } = await admin
    .from("business_subscriptions")
    .select("*")
    .eq("id", data.m_payment_id)
    .maybeSingle();
  if (subError || !subscription) {
    console.error("payfast-notify: unknown business subscription", data.m_payment_id);
    return new Response("unknown subscription", { status: 200 });
  }

  // R399 once-off is fixed — same reasoning as the branches above.
  const received = Number.parseFloat(data.amount_gross ?? "0");
  if (Math.abs(received - 399.0) > 0.01 && data.payment_status === "COMPLETE") {
    console.error("payfast-notify: business activation amount mismatch", { received, subscription_id: subscription.id });
    return new Response("amount mismatch", { status: 200 });
  }

  if (data.payment_status === "COMPLETE") {
    await admin.from("business_subscriptions")
      .update({
        status: "active",
        payfast_payment_id: data.pf_payment_id ?? null,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .neq("status", "active");

    // Launch credit: a one-time grant, included in the R399 activation
    // fee. "First-ever completed payment" and "the only payment" are now
    // the same event under the once-off model, so this atomic
    // check-and-set (unchanged from before item 10) still does exactly
    // the right thing — a retried/duplicate ITN for that same payment
    // still can't grant it twice.
    if (!subscription.launch_credit_granted) {
      const { data: wonRace } = await admin
        .from("business_subscriptions")
        .update({ launch_credit_granted: true })
        .eq("id", subscription.id)
        .eq("launch_credit_granted", false)
        .select()
        .maybeSingle();

      if (wonRace) {
        await admin.from("business_launch_credits").insert({
          business_id: subscription.business_id,
          subscription_id: subscription.id,
          amount: 199.0,
          remaining: 199.0,
        });
      }
    }
  } else if (data.payment_status === "FAILED") {
    // Can retry any time by starting the activation flow again — a
    // failed activation payment never granted the launch credit in the
    // first place (that only happens on COMPLETE, above), so there's
    // nothing to forfeit here.
    await admin.from("business_subscriptions").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", subscription.id);
  } else if (data.payment_status === "CANCELLED") {
    // Not an expected event for a once-off payment — see the identical
    // comment in handlePublisherSubscriptionItn above.
    console.error("payfast-notify: unexpected CANCELLED for a once-off business activation", subscription.id);
  }

  return new Response("ok", { status: 200 });
}

// deno-lint-ignore no-explicit-any

// Primary Pay Now buttons use the merchant receiver directly instead of the
// server-generated signed checkout. They carry the authenticated account ID
// in custom_str2 so a confirmed PayFast payment can still be matched to the
// correct ChatSched membership. The custom fields are treated as routing
// hints only: the PayFast ITN signature + PayFast validation happen above,
// the amount/item are checked again here, and the target profile role must
// match the activation being purchased.
//
// deno-lint-ignore no-explicit-any
async function handlePayNowActivationItn(admin: any, data: Record<string, string>, activationType: "business" | "publisher") {
  const expectedAmount = activationType === "business" ? 399.0 : 199.0;
  const expectedItem = activationType === "business"
    ? "ChatSched Business Activation"
    : "ChatSched Publisher Network Activation";
  const paymentStatus = (data.payment_status ?? "").toUpperCase();
  const pfPaymentId = (data.pf_payment_id ?? "").trim() || null;
  const mPaymentId = (data.m_payment_id ?? "").trim() || null;
  const receivedAmount = Number.parseFloat(data.amount_gross ?? "0");
  const payerEmail = (data.email_address ?? "").trim() || null;
  const payerName = [data.name_first, data.name_last].filter(Boolean).join(" ").trim() || null;

  const existingQuery = pfPaymentId
    ? admin.from("payfast_activation_events").select("id").eq("pf_payment_id", pfPaymentId).maybeSingle()
    : mPaymentId
    ? admin.from("payfast_activation_events").select("id").eq("m_payment_id", mPaymentId).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const { data: existingEvent } = await existingQuery;
  if (existingEvent) return new Response("ok", { status: 200 });

  let matchedUserId: string | null = null;
  let matchStatus: "auto_activated" | "already_active" | "action_required" | "failed" | "cancelled" | "ignored" =
    paymentStatus === "COMPLETE"
      ? "action_required"
      : paymentStatus === "FAILED"
      ? "failed"
      : paymentStatus === "CANCELLED"
      ? "cancelled"
      : "ignored";
  let note: string | null = null;

  if (paymentStatus === "COMPLETE") {
    if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
      note = \`Amount mismatch: PayFast reported R\${receivedAmount.toFixed(2)}, expected R\${expectedAmount.toFixed(2)}.\`;
    } else if ((data.item_name ?? "").trim() !== expectedItem) {
      note = \`Item mismatch: PayFast reported "\${data.item_name ?? "missing item name"}".\`;
    } else {
      const candidateUserId = (data.custom_str2 ?? "").trim();

      if (!candidateUserId) {
        note = "No ChatSched account identifier was returned by the Pay Now button.";
      } else {
        const { data: targetProfile, error: profileError } = await admin
          .from("profiles")
          .select("id, role")
          .eq("id", candidateUserId)
          .maybeSingle();

        if (profileError || !targetProfile) {
          note = "The Pay Now payment could not be matched to a ChatSched profile.";
        } else if (targetProfile.role !== activationType) {
          note = \`The payment target account has role "\${targetProfile.role}", not "\${activationType}".\`;
        } else if (!payerEmail) {
          note = "PayFast did not return a payer email, so automatic activation was blocked.";
        } else {
          const { data: authUser } = await admin.auth.admin.getUserById(targetProfile.id);
          const accountEmail = (authUser?.user?.email ?? "").toLowerCase().trim();

          if (!accountEmail || accountEmail !== payerEmail.toLowerCase()) {
            note = "PayFast payer email does not match the ChatSched account email, so automatic activation was blocked.";
          } else {
            matchedUserId = targetProfile.id;
            const paidAt = new Date().toISOString();

            if (activationType === "business") {
              const { data: subscription, error: subscriptionError } = await admin
                .from("business_subscriptions")
                .select("*")
                .eq("business_id", targetProfile.id)
                .maybeSingle();

              if (subscriptionError) {
                note = "Could not read the business activation record.";
              } else if (subscription?.status === "active") {
                matchStatus = "already_active";
              } else {
                let subscriptionId = subscription?.id ?? null;

                if (subscriptionId) {
                  const { error: updateError } = await admin
                    .from("business_subscriptions")
                    .update({
                      status: "active",
                      payfast_payment_id: pfPaymentId,
                      paid_at: paidAt,
                      updated_at: paidAt,
                    })
                    .eq("id", subscriptionId);
                  if (updateError) note = "Payment was confirmed, but the business activation record could not be updated.";
                } else {
                  const { data: created, error: createError } = await admin
                    .from("business_subscriptions")
                    .insert({
                      business_id: targetProfile.id,
                      status: "active",
                      payfast_payment_id: pfPaymentId,
                      paid_at: paidAt,
                      updated_at: paidAt,
                    })
                    .select("id")
                    .single();

                  if (createError || !created) {
                    note = "Payment was confirmed, but the business activation record could not be created.";
                  } else {
                    subscriptionId = created.id;
                  }
                }

                if (!note && subscriptionId) {
                  const { data: creditRace } = await admin
                    .from("business_subscriptions")
                    .update({ launch_credit_granted: true, updated_at: paidAt })
                    .eq("id", subscriptionId)
                    .eq("launch_credit_granted", false)
                    .select("id")
                    .maybeSingle();

                  if (creditRace) {
                    const { error: creditError } = await admin.from("business_launch_credits").insert({
                      business_id: targetProfile.id,
                      subscription_id: subscriptionId,
                      amount: 199.0,
                      remaining: 199.0,
                    });
                    if (creditError) console.error("payfast-notify: launch credit insert failed", creditError);
                  }

                  matchStatus = "auto_activated";
                }
              }
            } else {
              const { data: subscription, error: subscriptionError } = await admin
                .from("publisher_subscriptions")
                .select("*")
                .eq("publisher_id", targetProfile.id)
                .maybeSingle();

              if (subscriptionError) {
                note = "Could not read the Publisher Network activation record.";
              } else if (subscription?.status === "active") {
                matchStatus = "already_active";
              } else if (subscription) {
                const { error: updateError } = await admin
                  .from("publisher_subscriptions")
                  .update({
                    status: "active",
                    payfast_payment_id: pfPaymentId,
                    paid_at: paidAt,
                    updated_at: paidAt,
                  })
                  .eq("id", subscription.id);

                if (updateError) {
                  note = "Payment was confirmed, but the Publisher Network activation record could not be updated.";
                } else {
                  matchStatus = "auto_activated";
                }
              } else {
                const { data: created, error: createError } = await admin
                  .from("publisher_subscriptions")
                  .insert({
                    publisher_id: targetProfile.id,
                    status: "active",
                    payfast_payment_id: pfPaymentId,
                    paid_at: paidAt,
                    updated_at: paidAt,
                  })
                  .select("id")
                  .single();

                if (createError || !created) {
                  note = "Payment was confirmed, but the Publisher Network activation record could not be created.";
                } else {
                  matchStatus = "auto_activated";
                }
              }
            }
          }
        }
      }
    }
  }

  const { error: insertError } = await admin.from("payfast_activation_events").insert({
    pf_payment_id: pfPaymentId,
    m_payment_id: mPaymentId,
    activation_type: activationType,
    amount: Number.isFinite(receivedAmount) ? receivedAmount : 0,
    payer_email: payerEmail,
    payer_name: payerName,
    payment_status: paymentStatus || "UNKNOWN",
    matched_user_id: matchedUserId,
    match_status: matchStatus,
    note,
    processed_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("payfast-notify: could not log Pay Now activation event", insertError);
  }

  return new Response("ok", { status: 200 });
}

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
    // logic as handleContentStudioSubscriptionItn — a late-arriving
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
