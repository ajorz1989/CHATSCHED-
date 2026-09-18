// The `state` param round-trips through the platform's OAuth flow and
// back to social-oauth-callback — this signs it so the callback can trust
// it wasn't tampered with, without needing a database table to track
// pending authorization attempts. Needs OAUTH_STATE_SECRET set (any long
// random string — see supabase/DEPLOY.md).
export interface OAuthState {
  platform: string;
  publisherId: string;
  userId: string;
  nonce: string;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signState(payload: OAuthState, secret: string): Promise<string> {
  const json = JSON.stringify(payload);
  const encoded = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = await hmac(secret, encoded);
  return `${encoded}.${sig}`;
}

export async function verifyState(token: string, secret: string): Promise<OAuthState | null> {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = await hmac(secret, encoded);
  if (expected !== sig) return null;
  try {
    return JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))) as OAuthState;
  } catch {
    return null;
  }
}
