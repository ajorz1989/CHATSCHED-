#!/usr/bin/env node
// Generates dist/_headers (Netlify + Cloudflare Pages both read this file
// natively from the publish directory, zero extra config) with production
// security headers — "claude to fix 2" item 22.
//
// Why generated, not a static file committed to the repo: the
// Content-Security-Policy's connect-src needs this deployment's actual
// Supabase project host, and script-src needs a hash of the exact bytes
// of index.html's one inline script (the JSON-LD structured-data block) —
// hardcoding either would silently drift the first time someone changes
// SUPABASE_URL or edits that script block, and a CSP that's silently
// wrong doesn't fail loudly, it just quietly blocks something (messaging
// going dead, fonts disappearing, structured data vanishing) with no
// obvious cause. Computing both from the actual build output means the
// header always matches what's actually shipped.
//
// Run automatically via `npm run build`'s "postbuild" script — see
// package.json. Requires dist/index.html to already exist (i.e. must run
// after `vite build`, which is what "postbuild" guarantees).
//
// ── What's actually in this CSP, and why (verified against this specific
//    codebase, not a generic template) ──
// - script-src: 'self' for the app's own bundled JS, https://plausible.io
//   because src/lib/analytics.ts injects a real <script src="https://
//   plausible.io/js/script.manual.js"> tag when VITE_PLAUSIBLE_DOMAIN is
//   set, and a sha256 hash (computed below) for the one inline script
//   index.html actually ships — the JSON-LD Organization block. No
//   'unsafe-inline', no 'unsafe-eval': nothing else in this app needs
//   either.
// - style-src: 'unsafe-inline' is a deliberate, narrower trade-off, not an
//   oversight — 16 files use React's `style={{...}}` (inline style
//   attributes), which CSP treats the same as literal <style> blocks, and
//   there's no per-request server here to inject a nonce (this ships as
//   static files to whatever host). Inline style injection is a much
//   lower-severity XSS primitive than inline script injection, which is
//   why script-src stays strict while style-src doesn't. Also allows
//   https://fonts.googleapis.com — src/index.css's very first line is
//   `@import url('https://fonts.googleapis.com/css2?...')`.
// - font-src: https://fonts.gstatic.com — where fonts.googleapis.com's
//   stylesheet actually points the browser to fetch the .woff2 files from.
// - img-src: 'self', data:, blob:, and the Supabase host (storage-hosted
//   CVs/proof screenshots/attachments).
// - connect-src: 'self', the Supabase host over both https: and wss: (this
//   app uses Supabase Realtime — src/hooks/useNotifications.ts,
//   MessageThread.tsx, Messages.tsx all subscribe to postgres_changes
//   over a websocket, not just REST), https://plausible.io (the script's
//   own beacon requests), and Sentry's ingest hosts (wildcarded —
//   *.sentry.io covers every regional ingest subdomain Sentry uses
//   without needing to know which region this DSN happens to be in).
// - frame-src: https://www.youtube.com and https://player.vimeo.com —
//   src/components/PortfolioGallery.tsx embeds exactly these two via
//   src/lib/videoEmbed.ts's embedUrl construction, nothing else.
// - form-action: 'self' plus both PayFast hosts — src/lib/
//   payfastRedirect.ts builds and submits a real <form method="POST"
//   action="..."> to whichever PayFast checkout host
//   supabase/functions/_shared/payfast.ts's PAYFAST_MODE resolves to
//   (sandbox.payfast.co.za or www.payfast.co.za); both are allowed since
//   this static header can't know which mode is active at request time.
// - frame-ancestors 'none': this app is never legitimately iframed by
//   anyone — equivalent to (and stronger than relying on alone)
//   X-Frame-Options: DENY below.
// - object-src 'none', base-uri 'self': standard hardening this app has
//   no reason to need looser.
// - worker-src 'self', manifest-src 'self': the PWA's service worker
//   (vite-plugin-pwa) and web app manifest, both same-origin.
//
// ── The other headers below the CSP ──
// - Strict-Transport-Security: 2 years, includeSubDomains, preload — the
//   long-lived, "submit to browsers' HSTS preload list" strength the task
//   asked for. Harmless to send even before actually submitting to the
//   preload list; browsers just start enforcing HTTPS-only for this host
//   after the first successful HTTPS response either way.
// - X-Content-Type-Options: nosniff — stops a browser from executing a
//   response as a different content-type than the server declared (the
//   classic case: an uploaded "image" that's actually script content).
// - Referrer-Policy: strict-origin-when-cross-origin — send the full URL
//   as a referrer only to same-origin requests; cross-origin requests
//   (e.g. an outbound link) get just the origin, not the full path/query
//   (relevant here: request/campaign URLs can contain identifying slugs).
// - Permissions-Policy: geolocation/microphone/camera/payment all denied
//   outright (`=()`, not scoped to self) — verified this app calls none
//   of navigator.geolocation, getUserMedia, or the PaymentRequest API
//   anywhere (PayFast is a plain form-POST redirect, not the browser
//   Payment Request API), so there's no legitimate use to preserve.
// - X-Frame-Options: DENY — frame-ancestors 'none' above already covers
//   this in every modern browser; X-Frame-Options is the same protection
//   for the handful of older browsers that don't read frame-ancestors.
//
// What this does NOT try to handle: OAuth redirects (ConnectSocialAccounts.tsx
// does a full `window.location.href = data.url` top-level navigation to
// the provider's consent screen, and window.open() calls elsewhere open
// same-origin Supabase Storage signed URLs in a new tab) — neither is
// subject to the CURRENT page's CSP at all, since CSP only governs
// subresource loads and embeds from the page that sent it, not
// full-page/new-tab navigation targets. So OAuth needs no connect-src or
// frame-src entry here, which is why none of the four provider domains
// (YouTube/Facebook/Instagram/TikTok's OAuth endpoints) appear above.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadEnv } from "./_env.mjs";

