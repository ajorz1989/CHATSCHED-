// Pure helpers for the website ownership check (verify-website-ownership).
// Kept free of Deno/network APIs so they can be unit tested with vitest.
//
// A website owner proves control of their domain in any ONE of three ways,
// using the same CS-XXXXX code a social publisher puts in a bio:
//   1. a <meta name="chatsched-verification" content="CS-XXXXX"> tag on the home page
//   2. a DNS TXT record on the domain:  chatsched-verification=CS-XXXXX
//   3. a text file at /.well-known/chatsched-verification.txt containing the code
// (3) exists for site builders where the head can't be edited.

export const META_NAME = "chatsched-verification";
export const DNS_PREFIX = "chatsched-verification=";
export const WELL_KNOWN_PATH = "/.well-known/chatsched-verification.txt";

const CODE_RE = /^CS-[0-9A-F]{5}$/;

export function isValidCode(code: unknown): code is string {
  return typeof code === "string" && CODE_RE.test(code);
}

/**
 * Reduce whatever the publisher typed ("https://www.Example.co.za/about") to a
 * bare host name, or null if it is not a public-looking domain. Rejects IP
 * addresses, localhost, internal suffixes and ports so the server never fetches
 * anything but a public site.
 */
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (!s || s.length > 253) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  s = s.split(/[/?#]/)[0] ?? "";                // path / query / fragment
  if (s.includes("@") || s.includes(":")) return null; // credentials or port
  s = s.replace(/\.$/, "");
  if (!s.includes(".")) return null;
  if (/^[0-9.]+$/.test(s)) return null; // IPv4 literal
  const labels = s.split(".");
  if (labels.some((l) => !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,24}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return null;
  if (["localhost", "local", "internal", "lan", "home", "corp", "test", "invalid", "example"].includes(tld)) return null;
  return s;
}

/** True for private, loopback, link-local and other non-public IPv4/IPv6 addresses. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // not an IP we understand: treat as unsafe
}

/** True if the page contains <meta name="chatsched-verification" content="CODE"> (any attribute order or quoting). */
export function htmlHasMetaCode(html: string, code: string): boolean {
  if (!isValidCode(code)) return false;
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = tag.match(/\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
    const content = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
    const n = (name?.[1] ?? name?.[2] ?? name?.[3] ?? "").trim().toLowerCase();
    const c = (content?.[1] ?? content?.[2] ?? content?.[3] ?? "").trim().toUpperCase();
    if (n === META_NAME && c === code.toUpperCase()) return true;
  }
  return false;
}

/** True if any TXT record value (quotes and chunk splitting removed) is exactly chatsched-verification=CODE. */
export function txtHasCode(records: string[], code: string): boolean {
  if (!isValidCode(code)) return false;
  const want = `${DNS_PREFIX}${code}`.toLowerCase();
  return records.some((r) => r.replace(/"\s*"/g, "").replace(/^"|"$/g, "").trim().toLowerCase() === want);
}

/** True if the well-known file is essentially just the code. */
export function fileHasCode(body: string, code: string): boolean {
  if (!isValidCode(code)) return false;
  return body.trim().toUpperCase() === code.toUpperCase();
}

export const websiteSnippets = (code: string) => ({
  metaTag: `<meta name="${META_NAME}" content="${code}">`,
  dnsHost: "@ (the domain itself)",
  dnsValue: `${DNS_PREFIX}${code}`,
  filePath: WELL_KNOWN_PATH,
  fileContents: code,
});
