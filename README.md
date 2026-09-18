# ChatSched

A South African marketplace connecting small businesses with publishers and creators — social media pages/groups, influencers, websites, podcasts, and radio — to book advertising.

> **New to this codebase?** Read [`CLAUDE_1.0.md`](./CLAUDE_1.0.md) first —
> a running, plain-language log of a recent work session that found and
> fixed a real regression in the `channel_requests` state machine (the
> counter-offer flow was silently broken), plus PayFast cancellation,
> launch-credit forfeiture, and bulk request creation. It explains *why*
> those changes exist in more depth than the individual
> `PHASE*_DELIVERY.md` files do, and lists what's still genuinely open.

## Stack
Vite + React 19 + TypeScript + React Router + Tailwind CSS, backed by Supabase (Postgres + Auth + Edge Functions). Payments via PayFast, notification emails via Resend. AI is scoped narrowly and deliberately: the business-facing AI Content Studio runs on the Anthropic API (Claude), the admin-only publisher authenticity check runs on Cloudflare Workers AI, and publisher matching (`/audience-finder`) is fully rule-based — no AI call at all. All AI/API calls happen only from Edge Functions, never from the browser.

## Setup (one-time)
1. Create a free project at [supabase.com](https://supabase.com).
2. Database: two options —
   - **Full setup (recommended)** — `DATABASE_URL=postgres://...(your project's connection string).../postgres ./supabase/run-all-migrations.sh` applies `schema.sql` and every `schema_phase*.sql` file (74 files, numbered up to `schema_phase78` — a few numbers in between were retired/merged during this repo's history, the script's own header explains), in correct numeric order, giving you every feature this README documents below plus everything documented only in `CLAUDE_1.0.md`/`2.0.md`/`3.0.md` and the individual `PHASE*_DELIVERY.md` files. Needs `psql` on your machine and your project's connection string from **Project Settings → Database**. **Not yet run against a real database as of `CLAUDE_3.0.md`'s own note on it** — if it fails partway, it stops at the first broken file (`ON_ERROR_STOP=1`) rather than leaving things silently half-applied; open an issue with which file failed.
   - **Minimal/quick start** — Supabase dashboard → **SQL Editor → New query** → paste the contents of `supabase/schema.sql` → **Run**. Gets you the original prototype schema only (publishers, requests, reviews) — none of the phases below. Fine for a quick look at the codebase; not what any real deployment should run.
3. Optional but recommended, so the site isn't empty: run `supabase/seed.sql` the same way — it loads the 8 pilot publishers the prototype shipped with.
4. In **Project Settings → API**, copy your **Project URL** and **anon public key**.
5. Copy `.env.example` to `.env` and paste those two values in.
6. `npm install`, then `npm run dev`.

Without step 5, the app still runs — pages that need live data show a small "connect the database" notice instead of crashing.

### Making yourself an admin
1. Register a normal account at `/register`.
2. Supabase dashboard → **Authentication → Users** → copy your user's UUID.
3. SQL Editor: `update public.profiles set role = 'admin' where id = 'paste-uuid-here';`
4. Log out and back in on the site — you'll land on `/admin` instead of `/dashboard`.

### A note on email confirmation
By default, new Supabase projects require confirming a signup email before login works. For faster local testing, you can turn this off: **Authentication → Providers → Email → Confirm email**. Worth turning back on before real businesses sign up.

### If you ran the full migration script
Skip straight to "Setup — Phase 2" below for the Edge Function deploy steps (PayFast, `notify`, etc. — the script applies the SQL, it doesn't deploy Edge Functions or set secrets, follow `supabase/DEPLOY.md` for those regardless of which database option you picked). The "Setup — Phase 2/3" and "Phase 17" sections' own SQL-editor steps are already covered by the script — don't re-run them by hand, they're describing what's already in your database now, not a to-do list. Everything from "Error tracking & analytics" onward is feature documentation, not sequential setup steps, for either path.

## Setup — Phase 2 (payments, payouts, reviews)
1. SQL Editor → run `supabase/schema_phase2.sql` (after `schema.sql` — it adds `payments`, `reviews`, and an `agreed_amount` column on `requests`).
2. Follow `supabase/DEPLOY.md` to deploy the two PayFast Edge Functions and set their secrets. This part needs the Supabase CLI — it can't be done from the dashboard alone.
3. Until the Edge Functions are deployed, "Pay now" on the dashboard will fail — everything else in the app works fine without them.

## Setup — Phase 3 (messaging, notifications, Audience Finder)
1. SQL Editor → run `supabase/schema_phase3.sql` (adds a `messages` table for the per-request thread between a business and admin).
2. `supabase/DEPLOY.md` now also covers the `notify` function and the secrets it needs (`ADMIN_EMAIL`, `RESEND_API_KEY`).
3. Everything degrades gracefully without those secrets set: messaging still works without `notify` deployed (you just won't get emailed about it). Publisher matching (`/audience-finder`) is rule-based and needs no secret at all.

## Phase 4 (SEO) — and what's deliberately not here
No new setup steps — everything below is static files and per-page code, nothing to deploy or configure.

- **Meta tags, Open Graph, Twitter Cards, JSON-LD** in `index.html` — what non-JS crawlers and generic link shares see. Swap the placeholder `chatsched.com` domain for your real one (search-replace across `index.html`, `robots.txt`, `sitemap.xml`), and add a 1200×630 `/public/og-image.png` when you have one — there's a commented-out tag waiting for it.
- **Per-page titles and descriptions** via `src/components/Seo.tsx`, using React 19's native `<title>`/`<meta>` hoisting — no react-helmet dependency needed. Helps the browser tab/history and JS-executing crawlers (Google). Auth-only pages (dashboard, admin, login, register, payment result) are marked `noindex`.
- **`robots.txt` and `sitemap.xml`** in `/public`, covering the fixed public routes. Doesn't include individual `/browse/:id` publisher pages yet — see the comment in `sitemap.xml` for why, and what adding that later would look like.

**Worth knowing:** this is a client-rendered SPA with no server-side rendering, so per-page Open Graph tags only exist after JavaScript runs. Most social-preview bots (Facebook, WhatsApp, X, LinkedIn) fetch raw HTML and never execute JavaScript — they'll always see `index.html`'s static tags, never a specific publisher's. A real fix means server-side rendering or a prerendering layer, which is a bigger architectural change than fits here (and contradicts the original "don't change the tech stack" brief) — worth knowing about, not worth building today.

**Deliberately not built this pass, and why:**
- **Blog** — the original brief wanted a full CMS with categories. Building an editor and taxonomy before there's a single post to publish, or a content plan, is backwards. Worth revisiting once there's actually something to write and someone to write it.
- **Fraud detection** — at pilot volume, with every request going through an admin who reviews it by hand, a human already *is* the fraud detection. A bolted-on automated risk score with a handful of transactions would be decoration, not protection — the kind of thing this whole build has tried to avoid.
- **The "future modules" list** (WhatsApp/podcast/newsletter inventory, agency dashboard, white-label, public API, mobile apps, CRM) — the original brief's own instruction here was to architect so these could be *added later without a rewrite*, not to build them now. The type/table/Edge-Function boundaries already in place (one concern per file, RLS per table) are what keeps that door open — there isn't a specific piece of code this pass needed to add for it.

## Phase 17 (multi-channel marketplace: new channels, Suburbs, and the request workflow)
Note on numbering: several phases of work happened in this codebase between Phase 4 and this one without a matching README section — this one picks up the existing `schema_phase<N>.sql` numbering in the repo, not the README's. **This is also where this README's own sequential walkthrough historically stopped, 61 migrations short of where the schema actually is (`schema_phase78`).** If you're setting up a new project, use "Full setup" under "Setup (one-time)" above instead of trying to follow this and the sections after it as a run-these-in-order guide — they document *what* Phase 17 (and Phase 2–78 generally) built, not a checklist to execute by hand. See `NEXT_STAGE_DEVELOPMENT_BRIEF.md` and `CLAUDE_1.0.md`/`2.0.md`/`3.0.md` for what phases 18–78 actually built; a full section-by-section rewrite of this README for all 78 is real, not-yet-done work (`NEXT_STAGE_DEVELOPMENT_BRIEF.md` Task 4) — the script above closes the *setup* gap, not the *documentation* one.

Covers: retiring 8 unused channel placeholders, launching 4 real ones (influencer, website, podcast, radio) with their own dedicated pages and a no-online-checkout request → approve/decline workflow, merging Browse and Search into one page, adding a Suburbs browse dimension, and 3 new platform options (X, LinkedIn, YouTube).

1. SQL Editor → run `supabase/schema_phase17_channel_marketplace.sql` (after every prior `schema_phase*.sql`). Adds `channel_slug`/`suburb` to `publishers` and the new `channel_requests` table — see that file's header comment for the full escrow/payment state machine, and why the two 7-day windows are sequenced rather than run concurrently.
2. No new Edge Functions, secrets, or env vars required to launch — the 4 channel flags in `.env.example` now default to **on** even left blank (they're kill switches, not opt-ins; see `src/lib/featureFlags.ts`), so the new channels go live the moment this deploys.

**What's real:** the whole loop — a creator applies to a specific channel (from a channel page's "Apply as a creator" link, or `/register?role=publisher`), goes through the same by-hand admin review as any other publisher, appears in the directory (filterable by channel and suburb from the merged `/browse`), a business finds them and submits a request with a proposed budget from their profile, the creator approves or declines it from their own dashboard — self-serve, no admin relay needed for that step — and Admin's role narrows to the two moments that need a human confirming money actually moved: payment received, and payout sent.

**Deliberately not built this pass:**
- **No automatic expiry job.** The 7-day/48-hour deadlines are real (Postgres-generated columns, always correct), shown in both dashboards and in Admin's "Overdue" filter — but nothing runs on a schedule to auto-close an unresponsive request yet. Closing one is a manual admin action, same "a human is the safety net at pilot volume" reasoning as the fraud-detection note above.
- **No in-thread messaging on channel_requests** — `MessageThread`/`messages` stays scoped to the original `requests` table. A business and creator work from the campaign message + proposed amount only; wiring messaging in here would mean a real schema change beyond what this pass needed.
- **Suburb data is Cape Town-only, and not yet in Admin's manual "add publisher" form** — `CAPE_TOWN_SUBURBS` in `src/lib/constants.ts` is a fixed list; a creator can set their own suburb when they self-serve apply, admin just can't set it by hand yet for a manually-added row.

## Error tracking & analytics
Both are real integrations, both fully optional, both off by default — set the env var and they turn on, leave it blank and the app runs exactly as before.
- **Errors** (`src/lib/errorTracking.ts`, Sentry): set `VITE_SENTRY_DSN` to send uncaught errors there — render-phase crashes (via `ErrorBoundary.tsx`), unhandled promise rejections, and stray `window.onerror` events all report through the same `reportError()`. Without a DSN, everything still logs to the console (so local dev needs nothing here); it just never leaves the browser of whoever hit it. `sendDefaultPii` is off and `tracesSampleRate` is `0` — this is error capture only, not performance/session tooling, on purpose.
- **Analytics** (`src/lib/analytics.ts`, Plausible): set `VITE_PLAUSIBLE_DOMAIN` to start tracking pageviews. Chosen specifically because it's cookieless and doesn't build ad profiles — matches what `Privacy.tsx` already promises without needing a cookie-consent banner to stay honest about it. No script loads at all, not even to plausible.io, until the env var is set. `<AnalyticsListener>` in `App.tsx` fires a pageview on every route change (Plausible's default script can't see SPA navigation on its own).

## Admin two-factor authentication
Mandatory, not optional — `/admin` controls request approvals, payment confirmation, and payout sign-off for the whole marketplace, so a compromised password alone shouldn't be enough to get in.
- The first time an admin account visits `/admin`, `RequireAuth.tsx` redirects to `/mfa-setup` instead of letting them through — a TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.) is enrolled there via Supabase's real `auth.mfa` API, not a placeholder. From then on, each new session that hasn't yet cleared a challenge goes to `/mfa-verify` instead.
- This uses Supabase's Authenticator Assurance Level (AAL) directly — `aal.current !== aal.next` means a verified factor exists but this session hasn't proven it yet; `aal.current === aal.next === "aal1"` means no factor is enrolled at all. `AuthContext.tsx` tracks this alongside `user`/`profile`.
- An admin who gets a new phone can self-serve from Admin → Security (`AdminSecurity.tsx`): remove the old factor and get sent straight into `/mfa-setup` again. If they're locked out entirely (lost the device, never got that far), there's currently no in-app recovery-code fallback — another admin has to remove the stale factor for them, or you do it via Supabase dashboard → Authentication → Users → that user → MFA factors. Worth knowing before you need it.
- Only the `admin` role is gated this way. Business and publisher accounts are untouched.

## Scheduled request expiry
Channel requests (influencer/website/podcast/radio) that go unanswered or unpaid past their deadline used to need an admin to notice and close them by hand from Admin → Channel Requests ("Close as expired" / "Cancel — unpaid"). Now a scheduled job does it automatically, every 30 minutes by default, and emails the business explaining why. See "Scheduled request expiry" in `supabase/DEPLOY.md` for the full setup — it needs a manual, un-committed `cron.schedule(...)` call (not a migration file) because that command has to embed a real secret, and this repo's migrations are meant to be safe to commit. The original social-media/PayFast flow has no equivalent deadlines and isn't affected.

## Self-service account deletion & data export
`/account` (`AccountSettings.tsx`) — reachable from the Header, both dashboards, and Privacy.tsx's "Your rights" section. Export is pure client-side (`src/lib/accountExport.ts`, no deploy step); deletion is a real `auth.admin.deleteUser()` call behind the `delete-account` Edge Function, gated so it refuses while anything financially unresolved is tied to the account (an in-progress request, a pending payment, an active channel campaign as business or creator, an open dispute) rather than letting one side make an active campaign vanish out from under the other. See "Self-service account deletion & data export" in `supabase/DEPLOY.md` for the deploy step and a real caveat worth reading before this goes live — deletion cascades through completed financial records too, with no independent retention for SARS-style recordkeeping.

## Rate cards
A social-media publisher can now break their pricing into named line items (Story, Feed post, Reel, a bundle) instead of one flat number — shown on the public profile in the same spot the flat price always occupied, falling back to that flat number unchanged for anyone who hasn't set one up. `publishers.price_per_post` keeps meaning exactly what every existing consumer already expects (Browse's price filter, ComparePublishers, AudienceFinder, MediaKit) — a database trigger just keeps it synced to the cheapest rate-card line item once one exists, so none of those files needed to change. See "Rate cards" in `supabase/DEPLOY.md` for what's worth testing.

## "What happens next" clarity mid-flow
Escrow was previously only explained on the static `/how-payment-works` page — reassuring in the abstract, but not present at the actual moment someone's about to hand over money, which is when "is this safe" hesitation really happens. A small `EscrowNote.tsx` now shows right at both payment steps (`ChannelCampaignCard.tsx` and `Dashboard.tsx`'s EFT/PayFast flow): "Held by ChatSched until X — not released to the creator before then," linking through to the full explainer for anyone who wants more. Several other real gaps got the same treatment while auditing this: the original request form had zero forward-looking copy at all (submit → dead silence until an admin acts), `pending`/`contacted`/`declined` requests showed a bare status badge with no explanation, and both flows went quiet between "paid" and "completed" with no indication anything was still expected to happen. All filled in with copy specific to what's actually true at each step — see the individual status blocks in `Dashboard.tsx`, `ChannelCampaignCard.tsx`, and `PublisherProfile.tsx` for the exact wording. No schema change, no new deploy step — purely UI copy plus one small shared component.

