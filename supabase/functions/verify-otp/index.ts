// Verifies a code sent by send-otp, then flips the real phone_verified
// flag on the target row — the only place either phone_verified column
// gets set to true from something other than an admin's manual toggle.
//
// Uses the service role to write phone_verified: for profiles, that's
// deliberate and safe — trg_prevent_self_verification (schema_phase7.sql)
// only blocks the change when auth.uid() is not null, i.e. when a logged-in
// user tries to PATCH their own row directly; a service-role write has no
// auth.uid() and passes through, the same way payfast-notify already
// relies on for marking payments paid. For publishers, there's no
// self-serve UPDATE policy at all (only publishers_update_admin exists),
// so a service-role write is the only way this could ever work outside
// the admin panel — also deliberate, not a bypass of anything.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { request_id, code } = (await req.json()) as { request_id: string; code: string };
    if (!request_id || !code) return json({ error: "request_id and code are required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not logged in" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: otp, error: otpError } = await admin.from("phone_otp_requests").select("*").eq("id", request_id).single();
    if (otpError || !otp) return json({ error: "Verification request not found" }, 404);
    if (otp.user_id !== user.id) return json({ error: "Not your verification request" }, 403);
    if (otp.verified_at) return json({ error: "This code was already used" }, 400);
    if (new Date(otp.expires_at).getTime() < Date.now()) return json({ error: "Code expired — request a new one" }, 400);
    if (otp.attempts >= MAX_ATTEMPTS) return json({ error: "Too many attempts — request a new code" }, 429);

    const codeHash = await sha256(code.trim());
    if (codeHash !== otp.code_hash) {
      await admin.from("phone_otp_requests").update({ attempts: otp.attempts + 1 }).eq("id", request_id);
      return json({ error: "Incorrect code", attemptsRemaining: MAX_ATTEMPTS - (otp.attempts + 1) }, 400);
    }

    await admin.from("phone_otp_requests").update({ verified_at: new Date().toISOString() }).eq("id", request_id);

    const { error: targetError } = await admin.from(otp.target_table).update({ phone_verified: true }).eq("id", otp.target_id);
    if (targetError) {
      console.error("verify-otp: could not flip phone_verified", targetError);
      return json({ error: "Verified the code, but could not update the record — try again" }, 500);
    }

    // Best-effort audit trail entry — matches how admin actions log
    // themselves via log_admin_action, even though this path is a
    // self-service user action rather than an admin one. Awaited (not
    // fire-and-forget) since an Edge Function's execution can be torn
    // down as soon as it returns a response — an un-awaited promise
    // here isn't guaranteed to finish.
    try {
      await admin.from("admin_audit_log").insert({
        admin_id: null,
        action: "phone_verified_self_service",
        target_table: otp.target_table,
        target_id: otp.target_id,
        detail: { user_id: user.id },
      });
    } catch (auditErr) {
      console.warn("verify-otp: audit log write failed (non-fatal)", auditErr);
    }

    return json({ verified: true });
  } catch (err) {
    console.error("verify-otp: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
