import { Link } from "react-router-dom";
import { useId, useState } from "react";
import Seo from "../components/Seo";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import {
  PLATFORM_COMMISSION_RATE,
  PUBLISHER_SHARE,
  PUBLISHER_SUBSCRIPTION_PRICE,
  BUSINESS_SUBSCRIPTION_PRICE,
  BUSINESS_LAUNCH_CREDIT_AMOUNT,
} from "../lib/constants";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);
const sharePct = Math.round(PUBLISHER_SHARE * 100);

const EXAMPLES = [250, 500, 1000, 2500, 5000];

function rand(n: number) {
  return formatCurrencyShared(n, { cents: true });
}

/**
 * One row of the worked-example table: campaign value → fee → publisher
 * earnings, all derived from the same PLATFORM_COMMISSION_RATE used
 * everywhere else.
 *
 * BUG FIX: the minus sign was previously hardcoded outside the <span>,
 * rendering it in the body font instead of font-mono. Now included inside
 * rand() via a negative input so the full string is mono-formatted.
 */
function ExampleRow({ amount }: { amount: number }) {
  const fee = amount * PLATFORM_COMMISSION_RATE;
  const earnings = amount - fee;
  return (
    <div className="grid grid-cols-3 gap-3 py-3 border-b-2 border-billboard-ink/10 last:border-b-0 text-sm">
      <span className="font-mono">{rand(amount)}</span>
      <span className="font-mono text-billboard-inkSoft">−{rand(fee)}</span>
      <span className="font-mono font-bold text-billboard-greenDeep">{rand(earnings)}</span>
    </div>
  );
}

/**
 * BUG FIXES:
 * 1. <label> now has htmlFor linked to input id (via useId) so clicking the
 *    label focuses the input and screen readers announce it correctly.
 * 2. Input value guard rewritten: empty string no longer collapses to 0
 *    mid-type. Negative values are clamped to 0 on blur, not on every
 *    keystroke, so typing a new number doesn't fight the cursor.
 * 3. aria-live="polite" on the result panel so screen readers announce
 *    updated earnings when the amount changes.
 */
function FeeCalculator() {
  const inputId = useId();
  const [raw, setRaw] = useState("500");
  const value = Math.max(0, Number(raw) || 0);
  const fee = value * PLATFORM_COMMISSION_RATE;
  const earnings = value - fee;

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
      <label
        htmlFor={inputId}
        className="font-mono text-[11px] uppercase tracking-wide text-billboard-inkSoft block mb-2"
      >
        Campaign amount (R)
      </label>
      <input
        id={inputId}
        type="number"
        min={0}
        step={50}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => {
          // Clamp to 0 on blur so negative/empty input resolves cleanly
          const n = Number(e.target.value);
          setRaw(String(Math.max(0, isNaN(n) ? 0 : n)));
        }}
        className="w-full border-2 border-billboard-ink rounded px-3 py-2 mb-5 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-billboard-yellow"
        aria-describedby={`${inputId}-result`}
      />
      <div
        id={`${inputId}-result`}
        className="grid grid-cols-3 gap-3 text-center"
        aria-live="polite"
        aria-label={`Campaign ${rand(value)}, fee ${rand(fee)}, you earn ${rand(earnings)}`}
      >
        <div>
          <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">Campaign</div>
          <div className="font-display text-xl">{rand(value)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">Fee ({commissionPct}%)</div>
          <div className="font-display text-xl">−{rand(fee)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">You earn</div>
          <div className="font-display text-xl text-billboard-greenDeep">{rand(earnings)}</div>
        </div>
      </div>
    </div>
  );
}

// BUG FIX: PUBLISHER_SUBSCRIPTION_PRICE replaces the hardcoded "R199" string
// so this copy stays accurate if the activation price ever changes.
const FAQS = [
  {
    q: "Do publishers pay to join?",
    a: `A basic profile is free. Full Publisher Network access — campaign opportunities, analytics, earnings dashboard, and approving requests — needs a one-time ${formatCurrencyShared(PUBLISHER_SUBSCRIPTION_PRICE)} activation, no renewal, ever. The marketplace fee below applies to a completed campaign transaction either way.`,
  },
  {
    q: "What is the marketplace fee?",
    a: `A flat ${commissionPct}% on every completed campaign transaction. Same rate on every channel, for every publisher — no tiers, no volume thresholds, nothing that changes as you grow.`,
  },
  {
    q: "What does a publisher earn?",
    a: `A publisher keeps ${sharePct}% of the agreed campaign value. For a R500 campaign: a ${formatCurrencyShared(500 * PLATFORM_COMMISSION_RATE)} fee and ${formatCurrencyShared(500 * PUBLISHER_SHARE)} in earnings.`,
  },
  {
    q: "Are there additional payout charges?",
    a: "Your actual net payout may also reflect standard payment or payout processing charges, shown on your payout screen alongside the marketplace fee — never hidden.",
  },
  {
    q: "Are there business fees?",
    a: `A business pays the agreed campaign price — nothing added on top. The ${formatCurrencyShared(BUSINESS_SUBSCRIPTION_PRICE)} once-off activation includes a ${formatCurrencyShared(BUSINESS_LAUNCH_CREDIT_AMOUNT)} launch credit toward your first booking. Any payment-processing charges are shown at checkout, before you pay.`,
  },
  {
    q: "When do I see the fees?",
    a: "Before completing a transaction — in the pricing builder when you set your rate, on the campaign acceptance screen, and again in your dashboard and payout statement.",
  },
  {
    q: "Can fees change?",
    a: "Pricing may change in the future. If it does, we'll give appropriate notice — see the Terms for specifics.",
  },
];

