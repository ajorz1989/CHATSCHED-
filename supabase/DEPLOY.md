# Deploying the Edge Functions

I couldn't deploy or test-run these myself — this sandbox can't reach
supabase.com, deno.land, payfast.co.za, resend.com, or api.cloudflare.com.
Everything below is written from each service's current documentation, but
the first real test of this will be in your project, not mine. That's
normal for integrations like these, not a sign something's wrong — see "If
the first test fails" below.

## 1. Install the Supabase CLI and link your project
```
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
```
Your project ref is in the Supabase dashboard URL: `supabase.com/dashboard/project/<this-part>`.

## 2. Get PayFast sandbox credentials
Sign up at https://sandbox.payfast.co.za (free) for your own sandbox merchant
ID, key, and passphrase. PayFast also publishes shared test credentials
(merchant ID `10000100`, key `46f0cd694581a`) used across most of their
tutorials and sandboxes — fine for a first smoke test, but your own sandbox
account will let you set a passphrase and see transactions in a dashboard
that's actually yours. Either way, double-check current values on PayFast's
site — sandbox credentials aren't something I can verify from here.

## 3. Set secrets
```
supabase secrets set PAYFAST_MERCHANT_ID=your-merchant-id
supabase secrets set PAYFAST_MERCHANT_KEY=your-merchant-key
supabase secrets set PAYFAST_PASSPHRASE=your-passphrase
supabase secrets set PAYFAST_MODE=sandbox
supabase secrets set SITE_URL=http://localhost:5173
supabase secrets set ADMIN_EMAIL=you@example.com
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-api-key
supabase secrets set CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
supabase secrets set CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
```
`SITE_URL` should be wherever the site is actually reachable — swap it to
your real domain once deployed. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
don't need setting — Supabase injects those into every Edge Function
automatically. `ADMIN_EMAIL`, `RESEND_API_KEY`, and `ANTHROPIC_API_KEY` are
Phase 3 additions — see the bottom of this file if you're only deploying
Phase 2's payment functions for now. `ANTHROPIC_API_KEY` is only used by
`content-studio-generate` now (the business-facing AI Content Studio) —
every other AI feature on the site is either rule-based (publisher
matching, no key needed at all) or runs on Cloudflare Workers AI
(`publisher-authenticity-check`, needs the two `CLOUDFLARE_*` secrets
instead). Get a Workers AI-scoped API token from the Cloudflare dashboard
(My Profile → API Tokens) and your account ID from the URL of any page in
the Cloudflare dashboard, or the account home sidebar.

## 4. Deploy
```
supabase functions deploy payfast-checkout
supabase functions deploy payfast-notify --no-verify-jwt
supabase functions deploy notify
supabase functions deploy content-studio-subscribe
supabase functions deploy content-studio-generate
supabase functions deploy publisher-authenticity-check
```
The `--no-verify-jwt` on `payfast-notify` is not optional — PayFast's server
calls this one directly, with no Supabase login, so if JWT verification is
left on, Supabase rejects the call with a 401 before your code ever runs and
payments will look like they silently vanish. Every other function here
expects a logged-in user and should keep normal JWT verification.

## 5. Test in the sandbox
1. Make sure `PAYFAST_MODE=sandbox` is set (step 3).
2. As an admin, confirm a request and set an agreed amount.
3. As that business, click "Pay now" and complete a test payment on PayFast's
   sandbox checkout.
4. Check the payment shows `paid` on the dashboard and in `/admin` — this
   confirms the ITN round-trip actually worked, not just the redirect.
5. Function logs (`supabase functions logs payfast-notify`) will show
   exactly where anything failed — signature, PayFast's validate check, or
   the amount cross-check.

## 6. Test the Phase 3 pieces
- **Messages & notifications**: post a message from a business's dashboard,
  then check the admin inbox tied to `ADMIN_EMAIL` got an email — and the
  reverse, a message from `/admin` should email the business. Until you
  verify your own sending domain with Resend, emails send from
  `onboarding@resend.dev`, which works immediately but only actually lands
  for addresses you've confirmed in your Resend dashboard — verify a real
  domain before expecting a stranger's inbox to receive one. If
  `RESEND_API_KEY` isn't set at all, `notify` just skips sending rather than
  breaking the request/message it was attached to.
- **Audience Finder** (rule-based, no key/deploy needed at all): log in as a
  business, go to `/audience-finder`, describe a business and target
  customer, and check the ranked results reference real specifics from your
  publisher directory (category, city/suburb, price) rather than
  generic-sounding reasons — every reason shown traces back to the actual
  scoring logic in `marketingSuite.ts`, so if a reason looks wrong it's a
  real bug in that file, not a model being vague.
- **AI Content Studio** (`content-studio-subscribe` + `content-studio-generate`,
  run `schema_phase22_content_studio.sql` first): as a business, open
  Marketing Suite → AI Content Studio and subscribe — this is a *recurring*
  PayFast checkout (`subscription_type=1`), so confirm PayFast's sandbox
  actually shows it as a subscription, not a one-off payment, and that
  `content_studio_subscriptions.status` flips to `active` after the ITN
  round-trips (same signature/validate/amount checks as `payfast-notify`'s
  existing one-off path, just routed by the `custom_str1=content_studio_subscription`
  flag). Then upload a photo or type a brief, generate, and check the 9
  outputs come back distinct per format (WhatsApp under ~140 chars, X under
  280, etc.) rather than one blob repeated nine times. Hit generate more than
  `CONTENT_STUDIO_DAILY_LIMIT` times (constants.ts) in a day to confirm the
  429 rate-limit message actually fires — this is the one function on this
  list that's genuinely metered per-user, not just per-login, so it's worth
  actually triggering the limit once rather than trusting the code path.
- **Notification bell** (`schema_phase23_notifications.sql`, pure SQL — no
  new edge function to deploy): submit a request as a business and check the
  bell in `/admin`'s header picks up an unread "New campaign request"
  without a page refresh needed beyond the next 45s poll. Then, as the
  admin, change that request's status and confirm the business's bell picks
  up "Your ... campaign: confirmed" (or whichever status). Do the same for a
  channel_requests approval/decline as a publisher, and for a message sent
  either direction. Since every one of these fires from a database trigger
  rather than application code, the fastest way to confirm the whole set
  works is exercising each status change once from the UI rather than
  reading the trigger SQL and assuming it's right — triggers are exactly the
  kind of thing that look correct and still have a typo'd column name that
  only surfaces at runtime.
- **Fraud/authenticity checks** (`schema_phase24_fraud_authenticity.sql` +
  `publisher-authenticity-check`): the rule-based signals (engagement vs.
  follower count, price vs. the pricing-engine band, verification status)
  need no deploy step and no API key — check they show up as badges on a
  pending application in `/admin` → Applications by editing a test
  publisher's `engagement` or `followers` to something extreme and
  confirming the right badge appears. Separately, click "Run AI
  authenticity check" on an application and confirm a cached low/medium/high
  result appears with notes, and that re-running it updates
  `authenticity_checked_at` — this one now runs on Cloudflare Workers AI,
  not Anthropic, so if it 501s with "ask the platform owner to add
  Cloudflare Workers AI credentials", that means `CLOUDFLARE_API_TOKEN` or
  `CLOUDFLARE_ACCOUNT_ID` isn't set (step 3 above), not that Cloudflare
  itself is down. Then, as a logged-in business, open a publisher
  profile and use "Report this publisher" — confirm the row lands in
  `/admin` → Reports and that an admin notification fires (this reuses
  `create_notification()` from `schema_phase23_notifications.sql`, so that
  migration must already be applied). Resolve or dismiss the report and
  confirm its status updates. Try "Suspend publisher" from a report and
  confirm the publisher's status flips to `suspended`.
- **Dispute resolution / ticketing** (`schema_phase25_disputes.sql`, pure
  SQL — no new edge function): as a business with a confirmed/completed
  request or an in-progress channel campaign, click "Open a dispute" and
  submit one — confirm it appears immediately in `/admin` → Disputes with
  the right subject/category, and that the publisher side (and admins) get
  a notification. Reply from the publisher's dashboard and confirm the
  status flips to `open`; reply as admin from the Disputes tab and confirm
  it flips to `awaiting_response` — this state machine lives entirely in
  `enforce_dispute_message_insert()`, so it's worth actually watching the
  status badge change rather than trusting the trigger reads correctly.
  Resolve it with an outcome and notes, and confirm both the business and
  publisher dashboards show the resolution banner. Finally, try posting a
  message on a `closed` dispute and confirm it's rejected — that's the one
  path enforced only by the trigger raising an exception, not by anything
  visible in the UI before hitting send.
  Note: businesses have no self-serve way yet to submit payment or otherwise
  manage a channel_requests campaign day-to-day (the "Your channel
  campaigns" list added alongside this feature is read-only plus the
  dispute button) — that's a separate, pre-existing gap this feature
  surfaced rather than one it set out to fix.

## If the first test fails
A "signature mismatch" on the first attempt is the single most common PayFast
integration issue, documented extensively in PayFast's own troubleshooting
guides — it almost always means one field's value differs by a stray space,
or the account has a passphrase configured that a secret above doesn't match
(or vice versa). It is not a sign of a deeper problem, and PayFast's
knowledge base has a specific troubleshooting page for exactly this.

If instead you get a 401 straight away, it's almost certainly the
`--no-verify-jwt` flag from step 4. And if your project uses Supabase's newer
"secret / publishable" API keys rather than the legacy anon/service_role
keys, there's a known interaction where Edge Function JWT verification needs
extra configuration — worth checking Supabase's current Edge Functions docs
if you're on that newer key system.

## PWA / installable app
Unlike everything else in this file, the install prompt isn't a Supabase
concern — it's `vite-plugin-pwa` (see `vite.config.ts`) generating a web
manifest and service worker at build time from `public/icons/`. Nothing to
deploy or configure here beyond `npm run build`. To actually test the
install prompt, serve the **production build** — `npm run preview` or the
real deployed site — over HTTPS or `localhost`; `npm run dev` doesn't
register a service worker, and Chrome won't fire `beforeinstallprompt` over
plain HTTP on a non-localhost domain. On desktop Chrome/Edge, the "Install
app" button in the header/footer should trigger the native prompt; on
Android Chrome, likewise; on iOS Safari there's no native prompt at all, so
confirm the button instead opens the manual "Share → Add to Home Screen"
instructions. The service worker only precaches the app shell (JS/CSS/
icons) — it deliberately does **not** cache Supabase or PayFast responses
(see the comment in `vite.config.ts`), so don't be surprised that offline
mode shows a blank/stuck app rather than cached data — that's correct for a
live marketplace, not a bug.

## Code-splitting
Also not a Supabase concern — `src/App.tsx` lazy-loads every route except
Home, Browse, and PublisherProfile (`/browse/:id`), which stay in the main
bundle since they're the most common first-paint targets (a fresh visit
from search, social, or a shared link). Everything else — the Admin panel
(which pulls in AdminAnalytics/AdminChannelRequests/AdminPayouts/
AdminSecurity along with it, since those are imported inside `Admin.tsx`
rather than routed separately), the Marketing Suite, the MFA/auth flow,
Dashboard, Messages, MediaKit, and so on — only downloads when a visitor
actually navigates there, via `React.lazy()` + one shared `<Suspense>`
wrapping `<Routes>` (a generic skeleton fallback; `/map` keeps its own
nested `<Suspense>` with a map-shaped one, since that reads better than
the generic fallback for that specific page).

This took the main entry chunk from ~893 kB down to ~384 kB (pre-gzip) —
Vite's build no longer warns about any chunk over 500 kB. Nothing to
configure or deploy differently; `npm run build` just produces more,
smaller files instead of one large one, and the browser fetches only the
ones a given visit actually needs.

Worth testing after touching `App.tsx`: open the Network tab, do a hard
reload on `/`, and confirm only Home's own chunk (plus the shared vendor
chunks — React, Supabase, etc.) loads — not Admin's or Dashboard's. Then
navigate to `/admin` as an admin and confirm *its* chunk loads at that
point, with a brief skeleton flash while it does.

## On-site EFT payment (primary, alongside PayFast)
`schema_phase28_eft_payment.sql` — pure SQL, no new function. The real
Capitec bank details are now in `PLATFORM_BANK_DETAILS` (`constants.ts`) —
**that file is no longer a placeholder**, it's live in this repo, so treat
this repo with the same care as any other file containing real banking
info. A business on the `requests` flow (the original social-media/PayFast
booking flow) now sees "Pay by EFT" as the primary option once a request is
confirmed with an agreed amount, with PayFast tucked behind a "prefer to
pay by card instead?" toggle — PayFast itself is completely unchanged,
still the same redirect + `payfast-notify` auto-confirm flow as before.

Test by confirming a request as admin with an agreed amount, then as that
business: confirm the EFT panel shows the real bank details (not a
placeholder), click "I've made this payment", and check `/admin` shows
"Business claims paid ..." with a "Confirm payment received" button —
clicking it should flip the payment (and therefore the invoice download)
to paid, same as the PayFast path already does. Then, separately, click
through the PayFast toggle and confirm that path still works exactly as
before — this migration is additive, so a regression there would mean the
new `enforce_payment_insert_defaults` trigger is interfering with
`payfast-checkout`'s insert, worth checking first if PayFast breaks.

