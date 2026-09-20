// The one write path left for the seven public lead-generation tables —
// contact_messages, advertise_inquiries, agency_leads, partner_applications
// (two different entry points: the /partners directory and /partners/apply),
// career_applications, work_with_us_applications, community_questions —
// after schema_phase82_public_form_rate_limiting.sql dropped their direct
// anon insert RLS policies. "claude to fix 2" item 16: client-side
// honeypots (src/hooks/useHoneypot.ts) aren't a security boundary, a bot
// can call the backend directly. Fix: there is no longer a direct backend
// to call — every one of these tables now requires the service role, which
// only this function has, and this function throttles before it writes.
//
// One generic handler + a config map, not eight near-identical Edge
// Functions — the alternative is eight files that each need someone to
// remember the same auth/IP-extraction/throttling boilerplate, which is
// exactly the kind of drift where one form gets fixed and the other seven
// don't. FORM_CONFIGS below is the only place that needs to change to add,
// remove, or adjust a field on any of these forms.
//
// What this does NOT change: the actual shape/columns of any of the seven
// tables, or their check constraints (enum values for category/product/
// partner_type/etc. are still enforced by Postgres, not duplicated here —
// an invalid enum value still fails, just via a caught DB error instead of
// a client-side <select> already constraining the choice).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkAndRecordSubmission, extractClientIp } from "../_shared/publicFormRateLimit.ts";

interface FieldSpec {
  required: boolean;
  // Character cap applied before hitting the DB — generous enough for
  // real use, tight enough to stop someone posting megabytes of text into
  // a lead-gen table. Free-text fields (message/notes/cover letter) get a
  // higher cap than short fields (name/email/url) via `long: true`.
  long?: boolean;
}

const SHORT_MAX = 300;
const LONG_MAX = 8000;

interface FormConfig {
  table: string;
  fields: Record<string, FieldSpec>;
  emailField?: string;
  // Thresholds are a first-pass judgment call, not a validated policy —
  // same "needs real review before launch" caveat as the retention
  // duration in schema_phase81. Generous enough that no real user should
  // ever notice them; tight enough to blunt a naive flood. Revisit with
  // real traffic/abuse data once this is live.
  perIpLimit: number;
  perIpWindowMinutes: number;
  perEmailLimit: number;
  perEmailWindowMinutes: number;
  // Turns validated, trimmed string fields into the actual row to insert.
  // Where a form has server-derived values (agency_lead's business_id,
  // forced stage/campaign_manager_id) those are added here, never taken
  // from the client — same "derive identity from the caller's own JWT,
  // never trust a client-supplied id" pattern send-otp and delete-account
  // already use.
  buildRow: (fields: Record<string, string>, ctx: { authedUserId: string | null }) => Record<string, unknown>;
}

