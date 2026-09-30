// CORS headers for the Edge Functions browsers call directly (notify,
// payfast-checkout, content-studio-generate, content-studio-subscribe,
// publisher-authenticity-check, notify-saved-search-matches, delete-account,
// summarize-publisher-audience, campaign-compliance-screen,
// send-otp, verify-otp — payfast-notify and expire-channel-requests are
// server-to-server or scheduled calls, never a normal fetch from a browser
// with a session header, so they don't need this).
// (social-oauth-start and social-oauth-callback, the two OAuth Edge
// Functions previously listed here, were deleted in migration
// 20260929120000_social_bio_code_verification.sql — see that file and
// SocialVerificationPanel.tsx for what replaced the "Connect social
// accounts" flow they supported.)
// (send-otp and verify-otp were missing from this list even though they
// already imported corsHeaders — comment-only fix, caught in a pre-launch
// audit pass while looking at the fallback issue below.)
//
// Every one of these functions authorizes with the caller's own JWT (not
// cookies), so a wildcard origin was never the real security boundary —
// but "not the real boundary" isn't the same as "fine to leave open."
// Previously fell back to "*" whenever SITE_URL wasn't set, which meant a
// deploy that simply forgot to set SITE_URL silently opened CORS to every
// origin on the internet instead of failing loudly — flagged in a
// pre-launch audit pass. Fixed: falls back to `http://localhost:5173`
// instead — the exact value DEPLOY.md already tells you to set explicitly
// for local dev (`supabase secrets set SITE_URL=http://localhost:5173`),
// so local dev keeps working with zero extra config exactly as before,
// but a production deploy that forgets to set SITE_URL now gets loud,
// visible CORS errors in the browser console instead of a silently wide-
// open API. Set SITE_URL to your real domain once deployed, same as
// DEPLOY.md already says to.
const SITE_URL = Deno.env.get("SITE_URL");

export const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL || "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};
