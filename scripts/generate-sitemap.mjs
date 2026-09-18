#!/usr/bin/env node
// Regenerates dist/sitemap.xml at build time — "claude to fix 2" item 25
// ("SEO sitemap is still fixed-route only"). public/sitemap.xml's own
// header comment explained exactly why it only listed 13 fixed routes:
// "this is a plain Vite SPA with no build-time sitemap generation step."
// This is that step. Runs as part of npm's "postbuild" (see package.json)
// — Vite already copies public/sitemap.xml into dist/ verbatim as part
// of its normal public-dir handling; this script overwrites that copy
// with a fuller, freshly-generated one afterward.
//
// Three sources, combined:
//  1. A hardcoded list of public, indexable static routes — audited
//     directly against every <Route> in src/App.tsx (not assumed from
//     the old sitemap, which turned out to be missing dozens of real
//     public pages — /faq, /trust and its seven subpages, /for-businesses,
//     /for-publishers, /case-studies, and more never made it into the
//     original 13). Deliberately excludes: anything wrapped in
//     <RequireAuth> (dashboard/admin/account/messages/campaigns/business
//     & publisher dashboards), pure redirects (/search, /match, /t/:slug),
//     personal/empty-for-a-crawler pages (/saved-searches, /lists), auth
//     utility pages with nothing to index (/forgot-password,
//     /reset-password, /mfa-setup, /mfa-verify, /payment/cancel,
//     /payment/return), and the catch-all 404 route.
//  2. Static content files' own slugs — src/lib/blogPosts.ts,
//     businessSuccessArticles.ts, publisherSuccessArticles.ts are plain
//     TS arrays, not database tables (checked: neither Blog.tsx,
//     BusinessSuccess.tsx, nor PublisherSuccess.tsx makes a Supabase
//     call), so their slugs are read directly from source rather than
//     queried.
//  3. Live database content — approved publisher profiles (/browse/:id)
//     and channel pages (/channels/:slug), fetched from this
//     deployment's actual Supabase project over its public REST API
//     using the anon key. This is the actual fix for "once real
//     publisher inventory grows, dynamic sitemap generation becomes
//     important": every real approved publisher gets a sitemap entry,
//     refreshed on every deploy, instead of zero, forever, regardless of
//     how much real inventory exists.
//
// What this does NOT attempt: real-time updates between deploys (a
// crawler only sees what was true as of the last build — reasonable for
// how often crawlers actually re-fetch a sitemap, and a large
// improvement over "never updates at all"), or the other half of this
// task's own recommendation — prerendering/SSR/edge rendering for
// social-preview crawlers that don't execute JavaScript. That's a
// materially different, much larger change (this app's rendering
// architecture, not its build tooling) — the task itself frames it as a
// "Later introduce" recommendation at LOW/MEDIUM severity, not a
// required fix, and src/components/Seo.tsx's own header comment already
// documents the gap accurately. Not attempted here; flagged in the
// write-up, not silently skipped.
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./_env.mjs";

loadEnv();

const SITE_ORIGIN = "https://chatsched.com"; // matches robots.txt and public/sitemap.xml's own existing comment about the real domain

// ── 1. Static routes ────────────────────────────────────────────────────
// [path, priority] — priority is a rough editorial judgment (home and the
// core marketplace highest, legal/utility pages lowest), not derived from
// anything measured.
const STATIC_ROUTES = [
  ["/", 1.0],
  ["/browse", 0.9],
  ["/pricing", 0.8],
  ["/how-it-works", 0.7],
  ["/how-payment-works", 0.7],
  ["/for-businesses", 0.7],
  ["/for-publishers", 0.7],
  ["/advertise", 0.7],
  ["/about", 0.6],
  ["/categories", 0.6],
  ["/suburbs", 0.6],
  ["/channels", 0.6],
  ["/tools", 0.6],
  ["/network", 0.6],
  ["/faq", 0.6],
  ["/fees", 0.6],
  ["/budget-calculator", 0.6],
  ["/media-kit", 0.6], // real, shipped page (now also one of the seeded ChatSched Tools) — was missing from this list before schema_phase100
  ["/business-success", 0.6],
  ["/publisher-success", 0.6],
  ["/case-studies", 0.6],
  ["/blog", 0.6],
  ["/contact", 0.5],
  ["/audience-finder", 0.5],
  ["/reach-checker", 0.5],
  ["/earnings-estimator", 0.5],
  ["/channel-quiz", 0.5],
  ["/compare", 0.5],
  ["/map", 0.5],
  ["/fees/calculator", 0.5],
  ["/mission", 0.5],
  ["/transparency", 0.5],
  ["/trust", 0.5],
  ["/work-with-us", 0.5],
  ["/partners", 0.5],
  ["/careers", 0.5],
  ["/register", 0.5],
  ["/build-my-campaign", 0.5],
  ["/help", 0.5],
  ["/community", 0.5],
  ["/community/qa", 0.4],
  ["/community/announcements", 0.4],
  ["/community/events", 0.4],
  ["/trust/business-standards", 0.4],
  ["/trust/creator-standards", 0.4],
  ["/trust/disputes", 0.4],
  ["/trust/fraud-prevention", 0.4],
  ["/trust/payments", 0.4],
  ["/trust/platform-compliance", 0.4],
  ["/trust/safety", 0.4],
  ["/trust/verification", 0.4],
  ["/glossary", 0.4],
  ["/media-kit", 0.4],
  ["/investors", 0.4],
  ["/roadmap", 0.4],
  ["/press", 0.4],
  ["/compliance", 0.4],
  ["/partners/apply", 0.4],
  ["/platform-rules", 0.3],
  ["/security", 0.3],
  ["/privacy", 0.3],
  ["/terms", 0.3],
  ["/accessibility", 0.3],
  ["/login", 0.3],
];

