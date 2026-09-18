Updated worker and webhook to implement direct PayFast calls (placeholders)

Notes:
- payoutWorker.js: Replaced CSV worker with a PayFast-backed worker. The worker calls a placeholder sendPayFastPayout() that must be implemented with PayFast's real API endpoint, authentication, and idempotency. The worker uses the existing DB RPC mark_payout_item_attempt to record status.
- webhookServer.js: Replaced earlier webhook with PayFast IPN handler and a verifyPayFast(payload) placeholder. Replace verification with PayFast docs details.

Next steps:
1. Replace placeholders: implement sendPayFastPayout() per PayFast API docs (endpoint, request body, auth/signing) — or confirm PayFast Split Payments fits better and replace this pipeline instead (see the architecture note at the top of both worker files).
2. ~~Implement verifyPayFast(payload) per PayFast IPN verification.~~ Done — see below.
3. Provide PAYFAST_* env vars in staging (merchant id/key/passphrase/API base).
4. Test in sandbox with test credentials.

---

Security fix + doc/code reconciliation pass

Notes:
- webhookServer.js: verifyPayFast() previously returned `true` unconditionally, including whenever PAYFAST_PASSPHRASE wasn't set — meaning any POST would be trusted. Replaced with real signature verification using the same algorithm already correct in supabase/functions/_shared/payfast.ts (PayFast's field-order-as-sent + space-as-plus encoding + MD5 + passphrase), using a constant-time comparison. The server now refuses to start at all without PAYFAST_PASSPHRASE, and rejects (400) any request that fails verification, instead of accepting it. Also added idempotency handling so a retried IPN can't double-apply a payout.
- payoutWorker.js: the item-processing loop had a genuine JavaScript syntax error (an embedded '{}'::jsonb SQL literal was closing the outer single-quoted JS string early) — confirmed with `node --check`, which failed before this fix. This file could not run at all as previously committed. Fixed by switching that one query string to double quotes.
- README.md: was describing an older CSV-export design that no longer matches either worker file (payoutWorker.js was already rewritten to attempt direct PayFast calls in the previous changelog entry above, but the README and AdminPayouts.tsx's "Download CSV" button were never updated to match). Rewrote the README to describe current behaviour, and removed the CSV download button from AdminPayouts.tsx since the current worker doesn't produce one.
- AdminPayouts.tsx: fixed two `unused variable` TypeScript build errors that meant this file failed `npm run build` — it was never actually possible to ship this repo with AdminPayouts.tsx wired into routing until this was fixed, independent of anything else. Now wired into /admin behind a clearly-labelled "Experimental" tab.
