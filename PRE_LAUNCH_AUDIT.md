# ChatSched — Pre-Launch Audit

Scope: the full merged product (rate-cards base + compliance system +
OAuth fix + proof screenshots, as delivered so far). This is a real
static-analysis pass — grepping RLS coverage across every table, reading
every edge function's auth path, diffing documented vs. actually-required
env vars — not a restatement of earlier caveats. Where I found something
and could fix it safely and unambiguously, I did (noted inline); where it
needs a product or infra decision, it's listed for you.

Still true, and still the top of every list: **nothing in this repo has
been run** — no `npm ci`, `npm run build`, `npm run lint`, `npm run test`,
no `pg_prove` against a real Postgres instance. Everything below is from
reading code, not executing it.

## 🔴 Critical — fix before launch

**1. ~~Provider OAuth tokens stored in plaintext.~~ Fixed.**
`social_connections.access_token` / `refresh_token` (schema_phase34) held
the *actual* long-lived YouTube/Facebook/Instagram/TikTok tokens for a
connected creator account, in a plain `text` column. RLS was set to
service-role-only (no client could read it via the API, which was
correct), but that only protected the API layer — a leaked service-role
key, a database backup that ends up somewhere it shouldn't, or a support
person with direct DB access all would have exposed live, usable
credentials to a real person's social accounts.

**Fixed:** `schema_phase41_encrypt_social_tokens.sql` +
`_shared/tokenCrypto.ts` — `social-oauth-callback` (the table's only
writer) now encrypts both columns with AES-256-GCM before every write, via
a key that lives only as an Edge Function secret
(`SOCIAL_TOKEN_ENCRYPTION_KEY`), never in the database. Fails closed: read
the actual code path to confirm a missing/malformed key errors the
connection attempt out rather than silently storing a token unencrypted —
same posture as `OAUTH_STATE_SECRET`/`CRON_SECRET` elsewhere in this repo.
One caveat from the migration's own header, repeated here: this product
has never been deployed, so there's no existing plaintext data to
re-encrypt — if this is ever applied somewhere `social_connections`
already has rows, those existing rows stay plaintext until reconnected.

**2. `.env.example` was missing four required secrets** — `OAUTH_STATE_SECRET`,
`CRON_SECRET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` — despite
its own header claiming to document every secret the functions expect.
Checked each: all four fail closed if unset (a clear error, not an open
door), so this was never a security hole, but it's a real "this feature
silently doesn't work in production until someone notices" launch risk —
social connect, scheduled request-expiry, and the authenticity checker all
depend on one each. **Fixed** — added to `.env.example` with the same
explanatory style as the rest of the file.

**3. Toolchain never run.** Repeated because it's still the single biggest
unknown: ~35 new/modified files across the compliance build, the OAuth
fix, and the screenshot-upload follow-up have never been compiled,
type-checked, linted, or unit-tested. `npm ci && npm run build && npm run
lint && npm run test` needs to happen, and whatever it finds needs to be
fixed, before anything else on this list matters much.

## 🟠 High — likely to cause visible problems at launch

**4. Phone verification (`send-otp`) has no SMS provider wired.** The code
path is real and correctly guarded (60-second resend cooldown enforced
server-side, hashed codes, max-attempt lockout on verify) — but without
`SMS_PROVIDER_API_KEY`/`SMS_PROVIDER_API_URL` set to a real provider, it
generates and stores a valid code and honestly reports `smsSent: false`
rather than pretending a text went out. Decide before launch: is phone
verification advertised to users? If so, this needs a real SMS provider
wired in before it's true.

**5. ~~CORS falls back to a wildcard if `SITE_URL` is unset.~~ Fixed.**
`_shared/cors.ts` previously had `"Access-Control-Allow-Origin": SITE_URL
|| "*"`. Every function using this authenticates via the caller's own JWT
rather than cookies, so this was never the primary security boundary the
way it would be in a cookie-auth app — but a deploy that simply forgot to
set `SITE_URL` still silently opened CORS to every origin on the internet
instead of failing loudly, which isn't an acceptable default regardless of
severity. **Fixed:** falls back to `http://localhost:5173` instead — the
exact value `DEPLOY.md` already told people to set explicitly for local
dev, so nothing about local dev changes, but a production deploy that
forgets `SITE_URL` now gets loud, visible CORS errors instead of a
silently wide-open API. Added a manual verification step to `DEPLOY.md`'s
existing security checklist to actually confirm this with a real request,
not just by reading the code.

**6. Database-level tests have never actually run — still true, but now
manually traced end to end.** Tried to run them for real this pass:
`npm ci` (403 from `registry.npmjs.org`) and `apt-get install postgresql`
(403 from the Ubuntu mirror) both confirmed this sandbox has no network
access to install *anything*, Postgres included — not a choice, a hard
environment limit.

