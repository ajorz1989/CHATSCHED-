import { supabase } from "./supabase";
import { formatSupabaseError } from "./supabaseErrors";

export interface PublicFormSubmitResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Submits one of the public lead-generation forms (contact, advertise,
 * partner applications — directory or apply, careers, work-with-us,
 * community Q&A, agency leads) through the public-form-submit Edge
 * Function, which is now the only write path for these tables — see
 * supabase/schema_phase82_public_form_rate_limiting.sql and
 * supabase/functions/public-form-submit/index.ts ("claude to fix 2" item
 * 16: public forms need server-side abuse controls). Replaces the
 * previous direct `supabase.from(table).insert(...)` calls, which no
 * longer work now that these tables' anon insert RLS policies are gone.
 *
 * `form` must be one of public-form-submit's FORM_CONFIGS keys — see that
 * file for the current list and each form's exact field names.
 *
 * Error handling routes through formatSupabaseError ("claude to fix 2"
 * item 17 — centralize user-facing error mapping, raw technical errors
 * only in Sentry/console): data?.error is already this function's own
 * curated, friendly message (missing field, too long, rate-limited) —
 * formatSupabaseError passes a plain string through as-is, so that text
 * reaches the user unchanged. error (a transport-level failure — network,
 * function not deployed, etc.) is a structured object with no guarantee
 * its raw .message is fit to show anyone, so it gets the same generic-
 * fallback-plus-Sentry-log treatment as every other Supabase/Edge
 * Function error in this codebase.
 */
export async function submitPublicForm(
  form: string,
  fields: Record<string, string | number | null | undefined>,
): Promise<PublicFormSubmitResult> {
  const { data, error } = await supabase.functions.invoke("public-form-submit", { body: { form, fields } });
  if (error || data?.error) {
    return { ok: false, error: formatSupabaseError(error || data?.error) };
  }
  return { ok: true, id: data?.id };
}