## Publisher-side traction visibility
The publisher dashboard now shows real profile-view counts (last 7 days / last 30 days / all time) with a contextual nudge — different advice for "no views yet" vs. "views but no requests" vs. "here's your conversion rate." Deliberately count-only, never identity: a publisher sees how many people looked, never who. See "Publisher-side traction visibility" in `supabase/DEPLOY.md` for what counts as a view and what's deliberately excluded (self-views, admin views, same-day repeat views from one visitor).

## Counter-offers on the Request Feature workflow
A creator responding to a request (influencer/website/podcast/radio) now has a third option beyond approve/decline: propose a different price. One round only — the business accepts or declines that counter, no back-and-forth beyond it — and accepting it overwrites `proposed_amount` with the agreed figure, so every downstream read of that field (payment instructions, payout math, admin's commission breakdown) reflects the real price automatically. See "Counter-offers on the Request Feature workflow" in `supabase/DEPLOY.md` for the schema details and the one thing worth testing deliberately (that the countered price, not the original ask, is what actually gets paid).

## Social account connect
"Connect your social account" on the publisher dashboard — real OAuth against YouTube, Facebook Pages, Instagram, and TikTok's official APIs, importing a creator's real follower count instead of asking them to type it in. An AI step (same Claude Haiku call `content-studio-generate` already uses) then writes a short, factual audience summary from those real numbers, shown on the public profile. X, LinkedIn, Facebook Group, and WhatsApp Channel show as "not yet" with the actual reason why — see "Social account connect" in `supabase/DEPLOY.md` for what each requires (all four working platforms are genuinely free to call, but each needs its own developer app and, for Meta/TikTok, a real app-review process before it works for anyone beyond your own test accounts).

## Message read receipts ("seen" state)
Both message systems — the request-scoped business<->admin thread and the 1:1 business/publisher conversation inbox — now show "Seen" under your own last message once the other person's actually opened the thread, instead of leaving you wondering whether it landed. RLS enforces who can mark what read (never the sender themselves; an admin can read a business<->publisher conversation but deliberately can't mark it seen, since that's not their thread to confirm). See "Message read receipts" in `supabase/DEPLOY.md` for exactly what "seen" does and doesn't mean.

## Recently viewed
Home and Browse now show a "Continue where you left off" strip of publishers the current business has actually looked at, most recent first — reusing the same profile-view tracking that already powers publisher-side traction (`publisher_profile_views`), not a second tracking system. Renders nothing at all when there's no history yet, rather than an empty placeholder box. See "Recently viewed" in `supabase/DEPLOY.md` for the one RLS policy this needed and what's worth testing.

## Publisher dashboard reorganization
`PublisherDashboardView.tsx` had grown to ten stacked sections before a publisher ever saw their actual requests — every one added for a good reason individually, but the sum stopped being one. Now it's two tabs: **Requests** (default — badges, a slim "X setup steps left" nudge if the getting-started checklist isn't done, the traction panel, then the requests list) and **Manage listing** (the checklist, Connect Social Accounts, profile editing, portfolio, pricing/rate cards, placement/ad formats). Nothing about what renders changed, only when it's visible — see "Publisher dashboard reorganization" in `supabase/DEPLOY.md`. No schema change, no deploy step.

