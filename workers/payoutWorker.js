/*
PayFast-backed payout worker (placeholder implementation).

This worker polls for approved payout batches and attempts to send payouts via PayFast.

Environment variables required (set in deployment):
- DATABASE_URL
- PAYFAST_API_BASE (e.g. https://api.payfast.co.za or sandbox URL)
- PAYFAST_MERCHANT_ID
- PAYFAST_MERCHANT_KEY
- PAYFAST_PASSPHRASE (optional, for IPN verification)
- WORKER_POLL_INTERVAL_MS (optional, default 30s)
- WORKER_MAX_RETRIES (optional, default 3)

Important: This implementation contains placeholders where the exact PayFast API call, signing, and response handling must be implemented using PayFast's official docs and your account credentials.
Do NOT run this in production until you replace placeholders with real API calls and validate signature/verification logic.

Architecture note: this assumes PayFast has a generic outbound-payout API
(POST /payouts below is illustrative, not a real documented endpoint).
Confirm that against PayFast's actual docs before investing more time here —
PayFast's own product for splitting a payment with a third party at the
time it's made is "Split Payments" (instant, synchronous), which may fit
this marketplace's commission model better than polling for approved
batches and calling an assumed payout endpoint. See webhookServer.js for
the same note.

Fixed in this pass: the item-processing loop had a JavaScript syntax error
(a SQL string's embedded '{}'::jsonb literal was closing the outer JS
string early) that meant this file could not run at all — `node --check`
failed on it. That's fixed; the PayFast API call itself is still the
placeholder described above and needs real credentials and docs.
*/

const { Client } = require('pg');
const fetch = require('node-fetch');

// --- Hard production lockout (Required fix, Option A: deactivate until a
// real payout integration exists) ---
// sendPayFastPayout() below is still a placeholder: illustrative endpoint,
// no real signing/auth, assumed request/response shape. This worker is not
// wired into the deployed app anywhere (no package.json, no Dockerfile/
// Procfile/CI step references it — see workers/README.md), so today it can
// only run if someone deliberately sets it up. That "nobody wired it in" is
// not a strong enough guarantee on its own, so this file also refuses to
// start unless explicitly opted into, even if it does get deployed
// somewhere by mistake or by habit ("there's a worker directory, let's just
// run it"). Publishers are actually paid today via the "Mark payout sent"
// button on the Requests tab (src/pages/Admin.tsx) — that manual process is
// the one supported, documented payout mechanism and should keep being used
// until sendPayFastPayout() is replaced with a real, independently
// validated PayFast integration (or this pipeline is replaced with PayFast
// Split Payments — see the architecture note below).
if (process.env.ALLOW_EXPERIMENTAL_PAYOUT_WORKER !== 'true') {
  console.error(
    [
      'payoutWorker.js refused to start.',
      '',
      'This is an experimental, non-production-ready payout pipeline. Its',
      'sendPayFastPayout() call is a placeholder (illustrative endpoint,',
      'placeholder signing/authentication, assumed request/response shape) —',
      'see the architecture note at the top of this file and workers/README.md.',
      '',
      'Publishers are paid today via the "Mark payout sent" button on the',
      'Requests tab in the admin panel — use that until this pipeline is',
      'finished and validated for real.',
      '',
      'If you have replaced the placeholder with a real, independently',
      'validated PayFast integration and understand you are opting into this',
      'worker moving real money, set ALLOW_EXPERIMENTAL_PAYOUT_WORKER=true.',
    ].join('\n'),
  );
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
const PAYFAST_API_BASE = process.env.PAYFAST_API_BASE || 'https://api.payfast.example';
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '30000', 10);
const MAX_RETRIES = parseInt(process.env.WORKER_MAX_RETRIES || '3', 10);

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const pg = new Client({ connectionString: DATABASE_URL });

