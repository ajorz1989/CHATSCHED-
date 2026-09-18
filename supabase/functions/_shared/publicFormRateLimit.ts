// Shared per-IP / per-email / per-route throttling for public,
// unauthenticated form writes — contact, advertise, partner applications,
// careers, work-with-us, community Q&A, agency leads. Used only by
// public-form-submit/index.ts; kept separate so the thresholds and the
// HTTP handler aren't tangled together. "claude to fix 2" item 16.
//
// Two-step check-then-insert against public.public_form_submissions
// (schema_phase82_public_form_rate_limiting.sql), not a single atomic SQL
// function — the same level of race-safety already accepted elsewhere in
// this codebase (send-otp's resend cooldown works the same way: a select,
// then an insert, no transaction tying them together). Two requests from
// the same IP arriving within milliseconds of each other could both slip
// through under the limit. That's a real, acknowledged gap, but it's a
// gap in a form-abuse throttle, not a financial or auth boundary — an
// acceptable trade for not introducing a new SECURITY DEFINER SQL
// function that hasn't been run against a real database (same "couldn't
// verify against a live instance" caveat as everything else in this
// sandbox pass).

// deno-lint-ignore no-explicit-any
type SupabaseAdminClient = any;

export interface RateLimitConfig {
  form: string;
  ip: string;
  email?: string | null;
  perIpLimit: number;
  perIpWindowMinutes: number;
  // Only enforced when `email` is provided/non-empty.
  perEmailLimit: number;
  perEmailWindowMinutes: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
}

export async function checkAndRecordSubmission(
  admin: SupabaseAdminClient,
  hmacSecret: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const ipHash = await hmacSha256(hmacSecret, `ip:${config.ip}`);
  const trimmedEmail = config.email?.trim().toLowerCase();
  const emailHash = trimmedEmail ? await hmacSha256(hmacSecret, `email:${trimmedEmail}`) : null;

  const ipWindowStart = new Date(Date.now() - config.perIpWindowMinutes * 60 * 1000).toISOString();
  const { count: ipCount, error: ipError } = await admin
    .from("public_form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form", config.form)
    .eq("ip_hash", ipHash)
    .gte("created_at", ipWindowStart);
  if (ipError) {
    // Fail open on a lookup error rather than blocking every legitimate
    // submitter because of a transient DB hiccup — this is a throttle,
    // not an auth check. Logged so a persistent failure (e.g. this
    // migration wasn't applied) is still visible somewhere.
    console.error("checkAndRecordSubmission: IP count query failed", ipError);
  } else if ((ipCount ?? 0) >= config.perIpLimit) {
    return {
      allowed: false,
      retryAfterSeconds: config.perIpWindowMinutes * 60,
      reason: "Too many submissions from this network. Please try again later.",
    };
  }

  if (emailHash) {
    const emailWindowStart = new Date(Date.now() - config.perEmailWindowMinutes * 60 * 1000).toISOString();
    const { count: emailCount, error: emailError } = await admin
      .from("public_form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("form", config.form)
      .eq("email_hash", emailHash)
      .gte("created_at", emailWindowStart);
    if (emailError) {
      console.error("checkAndRecordSubmission: email count query failed", emailError);
    } else if ((emailCount ?? 0) >= config.perEmailLimit) {
      return {
        allowed: false,
        retryAfterSeconds: config.perEmailWindowMinutes * 60,
        reason: "Too many submissions from this email address. Please try again later.",
      };
    }
  }

  const { error: insertError } = await admin
    .from("public_form_submissions")
    .insert({ form: config.form, ip_hash: ipHash, email_hash: emailHash });
  if (insertError) {
    // Same "don't block a real submitter over ledger trouble" reasoning
    // as above — this only means the *next* request won't see this one
    // counted.
    console.error("checkAndRecordSubmission: ledger insert failed", insertError);
  }

  return { allowed: true };
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Deno Deploy (what Supabase Edge Functions run on) sets x-forwarded-for
// on every request; x-real-ip is a fallback some proxies set instead.
// No known deployment topology for this repo puts anything else in front
// (no CF-Connecting-IP handling elsewhere in the codebase), so those two
// are all this checks.
export function extractClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // No IP header present — every caller missing one shares a single
  // "unknown" bucket, which is strictly worse than real per-IP throttling
  // but still better than no throttling at all. Logged so this isn't a
  // silent gap if it turns out to happen in practice.
  console.warn("extractClientIp: no x-forwarded-for/x-real-ip header present, falling back to a shared bucket");
  return "unknown";
}