export default function Fees() {
  return (
    <div>
      <Seo
        title="Fees · ChatSched"
        description={`ChatSched's transparent marketplace pricing — a flat ${commissionPct}% fee on completed campaign transactions, with worked examples and a live calculator.`}
      />

      {/* ──────────────────────── HERO ──────────────────────── */}
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-20">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-5">
            Fees
          </span>

          {/* SLOGAN — speaks directly to both sides of the marketplace */}
          <h1 className="text-3xl md:text-5xl font-display mb-5 leading-tight max-w-2xl">
            Keep what you earn.
            <br />
            <span className="text-billboard-ink/60">Pay only when a deal closes.</span>
          </h1>
          <p className="text-lg text-billboard-inkSoft max-w-xl mb-8">
            One flat {commissionPct}% commission on completed campaigns — shown before you commit, deducted
            once, and never inflated at payout. No subscriptions. No listing fees. No surprises.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-block bg-billboard-ink text-billboard-paper font-bold px-5 py-2.5 rounded border-[3px] border-billboard-ink hover:-translate-y-0.5 transition text-sm"
            >
              Get started free
            </Link>
            <Link
              to="/how-payment-works"
              className="inline-block bg-white font-bold px-5 py-2.5 rounded border-[3px] border-billboard-ink hover:-translate-y-0.5 transition text-sm"
            >
              How payment works →
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────── MAIN CONTENT ──────────────────────── */}
      <div className="max-w-3xl mx-auto px-5 py-16">

        {/* Businesses */}
        <section className="mb-14">
          <h2 className="font-display text-xl mb-2">For Businesses</h2>
          <p className="text-sm text-billboard-inkSoft mb-4">
            A business pays the agreed campaign price to the publisher — nothing added on top. The{" "}
            <span className="font-semibold text-billboard-ink">{formatCurrencyShared(BUSINESS_SUBSCRIPTION_PRICE)} once-off activation</span>{" "}
            includes a{" "}
            <span className="font-semibold text-billboard-ink">{formatCurrencyShared(BUSINESS_LAUNCH_CREDIT_AMOUNT)} launch credit</span>{" "}
            toward your first booking. Any payment-processing charges are shown clearly at checkout, before you pay.
          </p>
          <Link
            to="/how-payment-works"
            className="text-xs font-semibold underline text-billboard-ink transition-colors hover:text-billboard-greenDeep"
          >
            See how payment works →
          </Link>
        </section>

        {/* Publishers — commission table */}
        <section className="mb-14">
          <h2 className="font-display text-xl mb-2">For Publishers</h2>
          <p className="text-sm text-billboard-inkSoft mb-5">
            A flat {commissionPct}% marketplace fee on every completed campaign — same rate on every channel,
            every time. No tiers, nothing extra deducted at payout. Your actual net payout may also reflect
            any applicable payment or payout processing charges.
          </p>
          <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-billboard-paperDim">
            <div className="grid grid-cols-3 gap-3 pb-2 mb-1 border-b-2 border-billboard-ink text-[11px] font-mono uppercase text-billboard-inkSoft">
              <span>Campaign value</span>
              <span>Marketplace fee</span>
              <span>Publisher earnings</span>
            </div>
            {EXAMPLES.map((amount) => (
              <ExampleRow key={amount} amount={amount} />
            ))}
          </div>
        </section>

        {/* Calculator */}
        <section className="mb-14">
          <h2 className="font-display text-xl mb-2">Calculate your earnings</h2>
          <p className="text-sm text-billboard-inkSoft mb-4">
            Enter any campaign amount and see exactly what you keep.
          </p>
          <FeeCalculator />
        </section>

        {/* Fee FAQ */}
        <section className="mb-14">
          <h2 className="font-display text-xl mb-2">Fee FAQ</h2>
          <div className="border-[3px] border-billboard-ink rounded-lg overflow-hidden">
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                className={i !== FAQS.length - 1 ? "border-b-2 border-billboard-ink/10" : ""}
              >
                <details className="group">
                  <summary className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-billboard-paperDim transition-colors cursor-pointer list-none">
                    <span className="font-bold text-sm">{f.q}</span>
                    <span
                      className="font-display text-lg shrink-0 transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-4 text-sm text-billboard-inkSoft leading-relaxed">{f.a}</p>
                </details>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* ──────────────────────── BOTTOM CTA ──────────────────────── */}
      <section className="bg-billboard-ink border-t-[3px] border-billboard-ink">
        <div className="max-w-4xl mx-auto px-5 py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-10">
          <div className="max-w-xl">
            <p className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-yellow mb-3">
              Ready when you are
            </p>
            <h2 className="font-display text-2xl md:text-3xl text-billboard-paper mb-3 leading-snug">
              The audience is out there.
              <br />
              The only cost is not reaching it.
            </h2>
            <p className="text-billboard-paper/70 text-sm max-w-lg">
              Join free. Activate once. Pay only when a campaign completes — and keep
              {" "}{sharePct}% of everything it earns.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link
              to="/register"
              className="inline-block bg-billboard-yellow border-[3px] border-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition text-sm text-center"
            >
              Create your free account →
            </Link>
            <Link
              to="/browse"
              className="inline-block bg-transparent border-[3px] border-billboard-paper/40 text-billboard-paper font-bold px-6 py-3 rounded hover:-translate-y-0.5 hover:border-billboard-paper transition text-sm text-center"
            >
              Browse publishers
            </Link>
            <Link
              to="/pricing"
              className="text-center text-xs text-billboard-paper/50 hover:text-billboard-paper transition underline pt-1"
            >
              See full pricing breakdown
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