async function sendPayFastPayout({ item, publisherDetails }) {
  // Placeholder function: build PayFast API payload and send HTTP request.
  // You must replace the body below with real PayFast payout API parameters,
  // including merchant authentication, signature/hash, and idempotency handling.
  // Example expected publisherDetails structure (adapt to your onboarding):
  // publisherDetails = { bank_account_name, bank_account_number, bank_branch_code, bank_type, payfast_recipient_id }

  // Build request payload (example; NOT real PayFast API fields)
  const payload = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    recipient: publisherDetails.payfast_recipient_id || null,
    amount: (item.amount_cents / 100).toFixed(2),
    currency: item.currency || 'ZAR',
    reference: `PAYOUT:${item.id}`,
    // include bank details if required by your PayFast account
    bank_account_name: publisherDetails.bank_account_name,
    bank_account_number: publisherDetails.bank_account_number,
    bank_branch_code: publisherDetails.bank_branch_code,
  };

  // Compute signature or passphrase as required by PayFast. This is provider-specific.
  // const signature = computePayFastSignature(payload, PAYFAST_PASSPHRASE);

  try {
    // Placeholder HTTP request — replace endpoint and method per PayFast docs
    const res = await fetch(`${PAYFAST_API_BASE}/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Add authentication headers as required by PayFast
        // 'Authorization': `Bearer ${PAYFAST_API_TOKEN}`
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    // Expected: data contains provider_payout_id or similar
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function processApprovedBatches() {
  await pg.connect();
  console.log('PayFast payout worker connected to DB');

  while (true) {
    try {
      // Fetch an approved payout batch scheduled now or earlier
      const res = await pg.query("select * from public.payouts where status = 'approved' and scheduled_for <= now() order by scheduled_for limit 1 for update skip locked");
      if (res.rows.length === 0) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      const payout = res.rows[0];
      console.log('Processing payout batch', payout.id);

      // mark payout as processing
      await pg.query('update public.payouts set status = $1, updated_at = now() where id = $2', ['processing', payout.id]);

      // fetch pending items for this payout
      const itemsRes = await pg.query('select pi.*, p.payout_details from public.payout_items pi join public.publishers p on p.id = pi.publisher_id where pi.payout_id = $1 and pi.status in ($2,$3)', [payout.id, 'pending', 'processing']);
      const items = itemsRes.rows;

      for (const it of items) {
        // Read attempt count from meta
        let attempts = 0;
        try {
          const meta = it.meta || null;
          if (meta && meta.attempts) attempts = meta.attempts;
        } catch { attempts = 0; }

        if (attempts >= MAX_RETRIES) {
          console.warn('Max retries reached for item', it.id);
          await pg.query("select public.mark_payout_item_attempt($1,$2,$3,$4)", [it.id, 'failed', null, JSON.stringify({ reason: 'max_retries' })]);
          continue;
        }

        try {
          // mark item as processing (optimistic lock handled by RPC)
          // NOTE: this line previously used single-quotes for the outer JS
          // string while also containing '{}'::jsonb inside it — the inner
          // quote closed the JS string early, which is a syntax error
          // (confirmed with `node --check`: this file could not run at all
          // as originally written). Double-quoting the outer string fixes it.
          await pg.query("update public.payout_items set status = $1, updated_at = now(), meta = jsonb_set(coalesce(meta,'{}'::jsonb), $2, $3::jsonb) where id = $4", ['processing', '{attempts}', JSON.stringify(attempts + 1), it.id]);

          const publisherDetails = it.payout_details || (it.meta && it.meta.payout_details) || null;
          if (!publisherDetails) {
            console.warn('No payout details for publisher', it.publisher_id);
            await pg.query("select public.mark_payout_item_attempt($1,$2,$3,$4)", [it.id, 'failed', null, JSON.stringify({ reason: 'missing_payout_details' })]);
            continue;
          }

          // Call PayFast API (placeholder)
          const result = await sendPayFastPayout({ item: it, publisherDetails });

          if (result.ok) {
            const providerId = result.data && (result.data.id || result.data.provider_payout_id || result.data.payout_id) || null;
            await pg.query("select public.mark_payout_item_attempt($1,$2,$3,$4)", [it.id, 'sent', providerId, JSON.stringify(result.data)]);
            // We expect webhook/IPN to confirm final delivery and mark succeeded.
          } else {
            // mark failed with provider info
            await pg.query("select public.mark_payout_item_attempt($1,$2,$3,$4)", [it.id, 'failed', null, JSON.stringify({ error: result.error || result.data })]);
          }

        } catch (innerErr) {
          console.error('Error processing item', it.id, innerErr);
          try {
            await pg.query("select public.mark_payout_item_attempt($1,$2,$3,$4)", [it.id, 'failed', null, JSON.stringify({ error: String(innerErr) })]);
          } catch (mErr) {
            console.error('Failed to mark item failed', it.id, mErr);
          }
        }
      }

      // After processing items, set payout status back to sent (waiting for reconciliation)
      await pg.query('update public.payouts set status = $1, updated_at = now() where id = $2', ['sent', payout.id]);
      console.log('Payout batch processed (sent):', payout.id);

    } catch (err) {
      console.error('Worker loop error', err);
    }

    await sleep(POLL_INTERVAL);
  }
}

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

processApprovedBatches().catch((err) => {
  console.error('Fatal worker error', err);
  process.exit(1);
});
