// POST /social-oauth-start  { platform, publisher_id }
//
// CHANGED from the original GET-with-query-string design: this used to be
// a plain browser navigation (`window.location.href = url`) with the
// user's Supabase access token passed as `?access_token=...` — a bearer
// credential sitting in a URL, which means it's a candidate for browser
// history, proxy/server access logs, referrer headers, and analytics/
// monitoring systems to capture. Flagged as a critical security review
// finding; fixed here.
//
// The fix: the browser now calls this as a normal authenticated fetch
// (`supabase.functions.invoke`, which sends the session token as a real
// `Authorization` header — never logged the way a URL is) with just
// `{ platform, publisher_id }` in the JSON body. This function verifies
// that header server-side exactly like campaign-compliance-screen and
// summarize-publisher-audience already do, then returns the provider's
// OAuth authorize URL as JSON rather than issuing an HTTP redirect itself.
//
// That last part isn't optional styling: a `fetch()` follows a 302
// internally and returns the *final response body*, it does not move the
// browser's own address bar. Getting the user onto Google/Meta/TikTok's
// real consent screen still needs an actual top-level navigation, so the
// client does that itself — `window.location.href = data.url` — once it
// has the URL back. Nothing sensitive rides in that second URL: it's
// standard OAuth authorize params (client_id, redirect_uri, scope, a
// signed `state`) that were always meant to be visible, not a bearer
// credential standing in for a login session.
//
// social-oauth-callback is unaffected by this change and needed no fix —
// it was never given the access token in the first place, only the signed
// `state` this function produces below.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PROVIDERS, isSupportedPlatform } from "../_shared/socialProviders.ts";
import { signState } from "../_shared/oauthState.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { platform, publisher_id: publisherId } = (await req.json()) as { platform?: string; publisher_id?: string };

    if (!platform || !isSupportedPlatform(platform)) {
      return json({ error: "That platform isn't supported for connecting yet." }, 400);
    }
    if (!publisherId) {
      return json({ error: "Missing publisher_id." }, 400);
    }

    const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
    const provider = PROVIDERS[platform];
    const clientId = Deno.env.get(provider.clientIdEnv);
    if (!stateSecret || !clientId) {
      return json({ error: `Connecting ${platform} isn't configured on this server yet.` }, 501);
    }

    // Confirm the caller actually owns this publisher listing — without
    // this, anyone who guessed a publisher_id could kick off a connection
    // and, worse, have social-oauth-callback attribute stats to a listing
    // they don't control. Same check as before, just reading identity from
    // a real Authorization header now instead of a query-string token.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Your session expired — log in again and retry." }, 401);

    const { data: publisher } = await supabase.from("publishers").select("id, user_id").eq("id", publisherId).maybeSingle();
    if (!publisher || publisher.user_id !== user.id) {
      return json({ error: "You can only connect accounts to your own publisher listing." }, 403);
    }

    const state = await signState({ platform, publisherId, userId: user.id, nonce: crypto.randomUUID() }, stateSecret);
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-oauth-callback`;

    const authUrl = new URL(provider.authUrl);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", provider.scope);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    for (const [k, v] of Object.entries(provider.extraAuthParams ?? {})) authUrl.searchParams.set(k, v);

    return json({ url: authUrl.toString() });
  } catch (err) {
    console.error("social-oauth-start: unexpected error", err);
    return json({ error: "Couldn't start the connection — try again." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
