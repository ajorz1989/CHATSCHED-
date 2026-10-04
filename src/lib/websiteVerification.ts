/**
 * What a website owner has to add to their site to prove ownership. These three
 * strings are what the verify-website-ownership edge function looks for
 * (supabase/functions/_shared/websiteOwnership.ts) — a test keeps the two in sync.
 */
export const WEBSITE_META_NAME = "chatsched-verification";
export const WEBSITE_DNS_PREFIX = "chatsched-verification=";
export const WEBSITE_WELL_KNOWN_PATH = "/.well-known/chatsched-verification.txt";

export function websiteSnippets(code: string) {
  return {
    metaTag: `<meta name="${WEBSITE_META_NAME}" content="${code}">`,
    dnsHost: "@ (the domain itself)",
    dnsValue: `${WEBSITE_DNS_PREFIX}${code}`,
    filePath: WEBSITE_WELL_KNOWN_PATH,
    fileContents: code,
  };
}

/** The domain typed on the listing, as a bare host name for display. */
export function listedDomain(channelMetadata: unknown): string | null {
  const raw = (channelMetadata as { domain?: unknown } | null)?.domain;
  if (typeof raw !== "string") return null;
  const host = raw.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0].replace(/\.$/, "");
  return host || null;
}

export interface WebsiteCheckAttempt {
  method: "meta_tag" | "dns_txt" | "well_known_file";
  where: string;
  ok: boolean;
  note?: string;
}

export const METHOD_LABEL: Record<WebsiteCheckAttempt["method"], string> = {
  meta_tag: "Meta tag",
  dns_txt: "DNS record",
  well_known_file: "Verification file",
};