## Build for production
```
npm run build
```
Outputs a static `dist/` folder — deployable to Netlify, Vercel, or any static host with zero config. Remember to set the two `VITE_SUPABASE_*` env vars in whatever host you use, the same way you did locally. The build also generates production security headers (CSP and friends) from those same env vars — see "Production security headers" in `supabase/DEPLOY.md` for how that reaches the browser on each hosting platform.

Every route except Home, Browse, and a publisher's profile page is code-split (`React.lazy()` in `src/App.tsx`) — see `supabase/DEPLOY.md`'s "Code-splitting" section. A visitor loading Home never downloads the Admin panel's or Marketing Suite's JS; those chunks fetch only when actually navigated to.

## What's real vs. placeholder
- Home, Browse (with working filters), Publisher Profile, Categories, Pricing, How It Works, and About are all built against **real Supabase data** — no more mock data in the repo.
- Login and Register are real (Supabase Auth). Businesses can create an account and log in. Forgot-password is real too (`/forgot-password` → `/reset-password`, Supabase's own recovery-link flow) — previously missing entirely, so a locked-out user had no self-service way back in.
- The Contact form saves to the database instead of opening an email draft.
- A business can request a campaign directly from a Publisher Profile page — it's saved to `requests` and shows up on their `/dashboard` and in `/admin`.
- `/admin` is a real, authenticated panel (not a demo): manage incoming requests and their status, add publishers to the directory, and read Contact form submissions. Every admin account is also required to set up two-factor authentication before it can be used — see "Admin two-factor authentication" below.
- Once an admin confirms a request and sets an **agreed amount**, the business can pay for real through PayFast from their dashboard. Payment status only ever changes via PayFast's server-to-server confirmation (the ITN webhook) — never from the page the browser happens to land on, so it can't be faked by just navigating to a "success" URL.
- Payouts to publishers are tracked, not automated — once a payment is marked `paid`, `/admin` shows what's owed (88% of the payment, after the 12% platform commission — see `PLATFORM_COMMISSION_RATE` in `src/lib/constants.ts` if that changes) and lets an admin mark it as sent once the real bank transfer happens.
- Reviews are real: a business can rate and comment on a campaign once an admin marks its request `completed`, and it shows up on the publisher's public profile.
- Publishers/creators self-serve apply at `/apply` (channel-aware since Phase 17 — see below) and go through admin review from there; the directory only ever shows approved ones.
- Every request on the original social-media flow has a real message thread between the business and an admin (relaying anything that needs to reach the publisher). The 4 request-flow channels added in Phase 17 skip this — see that section for why.
- New requests, new messages, and status changes each trigger a real email via Resend — not simulated, and it fails silently (never blocking the action that triggered it) if Resend isn't configured yet.
- `/audience-finder` (formerly "AI Match") is a real matching tool, not a static filter — and, since this update, deliberately not an AI call either: a business describes who they want to reach in plain language, and a rule-based ranking pass (`marketingSuite.ts`) scores the actual publisher directory against it with a specific, grounded reason per match — category, location, audience-text overlap, price fit, engagement. Worth knowing: with a small directory this is closer to "a well-explained filter" than a mature ranking model; it gets more useful as the directory grows past what someone would comfortably scan by eye themselves.
- Campaign Tracker (Marketing Suite tab, business dashboard) is real, not an estimate — unlike the Campaign Builder's "Est. clicks/leads" numbers next to it. A business creates a tracking link, gets a short redirect URL (`chatsched.com/t/<slug>`) plus a UTM-tagged version of their own destination, and every click through the redirect is logged for real. Visits, leads, and conversions come from a small embed snippet the business pastes onto their own site — see `supabase/DEPLOY.md`'s "Campaign tracking" section for how to test the whole loop.
- The "Campaign performance" section on `/dashboard` (above the Marketing Suite) rolls up real totals across every campaign a business has — not a separate mock summary. Same `campaign_stats` view Campaign Tracker itself reads, just summed — see `supabase/DEPLOY.md`'s "Business-side campaign rollup" section.
- Every data-heavy Admin tab (Requests, Applications, Publishers, Businesses, Messages, Reports, Disputes, and the multi-channel booking table — counter-offer-aware) has a real "Export CSV" button — client-side, downloads exactly what's currently loaded/filtered on screen, no server round trip. Deliberately not on `AdminPayouts.tsx`, which is the experimental batch/ledger pipeline, not live payout data — see `supabase/DEPLOY.md`'s "CSV export from Admin" section.
- The "Your traction" panel on the publisher dashboard is built from real profile-view events, not a placeholder metric — see "Publisher-side traction visibility" above for exactly what counts as a view and why it's count-only, never identity.
- "Download Media Kit" on a Publisher Profile (`/media-kit?publisher=<id>`) generates a real, branded, multi-page PDF client-side via jsPDF — profile, category, location, platforms, followers, engagement, audience description, pricing, ad formats, portfolio (embeds the actual images where the browser can fetch them, falls back to a text list otherwise), reviews, trust score/level/verification, and campaign history. Nothing is stored or sent to a server; it's assembled fresh from the same data already on the public profile. No AI or paid service involved — see `src/lib/mediaKit.ts`.
- The "Active today" / "Active 2 hours ago" / "Inactive for 14 days" badge on a Publisher Profile is a real signal, not a random placeholder — it comes from `publishers.last_active_at`, set by a throttled heartbeat on login/session refresh (see `supabase/DEPLOY.md`'s "Last-active indicator" section). Deliberately coarse on purpose — see `src/lib/lastActive.ts`.
- `/account` is real self-service, not a "contact us" form: export downloads an actual JSON of everything tied to your account, and deletion actually calls `auth.admin.deleteUser()` — see "Self-service account deletion & data export" above and its caveat about financial-record retention before you rely on it at scale.
- "💾 Save this search" on `/browse` is a real saved-search-with-alerts feature, not a bookmark that quietly does nothing — see `/saved-searches` and `supabase/DEPLOY.md`'s "Saved searches with alerts" section. A new matching publisher triggers both an in-app bell notification (trigger-driven) and a real email.
- "Connect your social account" on the publisher dashboard is real OAuth against YouTube/Facebook Pages/Instagram/TikTok's actual APIs, not a form pretending to import data — see "Social account connect" above for what each platform needs before it works for real users, and why X/LinkedIn/Facebook Group/WhatsApp Channel aren't offered at all rather than offered and broken.
- A creator responding to a Request Feature channel campaign can propose a different price instead of only approving or declining — see "Counter-offers on the Request Feature workflow" above. One round only, and accepting it is what the business actually pays, not the original ask.
- A social-media publisher can break their pricing into named rate-card items instead of one flat number — see "Rate cards" above. The flat `price_per_post` figure everywhere else in the app already reads keeps working unchanged; it's kept in sync with the cheapest item by a database trigger, not by any of those files knowing rate cards exist.
- The language switcher (Header/Footer) is real i18next, not decorative — Header, Footer, and Home are fully translated into Afrikaans, isiXhosa, and isiZulu, with the choice persisted across visits. The rest of the app is still English-only by design for now — see "Localization" above. isiXhosa and isiZulu have had a careful non-native review pass (fixed a duplicated-word typo and two terminology inconsistencies in isiZulu's `home.json` — see `CLAUDE_3.0.md`), but still haven't been checked by an actual native speaker before fully relying on them.
- `/faq` is a real, searchable FAQ pulling facts from across the actual product (escrow timings, commission split, dispute categories, counter-offers, rate cards) rather than generic Q&A — the numbers in it are interpolated straight from `constants.ts`/`pricingEngine.ts`, so they can't silently drift out of sync with the real values. See "FAQ page" above.
- Both message systems show a real "Seen" indicator, backed by RLS-enforced read receipts — not a UI-only flag either side could fake. See "Message read receipts" above for exactly what "seen" does and doesn't guarantee.
- "Continue where you left off" on Home/Browse is a real recently-viewed list, not a random sample — see "Recently viewed" above for what it's built on and why it shows nothing at all rather than a placeholder when there's no history yet.

## Before going live
- Swap the WhatsApp number (`27821234567`) for the real one — it appears in `Header.tsx`, `Contact.tsx`, and `PublisherProfile.tsx`.
- Turn email confirmation back on in Supabase Auth if you turned it off for testing.
- Replace or add to the seeded pilot publishers with real ones via `/admin`.
- Double-check Row Level Security is enabled on all tables (schema.sql and schema_phase2.sql both turn it on, but worth confirming in Table Editor before anyone's real data goes in).
- Confirm the commission — `PLATFORM_COMMISSION_RATE` in `src/lib/constants.ts` is set to 12% (publishers keep 88%). Check it's still what you want before real payouts depend on it.
- Switch `PAYFAST_MODE` to `live` and redeploy the Edge Functions with live PayFast credentials (see `supabase/DEPLOY.md`) — everything defaults to PayFast's sandbox until you do.
- Verify a real sending domain in Resend and set `RESEND_FROM` — until then, notification emails send from a shared sandbox address that won't reliably land in a stranger's inbox.
- Swap the placeholder `chatsched.com` domain in `index.html`, `robots.txt`, and `sitemap.xml` for your real one, and add `/public/og-image.png` if you want link shares to show a preview image.
- Sanity-check the Phase 17 numbers that were judgment calls, not given figures: radio's eligibility minimum (`10,000` weekly listener reach — the brief had numbers for podcast/website/influencer but not radio, so this is an estimate in `src/channels/radio/index.ts`), and the `CAPE_TOWN_SUBURBS` list in `src/lib/constants.ts` (add/remove suburbs to match where you actually have coverage).
- Set `VITE_SENTRY_DSN` and `VITE_PLAUSIBLE_DOMAIN` (see "Error tracking & analytics" above) — without them you have no visibility into errors real users hit or how the site's actually being used, beyond what they tell you directly.
- Confirm MFA/TOTP is enabled for your Supabase project (Authentication → Settings — it's on by default, but worth a look) and walk through `/mfa-setup` yourself on the actual admin account(s) before real requests start needing approval, so you're not locked out figuring it out under pressure.
- Set up the scheduled request-expiry job (see "Scheduled request expiry" above) — without it, overdue channel requests just sit there until an admin happens to notice and close them by hand.
- Deploy `delete-account` (see "Self-service account deletion & data export" above) and actually read its retention caveat — decide whether cascading away completed financial records on deletion is acceptable for your recordkeeping obligations before real businesses start closing accounts.
- If you want "Connect your social account" live, register a developer app with whichever of YouTube/Meta/TikTok you want to support (see "Social account connect" above) — none of it works until real client IDs/secrets are set, and Meta/TikTok's app review isn't instant. It's not required for launch — the manual follower-count field still works fine without it.
