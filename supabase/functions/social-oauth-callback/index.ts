// GET /social-oauth-callback?code=...&state=...
// This IS the redirect_uri every provider sends the browser back to —
// verify_jwt stays OFF here too, same reason as social-oauth-start: no
// Supabase session header exists at this point, only the signed `state`
// this app generated for itself a moment ago.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PROVIDERS, isSupportedPlatform } from "../_shared/socialProviders.ts";
import { verifyState } from "../_shared/oauthState.ts";
import { encryptToken } from "../_shared/tokenCrypto.ts";

const SITE_URL = Deno.env.get("SITE_URL") || "";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (providerError) return redirectToDashboard({ status: "error", message: providerError });
  if (!code || !stateToken) return redirectToDashboard({ status: "error", message: "Missing authorization details." });

  const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
  if (!stateSecret) return redirectToDashboard({ status: "error", message: "Server isn't configured (OAUTH_STATE_SECRET)." });

  const state = await verifyState(stateToken, stateSecret);
  if (!state || !isSupportedPlatform(state.platform)) {
    return redirectToDashboard({ status: "error", message: "This connection link is invalid or expired — try again." });
  }

  const provider = PROVIDERS[state.platform];
  const clientId = Deno.env.get(provider.clientIdEnv);
  const clientSecret = Deno.env.get(provider.clientSecretEnv);
  if (!clientId || !clientSecret) {
    return redirectToDashboard({ status: "error", message: `${state.platform} isn't fully configured on this server yet.` });
  }
  const tokenEncryptionKey = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (!tokenEncryptionKey) {
    // Fail closed, not open — never fall back to storing a token
    // unencrypted just because the key is missing. See tokenCrypto.ts.
    return redirectToDashboard({ status: "error", message: "Server isn't configured (SOCIAL_TOKEN_ENCRYPTION_KEY)." });
  }

  try {
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-oauth-callback`;
    const { accessToken, refreshToken, expiresInSeconds } = await provider.exchangeCode({ code, redirectUri, clientId, clientSecret });
    const profile = await provider.fetchProfile(accessToken);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : null;

    // Encrypted at rest (schema_phase41_encrypt_social_tokens.sql) — see
    // tokenCrypto.ts for why. encryptToken throws rather than returning a
    // plaintext fallback, so a misconfigured key surfaces as a failed
    // connection attempt, never as a silently-unencrypted row.
    const encryptedAccessToken = await encryptToken(accessToken, tokenEncryptionKey);
    const encryptedRefreshToken = refreshToken ? await encryptToken(refreshToken, tokenEncryptionKey) : null;

    const { error: connError } = await admin.from("social_connections").upsert({
      publisher_id: state.publisherId,
      platform: state.platform,
      platform_user_id: profile.platformUserId,
      platform_username: profile.username,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: expiresAt,
      connected_by: state.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "publisher_id,platform" });
    if (connError) throw connError;

    const { error: statsError } = await admin.from("publisher_platform_stats").upsert({
      publisher_id: state.publisherId,
      platform: state.platform,
      follower_count: profile.followerCount,
      platform_username: profile.username,
      avatar_url: profile.avatarUrl,
      synced_at: new Date().toISOString(),
    }, { onConflict: "publisher_id,platform" });
    if (statsError) throw statsError;

    // Keep the publisher's headline `followers` number current too — it's
    // what drives tiering/sorting elsewhere in the app, and shouldn't need
    // a separate manual edit just because a real number is now available.
    // Sums every connected platform's stats, not just the one just synced,
    // so connecting a second platform doesn't overwrite the first's count.
    const { data: allStats } = await admin.from("publisher_platform_stats").select("follower_count").eq("publisher_id", state.publisherId);
    const totalFollowers = (allStats ?? []).reduce((sum, row) => sum + (row.follower_count ?? 0), 0);
    await admin.from("publishers").update({ followers: totalFollowers }).eq("id", state.publisherId);

    return redirectToDashboard({ status: "success", platform: state.platform, followers: String(profile.followerCount) });
  } catch (err) {
    console.error("social-oauth-callback: unexpected error", err);
    return redirectToDashboard({ status: "error", message: "Something went wrong finishing the connection — try again." });
  }
});

function redirectToDashboard(params: Record<string, string>) {
  if (!SITE_URL) {
    // Nowhere safe to send them back to — surface this plainly rather
    // than throwing on `new URL("/dashboard")` with no base.
    return new Response("SITE_URL isn't configured on this server — can't complete the redirect.", { status: 500 });
  }
  const target = new URL(`${SITE_URL}/dashboard`);
  target.searchParams.set("connect", "1");
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return Response.redirect(target.toString(), 302);
}