const FORM_CONFIGS: Record<string, FormConfig> = {
  contact: {
    table: "contact_messages",
    fields: {
      name: { required: true },
      email: { required: true },
      message: { required: true, long: true },
    },
    emailField: "email",
    perIpLimit: 6, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f) => ({ name: f.name, email: f.email, message: f.message }),
  },
  advertise: {
    table: "advertise_inquiries",
    fields: {
      company_name: { required: true },
      contact_name: { required: true },
      email: { required: true },
      phone: { required: false },
      product: { required: true },
      budget_range: { required: false },
      message: { required: true, long: true },
    },
    emailField: "email",
    perIpLimit: 6, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f) => ({
      company_name: f.company_name, contact_name: f.contact_name, email: f.email,
      phone: f.phone || null, product: f.product, budget_range: f.budget_range || null, message: f.message,
    }),
  },
  // /partners directory page — Partners.tsx. `category` is the applicant's
  // industry (see schema_phase49_partner_types.sql's header for why this
  // is a separate axis from partner_apply's `partner_type`).
  partner_directory: {
    table: "partner_applications",
    fields: {
      company_name: { required: true },
      contact_name: { required: true },
      email: { required: true },
      phone: { required: false },
      category: { required: true },
      website: { required: false },
      message: { required: true, long: true },
    },
    emailField: "email",
    perIpLimit: 6, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f) => ({
      company_name: f.company_name, contact_name: f.contact_name, email: f.email,
      phone: f.phone || null, category: f.category, website: f.website || null, message: f.message,
    }),
  },
  // /partners/apply — PartnersApply.tsx. `partner_type` is the functional
  // role (agency/technology/media/community/referral), not the industry.
  partner_apply: {
    table: "partner_applications",
    fields: {
      company_name: { required: true },
      contact_name: { required: true },
      email: { required: true },
      phone: { required: false },
      partner_type: { required: true },
      website: { required: false },
      message: { required: true, long: true },
    },
    emailField: "email",
    perIpLimit: 6, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f) => ({
      company_name: f.company_name, contact_name: f.contact_name, email: f.email,
      phone: f.phone || null, partner_type: f.partner_type, website: f.website || null, message: f.message,
    }),
  },
  careers: {
    table: "career_applications",
    fields: {
      name: { required: true },
      email: { required: true },
      role: { required: true },
      career_id: { required: false },
      // cv_path/cv_filename point at a file already uploaded to the
      // career-cvs storage bucket by the time this is called (Careers.tsx
      // uploads first, then submits).
      cv_path: { required: true },
      cv_filename: { required: true },
      portfolio_url: { required: false },
      linkedin_url: { required: false },
      location: { required: true },
      cover_letter: { required: true, long: true },
    },
    emailField: "email",
    perIpLimit: 6, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f) => ({
      name: f.name, email: f.email, role: f.role, career_id: f.career_id || null,
      cv_path: f.cv_path, cv_filename: f.cv_filename,
      portfolio_url: f.portfolio_url || null, linkedin_url: f.linkedin_url || null,
      location: f.location, cover_letter: f.cover_letter,
    }),
  },
  work_with_us: {
    table: "work_with_us_applications",
    fields: {
      name: { required: true },
      email: { required: true },
      category: { required: true },
      location: { required: true },
      message: { required: true, long: true },
      portfolio_url: { required: false },
      linkedin_url: { required: false },
      // Same related-but-unfixed note as careers' cv_path above — this
      // points at the work-with-us-attachments storage bucket.
      attachment_path: { required: false },
      attachment_filename: { required: false },
    },
    emailField: "email",
    perIpLimit: 6, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f) => ({
      name: f.name, email: f.email, category: f.category, location: f.location, message: f.message,
      portfolio_url: f.portfolio_url || null, linkedin_url: f.linkedin_url || null,
      attachment_path: f.attachment_path || null, attachment_filename: f.attachment_filename || null,
    }),
  },
  community_qa: {
    table: "community_questions",
    fields: {
      category: { required: true },
      question: { required: true, long: true },
      asked_by_name: { required: false },
      asked_by_email: { required: false },
    },
    emailField: "asked_by_email",
    // Community questions are the one form here with no required email —
    // per-email throttling only kicks in when one's actually given
    // (checkAndRecordSubmission already handles an empty/absent email by
    // skipping that check), so this mostly leans on the per-IP limit.
    perIpLimit: 8, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f) => ({
      category: f.category, question: f.question,
      asked_by_name: f.asked_by_name || null, asked_by_email: f.asked_by_email || null,
    }),
  },
  // BuildMyCampaign.tsx — usable logged-out or logged-in (see business_id
  // handling below). Public per the "public agency leads" affected area
  // in the finding, and per schema_phase70's own header: "no read access,
  // no update, no delete... no spam protection beyond basic required
  // fields, which is a real, named gap" — this is that gap being closed.
  agency_lead: {
    table: "agency_leads",
    fields: {
      business_name: { required: true },
      contact_name: { required: false },
      contact_email: { required: true },
      contact_phone: { required: false },
      // The full generated campaign brief (strategy, budget, timing,
      // matched publishers, etc.) — built client-side from the wizard's
      // answers, same as it was as a direct insert. Long by a wide margin.
      notes: { required: true, long: true },
      estimated_value: { required: true },
      source: { required: false },
    },
    emailField: "contact_email",
    perIpLimit: 6, perIpWindowMinutes: 60,
    perEmailLimit: 3, perEmailWindowMinutes: 1440,
    buildRow: (f, ctx) => {
      const estimatedValue = Number(f.estimated_value);
      return {
        business_name: f.business_name,
        contact_name: f.contact_name || null,
        contact_email: f.contact_email,
        contact_phone: f.contact_phone || null,
        notes: f.notes,
        estimated_value: Number.isFinite(estimatedValue) ? estimatedValue : null,
        source: f.source || "campaign_builder_wizard",
        // Never taken from the client — same identity-derivation pattern
        // as delete-account/send-otp. Anonymous submitters get null,
        // exactly like the direct-insert version's `user?.id || null`.
        business_id: ctx.authedUserId,
        // Both forced, matching what agency_leads_public_insert's own
        // `with check` used to enforce before this migration dropped it —
        // this function is now the only thing enforcing it.
        stage: "new",
        campaign_manager_id: null,
      };
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => null)) as { form?: string; fields?: Record<string, unknown> } | null;
    if (!body || typeof body.form !== "string") return json({ error: "form is required" }, 400);

    const config = FORM_CONFIGS[body.form];
    if (!config) return json({ error: "Unknown form" }, 400);

    const rawFields = body.fields && typeof body.fields === "object" ? body.fields : {};

    // ── Validate + sanitize against the allowlist only ──────────────────
    // Anything in rawFields not listed in config.fields is silently
    // dropped, not passed through — this is what actually closes the
    // "client sets status/stage/admin_notes directly" hole the old
    // `with check (true)` policies technically left open (RLS row checks
    // don't restrict which columns an insert can set).
    const fields: Record<string, string> = {};
    for (const [key, spec] of Object.entries(config.fields)) {
      const raw = rawFields[key];
      const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
      if (spec.required && value === "") {
        return json({ error: `${key} is required` }, 400);
      }
      const max = spec.long ? LONG_MAX : SHORT_MAX;
      if (value.length > max) {
        return json({ error: `${key} is too long (max ${max} characters)` }, 400);
      }
      fields[key] = value;
    }

    // ── Optional caller identity (agency_lead only) ──────────────────────
    // Every other form is fully anonymous; this is the one that can be
    // submitted either logged-out or logged-in. Same as send-otp/
    // delete-account: derived from the caller's own JWT, not client input.
    let authedUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const authed = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await authed.auth.getUser();
        authedUserId = user?.id ?? null;
      } catch (err) {
        // An invalid/expired token on a public form just means "treat as
        // anonymous" — never a reason to reject an otherwise-valid
        // submission to a form nobody is required to be logged in for.
        console.warn("public-form-submit: auth header present but invalid, treating as anonymous", err);
      }
    }

    // ── Throttle ──────────────────────────────────────────────────────
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = extractClientIp(req);
    const email = config.emailField ? fields[config.emailField] : null;
    const rateLimit = await checkAndRecordSubmission(admin, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      form: body.form, ip, email, perIpLimit: config.perIpLimit, perIpWindowMinutes: config.perIpWindowMinutes,
      perEmailLimit: config.perEmailLimit, perEmailWindowMinutes: config.perEmailWindowMinutes,
    });
    if (!rateLimit.allowed) {
      return json({ error: rateLimit.reason ?? "Too many submissions. Please try again later." }, 429);
    }

    // ── Write ─────────────────────────────────────────────────────────
    const row = config.buildRow(fields, { authedUserId });
    const { data: inserted, error: insertError } = await admin
      .from(config.table)
      .insert(row)
      .select("id")
      .single();
    if (insertError) {
      console.error(`public-form-submit: insert into ${config.table} failed`, insertError);
      // Postgres check/not-null violations land here (e.g. an enum field
      // the client somehow sent an invalid value for) — a generic message
      // rather than the raw DB error, same reasoning as the rest of this
      // codebase's error-handling functions.
      return json({ error: "Could not submit — please check the form and try again." }, 400);
    }

    return json({ ok: true, id: inserted?.id });
  } catch (err) {
    console.error("public-form-submit: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
