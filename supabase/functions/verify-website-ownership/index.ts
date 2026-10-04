// Checks that the person who listed a website really controls it.
//
// The publisher generates their CS-XXXXX code (generate_social_verification_code,
// the same one social publishers use) and puts it on their site in ONE of three
// ways: a <meta> tag on the home page, a DNS TXT record, or a small text file at
// /.well-known/chatsched-verification.txt. This function looks for it and, if it
// finds it, marks the listing's ownership as confirmed
// (publishers.social_verification_confirmed — the column is named after the
// social check it was built for; it now means "ownership confirmed" for every
// channel that uses a code).
//
// Safety:
//   * only the listing's owner can call it, and it only ever checks the domain
//     stored on THEIR OWN listing (channel_metadata.domain) — callers cannot
//     point it at an address;
//   * the domain must look like a public host name, must not resolve to a
//     private / loopback / link-local address, redirects are followed by hand and
//     may only stay on the same site, with a short timeout and a size cap;
//   * the confirmation is written with the service role and only if the code on
//     the row is still the one that was checked.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  fileHasCode, htmlHasMetaCode, isPrivateIp, isValidCode, normalizeDomain, txtHasCode, WELL_KNOWN_PATH,
} from "../_shared/websiteOwnership.ts";

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const DOH = "https://cloudflare-dns.com/dns-query";

type Attempt = { method: "meta_tag" | "dns_txt" | "well_known_file"; where: string; ok: boolean; note?: string };

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
    if (!user) return json({ error: "Log in to verify your website." }, 401);

    const { data: publisher } = await userClient
      .from("publishers")
      .select("id, user_id, channel_slug, channel_metadata, social_verification_code, social_verification_confirmed")
      .eq("id", publisher_id)
      .maybeSingle();
    if (!publisher || publisher.user_id !== user.id) return json({ error: "Not your listing." }, 403);
    if (publisher.channel_slug !== "website") return json({ error: "This check is only for website listings." }, 400);
    if (publisher.social_verification_confirmed) return json({ verified: true, already: true, attempts: [] });

    const code = publisher.social_verification_code as string | null;
    if (!isValidCode(code)) return json({ error: "Get your verification code first, then add it to your site." }, 400);

    const domain = normalizeDomain((publisher.channel_metadata as Record<string, unknown> | null)?.domain);
    if (!domain) return json({ error: "Your listing doesn't have a valid website domain. Edit your listing and add it (for example mysite.co.za)." }, 400);

    const attempts = await runChecks(domain, code);
    const hit = attempts.find((a) => a.ok);
    if (!hit) return json({ verified: false, domain, attempts });

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
      console.error("verify-website-ownership: save failed", error.message);
      return json({ error: "Found your code but couldn't save the result — try again shortly." }, 500);
    }
    if (!updated || updated.length === 0) {
      return json({ error: "Your code changed while we were checking. Check again." }, 409);
    }
    return json({ verified: true, method: hit.method, domain, attempts });
  } catch (err) {
    console.error("verify-website-ownership", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

async function runChecks(domain: string, code: string): Promise<Attempt[]> {
  const hosts = [domain];
  const bare = domain.replace(/^www\./, "");
  if (domain === bare) hosts.push(`www.${domain}`); else hosts.push(bare);

  const jobs: Promise<Attempt>[] = [];
  for (const host of new Set([domain, bare])) {
    jobs.push(checkDns(host, code));
  }
  for (const host of hosts) {
    jobs.push(checkMeta(host, domain, code));
    jobs.push(checkFile(host, domain, code));
  }
  return await Promise.all(jobs);
}

async function checkDns(host: string, code: string): Promise<Attempt> {
  const a: Attempt = { method: "dns_txt", where: host, ok: false };
  try {
    const records = await dohTxt(host);
    if (records === null) a.note = "Couldn't look up DNS records.";
    else if (records.length === 0) a.note = "No TXT records found.";
    else if (txtHasCode(records, code)) a.ok = true;
    else a.note = "TXT records found, but not our code.";
  } catch {
    a.note = "Couldn't look up DNS records.";
  }
  return a;
}

async function checkMeta(host: string, domain: string, code: string): Promise<Attempt> {
  const a: Attempt = { method: "meta_tag", where: `https://${host}/`, ok: false };
  const page = await safeGet(`https://${host}/`, domain);
  if (page.error) a.note = page.error;
  else if (htmlHasMetaCode(page.body ?? "", code)) a.ok = true;
  else a.note = "Page loaded, but the meta tag isn't there.";
  return a;
}

async function checkFile(host: string, domain: string, code: string): Promise<Attempt> {
  const a: Attempt = { method: "well_known_file", where: `https://${host}${WELL_KNOWN_PATH}`, ok: false };
  const file = await safeGet(`https://${host}${WELL_KNOWN_PATH}`, domain);
  if (file.error) a.note = file.error;
  else if (fileHasCode(file.body ?? "", code)) a.ok = true;
  else a.note = "File found, but it doesn't contain just the code.";
  return a;
}

// ── network helpers ────────────────────────────────────────────────────

async function doh(name: string, type: "TXT" | "A" | "AAAA"): Promise<string[] | null> {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { Status?: number; Answer?: { type: number; data: string }[] };
  if (j.Status !== 0 && j.Status !== 3) return null; // 3 = NXDOMAIN → no records
  const want = type === "TXT" ? 16 : type === "A" ? 1 : 28;
  return (j.Answer ?? []).filter((r) => r.type === want).map((r) => r.data);
}

const dohTxt = (host: string) => doh(host, "TXT");

/** True only if the host has at least one address and every address is public. */
async function resolvesToPublicOnly(host: string): Promise<boolean> {
  const [a, aaaa] = await Promise.all([doh(host, "A"), doh(host, "AAAA")]);
  const ips = [...(a ?? []), ...(aaaa ?? [])];
  return ips.length > 0 && ips.every((ip) => !isPrivateIp(ip));
}

function sameSite(host: string, domain: string): boolean {
  const bare = domain.replace(/^www\./, "");
  return host === bare || host === `www.${bare}`;
}

async function safeGet(startUrl: string, domain: string): Promise<{ body?: string; error?: string }> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let u: URL;
    try { u = new URL(current); } catch { return { error: "Bad address." }; }
    if (u.protocol !== "https:" || u.port) return { error: "Only standard https addresses are checked." };
    if (!sameSite(u.hostname, domain)) return { error: "The site redirects somewhere else." };
    try {
      if (!(await resolvesToPublicOnly(u.hostname))) return { error: "Couldn't find your site on the public internet." };
      const res = await fetch(u, {
        redirect: "manual",
        headers: { "user-agent": "ChatSchedOwnershipCheck/1.0 (+https://chatsched.co.za)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { error: "The site redirected without saying where." };
        current = new URL(loc, u).toString();
        continue;
      }
      if (!res.ok) return { error: `The site answered ${res.status}.` };
      return { body: await readCapped(res) };
    } catch {
      return { error: "Couldn't reach your site." };
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
