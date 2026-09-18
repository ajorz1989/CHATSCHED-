# Payout system docs

This directory contains an **experimental, not-production-ready** payout
pipeline. It is not wired into the deployed app — the live admin panel
pays publishers via a simple "mark payout sent" button (see
`src/pages/Admin.tsx`, Requests tab), which is what's actually documented
in the top-level README's setup steps. Nothing here runs unless you
deliberately start these processes yourself.

**Before investing further time in this directory**, read the
architecture note at the top of `payoutWorker.js` and `webhookServer.js` —
PayFast's own "Split Payments" product (an instant, synchronous split of
a payment at the time it's made) may be a better fit for this
marketplace's commission model than the poll-and-call-an-assumed-API
design here, and could replace this whole pipeline. Confirm directly with
PayFast before continuing to build this out.

Files
- `supabase/schema_payouts_phase1.sql` — DB migration adding the ledger, payouts, payout_items, and payout_provider_events tables.
- `supabase/schema_payouts_functions.sql` — PL/pgSQL RPCs: create_payout_batch, approve_payout, mark_payout_item_attempt, update_payout_status.
- `workers/payoutWorker.js` — Node.js worker that polls for approved payout batches and attempts to call PayFast directly for each item. The actual API call (`sendPayFastPayout`) is a placeholder — the endpoint, auth, and signing are illustrative, not PayFast's real documented API. **Does not generate a CSV file** (an earlier version of this worker did; that behaviour was replaced, and this doc used to still describe the old version — fixed now). **Refuses to start unless `ALLOW_EXPERIMENTAL_PAYOUT_WORKER=true` is set** — this is a code-level lockout so the placeholder can't accidentally move real money just because someone deploys this directory, on top of the fact that nothing wires it in automatically today.
- `workers/webhookServer.js` — Express webhook handler for a PayFast payout-confirmation IPN. Signature verification is now real (same algorithm as `supabase/functions/_shared/payfast.ts`) and fails closed — it refuses to start without `PAYFAST_PASSPHRASE`, and rejects any request whose signature doesn't check out. The previous version trusted every request whenever no passphrase was set; that was a real gap even though it was never deployed, and it's fixed.
- `src/pages/AdminPayouts.tsx` — admin UI to create batches, approve them, and inspect items. Wired into `/admin` behind a clearly-labelled "Experimental" tab (see the app's own banner text) rather than the main Requests-tab flow. The CSV-download affordance from the old design was removed from the UI to match what the current worker actually produces (nothing — see above); if you revive a CSV-based design later, re-add it deliberately rather than relying on this doc.

Environment
- `ALLOW_EXPERIMENTAL_PAYOUT_WORKER` — **required**, must be exactly `true` for `payoutWorker.js` to start at all. This is a hard lockout, not just documentation: the file exits immediately without it. Only set this once `sendPayFastPayout()` has been replaced with a real, independently validated PayFast integration (or this pipeline has been replaced with PayFast Split Payments — see the architecture note in `payoutWorker.js`).
- `DATABASE_URL` — Postgres connection string for the app DB.
- `WORKER_POLL_INTERVAL_MS` — optional worker poll interval (ms).
- `PAYFAST_PASSPHRASE` — **required** for `webhookServer.js` (it will refuse to start without one). Optional for `payoutWorker.js` today since that file doesn't yet sign outbound requests — it will need one once `sendPayFastPayout` is implemented for real.
- `PAYFAST_API_BASE`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY` — used by the placeholder `sendPayFastPayout` call; replace with real values once you've confirmed the actual API this should call.

Behaviour and integration notes
- `payoutWorker.js` marks items `sent` after a successful-looking API response, then waits for `webhookServer.js` to receive a confirming IPN before anything is considered `succeeded`. That two-step design is sound regardless of which PayFast product you end up using — keep it even if the specific API call changes.
- Neither worker has a `package.json` of its own (they depend on `express`, `pg`, and `node-fetch`, none of which are in the root `package.json` — that file is for the Vite frontend only). Add one before trying to run these; see the root `.env.example` for the full list of variables both the frontend and these workers care about.
- These are long-running Node processes, not Edge Functions or static assets — they need separate hosting (a small always-on Node service) if you ever do deploy them. They cannot run on Vercel/Netlify-style static hosting the same way the frontend can.

Security
- Do not store raw bank credentials in plaintext. Use provider tokenization when possible or encrypt sensitive fields. Only admin and worker roles should access payout details.
- `webhookServer.js` now fails closed by design (see above) — if you modify signature verification, keep that property. A webhook that can't verify its caller should reject the request, not accept it.

Testing
- Use a staging DB and PayFast sandbox credentials — this has never been run against a real endpoint (same caveat as `supabase/DEPLOY.md` for the live checkout flow).
- Create ledger entries and run `create_payout_batch` to generate payout items.
- Approve a batch from the (experimental) AdminPayouts tab.
- Once `sendPayFastPayout` is implemented for real, run `payoutWorker.js` against sandbox and confirm `webhookServer.js` correctly verifies and reconciles the resulting IPN before trusting this with real money.