What I did instead: read `compliance_test.sql` against the actual final
post-migration schema (all 44 migrations, not just the ones that created
the tables it touches) rather than skimming it, and found five real bugs
a real test run would have hit immediately:

- The publisher fixture used `channel_slug = 'instagram'` — not a valid
  value (the check constraint only allows `social-media`/`influencer`/
  `website`/`podcast`/`radio`; `instagram` is a *platform*, a different
  column entirely on a different table). Would have failed on the very
  first fixture insert, before any of the 28 assertions ran.
- The tracking-link fixture referenced a `business_id` column that
  doesn't exist on `campaigns` (the real column is `owner_id`) and never
  supplied `name`, a `not null` column with no default. Both would have
  errored the insert.
- Two `throws_ok(...)` assertions wrapped a raw `UPDATE` and expected an
  exception for the RLS block — but Postgres RLS silently excludes rows
  an `UPDATE` isn't allowed to touch (zero rows affected, no error); only
  a failed `WITH CHECK` on an `INSERT` or a `raise exception` inside a
  function actually throws. The underlying security property these
  assertions were checking was never wrong — the fix was proving it the
  right way: run the update, then confirm the row didn't change.
- The file's own header claimed it only needed migrations through
  `schema_phase39_compliance.sql` applied, which stopped being true the
  moment the storage-bucket tests (`schema_phase40`) were added to it —
  fixed to say phase 40, matching what `tests/README.md` already said.

All five are fixed. Assertion count is genuinely 28 now (two of the
`throws_ok` fixes each became two assertions — `lives_ok` plus a
follow-up `is()` — recounted by grep after every edit, not carried over
by memory). Also re-ran the same string-literal tokenizer used on
`schema_phase44` against this file and got 5 initial false-positive flags
— checked each by hand before concluding they were fine (a `::uuid` cast
and four `'literal' where ...` clauses my checker's delimiter list didn't
recognize), rather than either reporting them as bugs or silently
discarding them.

None of this adds up to "confirmed passing" — it adds up to "every bug
findable by a careful human reading the SQL against the real schema is
now fixed," which is a meaningfully smaller set of remaining unknowns
than before, not the same thing as a green test run. Still needs
`supabase test db` or `pg_prove` against a real local/staging instance
with migrations through `schema_phase40_proof_screenshots.sql` applied.

## 🟡 Medium — worth doing before or shortly after launch

**7. Test coverage is thin.** 14 test files against 156 source files
(~9%). What exists is good (pure-function unit tests, correctly scoped to
what vitest can actually check without a live backend) but most of the
app's behavior — RLS, edge function logic, component interaction — has no
automated coverage at all beyond the one new pgTAP file.

**8. ~~`platform_compliance_rules` seed data is explicitly placeholder.~~ Fixed.**
Every row was labeled "Illustrative starting point" in its own `notes`
field on purpose — that was never meant to be real platform policy.

**Fixed:** `schema_phase44_platform_rules_content.sql` replaces all 10 rows
(TikTok, Instagram, Facebook, YouTube, X, LinkedIn, podcast, website,
newsletter, radio) with real policy summaries, each checked against an
official source as of 19 August 2026 — not written from memory. Sources
used: TikTok's own Branded Content Policy page (fetched directly), Meta's
Business Help Center, YouTube Help, X's Paid Partnerships Policy, and
LinkedIn Help for the five social platforms; South Africa's Advertising
Regulatory Board Code of Advertising Practice for the four non-social
channels, which don't have a platform ToS to point to and needed a
different kind of source — the ARB is the applicable general-advertising
reference for ChatSched's home market (see `DEPLOY.md`).

One thing worth flagging on its own: TikTok has announced a new Branded
Content Policy taking effect 31 August 2026, twelve days after this
review. The content here reflects the policy that was live as of the
review date — that row's own `notes` field says so explicitly and flags
a re-check shortly after that date, but it's also worth flagging here
since it's the one row in this migration with a known, dated expiration.

Also found and fixed while doing this, not something I was asked to fix:
`PlatformRequirementCard.tsx` stored `prohibited_categories` on every
platform rule but never actually rendered it anywhere — only
`restricted_categories` showed. That would have made this migration's
TikTok/X prohibited-category content invisible in the UI despite being
correctly in the database. Added it to the card's existing "Learn more"
section.

Still true, and still worth repeating: this is real, sourced content, not
a law firm's sign-off. `PlatformRequirementCard.tsx`'s own disclaimer
("requirements may change, always verify the current policy") is
unchanged and still renders on every card — that line is doing real work,
not decoration.

