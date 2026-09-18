// Sends a 6-digit phone verification code for either a business's profile
// or a publisher's listing. Real phone verification, replacing what is
// otherwise an admin-attested manual toggle (Admin.tsx's toggleBusinessFlag) —
// reasonable while every signup is reviewed by hand, but the Silver/Gold
// badges in businessVerification.ts, and a publisher's own trust_score,
// are only as meaningful as what backs them.
//
// Requires an SMS provider to actually deliver anything — SMS_PROVIDER_API_KEY
// below is intentionally provider-agnostic (fill in the fetch call for
// whichever SA SMS provider you pick; Clickatell, BulkSMS, and Twilio all
// work fine over a plain HTTP API). Until that's set, this still creates
// and stores a real, correctly-hashed code (so the verify side of this is
// fully real and testable), but returns `smsSent: false` rather than
// pretending a text went out — the frontend should tell the user that
// plainly instead of leaving them staring at a code that never arrives.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { target_table, target_id, phone } = (await req.json()) as {
      target_table: "profiles" | "publishers";
      target_id: string;
      phone: string;
    };
    if (!target_table || !target_id || !phone) return json({ error: "target_table, target_id, and phone are required" }, 400);
    if (target_table !== "profiles" && target_table !== "publishers") return json({ error: "Invalid target_table" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not logged in" }, 401);

    // Ownership check via the caller's own JWT — RLS on both tables only
    // lets this succeed if the row really is theirs (profiles: their own
    // id; publishers: publishers_select_approved_or_own_or_admin).
    if (target_table === "profiles") {
      if (target_id !== user.id) return json({ error: "You can only verify your own profile" }, 403);
    } else {
      const { data: pub, error: pubError } = await supabase.from("publishers").select("id, user_id").eq("id", target_id).single();
      if (pubError || !pub || pub.user_id !== user.id) return json({ error: "You can only verify your own listing" }, 403);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Simple cooldown: don't let someone (or a script) mash "send code"
    // and rack up SMS spend or spam a real phone number.
    const { data: recent } = await admin
      .from("phone_otp_requests")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("target_table", target_table)
      .eq("target_id", target_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
      return json({ error: `Please wait before requesting another code.` }, 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { data: inserted, error: insertError } = await admin
      .from("phone_otp_requests")
      .insert({ user_id: user.id, target_table, target_id, phone, code_hash: codeHash, expires_at: expiresAt })
      .select("id")
      .single();
    if (insertError || !inserted) {
      console.error("send-otp: insert failed", insertError);
      return json({ error: "Could not create verification request" }, 500);
    }

    const smsKey = Deno.env.get("SMS_PROVIDER_API_KEY");
    let smsSent = false;
    if (smsKey) {
      // Placeholder call — replace with your chosen SA SMS provider's real
      // endpoint, auth, and payload shape before relying on this.
      try {
        const res = await fetch(Deno.env.get("SMS_PROVIDER_API_URL") || "https://example-sms-provider.invalid/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${smsKey}` },
          body: JSON.stringify({ to: phone, message: `Your ChatSched verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.` }),
        });
        smsSent = res.ok;
        if (!res.ok) console.error("send-otp: SMS provider error", await res.text());
      } catch (err) {
        console.error("send-otp: SMS send failed", err);
      }
    } else {
      console.warn("send-otp: SMS_PROVIDER_API_KEY not set, code created but not sent");
    }

    return json({ request_id: inserted.id, smsSent, expiresAt });
  } catch (err) {
    console.error("send-otp: unexpected error", err);
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
