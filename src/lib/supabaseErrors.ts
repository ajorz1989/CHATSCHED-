import { reportError } from "./errorTracking";

export interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  statusCode?: string | number;
  name?: string;
  error_description?: string;
}

/**
 * Known PostgreSQL and PostgREST error codes mapped to clear, user-accessible descriptions.
 */
const KNOWN_POSTGRES_CODES: Record<string, string> = {
  "23505": "A record with this identifier already exists.",
  "42501": "Permission denied — you do not have permission to perform this action.",
  "23503": "The referenced item does not exist or was deleted.",
  "23502": "A required field was missing.",
  "22P02": "Invalid data format or value type.",
  "PGRST116": "Requested item was not found.",
  "PGRST301": "JWT expired or authentication token invalid.",
  "42P01": "Database relation does not exist.",
};

/**
 * Checks if an error is a unique constraint violation (PG code 23505).
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as SupabaseLikeError;
  return e.code === "23505";
}

/**
 * Checks if an error is an RLS or permission error (PG code 42501 or 403 status).
 */
export function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as SupabaseLikeError;
  return e.code === "42501" || e.status === 403 || e.statusCode === 403;
}

/**
 * Extracts error code from any error structure if available.
 */
export function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as SupabaseLikeError;
  if (e.code && typeof e.code === "string") return e.code;
  if (e.statusCode) return String(e.statusCode);
  if (e.status) return String(e.status);
  return null;
}

/**
 * Formats a Supabase, Postgres, Storage, or network error into a
 * user-facing message — a friendly, non-technical description only.
 * The raw error (message, code, details, stack) is always sent to
 * console/Sentry via reportError() below; it is deliberately never
 * included in the string this function returns. Postgres error details
 * in particular can contain column/table names and even raw row values
 * (e.g. "Key (user_id)=(123) is not present in table profiles.") — not
 * something to show a user, and not something to leak about the schema
 * either. "claude to fix 2" item 17: centralize user-facing error
 * mapping and keep raw technical errors in Sentry/console logs only —
 * this is the "keep raw technical errors [...] only [in logs]" half;
 * item 17's fix work is completing adoption of this function everywhere
 * that still used raw error.message.
 *
 * @param error The raw error caught or returned from Supabase
 * @param contextMessage Optional contextual action description (e.g. "Couldn't save request")
 * @returns A short, friendly string safe to show a user — never the raw error text.
 */
export function formatSupabaseError(error: unknown, contextMessage?: string): string {
  if (!error) {
    return contextMessage || "An unknown error occurred.";
  }

  // Report the *raw* error to error tracking/Sentry/console in the
  // background — this is the one place the original message, code,
  // details, and stack are allowed to go.
  reportError(error, { context: contextMessage });

  const GENERIC_FALLBACK = "Something went wrong. Please try again.";

  if (typeof error === "string") {
    // A plain string thrown/returned by application code (not a
    // structured Postgres/PostgREST error) — typically already a
    // reasonably-phrased message (e.g. "Network timeout") rather than
    // raw database internals, so this is passed through as-is rather
    // than replaced with the generic fallback.
    return contextMessage ? `${contextMessage}: ${error}` : error;
  }

  if (typeof error === "object") {
    const e = error as SupabaseLikeError;
    const code = extractErrorCode(e);
    const knownDesc = code ? KNOWN_POSTGRES_CODES[code] : null;
    const friendly = knownDesc || GENERIC_FALLBACK;
    return contextMessage ? `${contextMessage}: ${friendly}` : friendly;
  }

  return contextMessage ? `${contextMessage}: ${GENERIC_FALLBACK}` : GENERIC_FALLBACK;
}
