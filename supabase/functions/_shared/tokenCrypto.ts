// Encrypts/decrypts the third-party OAuth tokens stored in
// social_connections.access_token / .refresh_token (schema_phase34) —
// added in schema_phase41_encrypt_social_tokens.sql's follow-up fix.
//
// Why this exists: those columns held real, live, usable YouTube/Facebook/
// Instagram/TikTok credentials in plaintext. RLS already restricts the
// table to service-role-only (no client can read it via the API), but
// that only protects the API layer — a leaked service-role key, a
// database backup that ends up somewhere it shouldn't, or anyone with
// direct DB access would otherwise get live credentials to a real
// person's social account for free. Encrypting at rest means a database-
// level exposure alone isn't enough; the key (SOCIAL_TOKEN_ENCRYPTION_KEY,
// set only as an Edge Function secret, never in the database) is also
// required.
//
// AES-256-GCM via the Web Crypto API (built into Deno, no dependency to
// audit). Ciphertext format is a single string so it fits the existing
// `text` columns unchanged: base64(12-byte random IV || ciphertext ||
// 16-byte GCM auth tag). GCM's auth tag means a tampered ciphertext fails
// to decrypt rather than silently returning garbage.
//
// Key format: SOCIAL_TOKEN_ENCRYPTION_KEY must be a 32-byte key, base64-
// encoded — generate one with `openssl rand -base64 32`. Both
// encryptToken and decryptToken fail closed (throw) on a missing or
// wrong-length key, same posture as OAUTH_STATE_SECRET/CRON_SECRET
// elsewhere in this codebase: a misconfigured deploy should error loudly,
// never silently fall back to storing plaintext.

const IV_BYTES = 12;

async function importKey(base64Key: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not valid base64.");
  }
  if (raw.length !== 32) {
    throw new Error(`SOCIAL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${raw.length}). Generate one with: openssl rand -base64 32`);
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypts a token for storage. Throws (does not fall back to plaintext) if the key is missing or malformed — call sites must not catch-and-store-plaintext on failure. */
export async function encryptToken(plaintext: string, base64Key: string | undefined): Promise<string> {
  if (!base64Key) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not set — refusing to store a token unencrypted.");
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a token read back from storage. Not called anywhere yet — no
 * feature in this codebase currently re-uses a stored access/refresh
 * token (nothing does a background stats refresh or a token-refresh flow
 * today, see social_connections' own schema comment) — but the write side
 * needed to exist before the column meant anything, and a future feature
 * that reads these tokens shouldn't have to reinvent this.
 */
export async function decryptToken(stored: string, base64Key: string | undefined): Promise<string> {
  if (!base64Key) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not set — cannot decrypt.");
  const key = await importKey(base64Key);
  const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
