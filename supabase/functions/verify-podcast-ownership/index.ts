// Checks that the person who listed a podcast really controls it.
//
// The publisher generates their CS-XXXXX code (generate_social_verification_code,
// the same one social and website publishers use) and pastes it into the show
// description or any recent episode's notes. This function reads the show's RSS
// feed (the "show URL" saved on THEIR OWN listing) and, if the code is in it,
// marks the listing's ownership as confirmed (publishers.social_verification_confirmed).
//
// Safety:
//   * only the listing's owner can call it, and it only ever fetches the show URL
//     stored on THEIR OWN listing — callers cannot point it at an address;
//   * every address fetched (the feed, each redirect, a feed found on a show page)
//     must be https on the standard port and resolve only to public IP addresses;
//     redirects are followed by hand (a feed often lives on a hosting CDN, so any
//     public host is allowed), with a short timeout and a size cap;
//   * the confirmation is written with the service role and only if the code on
//     the row is still the one that was checked.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  feedHasCode, findFeedLink, isPrivateIp, isValidCode, looksLikeFeed, looksLikeHtml, normalizeFeedUrl,
} from "../_shared/podcastOwnership.ts";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 4;
const DOH = "https://cloudflare-dns.com/dns-query";

type Reason = "unreachable" | "not_a_feed" | "page_without_feed" | "code_not_found";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { publisher_id } = (await req.json()) as { publisher_id?: string };
    if (!publisher_id) return json({ error: "Missing publisher_id" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Log in to verify your podcast." }, 401);

    const { data: publisher } = await userClient
      .from("publishers")
      .select("id, user_id, channel_slug, channel_metadata, social_verification_code, social_verification_confirmed")
      .eq("id", publisher_id)
      .maybeSingle();
    if (!publisher || publisher.user_id !== user.id) return json({ error: "Not your listing." }, 403);
    if (publisher.channel_slug !== "podcast") return json({ error: "This check is only for podcast listings." }, 400);
    if (publisher.social_verification_confirmed) return json({ verified: true, already: true });

    const code = publisher.social_verification_code as string | null;
    if (!isValidCode(code)) return json({ error: "Get your verification code first, then add it to your show description." }, 400);

    const feedUrl = normalizeFeedUrl((publisher.channel_metadata as Record<string, unknown> | null)?.showUrl);
    if (!feedUrl) return json({ error: "Your listing doesn't have a valid show address. Edit your listing and add your RSS feed address." }, 400);

    const result = await readFeed(feedUrl);
    if (!result.ok) return json({ verified: false, feedUrl, reason: result.reason });
    if (!feedHasCode(result.xml, code)) return json({ verified: false, feedUrl: result.feedUrl, reason: "code_not_found" satisfies Reason });

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: updated, error } = await admin
      .from("publishers")
      .update({
        social_verification_confirmed: true,
        social_verification_confirmed_at: new Date().toISOString(),
        social_verification_confirmed_by: null,
      })
      .eq("id", publisher.id)
      .eq("social_verification_code", code)
      .select("id");
    if (error) {
      console.error("verify-podcast-ownership: save failed", error.message);
      return json({ error: "Found your code but couldn't save the result — try again shortly." }, 500);
    }
    if (!updated || updated.length === 0) {
      return json({ error: "Your code changed while we were checking. Check again." }, 409);
    }
    return json({ verified: true, feedUrl: result.feedUrl });
  } catch (err) {
    console.error("verify-podcast-ownership", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

type FeedResult = { ok: true; xml: string; feedUrl: string } | { ok: false; reason: Reason };

async function readFeed(startUrl: string): Promise<FeedResult> {
  const first = await safeGet(startUrl);
  if (first.error !== undefined) return { ok: false, reason: "unreachable" };
  const body = first.body ?? "";
  if (looksLikeFeed(body)) return { ok: true, xml: body, feedUrl: first.finalUrl ?? startUrl };

  // A show page rather than the feed itself: follow the feed it advertises, once.
  if (looksLikeHtml(body)) {
    const advertised = findFeedLink(body, first.finalUrl ?? startUrl);
    const next = advertised ? normalizeFeedUrl(advertised) : null;
    if (!next) return { ok: false, reason: "page_without_feed" };
    const second = await safeGet(next);
    if (second.error !== undefined) return { ok: false, reason: "unreachable" };
    if (looksLikeFeed(second.body ?? "")) return { ok: true, xml: second.body ?? "", feedUrl: second.finalUrl ?? next };
  }
  return { ok: false, reason: "not_a_feed" };
}

// ── network helpers ────────────────────────────────────────────────────

async function doh(name: string, type: "A" | "AAAA"): Promise<string[] | null> {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { Status?: number; Answer?: { type: number; data: string }[] };
  if (j.Status !== 0 && j.Status !== 3) return null; // 3 = NXDOMAIN → no records
  const want = type === "A" ? 1 : 28;
  return (j.Answer ?? []).filter((r) => r.type === want).map((r) => r.data);
}

/** True only if the host has at least one address and every address is public. */
async function resolvesToPublicOnly(host: string): Promise<boolean> {
  const [a, aaaa] = await Promise.all([doh(host, "A"), doh(host, "AAAA")]);
  const ips = [...(a ?? []), ...(aaaa ?? [])];
  return ips.length > 0 && ips.every((ip) => !isPrivateIp(ip));
}

async function safeGet(startUrl: string): Promise<{ body?: string; finalUrl?: string; error?: string }> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const normalised = normalizeFeedUrl(current);
    if (!normalised) return { error: "Not a public https address." };
    const u = new URL(normalised);
    try {
      if (!(await resolvesToPublicOnly(u.hostname))) return { error: "Not on the public internet." };
      const res = await fetch(u, {
        redirect: "manual",
        headers: {
          "user-agent": "ChatSchedOwnershipCheck/1.0 (+https://chatsched.co.za)",
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { error: "Redirected without saying where." };
        current = new URL(loc, u).toString();
        continue;
      }
      if (!res.ok) return { error: `Answered ${res.status}.` };
      return { body: await readCapped(res), finalUrl: u.toString() };
    } catch {
      return { error: "Couldn't reach it." };
    }
  }
  return { error: "Too many redirects." };
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* already closed */ }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  return new TextDecoder().decode(all.slice(0, MAX_BYTES));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
