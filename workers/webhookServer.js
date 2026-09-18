/*
PayFast webhook/IPN server for the payout pipeline.

Environment:
- DATABASE_URL
- PAYFAST_PASSPHRASE — required. Signature verification is impossible
  without it, and this file now refuses to run without one (see below).

IMPORTANT — architecture note, not just an implementation detail:
This assumes PayFast sends an asynchronous IPN confirming an *outbound*
payout, the same way it sends an ITN for an *inbound* payment (see
supabase/functions/payfast-notify). That may not be the right model —
PayFast's own product for splitting a payment with a third party at the
time it's made is "Split Payments" (an instant, synchronous split, not an
async payout+webhook flow). Confirm which model actually matches your
PayFast account and API access before wiring this into anything real; if
Split Payments fits, it likely replaces this whole worker rather than
needing this endpoint at all.

What changed here: the previous version's verifyPayFast() returned `true`
unconditionally — including, explicitly, whenever no passphrase was
configured — which meant anyone could POST a fake "payout succeeded"
event and have it trusted. It was never wired into the live app, so this
was never exploited, but it's fixed now on general principle: verification
here follows the exact same signature algorithm already proven correct in
supabase/functions/_shared/payfast.ts (field order as PayFast sent them,
PayFast's space-as-plus encoding, MD5 with the passphrase appended), and
fails closed — rejects the request — rather than failing open, in every
case where verification can't be completed.
*/

const express = require('express');
const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || null;

if (!DATABASE_URL) throw new Error('DATABASE_URL required');
if (!PAYFAST_PASSPHRASE) {
  // Deliberately fatal at startup, not a soft warning: a webhook endpoint
  // that can't verify its caller has no business accepting requests that
  // update payout state. Fail loudly here instead of failing open later.
  throw new Error('PAYFAST_PASSPHRASE required — this server cannot verify webhook authenticity without it.');
}

const pg = new Client({ connectionString: DATABASE_URL });
pg.connect();

const app = express();
// Capture the raw body ourselves (not body-parser's parsed object) so the
// signature check works over the exact bytes PayFast sent, in the exact
// field order they arrived in — matching payfast-notify's approach.
app.use(express.raw({ type: 'application/x-www-form-urlencoded' }));

// PayFast wants application/x-www-form-urlencoded-style escaping: spaces as
// '+' and uppercase hex. encodeURIComponent already gives uppercase hex, so
// the only gap is the space -> '+' swap. Mirrors pfEncode in _shared/payfast.ts.
function pfEncode(value) {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function md5(input) {
  return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * Recomputes the ITN-style signature over the fields as PayFast actually
 * sent them (order matters — this is not the fixed checkout field order).
 * Same algorithm as signItnFields() in supabase/functions/_shared/payfast.ts;
 * duplicated here rather than shared because this file runs under plain
 * Node.js, not Deno, and the two projects don't currently share a module
 * boundary.
 */
function verifyPayFastSignature(rawBody) {
  const params = new URLSearchParams(rawBody.toString('utf-8'));
  const entries = Array.from(params.entries()).filter(([k]) => k !== 'signature');
  const parts = entries
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${pfEncode(String(v))}`);
  const paramString = parts.join('&') + `&passphrase=${pfEncode(PAYFAST_PASSPHRASE)}`;
  const expectedSignature = md5(paramString);
  const providedSignature = params.get('signature') || '';

  // Constant-time comparison — this is a security check, not a UI diff.
  const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
  const providedBuf = Buffer.from(providedSignature, 'utf-8');
  if (expectedBuf.length !== providedBuf.length) return { valid: false, payload: Object.fromEntries(params) };
  const valid = crypto.timingSafeEqual(expectedBuf, providedBuf);
  return { valid, payload: Object.fromEntries(params) };
}

app.post('/payfast_ipn', async (req, res) => {
  let payload;
  let valid;
  try {
    ({ valid, payload } = verifyPayFastSignature(req.body));
  } catch (err) {
    console.error('Could not parse/verify PayFast IPN body', err);
    return res.status(400).send('Bad request');
  }

  console.log('Received PayFast IPN', { valid, m_payment_id: payload.m_payment_id });

  if (!valid) {
    // Fail closed. No event is recorded, no payout state changes.
    console.warn('PayFast IPN failed signature verification — rejecting.');
    return res.status(400).send('Invalid signature');
  }

  try {
    const provider = 'payfast';
    const providerEventId = payload.m_payment_id || payload.payment_id || payload.merchant_reference || JSON.stringify(payload);

    // Idempotency: if we've already processed this exact provider event,
    // do nothing further. on conflict + a `processed` check below means a
    // retried IPN (PayFast retries on non-2xx) can't double-apply a payout.
    const existing = await pg.query(
      'insert into public.payout_provider_events(provider, provider_event_id, payload, processed, created_at) values($1,$2,$3,$4,now()) on conflict (provider, provider_event_id) do nothing returning id',
      [provider, providerEventId, payload, false]
    );
    if (existing.rowCount === 0) {
      console.log('Duplicate PayFast IPN, already recorded — acknowledging without reprocessing.');
      return res.send('OK');
    }

    // reconcile: if merchant_reference contains PAYOUT:{payout_item_id}
    const merchantRef = payload.merchant_reference || payload.m_payment_id || payload.payment_reference || null;
    let payoutItemId = null;
    if (merchantRef && merchantRef.startsWith && merchantRef.startsWith('PAYOUT:')) {
      payoutItemId = merchantRef.replace('PAYOUT:', '');
    }

    if (payoutItemId) {
      const success = (payload.payment_status === 'COMPLETE' || payload.status === 'success' || payload.status === 'paid' || payload.payment_status === 'PAID');
      const status = success ? 'succeeded' : 'failed';
      const providerPayoutId = payload.payment_id || payload.m_payment_id || null;

      await pg.query('update public.payout_items set status = $1, provider_payout_id = $2, provider_response = $3, updated_at = now() where id = $4', [status, providerPayoutId, payload, payoutItemId]);

      if (status === 'succeeded') {
        // insert ledger entry (negative amount) if not already recorded
        await pg.query("insert into public.publisher_ledger(publisher_id, amount_cents, currency, type, reference_id, created_at, meta) select publisher_id, -amount_cents, currency, $1, id, now(), $2 from public.payout_items where id = $3 and not exists (select 1 from public.publisher_ledger l where l.reference_id = $3 and l.type = 'payout')", ['payout', JSON.stringify(payload), payoutItemId]);
      }
    }

    await pg.query("update public.payout_provider_events set processed = true where provider = $1 and provider_event_id = $2", [provider, providerEventId]);

    res.send('OK');
  } catch (err) {
    console.error('Error processing PayFast IPN', err);
    res.status(500).send('error');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('PayFast webhook server listening on', PORT, '— signature verification enforced.'));