// ── Load env vars the same way Vite does for the app itself, but for this
// standalone Node script — see scripts/_env.mjs for why this is needed
// and how the precedence works.
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.warn(
    "generate-security-headers: VITE_SUPABASE_URL isn't set — falling back to a " +
    "wildcard *.supabase.co in the generated CSP. Set it (in your host's env vars, " +
    "or a local .env file) before deploying for a tighter, project-specific policy."
  );
}
let supabaseHost;
try {
  supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "*.supabase.co";
} catch {
  console.warn(`generate-security-headers: VITE_SUPABASE_URL ("${supabaseUrl}") isn't a valid URL — falling back to a wildcard.`);
  supabaseHost = "*.supabase.co";
}

const indexHtmlPath = "dist/index.html";
if (!existsSync(indexHtmlPath)) {
  console.error(`generate-security-headers: ${indexHtmlPath} doesn't exist — run \`vite build\` first (this is meant to run as npm's "postbuild" step).`);
  process.exit(1);
}
const indexHtml = readFileSync(indexHtmlPath, "utf8");
const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!jsonLdMatch) {
  console.error("generate-security-headers: couldn't find the JSON-LD <script> block in dist/index.html — did index.html change shape? Update this script's regex if the structured-data block moved or its type attribute changed.");
  process.exit(1);
}
const jsonLdHash = createHash("sha256").update(jsonLdMatch[1], "utf8").digest("base64");

const csp = [
  `default-src 'self'`,
  `script-src 'self' https://plausible.io 'sha256-${jsonLdHash}'`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: blob: https://${supabaseHost}`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://plausible.io https://*.sentry.io`,
  `frame-src https://www.youtube.com https://player.vimeo.com`,
  `form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `upgrade-insecure-requests`,
].join("; ");

// Netlify and Cloudflare Pages both use this exact `_headers` file format,
// read automatically from the publish/output directory — no platform
// config needed beyond this file existing.
const headersFile = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  X-Frame-Options: DENY
`;

writeFileSync("dist/_headers", headersFile);
console.log("generate-security-headers: wrote dist/_headers");
console.log(`  Supabase host: ${supabaseHost}${supabaseUrl ? "" : " (wildcard fallback — see warning above)"}`);
console.log(`  JSON-LD script hash: sha256-${jsonLdHash}`);