**9. ~~Six `/trust/*` sub-pages from the original compliance brief were
never built.~~ Fixed — deliberately not as six new pages.**
Checked what `TrustCentre.tsx` already covered before building anything,
per this item's own suggestion, and most of it was already there in
depth: verification levels and the full dispute policy live on `/trust`
itself, and payment mechanics already have their own thorough page at
`/how-payment-works`. Building six separate pages would have meant four
of them either duplicating that content (drifting out of sync the moment
either copy changed) or being thin stubs.

What actually shipped: all six routes now resolve, but only two are new
pages —

- `/trust/fraud-prevention` — genuinely new, and grounded in real code
  rather than generic copy: `src/lib/authenticitySignals.ts`'s rule-based
  signals, the `publisher-authenticity-check` edge function, and the
  `reports` table (`schema_phase24_fraud_authenticity.sql`), all
  described with the same "decision support, not a verdict" honesty
  their own code comments already use.
- `/trust/safety` — a genuinely new overview page, deliberately built as
  an index into the other pages rather than a seventh copy of their
  content.
- `/trust/verification` and `/trust/disputes` redirect to
  `/trust#verification` / `/trust#disputes` — added real `id` anchors to
  `TrustCentre.tsx`'s existing sections, plus an actual scroll-to-hash
  effect, since bare `react-router-dom` doesn't auto-scroll to a URL
  fragment on client-side navigation the way a full page load would. A
  redirect that silently landed at the top of the page instead of the
  section it promised would have been worse than not building it.
- `/trust/payments` redirects to `/how-payment-works`; `/trust/platform-compliance`
  redirects to `/compliance` — both already complete, no reason to fork them.

Caught a real mistake while wiring the `TrustCentre.tsx` cross-links: an
edit briefly left a paragraph with a stray closing `</p>` and no matching
open tag (I'd closed the tag one line too early). Found it by rereading
the actual diff before moving on, not by assuming the edit did what I
intended — fixed before it went anywhere near a build.

**10. Payment config is a launch-day checklist item, not a code issue.**
`payfast-notify`'s signature verification is real and correctly
implemented (HMAC check against the ITN payload, plus a second
authoritative check rather than trusting the signature alone). What I
can't verify from here: that `PAYFAST_MODE` is actually flipped to `live`
with real (not sandbox) merchant credentials before launch — that's a
deploy-time step, not something in the repo to fix.

## 🟢 Low — recommended, not blocking

**11. No accessibility pass has been done** on anything built in this
conversation — components follow the existing app's semantic patterns
(real `<button>`/`<label>` elements, not divs-pretending-to-be-buttons)
but nothing has been tested with a screen reader or keyboard-only
navigation.

**12. No mobile visual QA** — there's no running dev server in this
environment, so nothing built here has actually been looked at on a
phone-sized viewport, only written against the app's existing responsive
class conventions.

**13. The rate-cards feature (`schema_phase38_rate_cards.sql`,
`RateCardManager.tsx`, `RateCardDisplay.tsx`, `EscrowNote.tsx`) predates
this conversation and got a shallow pass here — RLS is present and looks
correctly scoped (public read, owner write) — but it hasn't had the same
line-by-line review as the compliance/OAuth/screenshot work above, since
that wasn't the focus of this audit. Worth a normal review pass on its own
merits.

## What's already solid (confirmed, not assumed)

- **All 32 tables have RLS enabled** — checked every `create table
  public.*` against a matching `enable row level security`, no gaps.
- `payfast-notify`'s webhook signature verification is real.
- `verify-otp` has server-enforced max-attempt lockout; `send-otp` has a
  server-enforced resend cooldown.
- `expire-channel-requests` (the cron-triggered function) fails closed if
  `CRON_SECRET` isn't set.
- `social-oauth-start`/`acknowledge_campaign_disclosure`/every RPC added
  in the compliance build fails closed on a missing config value rather
  than proceeding insecurely.
- No `dangerouslySetInnerHTML` anywhere in the codebase.
- Error boundary and a real 404 route both exist.

## Suggested order of operations

1. Run the toolchain (#3) — fixes whatever it finds before anything else.
   This includes the code added for #1 and #5's fixes, which — same as
   everything else in this whole build — has not been compiled or run.
2. ~~Encrypt `social_connections` tokens at rest (#1)~~ — done; still worth
   a second pair of eyes given it's the one finding here that was a real
   security exposure, not a "silently broken feature."
3. Decide on SMS provider (#4) and confirm `PAYFAST_MODE`/`SITE_URL` are
   correctly set for production (#10, ~~#5~~ — #5 now fails loudly instead
   of silently if you forget `SITE_URL`, but you still need to actually
   set it).
4. Run the pgTAP suite for real (#6).
5. ~~Replace placeholder platform-rule content (#8)~~ — done, but re-check
   the TikTok row specifically shortly after 31 August 2026 (its own
   `notes` field explains why).
6. Everything else (#7, #11–13) is real but not launch-blocking —
   good backlog, not a gate.