// ── 2. Static content files — read their slugs directly from source,
// not by importing/executing the TS (would need a TS runtime this repo's
// plain Node scripts don't have; a regex is enough for "extract every
// slug/date pair from a flat array of flat objects," which is genuinely
// all these three files are).
function extractSlugsAndDates(path) {
  const src = readFileSync(path, "utf8");
  const slugs = [...src.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
  const dates = [...src.matchAll(/date:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (slugs.length !== dates.length) {
    throw new Error(`generate-sitemap: ${path} has ${slugs.length} slugs but ${dates.length} dates — its shape changed in a way this script's regex extraction no longer matches safely. Fix the extraction (or the file) before trusting this sitemap.`);
  }
  return slugs.map((slug, i) => ({ slug, date: dates[i] }));
}

const contentUrls = [
  ...extractSlugsAndDates("src/lib/blogPosts.ts").map(({ slug, date }) => ({ path: `/blog/${slug}`, priority: 0.5, lastmod: date })),
  ...extractSlugsAndDates("src/lib/businessSuccessArticles.ts").map(({ slug, date }) => ({ path: `/business-success/${slug}`, priority: 0.5, lastmod: date })),
  ...extractSlugsAndDates("src/lib/publisherSuccessArticles.ts").map(({ slug, date }) => ({ path: `/publisher-success/${slug}`, priority: 0.5, lastmod: date })),
];

// ── 3. Live database content ────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function fetchDynamicUrls() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("generate-sitemap: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set — skipping publisher/channel URLs. The rest of the sitemap (static routes + content articles) is still generated normally.");
    return [];
  }

  const headers = { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` };
  const urls = [];

  // Anon-key REST call against publishers_public (schema_phase82_restrict_public_publisher_columns.sql),
  // not the base publishers table — that migration narrowed the base
  // table's own SELECT policy to own-row-or-admin only, specifically to
  // stop anon/public requests from reading it directly (it was exposing
  // payout details, admin notes, and other sensitive columns to anyone).
  // publishers_public is the safe view built for exactly this kind of
  // public read, already filtered to status = 'approved' at the view
  // definition itself — same reasoning as before (trust the one real
  // policy/view instead of duplicating its condition here), just
  // pointed at the view that's now the actual public read surface.
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/publishers_public?select=id,created_at`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const publishers = await res.json();
    for (const p of publishers) {
      urls.push({ path: `/browse/${p.id}`, priority: 0.6, lastmod: p.created_at?.slice(0, 10) });
    }
  } catch (err) {
    console.warn(`generate-sitemap: couldn't fetch publishers for the sitemap (${err.message}) — continuing without them.`);
  }

  // Every registered channel, active or not — a "coming soon, apply now"
  // channel page is still real, public, indexable content (distinct from
  // "claude to fix 2" item 23's fix, which was about hiding not-yet-launched
  // channels from business-facing discovery/browse, not about hiding
  // their page from search engines entirely).
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/channels?select=slug`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const channels = await res.json();
    for (const c of channels) {
      urls.push({ path: `/channels/${c.slug}`, priority: 0.5 });
    }
  } catch (err) {
    console.warn(`generate-sitemap: couldn't fetch channels for the sitemap (${err.message}) — continuing without them.`);
  }

  // ChatSched Tools (schema_phase100) — same reasoning as channels above:
  // RLS already limits this query to status in (active, coming_soon), the
  // only two statuses ToolDetail.tsx ever renders publicly, so anything
  // returned here is real, indexable content.
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/tools?select=slug,updated_at`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const tools = await res.json();
    for (const t of tools) {
      urls.push({ path: `/tools/${t.slug}`, priority: 0.5, lastmod: t.updated_at?.slice(0, 10) });
    }
  } catch (err) {
    console.warn(`generate-sitemap: couldn't fetch tools for the sitemap (${err.message}) — continuing without them.`);
  }

  return urls;
}

function urlEntry({ path, priority, lastmod }) {
  const loc = `${SITE_ORIGIN}${path}`;
  const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `  <url><loc>${loc}</loc>${lastmodTag}<priority>${priority.toFixed(1)}</priority></url>`;
}

const dynamicUrls = await fetchDynamicUrls();

const allEntries = [
  ...STATIC_ROUTES.map(([path, priority]) => urlEntry({ path, priority })),
  ...contentUrls.map(urlEntry),
  ...dynamicUrls.map(urlEntry),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Generated by scripts/generate-sitemap.mjs at build time — do not hand-edit,
  changes here won't survive the next build. Edit STATIC_ROUTES in that
  script for fixed pages, or the relevant src/lib/*Articles.ts /
  blogPosts.ts file for content pages; publisher/channel URLs come from
  the live database automatically.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.join("\n")}
</urlset>
`;

writeFileSync("dist/sitemap.xml", xml);
console.log(`generate-sitemap: wrote dist/sitemap.xml — ${STATIC_ROUTES.length} static routes, ${contentUrls.length} content articles, ${dynamicUrls.length} live publisher/channel URLs.`);