## Video / portfolio on publisher profiles
`schema_phase27_portfolio.sql` — pure SQL, no new function, but it's the
first migration in this project that creates a **Storage bucket**
(`portfolio-images`), so it needs the SQL editor's storage extension to be
enabled (it is by default on every Supabase project). Two things worth
actually testing rather than trusting the code:
1. **The bucket's own limits, not just the client-side check.** Try
   uploading a >3MB file or a non-image file through the browser dev tools'
   network tab (bypassing `PortfolioManager.tsx`'s pre-upload validation) and
   confirm Supabase Storage itself rejects it — that's the real enforcement
   (`file_size_limit`/`allowed_mime_types` on the bucket), the client-side
   check is only there for a fast, friendly error message.
2. **Cross-account isolation.** Log in as publisher A, confirm you can
   upload/delete your own images but get denied trying to delete publisher
   B's (the `(storage.foldername(name))[1] = auth.uid()` policies).

No self-hosted video anywhere in this feature by design — `intro_video_url`
is always a link to an existing YouTube/Vimeo/TikTok/Instagram video (see
`videoEmbed.ts`), specifically to keep this free to run on Vercel/Supabase's
free tiers. If real video hosting is wanted later, that's a meaningfully
bigger feature (a CDN, transcoding, real storage costs) — worth a deliberate
decision, not something to quietly add on top of this.

## Onboarding checklist
Pure frontend — `OnboardingChecklist.tsx` + `onboardingChecklist.ts`, no
migration, no new function. Every item's `done` is computed from data
already loaded on the dashboard (profile fields, request counts, payment
status), so there's nothing to seed — log in as a fresh business or
publisher and the checklist should start mostly unchecked, then tick off
items as you complete a profile, send/receive a request, and so on. The one
thing worth deliberately testing: dismiss it, then log out and back in —
it should stay dismissed (localStorage, keyed per-user-id), and should NOT
carry over if you log in as a *different* user on the same browser.

## Response-time badges
`schema_phase26_response_time.sql` — pure SQL, no new function to deploy.
Test by having a creator approve or decline a few `channel_requests`
campaigns (need 3+ before the badge shows at all — deliberate, see
`responseTime.ts`), then check `avg_response_hours`/`response_count` update
on their `publishers` row and the badge appears on their card in Browse and
on their profile. The aggregate is intentionally the only thing exposed
publicly — worth confirming an anonymous/logged-out visitor can still see
the badge (since it's just a number on the public `publishers` row) but
can't query `channel_requests` directly for the same publisher.

## Business-side channel campaign management
`ChannelCampaignCard.tsx` shows a business the real bank transfer details
(`PLATFORM_BANK_DETAILS` in `constants.ts`) once a channel campaign
(influencer/website/podcast/radio) reaches `awaiting_payment` — **every
field in that constant is a TODO placeholder right now.** A business who
pays those placeholder details sends money nowhere. Replace all five fields
with ChatSched's real business banking details before this goes live; there's
no deploy step beyond editing that one constant and rebuilding.

## Campaign tracking
`schema_phase30_campaign_tracking.sql` — two new tables (`campaigns`,
`campaign_events`), one view (`campaign_stats`), and two `SECURITY DEFINER`
functions (`resolve_campaign_link`, `track_campaign_event`). Lets a business
turn any campaign — booked through ChatSched or not — into a short
tracking link (`chatsched.com/t/<slug>`) plus a UTM-tagged version of their
own destination URL, and see real clicks/visits/leads/conversions against
it from the Campaign Tracker tab in the Marketing Suite (business dashboard).

Nothing to configure beyond running the migration — both functions are
granted to `anon` on deploy, so the redirect (`/t/:slug`, a public route,
no login required) and the embed snippet (see below) work immediately.

Worth testing deliberately:
1. **The redirect itself.** Create a tracking link in the dashboard, open
   `/t/<slug>` in an incognito window, and confirm it lands on the
   destination URL with `?utm_source=chatsched&utm_medium=referral&utm_campaign=<slug>`
   appended, and that a `clicks` count of 1 shows up back in the dashboard
   within a few seconds.
2. **An unknown slug.** `/t/not-a-real-slug` should show the "link not
   active" page, not a broken redirect or a raw Supabase error.
3. **A paused campaign.** Pause a campaign in the dashboard, then hit its
   `/t/<slug>` again — same "not active" page. `resolve_campaign_link` only
   matches `status = 'active'`.
4. **The embed snippet.** Copy a campaign's snippet from the dashboard
   (Campaign Tracker → a campaign card → "Show the embed snippet"), paste
   it onto any test HTML page, and open that page with
   `?utm_source=chatsched&utm_campaign=<slug>` in the URL (exactly what the
   redirect appends) — the `visits` count should tick up. From that same
   page's console, run `window.chatschedTrack("lead")` and
   `window.chatschedTrack("conversion", 199)` and confirm `leads`,
   `conversions`, and `conversion_value` update too.
5. **Cross-account isolation.** Log in as business A, create a campaign,
   note its `id` from the network tab, then log in as business B and
   confirm querying `campaigns`/`campaign_events`/`campaign_stats` for that
   `id` returns nothing (RLS is owner/admin-only on all three).

No IP addresses are collected anywhere in this feature by design — see the
comment on `campaign_events` in the migration for why (POPIA: the less
personal data collected, the less there is to protect or leak). The
`visitor_id` column is a random, non-identifying id the embed snippet
generates itself and stores in `localStorage`, good enough to de-duplicate
obvious double-fires but not a precise unique-visitor count.

## Business-side campaign rollup
No new schema — `src/components/CampaignRollup.tsx` sits on `/dashboard`,
above the Marketing Suite, and reads the same owner-scoped `campaign_stats`
view Campaign Tracker already does, plus a direct `campaign_events` query
for the weekly click trend (RLS already restricts that table to events
belonging to the caller's own campaigns, so no explicit owner filter is
needed in the query itself). Closes a gap Campaign Tracker always had on
its own: real per-link stats existed, but nothing added them up across
every tracking link a business had running at once.

Shows: totals (clicks/visits/leads/conversions/conversion value) summed
across every campaign regardless of status, an active/total campaign
count, an 8-week click bar chart, and the top 3 campaigns by clicks. Stays
hidden entirely for a business with zero campaigns yet — Campaign Tracker's
own empty state (right below it) already covers "create your first
tracking link", so this section doesn't show a second, redundant one above
it.

The aggregation and week-bucketing logic is pure and unit-tested in
isolation (`src/lib/campaignRollup.ts` / `campaignRollup.test.ts`) rather
than only exercised through the component — worth checking those tests
still pass after touching the bucketing math specifically, since an
off-by-one there silently misattributes a real click to the wrong week
rather than throwing.

Worth testing manually:
1. **A business with campaigns across several statuses** (active, paused,
   archived) — totals should include all of them; the "N active" count in
   the header should only count `active`.
2. **A campaign with clicks but a business that's never set up the embed
   snippet** — visits/leads/conversions correctly show 0 rather than the
   section erroring on missing data.
3. **Two businesses, each with their own campaigns** — confirm business A
   never sees business B's totals or top campaigns (same RLS this already
   relies on for Campaign Tracker itself, but worth re-confirming here
   since this is a second, independent query path against the same data).

## CSV export from Admin
No schema, no new endpoint — `src/lib/csvExport.ts` turns whatever rows
are already loaded in the browser (every admin tab already fetches its
full dataset to render the page) into a CSV and triggers a download via a
Blob + object URL, entirely client-side. `src/components/ExportCsvButton.tsx`
is the themed button every tab uses; it renders nothing at all when there
are zero rows, so there's never a dead "Export CSV (0)" button sitting on
an empty tab.

Wired onto: Requests, Applications, Publishers, Businesses, Messages,
Reports, and Disputes tabs in `Admin.tsx`, plus the multi-channel booking
table in `AdminChannelRequests.tsx` (that last one exports whichever
filter — Needs action / Overdue / All — is currently selected, not always
the full table, so what downloads matches what's on screen).

The channel-requests export also accounts for Phase 35's counter-offer
flow: alongside the original `proposed_amount`, it includes the
`counter_amount` and `countered_at` columns when a creator has countered,
and computes platform commission / creator share off whichever amount
actually applies — the counter once one exists, the original proposal
otherwise — rather than always using the original proposed amount, which
would silently misstate the real payout split on a countered booking.

Deliberately left off: `AdminPayouts.tsx`. That page is explicitly the
UI for the experimental batch/ledger payout pipeline described in
`workers/README.md`, not the live payout mechanism (that's the "Mark
payout sent" button on the Requests tab, which the Requests CSV export
already covers) — adding an export button there would imply that data is
something worth reconciling against real money, which it isn't yet.

Each filename is date-stamped (`chatsched-requests-2026-08-16.csv`) so
re-exporting later in the day doesn't silently overwrite an earlier
download with the same name, and every file gets a leading UTF-8 BOM so
Excel — the most likely destination for an admin CSV — renders
Afrikaans/isiZulu names and the R/± symbols correctly instead of as
mojibake.

Worth testing:
1. **Open each exported CSV in an actual spreadsheet app**, not just a
   text editor — the field-quoting rules in `csvExport.ts` (commas,
   embedded quotes, newlines in a message/note field) are the kind of
   thing that looks fine as raw text but silently shifts every column
   after it if a real spreadsheet parses it differently than expected.
2. **A message or dispute subject containing a comma or a quote** — the
   Messages and Disputes tabs are the two most likely to have raw
   free-text user input hit those escaping rules for real.
3. **A countered channel request** — confirm the exported "Final amount",
   commission, and creator share reflect the counter amount, not the
   original proposal.
4. **An empty tab** (e.g. no disputes yet) — confirm the Export button
   doesn't render at all, rather than exporting a header-only file.

## Publisher media kits
No schema change — `src/lib/mediaKit.ts` builds the PDF entirely from
columns already on the `publishers` row (plus a `reviews` query and a
completed-campaign count, both already-public data). Reached from a
Publisher Profile's "Download Media Kit" button, which links to
`/media-kit?publisher=<id>` — a small page that shows what's included and
has the "Generate Media Kit" button itself. Gated the same as the rest of
a full profile: signed-in businesses, publishers, or admins only.

Worth testing:
1. **A social-media publisher** (flat `price_per_post`, `placement_types`
   for ad formats) and **a request-flow channel publisher** (website/
   podcast/radio/influencer — pricing shown as "varies", `pricingModels`
   and `minBudgetZAR` from the channel definition, `accepted_ad_formats`
   or the channel's full `advertisingMethods` list) both produce a
   sensible Pricing & Ad Formats section — the two flows store pricing
   completely differently, so it's easy for one to look broken while the
   other looks fine.
2. **A publisher with portfolio images** — confirm the thumbnails actually
   embed. If the Storage bucket's CORS config doesn't allow the page's
   origin, `fetchImageAsDataUrl` fails closed and the PDF falls back to a
   text line ("N portfolio images — view on the full profile online")
   instead of a broken image or a thrown error — that fallback path is
   worth triggering on purpose at least once (e.g. temporarily point
   `portfolio_images` at an external URL that isn't CORS-enabled).
3. **A brand-new publisher** with no reviews, no portfolio, `trust_score`
   /`publisher_score` still at 0, and `avg_response_hours` still null —
   every section should just quietly omit itself rather than showing an
   empty heading or a "null" in the PDF.
4. **Pagination** — a publisher with a long bio/audience description and
   several reviews should flow onto a second page cleanly, with the
   footer (site + profile URL + page number) present on every page, not
   just the first.

## Last-active indicator
`schema_phase31_last_active.sql` — one new column
(`publishers.last_active_at`) and one throttled function
(`touch_publisher_activity()`). Shows on a Publisher Profile as a coarse
badge next to the response-time one: "Active 2 hours ago" / "Active
today" / "Active 3 days ago" / "Inactive for 14 days" — see
`src/lib/lastActive.ts` for the exact bucketing. Deliberately never shows
raw timestamps, minutes, or an "online now" dot; a business gets a general
sense of how live the listing is without ChatSched turning into a
surveillance feed of when someone was last on their phone.

`touch_publisher_activity()` is called once per session from
`AuthContext.loadProfile()` — on sign-in, and again on every Supabase
`TOKEN_REFRESHED` event while the tab stays open (roughly hourly for an
active session), which in practice is enough to keep "Active today" honest
without an explicit heartbeat timer. The function only writes if the
existing `last_active_at` is more than 30 minutes old, so it doesn't
generate a write on every token refresh.

Worth testing:
1. **A freshly-registered publisher who hasn't logged in yet** —
   `last_active_at` is null, and the badge doesn't render at all (no
   "Inactive for 0 days" or similar guess).
2. **Log in as that publisher** — `last_active_at` should be set within a
   few seconds, and reloading the profile page should show "Active X
   hour(s) ago" or "Active today" depending on the exact gap.
3. **An admin-added publisher with no `user_id`** — same as (1); there's
   no account to log in with, so the badge should stay hidden rather than
   showing "Inactive for" some enormous number.
4. **Cross-account isolation** — confirm `touch_publisher_activity()`
   only ever updates the row matching the caller's own `auth.uid()`; a
   business or another publisher's session can't bump someone else's
   `last_active_at`.

## Scheduled request expiry
`schema_phase32_expire_channel_requests.sql` (just enables `pg_cron`/`pg_net`) +
`expire-channel-requests` Edge Function. Automates the two "manual for now"
admin actions AdminChannelRequests.tsx already has — closing a request the
creator never responded to within 7 days (→ `declined`), and cancelling one
the business never paid within its 7-day window (→ `cancelled`) — so they
happen on a timer instead of waiting for an admin to notice and click the
button. Nothing about the state machine itself changes: this calls the same
two transitions `enforce_channel_request_transition()` already allows, and
only touches `channel_requests` — the original social-media/PayFast flow has
no equivalent deadlines and isn't affected.

1. Run `schema_phase32_expire_channel_requests.sql`.
2. Pick a secret value and set it (this is the shared secret the cron job
   authenticates with — not a Supabase JWT, since nobody's logged in when
   this runs):
   ```
   supabase secrets set CRON_SECRET=some-long-random-string
   ```
3. Deploy the function — like `payfast-notify`, this is never called by a
   logged-in browser, so it needs `--no-verify-jwt` for the same reason:
   ```
   supabase functions deploy expire-channel-requests --no-verify-jwt
   ```
4. In the SQL editor, schedule it — **run this by hand, don't add it to a
   migration file**, since it embeds your real project ref and the
   `CRON_SECRET` value from step 2 in plain text, and migration files get
   committed to git:
   ```sql
   select cron.schedule(
     'expire-channel-requests',
     '*/30 * * * *', -- every 30 minutes; tune to taste
     $$
     select net.http_post(
       url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/expire-channel-requests',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET-VALUE'),
       body := '{}'::jsonb
     );
     $$
   );
   ```
   Swap in your project ref (same one from step 1's `supabase link`) and the
   exact value you set as `CRON_SECRET`.
5. Confirm it's scheduled: `select * from cron.job;` should list
   `expire-channel-requests`. After it's had at least one run,
   `select * from cron.job_run_details order by start_time desc limit 5;`
   shows whether recent runs succeeded — `status` should read `succeeded`,
   not `failed`.
6. To test without waiting 30 minutes: manually back-date a request's
   `created_at` (or `responded_at`, for the payment-window case) far enough
   into the past that its generated `approval_due_at`/`payment_due_at`
   column is already in the past, then either wait for the next scheduled
   run or call the function directly:
   ```
   curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/expire-channel-requests \
     -H "x-cron-secret: YOUR-CRON-SECRET-VALUE"
   ```
   Confirm the request's status actually flipped, and — if `RESEND_API_KEY`
   is set — that the business got an email explaining why.
7. To stop it later: `select cron.unschedule('expire-channel-requests');`

## Scheduled subscription grace-period expiry — REMOVED (item 10, once-off activation pricing)
`schema_phase72_subscription_grace_period.sql` and the
`expire-subscription-grace-periods` Edge Function this section used to
document are both gone as of `schema_phase86_once_off_activation_pricing.sql`.
Publisher/business membership became a once-off activation fee with no
renewal, so there's no recurring payment left to lapse from, no
`grace_period`/`suspended` state to expire out of, and nothing left for a
scheduled job to do here.

**If you already ran the old instructions in a live project**, this
schedule is still running against a function that no longer exists —
clean it up:
```sql
select cron.unschedule('expire-subscription-grace-periods');
```
Then remove the deployed function itself (if your Supabase CLI still
shows it): `supabase functions delete expire-subscription-grace-periods`.

## Restored counter-offer + content-approval gate (regression fix)
`schema_phase73_restore_counter_offer_and_content_gate.sql`. Phase 71
(subscription enforcement) replaced `enforce_channel_request_transition()`
by building off Phase 17's version instead of the live one (Phase 53's),
which silently deleted the counter-offer state machine (Phase 35:
`pending -> countered -> awaiting_payment`/`cancelled`) and the
content-approval gate on going live (Phase 53/54: `paid -> live` required
an approved `content_approvals` row). The frontend was never updated to
match, so every counter-offer action — a creator countering, a business
accepting or declining a counter — has been hitting a raw
`'That status change is not allowed.'` exception since Phase 71 shipped,
and any placement could go live with zero content-approval check. This
migration restores both, merged with Phase 71's subscription check
(the one thing it actually meant to add) rather than reverting it.

1. Run `schema_phase73_restore_counter_offer_and_content_gate.sql`.
2. No new secret, function, or cron — this only replaces the trigger
   function body, same no-op deploy shape as every prior
   `enforce_channel_request_transition()` update (Phase 35, 36, 53, 71).
3. To confirm the fix on a test row: create a `channel_requests` row in
   `pending`, have the creator countered it
   (`update ... set status = 'countered', counter_amount = <n>`), and
   confirm that succeeds instead of raising — then confirm the business
   can move it `countered -> awaiting_payment` or `countered -> cancelled`.
   Separately, confirm a `paid` row without an approved
   `content_approvals` row still can't move to `live`.

## Countered-offer notification (bug fix)
`schema_phase36_countered_notification.sql` — Phase 35 (counter-offer)
added a `countered` status to `channel_requests`, but the notification
trigger that covers every other status change on that table
(`notify_channel_request_status_change()`, from Phase 23) never got a
matching branch. A business had no way to find out a creator had
countered *except* after the fact, via the expiry job's "counter-offer
expired" notice — nothing told them while they still had time to accept
or decline it. This migration is a straight `CREATE OR REPLACE` of that
one function with a `countered` branch added; every other branch is
unchanged, and the trigger itself doesn't need touching.

In-app only, deliberately — matching every other branch in this same
function. The `channel_requests` flow has never sent email on a status
change (that's a separate, `requests`-table-only mechanism — see how
`notify` is invoked from `Admin.tsx`/`Dashboard.tsx`/`PublisherProfile.tsx`),
so giving `countered` an email while nothing else here has one would trade
one inconsistency for a different, bigger one.

Run this migration after `schema_phase35_counter_offer.sql`. Nothing else
to configure — same `create_notification()` helper, same
`trg_notify_channel_request_status_change` trigger, already wired up.

Worth testing:
1. **As a creator, counter a pending request** — confirm the business
   gets a bell notification immediately (not just when/if the counter
   later expires), with the actual countered amount in the message, and
   that clicking it lands on `/dashboard` where `ChannelCampaignCard.tsx`
   already has the Accept/Decline UI for a countered request.
2. **Every other status transition still fires correctly** — approve,
   decline, payment submitted/confirmed, live, completed — since this was
   a full function replace, not a patch, a typo anywhere in the copied
   branches would silently break notifications for the whole table, not
   just the new one.

## Self-service account deletion & data export
No schema change — this is entirely new code, not a migration. Two pieces:
`src/lib/accountExport.ts` (pure client-side, no deploy step) and the
`delete-account` Edge Function. Both reached from `/account`
(`AccountSettings.tsx`), linked from the Header, both dashboards, and
Privacy.tsx's "Your rights" section — this is what that section now points
to instead of "email our Information Officer and wait."

- **Export** queries every table keyed to the caller's own `auth.uid()` (or
  their publisher id) — profile, requests, channel requests, payments,
  reviews, messages, conversations, disputes, notifications, campaigns,
  saved lists, Content Studio data, reports filed — using the exact same
  RLS policies already protecting those tables, so there's no way for it to
  return anyone else's data even if this table list ever drifts from the
  schema. Downloads as a timestamped JSON file, nothing stored server-side.
- **Deletion** actually calls `auth.admin.deleteUser()` — this isn't a
  placeholder or a soft-delete flag. Before it does, it checks for anything
  financially unresolved tied to the account (in-progress requests, pending
  payments, active channel campaigns as business *or* creator, open
  disputes) and refuses with the specific list if it finds any — deleting a
  business account cascades through the schema's `on delete cascade` FKs
  and would otherwise erase a creator's own income history mid-campaign
  along with it. Admin accounts are excluded from self-deletion entirely
  (the UI just explains why) — a scheduled-job-style "you're the only
  admin" check isn't implemented, so don't rely on this to prevent locking
  yourself out if you're testing with your only admin account.

Deploy:
```
supabase functions deploy delete-account
```
Normal JWT verification stays on for this one (unlike payfast-notify or
expire-channel-requests) — it's only ever called by a logged-in browser.

**Worth understanding before this goes live, not just testing:** deleting a
business account cascades to erase every `requests`/`channel_requests`/
`payments`/`reviews` row tied to that business, including completed ones —
which also erases a creator's own record of that income, and doesn't
independently retain anything for SARS-style financial recordkeeping
(South Africa generally expects ~5 years). The blocker check above stops
this for anything *currently* active, but does nothing for a business that
deletes its account well after a campaign completed. If that retention gap
matters to you, the real fix is a schema change — anonymizing completed
financial rows instead of cascading them — not something this function can
safely paper over on its own. Flagging it here rather than pretending the
current behaviour already handles it.

Worth testing:
1. **A normal export** — log in as a business with a few requests/payments,
   download from `/account`, and open the JSON: confirm it's actually your
   data (not empty, not someone else's) and the file is well-formed.
2. **Deletion while something's active** — with a `pending` or
   `awaiting_payment` request outstanding, try deleting: confirm you get
   the specific blocker list back, not a generic error, and that the
   account is still very much alive afterward.
3. **Deletion once clear** — resolve or cancel that request, delete again,
   confirm you're signed out and redirected home, and that logging in with
   the old credentials now fails.
4. **Cross-account isolation** — as business A, try calling the function
   with business B's request/payment ids in mind (there's nothing to pass
   in — the function only ever acts on the caller's own JWT — but worth
   confirming there's genuinely no `target_user_id` parameter it'll accept
   instead).
5. **An admin account** — confirm `/account` shows the "can't self-delete"
   message instead of a working delete button.

## Saved searches with alerts
`schema_phase33_saved_searches.sql` — one new table (`saved_searches`)
and one trigger (`trg_notify_saved_search_matches` on `publishers`). A
business saves a Browse filter set from the new "💾 Save this search"
button; the moment a publisher becomes newly visible in the directory —
admin-approved from the review queue, or added by hand already approved —
every saved search with alerts on is checked against it.

Two separate delivery paths, same event:
- **In-app bell** — entirely trigger-driven (`notify_saved_search_matches()`
  in the migration), so it fires no matter which admin action approved the
  publisher, same "server is the source of truth" guarantee Phase 23's own
  notification triggers already rely on.
- **Email** — `supabase/functions/notify-saved-search-matches`, invoked
  from `Admin.tsx` right after both approval paths (the review-queue
  "Approve" button, and the "add a publisher by hand" form). Needs
  `RESEND_API_KEY` set, same as every other email in this schema; fails
  quietly (bell notification still fires) if it isn't configured yet.

Matching is deliberately narrower than everything Browse.tsx can filter
on — only the structured fields (channel, category, province, city,
suburb, platforms, languages, verifiedOnly, minFollowers, maxFollowers,
minEngagement, maxPrice). The free-text keyword search and the regex-based
age/gender heuristics are still *saved* (so "View results" restores the
exact search) but aren't used to decide whether to alert — see the
migration's comment for the reasoning. The email function's matching
logic and URL-building are hand-kept in sync with the SQL trigger and
`src/lib/searchParamsCodec.ts` respectively, since a Deno Edge Function
can't import from `src/`; a comment in each file points at its counterpart.

Also worth knowing: `Browse.tsx` now syncs its *entire* filter set to the
URL (`src/lib/searchParamsCodec.ts`), not just the 4 fields it used to —
that's what makes a saved search's "View results" link, and the link in
its email alert, actually restore the full search rather than dropping
most of it.

Worth testing:
1. **Save a search, then approve a matching publisher** — confirm both
   the bell notification and the email arrive, and that the email's "View
   matching publishers" link actually lands on `/browse` with the same
   filters restored (including `verifiedOnly`, which is easy to
   accidentally drop — see `searchParamsCodec.test.ts` for why that one
   specifically has its own test).
2. **Approve a publisher that matches nobody's saved search** — no bell,
   no email, and the function returns `{ sent: 0 }` rather than erroring.
3. **Turn a saved search's alerts off** (`/saved-searches`) — re-approve
   a matching publisher and confirm nothing fires for that search, while
   any other business's still-enabled matching search still gets notified.
4. **Full round-trip on `/browse` itself** — set a handful of filters,
   copy the URL, open it in a new tab, and confirm every filter (not just
   the 4 that used to sync) comes back exactly as set.

## Social account connect
`schema_phase34_social_connect.sql` + three Edge Functions
(`social-oauth-start`, `social-oauth-callback`, `summarize-publisher-audience`)
+ `ConnectSocialAccounts.tsx`, wired into the publisher dashboard (both the
pending-review state and the main one) and the application-submitted
screen. Real OAuth against each platform's official API — not a mockup —
for the ones that actually have a free, self-serve way to read a creator's
own follower count: **YouTube, Facebook Pages, Instagram, TikTok**.

Also has its own step in the onboarding checklist now
(`onboardingChecklist.ts`'s `computePublisherChecklist`, `id: "social-connect"`)
— done once `publisher_platform_stats` has at least one row for that
publisher. `PublisherDashboardView.tsx` fetches just the count (not the
full per-platform breakdown `ConnectSocialAccounts.tsx` already owns and
re-fetches itself) purely so the checklist has a done/not-done signal.

**Why only those four, and not the rest of `PLATFORMS` in `src/lib/constants.ts`:**
- **X** — no free API tier at all as of 2026. Every read costs money per
  call, with no way around it. Not something to wire up and then discover
  it's silently burning a card on file.
- **LinkedIn** — its follower/audience API is restricted to approved
  marketing partners, not self-serve for an individual developer account.
- **Facebook Group** — no public API for member counts the way Pages have;
  only a group's own admins can see that number, and not via a general
  OAuth grant.
- **WhatsApp Channel** — no public API for follower counts exists yet.

If any of that changes, `supabase/functions/_shared/socialProviders.ts` is
where a fifth platform would slot in — it's one config object per
platform, not a rewrite.

### What each of the four actually needs (all free, all real developer setup)
1. **YouTube** — a Google Cloud project, OAuth consent screen, and OAuth
   Client ID (Web application type). Scope used is `youtube.readonly`,
   classified by Google as "sensitive" — needs their standard verification
   step (a form + a short screen-recording demo) before it'll work for
   anyone beyond your own test users, typically a few days to a couple
   weeks. Not the multi-week CASA security assessment "restricted" scopes
   require.
   ```
   supabase secrets set GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
   ```
2. **Facebook Pages** — a Meta App (Business type) at developers.facebook.com,
   with the Facebook Login product added. Scopes: `pages_show_list`,
   `pages_read_engagement`. Works immediately in Development Mode for Pages
   you or your added testers admin; needs Meta App Review (Meta's own
   published estimate is 2-4 weeks, plus Business Verification) before it
   works for real publishers generally.
   ```
   supabase secrets set META_APP_ID=your-app-id
   supabase secrets set META_APP_SECRET=your-app-secret
   ```
3. **Instagram** — the same Meta App as above, with the Instagram product
   added, using "Instagram API with Instagram Login" (the current,
   non-deprecated path — no linked Facebook Page required). Business or
   Creator accounts only; Instagram has had no official API for personal
   accounts since Basic Display API shut down. Same Meta App Review gate as
   Facebook Pages.
   ```
   supabase secrets set INSTAGRAM_APP_ID=your-app-id
   supabase secrets set INSTAGRAM_APP_SECRET=your-app-secret
   ```
4. **TikTok** — a TikTok for Developers app with Login Kit and the Display
   API product added, scope `user.info.basic`. Requires TikTok's own app
   review before it works for real users — no fixed published timeline.
   Worth knowing regardless of review status: TikTok has no audience-
   demographics endpoint for commercial apps at all, reviewed or not —
   that's Research-API-only, restricted to academic access.
   ```
   supabase secrets set TIKTOK_CLIENT_KEY=your-client-key
   supabase secrets set TIKTOK_CLIENT_SECRET=your-client-secret
   ```

### Shared setup (needed regardless of which platforms you enable)
```
supabase secrets set OAUTH_STATE_SECRET=some-long-random-string
supabase secrets set SOCIAL_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
```
`OAUTH_STATE_SECRET` signs the OAuth `state` parameter so
`social-oauth-callback` can trust it wasn't tampered with, without needing
a database table to track in-flight authorization attempts. Any long
random string works — it's never shown to anyone, just used to sign/verify.

`SOCIAL_TOKEN_ENCRYPTION_KEY` encrypts the actual provider access/refresh
tokens before `social-oauth-callback` stores them (schema_phase41 — see
that migration and `_shared/tokenCrypto.ts` for why plaintext wasn't
acceptable here). Must be exactly 32 bytes, base64-encoded — the
`openssl rand -base64 32` above produces one directly. Losing this key
after connecting real accounts means every one of them needs to be
reconnected; there's no recovery path by design.

**For every provider you actually enable**, the redirect URI you register
in that platform's developer console must be exactly:
```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/social-oauth-callback
```

Deploy all three functions with `--no-verify-jwt`. `social-oauth-callback`
needs it for real — it's the mid-redirect browser navigation every
provider sends the user back to, with no Supabase session header at all
(identity comes from the signed `state` token instead). `social-oauth-start`
and `summarize-publisher-audience` don't strictly need the flag anymore —
both are called with `supabase.functions.invoke`, which sends a genuine
Authorization header, and both verify it manually inside the function the
same way — but matching all three here keeps the deploy step uniform.
(`social-oauth-start` used to be the odd one out here, taking the user's
access token as a `?access_token=...` query-string param and redirecting
the browser directly — a bearer credential sitting in a URL, and therefore
exposed to browser history, proxy/server logs, and analytics/monitoring
systems. Fixed: it's now `POST`ed to like the other two, authenticated via
a real header, and hands back the provider's authorize URL for the browser
to navigate to itself.)
```
supabase functions deploy social-oauth-start --no-verify-jwt
supabase functions deploy social-oauth-callback --no-verify-jwt
supabase functions deploy summarize-publisher-audience --no-verify-jwt
```

`summarize-publisher-audience` reuses `ANTHROPIC_API_KEY` — see "Setup —
Phase 3" above if that's not already set. It's the same Claude Haiku call
shape as `content-studio-generate`; nothing new to configure there if
Content Studio already works.

### What actually gets stored
Two new tables, deliberately split by sensitivity:
- `social_connections` — the real access/refresh tokens. **No RLS policies
  at all beyond enabling RLS** — not even the publisher who owns the
  connection can query this table directly. Every access goes through a
  service-role Edge Function. This is a decision, not an oversight.
- `publisher_platform_stats` — just the follower count/username/avatar
  pulled *from* a connection, publicly readable (same as everything else on
  a profile), and kept in its own table specifically so "what's safe to
  show" and "what's a credential" can never be confused by a future query
  someone writes without reading this section first.

### Worth testing before relying on this
1. **A full round trip** on whichever platform you set up first — click
   Connect, actually authorize on the real platform, land back on
   `/dashboard` with a success banner and a real follower count showing.
2. **Declining the authorization** on the platform's side — confirm you
   land back with a clear error banner, not a blank page or a stuck spinner.
3. **A stale/tampered state token** — manually edit the `state` query param
   on a callback URL and confirm it's rejected, not silently accepted.
4. **The AI summary** — connect at least one platform, click "Generate with
   AI" from the dashboard, confirm the summary only references numbers that
   are actually true, and shows up on the public profile afterward.
5. **Someone else's publisher_id** — while logged in as publisher A, try
   calling `social-oauth-start` (e.g. via the browser console:
   `supabase.functions.invoke('social-oauth-start', { body: { platform: 'youtube', publisher_id: '<publisher-B-id>' } })`)
   with publisher B's id (there's a real check for this in the function —
   confirm it actually rejects rather than trusting the request body).
6. **Tokens are actually encrypted** — after connecting a real account,
   check the row directly (`select access_token from
   public.social_connections where publisher_id = '...'` via the SQL
   editor, using the service role — RLS blocks everyone else). It should
   be an opaque base64 blob, not something that visibly starts like a real
   provider token. Then try connecting with `SOCIAL_TOKEN_ENCRYPTION_KEY`
   unset — the connection should fail with a clear error, not silently
   store the token unencrypted.
7. **CORS isn't accidentally wide open** — deploy a function without
   setting `SITE_URL`, then check the `Access-Control-Allow-Origin` header
   on a response from a browser (dev tools → Network tab) or with
   `curl -i` — it should read `http://localhost:5173`, never `*`. Then set
   `SITE_URL` to your real domain and confirm the header updates to match.

## Counter-offers on the Request Feature workflow
`schema_phase35_counter_offer.sql` — adds one round of price negotiation to
`channel_requests` (influencer/website/podcast/radio). Previously a creator
could only approve the business's exact `proposed_amount` or decline
outright; now there's a third option: propose a different price. Purely
additive to the state machine from Phase 17 — nothing about the existing
approve/decline/pay/live/payout path changed, there's just a new fork
before it.

**New status: `countered`.**
- `pending → countered` — the creator proposes `counter_amount` (with an
  optional `counter_note`), before `approval_due_at` — same window as an
  ordinary response, not a new one.
- `countered → awaiting_payment` — the business accepts. This is the exact
  moment `responded_at` gets set (starting the 7-day payment window, same
  as an ordinary approval), and `proposed_amount` is overwritten with the
  agreed `counter_amount` — so the bank transfer instructions, the
  creator's payout math, and admin's commission breakdown all just work
  off `proposed_amount` as before, with no changes needed in any of those
  files.
- `countered → cancelled` — the business declines the counter.

**Deliberately capped at one round**, not open-ended haggling — the
creator counters once, the business accepts or declines that counter, no
counter-to-the-counter. A real back-and-forth belongs in the message
thread the request already has; this is a structured price adjustment,
not a chat feature.

**`approval_due_at` does not reset** when a counter is made — a creator
countering on day 6 leaves the business only 1 day to respond. That
column is a Postgres generated column (`created_at + interval '7 days'`),
which can't conditionally depend on which state led there — so this is a
real simplicity trade-off, not an oversight. `expire-channel-requests`
(the scheduled job from "Scheduled request expiry" above) was updated to
close a stale `countered` request the same way it already closes a stale
`pending` one — landing on `cancelled` rather than `declined`, since the
creator did respond and the business just didn't act on it in time.

No new deploy step beyond running the migration — this doesn't touch
Edge Functions, env vars, or third-party services, just the schema and
the two dashboard components (`PublisherDashboardView.tsx` for the
creator's "Propose a different price" flow, `ChannelCampaignCard.tsx` for
the business's accept/decline).

Worth testing: submit a request, counter it as the creator, accept it as
the business, and confirm the bank transfer instructions and payout math
downstream both reflect the countered price, not the original ask —
that's the one place a bug here would actually cost someone money.

## Publisher-side traction visibility
`schema_phase37_profile_views.sql` + `profileTraction.ts` +
`PublisherTractionPanel.tsx`, shown on the main (approved) publisher
dashboard above "Connect your social account." Businesses already get
real numbers the moment they start a campaign (CampaignRollup); a
publisher previously got nothing between "0 requests" and "is this
platform even working" — no signal that anyone had even looked. This logs
a real event every time a registered business or creator opens a
publisher's full (gated) profile, and shows the aggregate with a nudge
tailored to what the numbers actually say — "no views yet" gets different
advice than "views but no requests," which gets different advice than
"here's your view-to-request rate."

**Deliberately count-only, never identity** — a publisher sees "8 views
this week," never which businesses. `Privacy.tsx`'s "Technical
information" bullet was updated to disclose this alongside the migration,
since it does tie a business's own account to which listings they looked
at, even though that detail is never shown to anyone but the platform
itself and (in aggregate) the publisher.

**What counts as a view:** the business/creator has to reach the actual
gated profile (see the profile-gating feature from earlier — an
unregistered visitor only ever sees the card preview, so there's nothing
to log for them). Deduped to one row per viewer per publisher per day —
refreshing a profile five times in one sitting logs once, coming back on
a different day logs again (the right signal — "still interested" — not
noise). A publisher's own view of their own listing is excluded both in
the client (skips the insert entirely) and in RLS (blocked even if that
check were somehow bypassed) — self-inflating your own traction numbers
isn't something to leave to good faith. Admin views don't count either;
an admin opening a profile to review something isn't a business showing
interest.

No deploy step beyond running the migration — no Edge Functions, no env
vars, nothing third-party. Worth testing: view a profile as a business
account, confirm exactly one row lands in `publisher_profile_views`
(re-view the same day, confirm it doesn't add a second), and confirm the
publisher's dashboard nudge text actually matches whatever combination of
views/requests you've set up (all three branches — zero views, views but
no requests, and views with requests — are worth eyeballing once each).

## Rate cards
`schema_phase38_rate_cards.sql` + `RateCardManager.tsx` (dashboard) +
`RateCardDisplay.tsx` (public profile). `publishers.price_per_post` has
always been a single flat number — real creator pricing varies by format
(a Story costs less than a dedicated Reel, a bundle undercuts booking
each separately), so this adds optional structured line items instead of
forcing everyone onto one number that's rarely right for most of what
they actually sell.

**Only relevant to social-media publishers** — the Request Feature
channels (influencer/website/podcast/radio) already show "Pricing
varies, propose your budget" instead of a fixed price, since those go
through `ChannelRequestForm.tsx`'s free-text budget field regardless.
Rate cards live in the sidebar spot the flat price has always occupied
on `PublisherProfile.tsx`.

**`price_per_post` keeps meaning exactly what it always has** — a single
number every existing consumer already reads (Browse's price filter,
`ComparePublishers.tsx`, `AudienceFinder.tsx`'s matching, `mediaKit.ts`,
the pricing-suggestion engine). None of those files changed. A database
trigger (`sync_publisher_starting_price_trigger`) keeps `price_per_post`
mirroring the cheapest rate-card line item whenever at least one exists —
so it now means "starting from" rather than "the" price, but it's still
just one number those files can keep reading unchanged. A publisher who
never adds a rate card is completely unaffected: the trigger never fires
for them, and the dashboard's original flat-price editor still works
exactly as it always did.

No new deploy step beyond running the migration — no Edge Functions, no
env vars, nothing third-party.

Worth testing: add two rate-card items with different prices as a
publisher, confirm the dashboard's "starting price" figure updates to
match the cheaper one without you touching it directly, confirm the
public profile shows the full breakdown (not just the flat number), and
confirm removing all rate-card items leaves `price_per_post` at whatever
it last synced to (the trigger only updates it when a rate-card row still
exists — deleting the last one doesn't reset it to zero or null).

## Localization (Afrikaans / isiXhosa / isiZulu)
`react-i18next` + `i18next` + `i18next-browser-languagedetector` — no
schema, no server component, entirely a frontend concern. Covers the
public marketing surface only: Header, Footer, and Home, fully in all
four languages (English, Afrikaans, isiXhosa, isiZulu). Deliberately not
the authenticated app (dashboards, forms, admin, payment/escrow, or the
compliance flows) — translating live transactional or legal-adjacent UI
carries real correctness risk, and it's the marketing pages that actually
decide whether a South African SME owner who reads one of these languages
first gets as far as signing up at all.

**Not yet translated, on purpose:** `/how-it-works`, `/for-businesses`,
`/for-publishers`, and everything added since (Compliance Centre,
Platform Rules, rate cards, etc.). The infrastructure is fully in place —
`src/i18n/locales/{af,xh,zu}/{howItWorks,forBusinesses,forPublishers}.json`
currently exist only as placeholder `{ "_todo": ... }` stubs (so the app
builds and runs correctly right now) rather than half-translated content.
Extending coverage to any page is: write the real JSON following
`home.json`'s pattern, then wire that page's JSX the same way `Home.tsx`
was — no changes to `i18n/index.ts` needed, the imports are already there.

**Please get isiXhosa and isiZulu reviewed by a native speaker before
relying on them in production.** Afrikaans is a language translated with
confidence end-to-end. isiXhosa and isiZulu are Nguni languages translated
carefully and grammatically, but not at native-speaker fluency — idiom,
register, and natural phrasing need a real speaker of these languages to
check before this goes in front of real customers. This is the single
most important caveat in this section, not a formality.

How switching works: `LanguageSwitcher.tsx` (in the Header, and again
compact in the Footer) sets `i18n.changeLanguage()`, persisted to
`localStorage` (`chatsched_language`) so it's remembered across visits.
First-time visitors get the browser's own language list checked before
falling back to English. Missing keys — which right now means any key on
an untranslated page — silently fall back to English (`fallbackLng: "en"`)
rather than showing a raw `"home.hero.title"`-style key.

`src/i18n/keyParity.test.ts` checks every translated namespace (`common`,
`home`) has *exactly* the same key structure across all four languages,
and that no translated string was left empty. Extend this test's
`namespaces` array when a new page's namespace moves from stub to real.

Worth testing manually:
1. **Switch languages via the Header dropdown on `/`** — hero, metrics,
   the business/publisher split, featured publishers, channels teaser,
   "why not just ads", the interactive how-it-works mockup, the payment
   explainer (check the interpolated numbers render correctly in all four
   languages), and the case studies teaser should all update.
2. **Reload the page** — the chosen language should persist, not reset.
3. **Navigate to an untranslated page** (e.g. `/how-it-works`) while a
   non-English language is selected — content should be in English, not
   broken, not showing raw translation keys.
4. **A first-time visitor with a South African browser locale** (e.g.
   `af-ZA` or `zu-ZA`) — confirm the language detector picks it up
   automatically rather than defaulting to English.

## FAQ page
`src/pages/Faq.tsx` (`/faq`, linked from the Footer) — a single searchable,
categorized FAQ page pulling real facts from across the whole product
rather than generic marketing Q&A. Every answer reflects something that
actually exists today: the real commission split and escrow timings
(`constants.ts`), the real dispute categories and resolution process
(Trust Centre), the real counter-offer mechanic, rate cards, social
account connect, read/view-count privacy behaviour, and account
deletion/export — not aspirational copy about features that don't exist
yet. Where a page already goes deeper on a topic (Trust Centre, Compliance
Centre, How Payment Works), the FAQ answer stays short and links out
rather than duplicating it at length.

Client-side search and category-pill filtering, both against the same
in-memory list — no new table, no new query. If a search comes up empty,
it points straight at `/contact` rather than a dead end.

Worth checking after any change to escrow timings, the commission rate,
or the minimum price floor in `constants.ts`/`pricingEngine.ts`: the FAQ
page interpolates those same constants directly (`CREATOR_APPROVAL_WINDOW_DAYS`,
`BUSINESS_PAYMENT_WINDOW_DAYS`, `CREATOR_PAYOUT_WINDOW_HOURS`,
`PLATFORM_COMMISSION_RATE`, `MIN_PRICE_PER_POST`), so it can't silently
drift out of sync the way a hand-typed number elsewhere in copy could.

## Message read receipts ("seen" state)
`schema_phase42_read_receipts.sql` — adds a nullable `read_at` to both
message systems (`messages`, the request-scoped business<->admin thread
from Phase 3, and `conversation_messages`, the 1:1 business<->publisher
inbox from Phase 29) and shows "Seen" / "Sent" under your own last message
once the other person has opened the thread. Not knowing whether the
other side even saw your message is exactly the kind of uncertainty that
makes people give up on in-platform messaging and go find each other on
WhatsApp or Instagram DMs instead — which is the real competition here,
not another marketplace.

**"Seen" means the thread was open in their browser**, not a guarantee
they read every word — same honest scope every "seen" indicator in any
chat app actually has, no eye-tracking involved. A message is marked read
the moment `load()` runs while that thread is the one currently open,
which happens on initial open and on every poll refresh (`POLL_MS`, both
files) while it stays open.

**RLS enforces who can mark what read, not just the client:**
- A sender can never mark their own message as read (`sender_id <> auth.uid()` in both UPDATE policies) — there's no path, accidental or otherwise, for someone to fake having been seen.
- For `conversation_messages`, only the two actual participants (the business, or the publisher via `publishers.user_id`) can mark something read — an admin can still read every conversation (unchanged from Phase 29) but deliberately cannot mark messages seen, since an admin peeking into a thread to check on it shouldn't tell either side the other has seen their message.
- For `messages`, admin genuinely is one of the two participants (business<->admin, not business<->publisher — see that table's own Phase 3 comment on why), so admin marking read there is correct, not an oversight that differs from the conversation_messages behaviour above.

No new deploy step beyond running the migration — no Edge Functions, no
env vars, nothing third-party.

Worth testing: open a conversation as one participant, send a message,
confirm it shows "Sent" (not "Seen") until the other participant actually
opens that thread — then confirm it flips to "Seen" without either side
needing to refresh manually (the existing poll picks it up within
`POLL_MS`). Also worth confirming an admin viewing a business<->publisher
conversation does NOT flip anything to "Seen" — that's not a bug if you
notice it, it's the RLS policy working as designed.

## Recently viewed
`schema_phase43_recently_viewed.sql` + `recentlyViewed.ts` +
`RecentlyViewedStrip.tsx`, shown on Home (above Featured Publishers) and
Browse (above the filter bar, only when no filter is active — it's meant
to help someone get back to what they were comparing before starting a
fresh search, not compete with an active one). Deliberately reuses
`publisher_profile_views` (Phase 37 — the same table backing publisher-
side traction) rather than a second tracking table: it's the same event
either way, "a registered user looked at this profile," just read back
from the opposite side this time.

**The one real schema change:** Phase 37's SELECT policy only ever let a
publisher see who'd viewed *their own* listing (in aggregate, never
identity — see that migration's own comment). This adds the
complementary direction — a viewer reading their own view history, same
as browser history, no new privacy surface. The "no business can see
another business's views of the same listing" guarantee from Phase 37
is completely untouched by this: the new policy only ever exposes rows
where `viewer_id = auth.uid()`.

Renders nothing at all — no empty box, no placeholder — for a logged-out
visitor or anyone with no view history yet. That's deliberate: this is
meant to disappear completely when there's nothing to show, not take up
space explaining why it's empty.

No new deploy step beyond running the migration — no Edge Functions, no
env vars, nothing third-party.

Worth testing: view two or three different publisher profiles as a
business, then check Home and Browse both show them, most-recently-viewed
first. View the same profile again and confirm it moves to the front
rather than appearing twice. Suspend or reject the underlying listing (as
admin) and confirm it quietly drops out of the strip rather than showing
a broken card.

## Publisher dashboard reorganization
UI-only, no schema change. `PublisherDashboardView.tsx` had grown to
1,000 lines through entirely reasonable individual additions — traction,
connect-your-socials, badges, the getting-started checklist, profile
editing, portfolio, pricing/rate cards, placement types, ad formats —
stacked one after another above the actual requests list. A returning
publisher checking "did anyone request me" was scrolling past eight
sections every time to find out. That's the classic organic-growth trap:
each panel was a good idea on its own, the sum stopped being one.

Now it's two tabs: **Requests** (default) and **Manage listing**.
- **Requests** — the connect-result banner (if just back from OAuth) and
  the identity/badges row stay above the tabs since they're not really
  "requests" or "listing" content specifically; then a slim nudge banner
  if the getting-started checklist isn't finished ("3 setup steps left —
  Manage listing →", using the exact same `computePublisherChecklist()`
  call the checklist panel itself uses, just counted rather than
  rendered), the traction panel (kept here on purpose — "why aren't I
  getting requests" is a requests-page question), then the actual
  requests list. Four things before you see what you came for, not ten.
- **Manage listing** — everything about shaping the listing itself: the
  full getting-started checklist, Connect Social Accounts, profile
  editing, portfolio, pricing/rate cards, and placement/ad-format panels
  (still channel-conditional exactly as before — social-media gets
  Placement Types, the four Request Feature channels get Ad Formats,
  same logic, just relocated).

Nothing about *what* renders changed — every panel, every prop, every
conditional (channel-slug checks, `isRequestFlowChannel` branches) is
identical to before. This is purely about *when* each one is visible,
not what any of them do.

No deploy step at all — no migration, no Edge Function, no env var. Just
`git pull` and ship it.

Worth testing: as a publisher with an incomplete checklist, confirm the
nudge banner shows the right remaining count and that clicking it lands
you on Manage Listing with the full checklist visible. As a publisher
with zero pending items, confirm the nudge banner doesn't show at all.
Switch between tabs a few times and confirm state isn't lost mid-edit
(e.g. don't switch away from Manage Listing while `ProfileEditPanel` is
mid-edit and expect to lose changes — it isn't saved automatically,
same as it wasn't before this reorganization).

## Going live
Switch `PAYFAST_MODE` to `live`, swap in your live PayFast credentials, verify
your sending domain in Resend and set `RESEND_FROM` to an address on it (e.g.
`ChatSched <notifications@yourdomain.co.za>` — without this it keeps
using the sandbox `onboarding@resend.dev` address), and set `SITE_URL` to
your real domain — then redeploy all eleven functions so they pick up the new
secrets.

## Realtime messaging & notifications
`schema_phase45_realtime.sql` — replaces polling with actual push updates
for the notification bell and both messaging surfaces (the per-request
`MessageThread` embedded in dashboard cards, and the general inbox at
`/messages`). No new infrastructure to stand up: this runs on Supabase
Realtime, which every project already has — the migration just opts four
tables into the `supabase_realtime` publication that's created by default,
the same thing the "Enable Realtime" toggle in the Table Editor UI does
under the hood. Nothing to configure beyond running the migration.

What changed on the client: `useNotifications.ts`, `MessageThread.tsx`,
and `Messages.tsx` (both the conversation list and the open thread) each
replaced a `setInterval` poll (20–45s) with a `postgres_changes`
subscription, backed by a refetch when the tab regains focus
(`document.visibilitychange`) rather than a slower fallback poll — that
covers a dropped websocket after sleep/wifi loss without polling
constantly while the tab is backgrounded and nothing could be dropped.

RLS is still the actual security boundary here, not the subscription
`filter` parameter — a client subscribing with no filter at all only ever
receives rows its own RLS policies already let it `SELECT`. The
`conversations` list subscription deliberately has no filter for exactly
this reason: that table's SELECT policy covers both business and
publisher participants via an OR/join a single column-equality filter
can't express, so the correct move is subscribing broadly and trusting
RLS, not narrowing the subscription and hoping that's enough on its own.

Also worth knowing: all four tables got `replica identity full`. The
default replica identity (primary key only) is enough for INSERT events,
but logical replication needs the full OLD row to evaluate an UPDATE
against a policy that references columns beyond the primary key — which
every RLS policy on these four tables does. Without it, read-receipt
UPDATE events (the actual reason `MessageThread`/`Messages.tsx` care about
`read_at`) would silently never reach anyone once RLS got involved.

Worth testing: open a conversation as a business in one browser and the
matching publisher's dashboard in another (or a private window), send a
message from one side, and confirm it appears on the other without a
manual refresh — same test for the notification bell (trigger any
existing notification path, e.g. a new request, and confirm the badge
updates live). Then background one tab for a minute, refocus it, and
confirm anything that happened while it was hidden shows up immediately
rather than needing a second refocus.

## Real-user performance monitoring (Sentry Web Vitals)
`src/lib/errorTracking.ts` previously initialized Sentry for error
tracking only, with `tracesSampleRate: 0` and no tracing integration —
deliberately off, per that file's own prior comment, on the reasoning
that this app had no need for it. Turned on: `Sentry.browserTracingIntegration()`
plus a non-zero `tracesSampleRate` (defaults to 10% —
`VITE_SENTRY_TRACES_SAMPLE_RATE` overrides it) now reports real Core Web
Vitals — LCP, CLS, INP, TTFB — from actual visitors' page loads, not just
errors. No new dependency and no new secret to provision: this is the
same `@sentry/react` SDK and `VITE_SENTRY_DSN` already in place: it's a
capability that SDK already had, switched on.

Nothing else to configure — once `VITE_SENTRY_DSN` is set (see
`.env.example`), this is live on the next deploy. Worth confirming it
actually works rather than assuming the config is right: open the
deployed site, click through a few pages, then check Sentry → your
project → **Performance** (or **Insights → Web Vitals** depending on your
Sentry plan/UI version) a minute or two later — you should see pageload
transactions with LCP/CLS/INP/TTFB measurements attached, not just an
empty dashboard.

If the volume ends up too high (or too low to be useful) once real
traffic arrives, adjust `VITE_SENTRY_TRACES_SAMPLE_RATE` — no code change
needed, just redeploy with the new value.

## Careers (`/careers` + `/admin/careers`)
New table `career_applications`, plus a private `career-cvs` storage bucket
— **run `schema_phase46_careers.sql` in the Supabase SQL editor** before
either page will work.

Applicants aren't logged in, so this follows `contact_messages`' shape
(anyone can insert, only admins can read) rather than portfolio-images'
`{auth.uid()}/{filename}` folder convention — there's no `auth.uid()` to
scope by. The CV bucket is private like `campaign-proof-screenshots`, not
public like portfolio-images: a CV is personal information tied to one
application, not something meant to be publicly browsable. Admin reads it
back via a 5-minute signed URL (`AdminCareers.tsx`'s "Download CV"
button), same pattern `compliance.ts` already uses for proof screenshots.

`/admin/careers` is a standalone route behind `RequireAuth role="admin"`
(so it inherits the mandatory-MFA gate the rest of `/admin` has), not a
tab inside `Admin.tsx` — it's a big enough, separate-enough workflow to
warrant its own page, with a link back and forth between it and the main
admin dashboard.

No Edge Function, no env var, no third-party service — just the one
migration.

Worth testing: submit an application from `/careers` (as a logged-out
visitor) with a real PDF/DOCX under 5MB, confirm it shows up in
`/admin/careers`, walk it through a few status changes, set an interview
date, save a note, and download the CV back down. Try uploading a file
over 5MB or a `.zip` and confirm the client-side check catches it before
it even reaches the bucket's own limit.

## Work With Us (`/work-with-us` + Admin → Work With Us tab)
New table `work_with_us_applications`, plus an optional-attachment private
storage bucket `work-with-us-attachments` — **run
`schema_phase47_work_with_us.sql`** before either surface will work.

Same "anyone can insert, only admins can read" shape as Careers
(Phase 45), but deliberately a separate table: this is a wider,
lower-commitment intake across nine categories (Developers, Designers,
Sales, Marketing, Creators, Community Managers, Sales Representatives,
Freelancers, Internships) rather than a hiring pipeline — no interview
scheduling, and the attachment is optional since a freelancer's or
creator's portfolio link is often enough on its own.

Unlike Careers, this one lives as a tab inside the main `/admin`
dashboard rather than its own route — `Admin.tsx`'s new "Work With Us"
tab loads it alongside everything else already in `loadAll()`. The tab
opens with a category breakdown bar chart (pure client-side count over
whatever's loaded, same as every other tab-label count in this file) so
it answers "which pipeline are people actually using" at a glance, before
you scroll into any individual submission — then the filterable
list/status/notes/attachment-download UI below it, same shapes as the
Careers admin page (signed URL for the attachment, CSV export).

No Edge Function, no env var — just the one migration.

Worth testing: submit from `/work-with-us` under a couple of different
categories, with and without an attachment, and confirm the breakdown bar
chart on the new admin tab updates to match. Change a submission's status
and confirm it holds after a refresh. Filter the list by category and
confirm the CSV export respects the filter.

## Partners (`/partners` + Admin → Partners tab)
New table `partner_applications` — **run `schema_phase48_partners.sql`**
before either surface will work. No storage bucket this time — partner
applications are companies, not people submitting a CV, so the form asks
for a company website link instead of a file upload.

Different shape again from Careers and Work With Us: this is other
BUSINESSES (marketing agencies, web developers, PR agencies,
photographers, event companies, payment providers, software companies,
creator networks, media organisations, business associations) applying
to partner with the platform itself, so the table has
`company_name`/`contact_name` instead of a single name, and its own
status pipeline — New → Contacted → In Discussion → Active Partner →
Declined — that reflects a partnership deal progressing, not a hiring
funnel or a triage queue.

Lives as an "Partners" tab inside `/admin`, right next to Work With Us,
with the same shape: a category breakdown bar chart at the top ("which
partner category are people applying under"), then a filterable
list/status/notes/CSV-export UI below it.

No Edge Function, no env var — just the one migration.

Worth testing: submit from `/partners` under a few different categories
and confirm the breakdown bar updates. Walk a submission through New →
Contacted → In Discussion → Active Partner and confirm it holds after a
refresh. Filter by category and confirm the CSV export respects the
filter.

## Become a Partner (`/partners/apply`)
Extends Phase 47's `partner_applications` table rather than adding a new
one — **run `schema_phase49_partner_types.sql`** before this page will
work. It adds a `partner_type` column (Agency / Technology / Media /
Community / Referral Partner) and relaxes `category` to nullable, because
this page collects a different, independent thing from `/partners`:
`/partners` asks what INDUSTRY the applicant is in (agency, developer,
media org, etc.); `/partners/apply` asks what FUNCTIONAL ROLE they'd play
in the partner program itself. A submission can set either field, both,
or (enforced by a check constraint) at least one — the two application
pages each still make their own field required client-side.

`/partners` now links to `/partners/apply` via a "Become a partner" button
in its hero — the two pages are meant to work together: browse by
industry on one, formally apply by program type on the other.

The Partners tab in `/admin` picked up a second breakdown chart
("By partner type") next to the existing category one, plus a second
filter dropdown, so you can see both dimensions of the pipeline
independently. Everything else about that tab — status pipeline, notes,
CSV export — is unchanged and now just reflects rows from both pages.

Worth testing: submit from `/partners/apply` under each of the five
types, confirm they show up in the admin Partners tab with `Partner type`
set and `Category` blank, and that the new "By partner type" chart
updates. Confirm existing `/partners` submissions (category set,
partner type blank) still display and filter correctly alongside them.

## Investors (`/investors`)
No migration, no database, no admin tab — this one's static content.
Company overview page (Problem / Solution / Marketplace / Vision) with a
"Get in touch" button pointing at `/contact`, since it's a company-facing
page rather than another applicant pipeline like Careers/Work With
Us/Partners. If you later want to capture investor inquiries separately
instead of routing them through the general contact form, that'd be a
small follow-up in the same shape as the others.

## Our Mission (`/mission`)
No migration, no database — another static, brand-identity page like
Investors. "Our mission" hero, then Vision (reuses the same vision
statement as `/investors` for consistency), Principles (five cards on how
the platform is built — fair splits, no lock-in, SA-first, real audiences
over vanity metrics, small-team accountability), and What We Believe (four
short belief statements). All copy avoids "AI"/"automated" language, in
line with the site-wide sweep already done elsewhere in this codebase.

## Business Success Centre (`/business-success` + `/business-success/:slug`)
No migration, no database — static content, same pattern as `/blog` and
`/blog/:slug` (which this deliberately mirrors rather than reinvents:
same hub-page-with-featured-post layout, same article-detail layout,
same `getXBySlug` lookup helper). Content lives in
`src/lib/businessSuccessArticles.ts` as a plain array, same shape as
`src/lib/blogPosts.ts`.

Seven guides, one per requested topic: getting your first campaign,
choosing publishers, calculating budgets, measuring ROI, growing
locally, campaign mistakes, and building a repeat-campaign rhythm. All
grounded in how the platform actually works (request → publisher review
→ schedule → live), not generic marketing filler.

To add an eighth guide later: add one object to `SUCCESS_ARTICLES` in
`src/lib/businessSuccessArticles.ts` — the hub and article pages pick it
up automatically, no other file needs touching.

## Publisher Success Centre (`/publisher-success` + `/publisher-success/:slug`)
No migration, no database — static content, same hub/detail pattern as
Business Success Centre and `/blog`, this time with a red accent instead
of green to visually distinguish it. Content lives in
`src/lib/publisherSuccessArticles.ts`.

Eight guides, one per requested topic: pricing, media kits, increasing
engagement, responding to campaign requests, avoiding fake followers,
improving profiles, negotiating campaigns, and creating better sponsored
content. Grounded in the platform's own mechanics where it mattered — the
pricing guide walks through the actual Suggested Price model
(`pricingEngine.ts`'s per-1,000-follower base rate, engagement multiplier,
trust score), and the fake-followers guide explains the same signals
`authenticitySignals.ts` already checks for during admin review — rather
than repeating generic influencer-blog advice unconnected to the tools
publishers are actually using.

CTA at the end of each page points to `/dashboard` (not `/browse`, which
is the businesses' entry point) since the audience here is publishers.

To add a ninth guide later: add one object to `PUBLISHER_SUCCESS_ARTICLES`
in `src/lib/publisherSuccessArticles.ts` — same as Business Success
Centre, no other file needs touching.

## Marketplace Transparency (`/transparency`)
**Run `schema_phase50_transparency.sql`** before the live stats on this
page will show real numbers.

Deliberately doesn't rebuild what already exists — dispute handling,
verification, and platform rules already have full pages
(`/trust#disputes`, `/trust#verification`, `/trust`, `/platform-rules`),
so `/transparency` links into those rather than duplicating their
content, and "supported channels" reads straight from the existing
channel registry (`getEnabledChannels()`) rather than a new hardcoded
list. What's actually new here is the two live numbers at the top —
campaign completion rate and average response time — which needed real
data behind them, not copy.

That required a small, deliberate schema change: `requests` (schema.sql)
only ever had `created_at`, so there was nothing honest to compute a
response-time metric from. This migration adds `first_responded_at`, set
once by trigger the moment a request's status first moves off
`'pending'` — not on every later status change — so it measures time to
first response, not total time to resolution. Completion rate needs no
new column; it's just `completed / total`.

Both numbers come from `public.get_marketplace_transparency_stats()`, a
SECURITY DEFINER function granted to `anon` — it returns only the
aggregate row, never an individual request, so it's safe to call from
the public page despite `requests` itself being RLS-locked to the
business/publisher/admin involved. The page shows "Not enough data yet"
rather than 0% or a fake number when there's nothing to compute from
yet (a fresh database, or before anyone's responded to anything) —
deliberately, in keeping with this codebase's existing stance against
illustrative-looking numbers that aren't real (see schema_phase44's
comment header for the earlier instance of that same principle).

Worth testing: submit a request as a business, respond to it as a
publisher, mark it completed, then reload `/transparency` and confirm
both numbers move — completion rate should reflect the new completed
request, and average response time should reflect the gap between
submission and that first status change specifically (not any later one,
if you change status again after).

## Advertise With ChatSched (`/advertise` + Admin → Advertise tab)
New table `advertise_inquiries` — **run `schema_phase51_advertise.sql`**
before either surface will work.

Conceptually different from everything else added so far: every other
form sold access TO the platform (partnering, publishing, applying,
working with it). This one sells the platform's OWN traffic and audience
AS inventory — a business buying a banner slot, a newsletter mention, a
featured directory placement, a sponsored article, or a broader brand
partnership with ChatSched itself, not with a publisher on the
marketplace. Kept as its own table rather than folded into
`partner_applications` because neither of that table's two axes
(industry category, functional partner-program role) means "which ad
product on chatsched.com" — this is closer in shape to Work With Us or
Partners (same public-insert/admin-only-read RLS, same simple status
pipeline) but a genuinely different pipeline.

Five products, matching the request: Website Advertising, Newsletter
Sponsorship, Featured Marketplace Placement, Sponsored Article, Brand
Partnership. The form also collects an optional free-text budget range,
since there's no fixed rate card yet.

Lives as an "Advertise" tab inside `/admin`, right next to Partners, with
the same shape: a product breakdown bar chart at the top, then a
filterable list/status/notes/CSV-export UI below it.

No Edge Function, no env var — just the one migration.

Worth testing: submit from `/advertise` under a couple of different
products, confirm the breakdown bar updates, walk one through New →
Contacted → In Discussion → Active, and confirm the CSV export respects
the product filter.

## Press (`/press`)
No migration, no database — static content plus two live reads reused
from elsewhere (approved publisher count, the same
`get_marketplace_transparency_stats()` RPC `/transparency` already calls),
same "real numbers or say there isn't enough data" stance as `/about` and
`/transparency` — a press page is exactly the place a stale or fabricated
number would do the most damage if a journalist quoted it.

Brand assets section links directly to the real, existing files
(`/favicon.svg`, `/icons/icon-512.png`) rather than inventing a logo suite
that doesn't exist yet — there's no separate full wordmark file in this
repo, just the billboard glyph used as the favicon/app icon, so that's
what's offered. Colour palette and typefaces are pulled straight from
`tailwind.config.js`. Deliberately no "as featured in" / press-mentions
section — there's no real press coverage to list yet, and a page like
this is the wrong place to imply otherwise.

## Security (`/security`)
No migration, no database — static content, but every claim on it is
grounded in something that's actually implemented elsewhere in this
codebase, not generic security-page boilerplate: RLS is enabled on all
40 tables across `supabase/*.sql`; admin 2FA is enforced by
`AdminSecurity.tsx`/`MfaSetup.tsx` and gates `/admin` via `RequireAuth`;
PayFast ITN signatures are independently recomputed and checked in
`supabase/functions/_shared/payfast.ts`; social OAuth tokens are
AES-256-GCM encrypted at rest per `tokenCrypto.ts`; admin actions are
written to `admin_audit_log` (schema_phase15) via `log_admin_action()`;
and self-service account deletion (`delete-account` Edge Function) is
POPIA "right to erasure" support, not a "email us" placeholder. Nothing
on the page describes a control that isn't real.

Deliberately scoped apart from the Trust Centre: `/trust` and its
sub-pages are about marketplace trust (publisher verification, fraud,
disputes between users); `/security` is about the platform's own
infrastructure. The hero links to `/trust/fraud-prevention` for anyone
who lands here looking for the other one.

## Help Centre (`/help`)
No migration, no database. Deliberately NOT a rebuild of `/faq` — that
page already had search, category filters, and an accordion, so a second
searchable FAQ would just be a worse duplicate. `/help` is a different
thing: a support hub that gets people to the right place fast — a search
box that deep-links into `/faq?q=...`, four role-based link groups
(business / publisher / account & billing / trust & safety), a "common
tasks" list (reset password, set up 2FA, delete account, report a
dispute, understand a payout), and a contact fallback. Every link on it
points to a page that already exists.

The one real code change this needed: `Faq.tsx` now reads an initial
`?q=` from the URL via `useSearchParams` (same pattern `MediaKit.tsx`
already used) so `/help`'s search box can hand off into a pre-filled FAQ
search rather than duplicating FAQ's own search logic. It's read once on
mount, not kept in sync — the URL is just the entry point.

## Accessibility (`/accessibility`)
No migration, no database — static content, same "only claim what's
verifiably true" stance as Security and Press. Every item in "What's in
place" is something I actually found in the codebase, not boilerplate:
`lang="en"` on the document, `prefers-reduced-motion` respected in
`Skeleton.tsx`/`useReveal.ts`/`Home.tsx`, ARIA labels/roles present
across ~28 files, real alt text on images (none found blank), and the
i18n setup already covering four languages. Deliberately does NOT claim
WCAG AA/AAA conformance or cite a completed audit — neither is true yet
— and says so plainly in its own "still improving" section, with a
direct report channel for anything that doesn't work.

## Glossary (`/glossary`)
No migration, no database — static content, but every number in it is
pulled from the real constants rather than retyped: commission and
publisher share come from `PLATFORM_COMMISSION_RATE`/`PUBLISHER_SHARE`,
and the three timing windows from `CREATOR_APPROVAL_WINDOW_DAYS`/
`BUSINESS_PAYMENT_WINDOW_DAYS`/`CREATOR_PAYOUT_WINDOW_HOURS` in
`constants.ts`. If any of those ever change, this page updates itself —
nothing here is a copy that can silently drift out of sync with the
actual mechanics (the platform commission is 12%/88%, not the 25%/75%
figure floated in early planning — worth knowing if that number shows up
anywhere else).

Sixteen terms across four categories (marketplace basics, money & timing,
pricing, trust & safety), several linking out to the fuller explanation —
Suggested Price links to the Publisher Success Centre's pricing guide,
Escrow to `/how-payment-works`, Dispute to `/trust#disputes` — so the
glossary stays a quick reference rather than trying to re-explain
everything itself.

## Roadmap (`/roadmap`)
No migration, no database — static content, and deliberately conservative
about what it claims. "Now" only lists things I verified are actually
shipped (all 5 channels live per `featureFlags.ts`, escrow + 48-hour
payout per `constants.ts`, publisher verification + authenticity checks,
self-serve applications, disputes). "Next" draws from one genuinely solid
piece of real evidence rather than invented features: `channelTypes.ts`
already defines `print`, `outdoor`, `direct`, and `programmatic` as
channel categories in the type system, with zero channels actually
registered in any of them yet (`channelRegistry.ts` only has the 5 live
ones, all `digital`/`broadcast`). That's real, checkable "room designed
for growth," not a guess — so it's presented as directional exploration,
explicitly with no committed dates, rather than a promised feature list.

## Publisher Earnings Estimator (`/earnings-estimator`) & Campaign Budget Calculator (`/budget-calculator`)
No migration, no database, no AI/API call of any kind — both are pure
client-side math, computed instantly on every input change.

The Earnings Estimator doesn't reimplement pricing logic — it imports
`calculateSuggestedPrice()` straight from `pricingEngine.ts`, the exact
function the real publisher dashboard and `PublisherApply.tsx` already
use. A visitor playing with the sliders here sees the same number
they'd get on their actual dashboard once they're a publisher — that
consistency is the entire point of the tool, so it was built by reusing
the real function, not writing a second approximation of it. It also
reuses `getEnabledChannels()` rather than a hardcoded channel list, and
its "apply" CTA points at the real public entry point
(`/register?role=publisher`), not the authenticated `/apply` route
(worth double-checking if the register flow's query-param handling
changes).

The Budget Calculator implements, as an interactive tool, exactly the
method the Business Success Centre's budgeting guide already describes
in prose — work backwards from what a customer is worth × an acceptable
acquisition-cost percentage × how many customers you want, then split
across the channels you pick. Both tools cross-link back to their
matching Success Centre guide, and are cross-linked from the
Roadmap-adjacent footer nav.

## Local Reach Checker (`/reach-checker`) & Which Channel Fits Your Business? Quiz (`/channel-quiz`)
No migration needed for either — both use existing tables/data as-is.

The Reach Checker queries the real `publishers` table live
(`status = 'approved'`, matched category + province, optional suburb
substring match), the same table `/browse` already queries — this works
unauthenticated because `publishers_select_public` (schema.sql) already
grants public select. It sums real follower counts across up to 200
matches rather than reporting a fabricated "potential reach" figure, and
when a category/area combination has zero approved publishers, it says
so honestly and turns that into a publisher-recruitment CTA rather than
hiding the gap. Deep-links into `/browse` with the same filters
(`category`, `province`, `suburb` params — `browseFilters.ts`/
`searchParamsCodec.ts`) so "see them all" actually shows the same set.

The Channel Quiz is pure client-side scoring, no database at all — five
questions, each answer adding weighted points toward one or more of the
5 real channel slugs, highest score wins. Reuses `getChannelBySlug()`
and `ChannelIcon` so the result page shows the same name/tagline/icon as
the channel's own page, and deep-links into `/browse?channel=<slug>`
using the same `channel` param `Browse.tsx` already reads.

## Community (`/community` + 3 sub-pages + Admin → Community tab)
New tables `community_announcements`, `community_events`,
`community_questions` — **run `schema_phase52_community.sql`** before
any of it will work.

Deliberately not a forum — three separate, simple, admin-curated content
types, exactly matching the "start with articles, Q&A, announcements,
webinars, events" scope:

- **Announcements** and **Events** are pure admin-authored content
  (`is_published`/`pinned` flags), publicly readable once published —
  the same shape as a lightweight news feed or calendar, no reply
  threads.
- **Q&A** is the one piece with public write access: anyone can submit a
  question (`community_questions_insert_public`), but it stays invisible
  to everyone except admins until an admin writes an answer and
  explicitly sets `status = 'published'`
  (`community_questions_select_published_or_admin`). This is curated
  Q&A — no reply-to-a-reply structure, on purpose, per the brief's "you
  don't need to build a Reddit clone."
- "Articles" and "Marketing Discussions" deliberately don't get new
  tables — `/community` links out to the existing Business/Publisher
  Success Centres and `/blog` rather than duplicating content that
  already has a home.

`/community` is the hub (5 sections matching the brief exactly:
Publisher Community, Business Community, Marketing Discussions, Events,
Announcements); `/community/qa`, `/community/announcements`, and
`/community/events` are the full list pages. `/community/qa` reads an
optional `?category=` from the URL (same `useSearchParams` pattern as
`/help` → `/faq`) so the hub's "Publisher Q&A →" / "Business Q&A →" /
"Marketing Q&A →" links land pre-filtered.

Admin got one new top-level "Community" tab (not three, to avoid further
crowding an already-large tab bar) with three inner sub-tabs —
Announcements, Events, Q&A — each with its own create-and-manage UI:
post/pin/publish/delete for announcements, create/publish/delete for
events, and answer/mark-answered/publish/delete for questions. The tab
label surfaces the pending-question count specifically
(`Community (N pending)`), since that's the one queue here that actually
needs regular attention — a submitted question sits invisible to the
public until an admin acts on it.

Worth testing: submit a question from `/community/qa`, confirm it does
NOT appear publicly yet, answer and publish it from
`/admin` → Community → Q&A, then confirm it now shows up both on
`/community/qa` and filtered correctly via `/community/qa?category=...`.
Same publish/unpublish round-trip for an announcement and an event.


## Browse/CaseStudies/HowItWorks icon & live-data upgrade
No migration — this is frontend only. Merged in an upstream update that:
replaced bare emoji glyphs on Browse's channel/platform filter chips with
real icon components (`ChannelIcons.tsx`, `PlatformIcons.tsx` — original
artwork for platform badges, not reproductions of any trademarked logos);
added an active-filter chip row to Browse so a narrowed search can be
backed off one field at a time instead of only via "Clear all"; gave
CaseStudies a live-data section (real approved-publisher counts by
channel and province, pulled from the same `usePublishers()` hook Browse
itself uses) clearly separated from its existing illustrative scenarios;
and turned HowItWorks' single flow mockup into three switchable
channel-specific scenarios (social media / influencer / podcast).

The upstream files as provided referenced two things that didn't exist
yet in this codebase, so I added them to make the merge actually build
rather than leave a broken import:

- **`src/components/UiIcons.tsx`** — a new shared file with `CloseIcon`,
  `WarningIcon`, `CheckIcon`, in the same ink-stroke line style
  `ChannelIcon.tsx` already established. These replace raw ✕/⚠/✓
  characters that were previously typed directly into JSX across Browse,
  CaseStudies, and HowItWorks.
- **`getMatchReason(publisher)`** in `browseFilters.ts` — Browse's "Best
  match" sort now shows a one-line reason chip on each result
  (`PublisherCard.tsx`'s new optional `matchReason` prop). The reason is
  deterministic, not AI-generated: it names whichever real signal already
  feeding that publisher's `publisher_score` is strongest for them
  (rating, verification + trust score, response time, engagement,
  followers — see `calculate_publisher_score()` in schema_phase5.sql for
  the actual weights), and returns nothing rather than a filler string
  when no signal stands out.

## Personalized dashboard homepage
No migration — every number and list here reads from tables that already
exist (`saved_lists`, `publisher_blocked_dates`, `notifications`,
`publisher_profile_views`, `requests`/`channel_requests`, plus the
existing `computeBusinessChecklist()`/`computePublisherChecklist()`
helpers). Nothing here is a placeholder number; every figure is a real
query result, including the ones that read like copy
("You have 3 saved publishers available this week").

Two new self-contained components, one per role, replacing the identical
static "Welcome back" heading both dashboards used to share:

- **`BusinessHomeSummary.tsx`** (`Dashboard.tsx`, business branch) —
  "Saved publishers available this week" cross-references every publisher
  across a business's `saved_lists` against `publisher_blocked_dates` for
  the next 7 days (available = no blocked date in that window, not a
  guess). "Recommended publishers" looks at the categories/provinces the
  business has actually sent requests to before and finds more
  `approved` publishers in those, excluding ones already requested —
  falling back to top trust-score publishers for a business with no
  history yet. "Continue your campaign" surfaces the most recent
  non-terminal request and deep-links to `#your-requests` (a new anchor
  on the existing "Your requests" heading) rather than a new route.
  "New publishers matching your searches" reads back the real
  notifications `trg_notify_saved_search_matches` (schema_phase33)
  already generates — nothing recomputed. "Your recent activity" reads
  `publisher_profile_views` filtered to `viewer_id = auth.uid()`
  (schema_phase43). "Recommended next action" is literally the first
  incomplete item from the existing `computeBusinessChecklist()` — reused,
  not reimplemented, so it can never say something different from the
  onboarding checklist lower on the same page.
- **`CreatorHomeSummary.tsx`** (`PublisherDashboardView.tsx`) — takes
  `publisher`/`requests`/`channelRequests`/`connectedPlatformCount` as
  props from state the parent already loaded, so it adds **zero** new
  queries. "N campaigns match your profile" counts requests/channel
  requests actually awaiting this publisher's response right now — the
  most literal, honest reading available, since a request only ever
  reaches a publisher if it already matched their channel/category by
  construction of the request flow. "Your profile is N% complete" is
  `computePublisherChecklist()`'s done-count as a percentage, with a
  progress bar. "Your earnings" applies the same `PUBLISHER_SHARE` math
  `EarningsDashboard.tsx` uses, computed from whichever of the two
  request flows this publisher's channel actually uses (only one is ever
  populated per publisher). "Recommended actions" is the same
  first-incomplete-checklist-item pattern as the business side.

Worth testing: as a business, save a publisher to a list, block one of
their dates for this week (as that publisher), and confirm the "available
this week" count drops by one. As a publisher, confirm the earnings
figure matches the total shown on `/dashboard/earnings` exactly (same
underlying math, so it should never disagree).

## Once-off activation pricing + Featured Placement (item 10)
`schema_phase86_once_off_activation_pricing.sql`,
`schema_phase87_featured_placement_subscriptions.sql`. Converts ChatSched
Publisher Network / ChatSched Business from monthly recurring PayFast
subscriptions (R99/mo, R199/mo) to once-off activation fees (R199, R399 —
the latter now includes the R199 launch credit rather than granting it
separately) with no renewal, ever, and drops the past_due/grace_period/
suspended lifecycle that only ever made sense for a recurring payment.
Adds a genuinely new, separate, still-recurring R99/month product —
self-serve Featured Placement for publishers.

1. Run `schema_phase86_once_off_activation_pricing.sql`, then
   `schema_phase87_featured_placement_subscriptions.sql`, in that order.
2. Redeploy the changed functions:
   ```
   supabase functions deploy publisher-subscribe
   supabase functions deploy business-subscribe
   supabase functions deploy payfast-notify
   supabase functions deploy cancel-subscription
   supabase functions deploy featured-placement-subscribe
   ```
3. **Delete the retired function** — it no longer exists in this repo,
   but if it was ever deployed to your project it's still running against
   code that no longer matches the schema:
   ```
   supabase functions delete expire-subscription-grace-periods
   ```
   And if you'd already scheduled it per this file's old instructions,
   also run `select cron.unschedule('expire-subscription-grace-periods');`
   in the SQL editor.
4. **Known gap, not an oversight**: `cancel-subscription`'s
   `role=featured_publisher` path marks a publisher's Featured Placement
   row 'cancelled' in our own database, but does NOT call PayFast's
   recurring-cancel API — that code (`cancelPayfastSubscription`, removed
   from `_shared/payfast.ts` when it lost its last caller in this same
   pass) needs re-adding from PayFast's published API docs
   (https://developers.payfast.co.za/api, "Recurring Billing" section)
   before this path is relied on for a real paying publisher, or the
   PayFast-side charge may continue even after our own records show
   'cancelled'. Flagged here and in "claude fixes Sept 6" rather than
   left to be discovered later.
5. There is currently no admin UI wired up to call `cancel-subscription`
   for any of its three roles (business/publisher/featured_publisher) —
   it's callable (admin-only, confirmed via the caller's own session) but
   nothing in `Admin.tsx` has a button for it yet. A real gap if ChatSched
   staff need to revoke a membership or a Featured Placement today.
6. Test the same way `PHASE2_SUBSCRIPTIONS_DELIVERY.md` originally
   described for the old recurring flow, adjusted for the once-off model:
   activate as a test publisher and a test business via PayFast sandbox,
   confirm both land on `active` with no `current_period_end` expectation
   (there isn't one anymore), confirm the business's launch credit is
   granted in the same PayFast ITN that activates it, and confirm a
   second visit to Account Settings no longer offers to "subscribe" (it
   should show "Activated" with no renew/cancel affordance). Separately,
   as a publisher, buy Featured Placement and confirm the listing's
   `featured`/`featured_until` update automatically (via
   `trg_sync_featured_placement_status`) without touching the admin
   manual-toggle button in `Admin.tsx` at all.

## Atomic launch-credit redemption (item 11)
`schema_phase88_atomic_launch_credit_redemption.sql`. Closes the race
condition in `payfast-checkout`'s launch-credit application — reading
`business_launch_credits.remaining`, computing the discount in
JavaScript, and (for a partially-covered payment) deferring the actual
balance deduction to a later `payfast-notify` call meant two concurrent
checkouts for the same business could each observe the same
pre-deduction balance before either wrote anything back. Replaces that
with three atomic, row-locked Postgres functions
(`reserve_launch_credit_for_payment`, `confirm_launch_credit_redemption`,
`release_launch_credit_redemption`) and a new
`launch_credit_redemptions` table recording one row per payment that
ever claimed credit.

Also fixes a second, real, separate bug found while implementing this:
`payfast-notify`'s amount-mismatch check compared PayFast's actual
charge against the FULL campaign amount even when launch credit had
covered part of it — meaning any partially-credit-covered payment could
never actually be marked paid. Now compares against
`payment.amount - payment.credit_applied`, which is what PayFast was
actually asked to charge.

1. Run `schema_phase88_atomic_launch_credit_redemption.sql`.
2. Redeploy the two changed functions:
   ```
   supabase functions deploy payfast-checkout
   supabase functions deploy payfast-notify
   ```
3. **Known, deliberately out-of-scope gap**: a checkout that reserves
   credit and is then silently abandoned — never completes, and PayFast
   never sends a FAILED/CANCELLED ITN either (e.g. the business just
   closes the tab) — leaves that reservation at `'reserved'`
   indefinitely, with its amount unavailable to other payments until
   released. Retrying checkout for the *same* request is safe (the
   reservation is idempotent per `payment_id`), so this only affects
   credit that's never retried and never explicitly fails. A scheduled
   sweep that releases stale `'reserved'` rows after some window (e.g. 24
   hours) would close this properly — not built here, flagged in
   `schema_phase88`'s own header comment and in "claude fixes Sept 7"
   rather than left to be discovered later.
4. Test: as a test business with launch credit, start two checkouts for
   two different confirmed requests whose combined cost exceeds the
   remaining credit, and confirm the SECOND one only gets whatever credit
   is genuinely left (not the same starting balance both would have seen
   under the old code) — this is the actual regression test for the race,
   though a true concurrent-request test needs two overlapping requests
   fired at once (a load-testing tool, not just two sequential manual
   checkouts) to fully exercise the row lock rather than just the
   sequential-correctness half of it. Also confirm a payment that uses
   *partial* credit (not full coverage) actually reaches `'paid'` after a
   real PayFast sandbox completion — this was silently broken before this
   fix (see the amount-mismatch bug above) and is easy to miss if only
   full-coverage or no-credit payments were tested previously.

## Production security headers ("claude to fix 2" item 22)
The app didn't set any security headers at the hosting layer at all —
whatever the CDN/host's own defaults happened to be. Now it does, via a
generated `Content-Security-Policy` plus five other standard headers, but
*how* they reach the browser depends on where this gets deployed, since
this is a static SPA with no server of its own to set headers at request
time.

**Netlify and Cloudflare Pages** (recommended — zero extra config beyond
what's already committed): `npm run build`'s `postbuild` step
(`scripts/generate-security-headers.mjs`) writes `dist/_headers`, which
both platforms read natively from the publish/output directory. This
version of the CSP is the tightest one: it bakes in this deployment's
*actual* `VITE_SUPABASE_URL` host (set that env var on the host before
building — Netlify/Cloudflare Pages both inject configured env vars into
the build command's environment, which is exactly what this script reads)
and a hash of the exact bytes of `index.html`'s one inline script (the
JSON-LD block), computed fresh from the real build output every time —
never hardcoded, so it can't silently drift if that script block ever
changes.

**Vercel**: reads `vercel.json` from the project root, which can't be
generated the same way (Vercel resolves it independent of the build
command, and its header values can't reference env vars). The committed
`vercel.json` has the same policy with one difference — `*.supabase.co`
wildcarded instead of this deployment's exact project host, since a
static file can't know that value. Safe (every Supabase cloud project
lives on that domain), just slightly broader than it needs to be. Want
the tighter version on Vercel anyway? Build locally with your real
`VITE_SUPABASE_URL` set, read the `Content-Security-Policy` value out of
the generated `dist/_headers`, and paste it into `vercel.json` in its
place.

**Any other static host** (S3 + CloudFront, GitHub Pages, nginx, Apache,
etc.) — none of these read `_headers` or `vercel.json`; headers need to be
configured at that host/CDN's own layer. Build once locally (with your
real `VITE_SUPABASE_URL` set) and copy the exact header values out of the
generated `dist/_headers` — that file is the single source of truth for
what these headers should actually say, so treat it as the copy-paste
source rather than reconstructing the policy from scratch:
- **CloudFront**: create a Response Headers Policy (CloudFront console →
  Policies → Response headers → Create) and add each header from
  `dist/_headers` as a custom header.
- **nginx**: an `add_header '<Name>' '<value>' always;` line per header,
  inside the relevant `server`/`location` block. `always` matters — without
  it nginx won't add these headers to error responses.
- **Apache**: `Header always set <Name> "<value>"` per header (needs
  `mod_headers` enabled), in a `.htaccess` file or the site's vhost config.
- **GitHub Pages**: doesn't support custom response headers at all, at any
  layer — put a real CDN (e.g. Cloudflare, free tier) in front of it if
  these headers matter for a GitHub Pages deployment.

**Worth testing after any deploy**: open the deployed site, check the
Network tab for the CSP header on the initial document response, and
actually exercise the things the policy had to account for — fonts
render, Plausible's script loads if configured, a request/message page
that uses Realtime updates live, a publisher profile with a YouTube/Vimeo
intro video actually plays, and a PayFast checkout redirect completes.
Every one of those is a real, specific thing this policy was built to
keep working, not a generic checklist — see
`scripts/generate-security-headers.mjs`'s own header comment for exactly
which line of code in this repo justifies which CSP entry.

## Dynamic sitemap generation ("claude to fix 2" item 25)
public/sitemap.xml used to be a hand-maintained, fixed 13-route list —
its own header comment said plainly that dynamic pages (publisher
profiles, individual channel pages) weren't included because "this is a
plain Vite SPA with no build-time sitemap generation step." There's now
one: `npm run build`'s `postbuild` step runs
`scripts/generate-sitemap.mjs` after `scripts/generate-security-headers.mjs`
(same postbuild chain as item 22's headers), which writes a fresh
`dist/sitemap.xml` combining:
- ~60 static, indexable routes (audited against every `<Route>` in
  src/App.tsx, not assumed from the old file — which turned out to be
  missing dozens of real pages, not just the dynamic ones)
- every blog/business-success/publisher-success article (read directly
  from their static source files — these aren't database content)
- every real, currently-approved publisher profile and every registered
  channel page, fetched from this deployment's actual Supabase project
  over its public REST API using the anon key, querying
  `publishers_public` (schema_phase82_restrict_public_publisher_columns.sql —
  the safe public view, already filtered to `status = 'approved'`; the
  base `publishers` table no longer allows anon/public reads at all as
  of that same migration) rather than the base table, so the sitemap
  can't drift ahead of what's genuinely public

If `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` aren't set, or the
Supabase fetch fails for any reason, the script logs a warning and still
writes the sitemap with just the static routes and articles — a sitemap
problem should never block a deploy.

`public/sitemap.xml` (source-controlled) is kept as a fallback with the
same ~60 static routes, for the same reason `vercel.json` exists
alongside the generated `dist/_headers` in item 22: if the build pipeline
ever fails before reaching `postbuild` (see that same section above for
why that's a real, current risk — the pre-existing `tsc -b` errors), this
is what actually ships. It won't have the live publisher/channel/article
URLs (can't, without a build step), and it's expected to drift from
scripts/generate-sitemap.mjs's STATIC_ROUTES over time as pages are
added — that's an accepted trade-off for a fallback, not something worth
keeping perfectly in sync by hand.

**Not fixed, and deliberately not attempted here**: real per-page social
previews (Facebook/WhatsApp/X/LinkedIn all fetch raw HTML and never
execute this app's JavaScript, so they only ever see index.html's static
tags, never src/components/Seo.tsx's per-page ones). That needs
prerendering/SSR/edge rendering — a change to this app's rendering
architecture, not its build tooling, and the task that raised this
explicitly frames it as a "Later introduce" recommendation at LOW/MEDIUM
severity rather than a required fix. See Seo.tsx's own header comment.
