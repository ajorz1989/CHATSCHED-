// Pure helpers for the podcast ownership check (verify-podcast-ownership).
// Kept free of Deno/network APIs so they can be unit tested with vitest.
//
// A podcaster proves they control the show by putting their CS-XXXXX code (the
// same one social and website publishers use) in the show description or in any
// recent episode description. Only the person who can edit the feed can do that,
// so finding the code in the feed proves control. The check reads the show's RSS
// feed (the "show URL" on the listing).
import { isPrivateIp, isValidCode, normalizeDomain } from "./websiteOwnership.ts";

export { isPrivateIp, isValidCode };

/** The line a podcaster pastes into their show description or an episode's notes. */
export const podcastSnippet = (code: string) => `ChatSched verification: ${code}`;

/**
 * Turn whatever was typed on the listing into a safe https URL to fetch, or
 * null. http is upgraded to https; credentials, ports, IP addresses, localhost
 * and internal-looking host names are rejected so the server only ever fetches
 * public sites.
 */
export function normalizeFeedUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || u.port) return null;
  if (!normalizeDomain(u.hostname)) return null;
  u.protocol = "https:";
  u.hash = "";
  return u.toString();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/gi, "&");
}

/** Text of the show- and episode-level description fields, with CDATA and entities resolved. */
function descriptionTexts(xml: string): string[] {
  const out: string[] = [];
  const re = /<(description|itunes:summary|itunes:subtitle|content:encoded|title)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const inner = m[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
    out.push(decodeEntities(inner));
  }
  return out;
}

/** True if the feed's show or episode descriptions contain exactly this code as a whole token. */
export function feedHasCode(xml: string, code: string): boolean {
  if (!isValidCode(code)) return false;
  const token = new RegExp(`(?<![0-9A-Za-z-])${code}(?![0-9A-Za-z])`, "i");
  return descriptionTexts(xml).some((t) => token.test(t));
}

export function looksLikeFeed(body: string): boolean {
  return /<(rss|feed)\b/i.test(body.slice(0, 4000));
}

export function looksLikeHtml(body: string): boolean {
  return /<html\b|<!doctype html/i.test(body.slice(0, 2000));
}

/** If a web page advertises its RSS/Atom feed, the absolute address of it. */
export function findFeedLink(html: string, base: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = tag.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const type = tag.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const r = (rel?.[1] ?? rel?.[2] ?? "").toLowerCase();
    const t = (type?.[1] ?? type?.[2] ?? "").toLowerCase();
    const h = decodeEntities(href?.[1] ?? href?.[2] ?? "");
    if (r.includes("alternate") && /(rss|atom)\+xml/.test(t) && h) {
      try { return new URL(h, base).toString(); } catch { /* try the next one */ }
    }
  }
  return null;
}
