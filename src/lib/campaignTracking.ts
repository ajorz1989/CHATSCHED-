import { supabase } from "./supabase";
import { CONTACT_WEBSITE } from "./constants";

/**
 * Campaign tracking helpers — turning a `campaigns` row into the two URLs a
 * business actually copies out (short redirect link + direct UTM-tagged
 * link), the visitor id used to de-duplicate embed-snippet events, and the
 * embed snippet itself. All real logging happens server-side, via
 * resolve_campaign_link()/track_campaign_event() in
 * schema_phase30_campaign_tracking.sql — nothing here writes to the
 * database directly except generateUniqueSlug()'s existence check.
 */

/** chatsched.com/t/<slug> in production; localhost:xxxx/t/<slug> in dev — always the real current origin. */
export function trackingUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : `https://${CONTACT_WEBSITE}`;
  return `${origin}/t/${slug}`;
}

/** The business's own destination URL, with UTM params appended (or merged into existing ones). */
export function utmTaggedUrl(campaign: {
  destination_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string | null;
}): string {
  try {
    const url = new URL(campaign.destination_url);
    url.searchParams.set("utm_source", campaign.utm_source);
    url.searchParams.set("utm_medium", campaign.utm_medium);
    url.searchParams.set("utm_campaign", campaign.utm_campaign);
    if (campaign.utm_content) url.searchParams.set("utm_content", campaign.utm_content);
    return url.toString();
  } catch {
    // destination_url failed to parse as an absolute URL — shouldn't happen
    // given the DB check constraint, but fail soft rather than throw.
    return campaign.destination_url;
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "campaign";
}

/** Turns a campaign name into a unique slug, retrying with a random suffix on collision. */
export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data } = await supabase.from("campaigns").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  // Astronomically unlikely to still collide — fall back to a fully random slug.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A random, non-identifying id — stored in localStorage on whichever site the visitor lands on, to de-dupe obvious double-fires. Never an IP or anything else personal (see schema comment). */
export function getOrCreateVisitorId(): string {
  try {
    const key = "cs_visitor_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * The plain-JS snippet a business pastes onto their own site to report
 * visits/leads/conversions back to this campaign. Vanilla JS on purpose —
 * it runs on someone else's site, which might not be React or even have a
 * build step at all. Reads utm_source/utm_campaign off the current page's
 * URL (which is exactly what the redirect appends), so it only ever fires
 * for traffic that actually came from this campaign's tracking link.
 */
export function buildEmbedSnippet(supabaseUrl: string, supabaseAnonKey: string, slug: string): string {
  return `<script>
(function () {
  var qs = new URLSearchParams(location.search);
  if (qs.get("utm_source") !== "chatsched" || qs.get("utm_campaign") !== ${JSON.stringify(slug)}) return;

  var visitorId = (function () {
    try {
      var k = "cs_visitor_id";
      var v = localStorage.getItem(k);
      if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return null; }
  })();

  function csTrack(eventType, value) {
    fetch(${JSON.stringify(`${supabaseUrl}/rest/v1/rpc/track_campaign_event`)}, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ${JSON.stringify(supabaseAnonKey)},
        "Authorization": "Bearer " + ${JSON.stringify(supabaseAnonKey)}
      },
      body: JSON.stringify({
        p_slug: ${JSON.stringify(slug)},
        p_event_type: eventType,
        p_value: value || null,
        p_referrer: document.referrer || null,
        p_visitor_id: visitorId
      }),
      keepalive: true
    }).catch(function () {});
  }

  // Fires once per page load — this is the "visit".
  csTrack("visit");

  // Call these yourself wherever a lead or a sale actually happens, e.g.:
  //   window.chatschedTrack("lead");
  //   window.chatschedTrack("conversion", 499.00);
  window.chatschedTrack = csTrack;
})();
</script>`;
}
