// Centralized authorization and authentication validation logic for Supabase Edge Functions.
// Audited to ensure consistent, strict access control across all serverless endpoints.

export interface PermissionCheckResult {
  allowed: boolean;
  statusCode?: number;
  reason?: string;
}

/**
 * Extracts Bearer token or authorization string from request or headers.
 */
export function extractAuthHeader(
  input: Request | Headers | Record<string, string | null | undefined>
): string {
  if (!input) return "";
  if (typeof (input as Request).headers?.get === "function") {
    return (input as Request).headers.get("Authorization") ?? (input as Request).headers.get("authorization") ?? "";
  }
  if (typeof (input as Headers).get === "function") {
    return (input as Headers).get("Authorization") ?? (input as Headers).get("authorization") ?? "";
  }
  const obj = input as Record<string, string | null | undefined>;
  return obj["Authorization"] ?? obj["authorization"] ?? "";
}

/**
 * Checks whether a given user profile has the 'admin' role.
 */
export function checkIsAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/**
 * Database query helper to verify whether a user ID has the 'admin' role in public.profiles.
 */
// deno-lint-ignore no-explicit-any
export async function isUserAdmin(client: any, userId: string): Promise<boolean> {
  if (!client || !userId) return false;
  try {
    const { data, error } = await client
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return false;
    return checkIsAdminRole(data.role);
  } catch (err) {
    console.error("isUserAdmin: lookup failed", { userId, err });
    return false;
  }
}

/**
 * Validates admin-only access for a request.
 */
export function validateAdminAccess(
  user: { id: string } | null,
  profileRole: string | null | undefined
): PermissionCheckResult {
  if (!user || !user.id) {
    return { allowed: false, statusCode: 401, reason: "Not logged in" };
  }
  if (!checkIsAdminRole(profileRole)) {
    return { allowed: false, statusCode: 403, reason: "Admin only" };
  }
  return { allowed: true };
}

/**
 * Validates access to campaign compliance screening.
 * Allowed ONLY for the campaign's business owner OR an admin.
 */
export function validateCampaignScreenAccess(
  user: { id: string } | null,
  profileRole: string | null | undefined,
  campaignBusinessId: string
): PermissionCheckResult {
  if (!user || !user.id) {
    return { allowed: false, statusCode: 401, reason: "Not logged in" };
  }
  const isAdmin = checkIsAdminRole(profileRole);
  if (!isAdmin && user.id !== campaignBusinessId) {
    return {
      allowed: false,
      statusCode: 403,
      reason: "Only the campaign's business (or an admin) can run a compliance screening.",
    };
  }
  return { allowed: true };
}

/**
 * Validates authorization for the notify edge function events.
 * - status_change: strictly Admin only (prevents non-admins from spoofing status updates)
 * - new_request: anyone logged in who created the request (or admin)
 * - new_message: caller must be either the request's business or an admin
 */
export function validateNotifyAccess(
  kind: "new_request" | "new_message" | "status_change" | string,
  user: { id: string } | null,
  profileRole: string | null | undefined,
  requestBusinessId: string
): PermissionCheckResult & { senderIsAdmin: boolean } {
  if (!user || !user.id) {
    return { allowed: false, statusCode: 401, reason: "Not logged in", senderIsAdmin: false };
  }

  const isAdmin = checkIsAdminRole(profileRole);

  if (kind === "status_change") {
    if (!isAdmin) {
      return {
        allowed: false,
        statusCode: 403,
        reason: "Only admins can trigger status change notifications",
        senderIsAdmin: false,
      };
    }
    return { allowed: true, senderIsAdmin: true };
  }

  if (kind === "new_message") {
    const isBusiness = user.id === requestBusinessId;
    if (!isBusiness && !isAdmin) {
      return {
        allowed: false,
        statusCode: 403,
        reason: "Only the campaign business or an admin can send message notifications",
        senderIsAdmin: false,
      };
    }
    return { allowed: true, senderIsAdmin: isAdmin };
  }

  if (kind === "new_request") {
    return { allowed: true, senderIsAdmin: isAdmin };
  }

  return { allowed: false, statusCode: 400, reason: "Unknown notification kind", senderIsAdmin: false };
}

/**
 * Verifies cron secret header match.
 */
export function verifyCronSecret(
  providedSecret: string | null | undefined,
  expectedSecret: string | null | undefined
): boolean {
  if (!expectedSecret || !providedSecret) return false;
  return providedSecret === expectedSecret;
}
