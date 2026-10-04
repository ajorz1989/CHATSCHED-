// Admin-only: onboard a business from the admin dashboard (Admin → Business
// Onboarding). Two actions:
//
//   create   — creates the login account + business profile, optionally
//              marks verification flags, optionally activates the
//              R399 once-off ChatSched Business membership, and returns a
//              one-time "set your password" link the admin can send.
//   activate — activates (or re-activates) an EXISTING business's
//              membership without a PayFast payment (EFT received, comped,
//              or onboarded by hand). Grants the R199 launch credit exactly
//              once, same guard payfast-notify uses.
//
// Revoking a membership is NOT done here — cancel-subscription already does
// that, so the UI calls it directly.
//
// Safety: the caller's own JWT must belong to an admin profile. The elevated
// service-role client is only used AFTER that check, never to decide it.
// Nothing here touches the public signup flow, PayFast, or any existing
// function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAdminAccess } from "../_shared/auth.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

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

    const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const access = validateAdminAccess(user, callerProfile?.role);
    if (!access.allowed) return json({ error: access.reason ?? "Admin only" }, access.statusCode ?? 403);

    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (body.action === "activate") {
      const businessId = str(body.business_id, 64);
      if (!businessId) return json({ error: "business_id is required" }, 400);
      const { data: biz } = await admin.from("profiles").select("id, role").eq("id", businessId).maybeSingle();
      if (!biz || biz.role !== "business") return json({ error: "Business not found" }, 404);
      const result = await activateMembership(admin, businessId);
      if (result.error) return json({ error: result.error }, 500);
      return json({ activated: true, launch_credit_granted: result.creditGranted });
    }

    if (body.action === "setup_link") {
      const businessId = str(body.business_id, 64);
      if (!businessId) return json({ error: "business_id is required" }, 400);
      const { data: biz } = await admin.from("profiles").select("id, role").eq("id", businessId).maybeSingle();
      if (!biz || biz.role !== "business") return json({ error: "Business not found" }, 404);
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(businessId);
      const targetEmail = authUser?.user?.email;
      if (authError || !targetEmail) return json({ error: "Could not find that account's email" }, 404);
      const siteUrl = Deno.env.get("SITE_URL")?.trim().replace(/\/+$/, "");
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail,
        options: siteUrl ? { redirectTo: `${siteUrl}/reset-password` } : undefined,
      });
      if (linkError || !link?.properties?.action_link) return json({ error: "Could not generate a setup link" }, 500);
      return json({ setup_link: link.properties.action_link, email: targetEmail });
    }

    if (body.action !== "create") return json({ error: "Unknown action" }, 400);

    const email = str(body.email, 254)?.toLowerCase() ?? "";
    const companyName = str(body.company_name, 160);
    const fullName = str(body.full_name, 120);
    if (!EMAIL_RE.test(email)) return json({ error: "A valid email address is required" }, 400);
    if (!companyName) return json({ error: "Business name is required" }, 400);
    if (!fullName) return json({ error: "Contact person's name is required" }, 400);

    const phone = str(body.phone, 40);
    const markEmailConfirmed = body.email_confirmed !== false;

    // Role is hard-coded: handle_new_user() (schema_phase81) already refuses
    // anything but business/publisher from metadata, and this function only
    // ever onboards businesses.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: markEmailConfirmed,
      user_metadata: { role: "business", full_name: fullName, company_name: companyName, phone },
    });
    if (createError || !created?.user) {
      const msg = createError?.message ?? "";
      if (/already|exists|registered/i.test(msg)) return json({ error: "An account with that email already exists" }, 409);
      console.error("admin-onboard-business: createUser failed", createError);
      return json({ error: "Could not create the account" }, 500);
    }
    const businessId = created.user.id;

    // handle_new_user() has already inserted the base profile row; fill in the
    // rest. Service-role context (auth.uid() is null) is allowed through the
    // verification-column guard trigger, same as the SQL-editor path.
    const profileUpdate: Record<string, unknown> = {
      province: str(body.province, 60),
      city: str(body.city, 100),
      industry: str(body.industry, 100),
      business_type: str(body.business_type, 100),
      website: str(body.website, 300),
      facebook_url: str(body.facebook_url, 300),
      instagram_url: str(body.instagram_url, 300),
      address_line1: str(body.address_line1, 200),
      address_line2: str(body.address_line2, 200),
      postal_code: str(body.postal_code, 20),
      vat_number: str(body.vat_number, 40),
      phone_verified: body.phone_verified === true,
      business_verified: body.business_verified === true,
    };
    for (const k of Object.keys(profileUpdate)) if (profileUpdate[k] === null) delete profileUpdate[k];

    const { error: profileError } = await admin.from("profiles").update(profileUpdate).eq("id", businessId);
    if (profileError) console.error("admin-onboard-business: profile update failed", profileError);

    let activated = false;
    let creditGranted = false;
    let activateError: string | null = null;
    if (body.activate === true) {
      const result = await activateMembership(admin, businessId);
      activated = !result.error;
      creditGranted = result.creditGranted;
      activateError = result.error ?? null;
    }

    // One-time "choose your password" link. Supabase doesn't email this for
    // admin-created users, so it's returned for the admin to send.
    let setupLink: string | null = null;
    const siteUrl = Deno.env.get("SITE_URL")?.trim().replace(/\/+$/, "");
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: siteUrl ? { redirectTo: `${siteUrl}/reset-password` } : undefined,
    });
    if (linkError) console.error("admin-onboard-business: generateLink failed", linkError);
    else setupLink = link?.properties?.action_link ?? null;

    return json({
      business_id: businessId,
      activated,
      launch_credit_granted: creditGranted,
      setup_link: setupLink,
      warnings: [
        profileError ? "Account created, but some profile details could not be saved — edit them from the Businesses tab." : null,
        activateError ? "Account created, but membership could not be activated — use Activate on the business row." : null,
        !setupLink ? "Account created, but the password setup link could not be generated — use Forgot password for that email." : null,
      ].filter(Boolean),
    });
  } catch (err) {
    console.error("admin-onboard-business: unexpected error", err);
    return json({ error: "Unexpected error onboarding business" }, 500);
  }
});

// Grants Premium access by hand (a comp, or payment received outside PayFast):
// status -> active with a period end a month out. Launch credit no longer exists.
// deno-lint-ignore no-explicit-any
async function activateMembership(admin: any, businessId: string): Promise<{ error?: string; creditGranted: boolean }> {
  const now = new Date();
  const nowIso = now.toISOString();
  const periodEnd = new Date(now.getTime() + 33 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await admin.from("business_subscriptions").select("id").eq("business_id", businessId).maybeSingle();
  if (existing) {
    const { error } = await admin.from("business_subscriptions").update({ status: "active", paid_at: nowIso, current_period_end: periodEnd, updated_at: nowIso }).eq("id", existing.id);
    if (error) return { error: "Could not grant Premium access", creditGranted: false };
  } else {
    const { error } = await admin.from("business_subscriptions").insert({ business_id: businessId, status: "active", paid_at: nowIso, current_period_end: periodEnd });
    if (error) return { error: "Could not grant Premium access", creditGranted: false };
  }
  return { creditGranted: false };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
