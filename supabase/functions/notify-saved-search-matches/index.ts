// Called by an admin right after approving a publisher (see Admin.tsx's
// handleApprove) — same "client invokes an edge function right after the
// DB write" pattern as the `notify` function elsewhere in this schema,
// and for the same reason: sending real email needs RESEND_API_KEY, which
// only exists in an Edge Function's environment, not inside Postgres.
//
// The in-app bell notification for the same event is handled entirely
// separately, by trg_notify_saved_search_matches (schema_phase32) — a
// database trigger, so it fires no matter which code path approved the
// publisher. This function's matching logic intentionally mirrors that
// trigger's structured-field checks (channel/category/province/city/
// suburb/platforms/languages/verifiedOnly/minFollowers/maxFollowers/
// minEngagement/maxPrice) so a business's email and bell notification
// always agree on what counted as a match — see that migration's comment
// for why the fuzzy keyword/age/gender fields aren't part of matching at
// all.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface SavedSearchRow {
  id: string;
  business_id: string;
  name: string;
  filters: Record<string, unknown>;
}

interface PublisherRow {
  id: string;
  name: string;
  category: string;
  city: string;
  province: string;
  suburb: string | null;
  channel_slug: string;
  platforms: string[];
  languages: string[];
  verified: boolean;
  followers: number;
  engagement: number;
  price_per_post: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { publisher_id } = (await req.json()) as { publisher_id?: string };
    if (!publisher_id) return json({ error: "publisher_id is required" }, 400);

    // Step 1 — confirm the caller is really an admin, scoped to their own
    // JWT (same two-step pattern as publisher-authenticity-check).
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Not logged in" }, 401);
    const { data: profile } = await callerClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "admin") return json({ error: "Admin only" }, 403);

    // Step 2 — everything past this point needs to read across every
    // business's saved_searches (owner-only RLS) and look up arbitrary
    // users' emails, so it switches to the service role key, same as
    // notify/index.ts's lookupEmail().
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: publisher, error: pubError } = await admin
      .from("publishers")
      .select("id, name, category, city, province, suburb, channel_slug, platforms, languages, verified, followers, engagement, price_per_post")
      .eq("id", publisher_id)
      .maybeSingle();
    if (pubError || !publisher) return json({ error: "Publisher not found" }, 404);

    const { data: searches } = await admin
      .from("saved_searches")
      .select("id, business_id, name, filters")
      .eq("alerts_enabled", true);

    const matches = (searches ?? []).filter((s: SavedSearchRow) => matchesSavedSearch(publisher as PublisherRow, s.filters));

    if (matches.length === 0) return json({ sent: 0 });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      // Not configured yet — the in-app bell notification (trigger-driven,
      // already fired regardless of this function) still reached them.
      console.warn("notify-saved-search-matches: RESEND_API_KEY not set, skipping email");
      return json({ skipped: true, matched: matches.length });
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    const from = Deno.env.get("RESEND_FROM") || "ChatSched <onboarding@resend.dev>";
    let sent = 0;

    for (const search of matches as SavedSearchRow[]) {
      const { data: userData } = await admin.auth.admin.getUserById(search.business_id);
      const to = userData?.user?.email;
      if (!to) continue;

      const browseUrl = `${siteUrl}${buildBrowseUrl(search.filters)}`;
      const html = `<p><strong>${escapeHtml(publisher.name)}</strong> just joined the ChatSched directory and matches your saved search "<strong>${escapeHtml(search.name)}</strong>".</p><p>${escapeHtml(publisher.category)} · ${escapeHtml(publisher.city)}, ${escapeHtml(publisher.province)}</p><p><a href="${browseUrl}">View matching publishers</a></p><p style="color:#6B6250;font-size:12px">Turn alerts off any time from <a href="${siteUrl}/saved-searches">your saved searches</a>.</p>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `New match for "${search.name}"`,
          html,
        }),
      });
      if (res.ok) sent++;
      else console.error("notify-saved-search-matches: Resend error", await res.text());
    }

    return json({ sent, matched: matches.length });
  } catch (err) {
    console.error("notify-saved-search-matches: unexpected error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

/** Mirrors trg_notify_saved_search_matches's structured-field matching exactly — see schema_phase33_saved_searches.sql. */
function matchesSavedSearch(p: PublisherRow, filters: Record<string, unknown>): boolean {
  const str = (k: string) => (typeof filters[k] === "string" && filters[k] !== "" ? (filters[k] as string) : null);
  const arr = (k: string) => (Array.isArray(filters[k]) && (filters[k] as unknown[]).length ? (filters[k] as string[]) : null);
  const num = (k: string) => (filters[k] !== undefined && filters[k] !== null && filters[k] !== "" ? Number(filters[k]) : null);

  const channel = str("channel");
  if (channel && channel !== p.channel_slug) return false;
  const category = str("category");
  if (category && category !== p.category) return false;
  const province = str("province");
  if (province && province !== p.province) return false;
  const city = str("city");
  if (city && !p.city.toLowerCase().includes(city.toLowerCase())) return false;
  const suburb = str("suburb");
  if (suburb && suburb !== p.suburb) return false;
  if (filters.verifiedOnly === true && !p.verified) return false;
  const platforms = arr("platforms");
  if (platforms && !platforms.some((pl) => p.platforms.includes(pl))) return false;
  const languages = arr("languages");
  if (languages && !languages.some((l) => p.languages.includes(l))) return false;
  const minFollowers = num("minFollowers");
  if (minFollowers !== null && p.followers < minFollowers) return false;
  const maxFollowers = num("maxFollowers");
  if (maxFollowers !== null && p.followers > maxFollowers) return false;
  const minEngagement = num("minEngagement");
  if (minEngagement !== null && p.engagement < minEngagement) return false;
  const maxPrice = num("maxPrice");
  if (maxPrice !== null && p.price_per_post > maxPrice) return false;
  return true;
}

/** Same key names/shape as src/lib/searchParamsCodec.ts's filtersToSearchParams — kept in sync by hand since this Deno function can't import from src/. */
function buildBrowseUrl(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  const stringKeys = [
    "query", "channel", "category", "province", "city", "suburb",
    "minFollowers", "maxFollowers", "minMonthlyReach", "minEngagement",
    "ageDemographic", "gender", "sortBy",
  ];
  for (const k of stringKeys) {
    const v = filters[k];
    if (typeof v === "string" && v) params.set(k, v);
  }
  if (filters.minRating && Number(filters.minRating) !== 0) params.set("minRating", String(filters.minRating));
  if (filters.maxPrice && Number(filters.maxPrice) !== 5000) params.set("maxPrice", String(filters.maxPrice));
  if (filters.verifiedOnly === true) params.set("verifiedOnly", "true");
  if (Array.isArray(filters.platforms) && filters.platforms.length) params.set("platforms", (filters.platforms as string[]).join(","));
  if (Array.isArray(filters.languages) && filters.languages.length) params.set("languages", (filters.languages as string[]).join(","));
  const qs = params.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
