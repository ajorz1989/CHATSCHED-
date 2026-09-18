import { Link } from "react-router-dom";
import { useState } from "react";
import Seo from "../components/Seo";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import { PLATFORM_COMMISSION_RATE, PUBLISHER_SHARE } from "../lib/constants";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);
const sharePct = Math.round(PUBLISHER_SHARE * 100);

const EXAMPLES = [250, 500, 1000, 2500, 5000];

function rand(n: number) {
  return formatCurrencyShared(n, { cents: true });
}

/** One row of the worked-example table: campaign value → fee → publisher earnings, all derived from the same PLATFORM_COMMISSION_RATE used everywhere else. */
function ExampleRow({ amount }: { amount: number }) {
  const fee = amount * PLATFORM_COMMISSION_RATE;
  const earnings = amount - fee;
  return (
    <div className="grid grid-cols-3 gap-3 py-3 border-b-2 border-billboard-ink/10 last:border-b-0 text-sm">
      <span className="font-mono">{rand(amount)}</span>
      <span className="font-mono text-billboard-inkSoft">-{rand(fee)}</span>
      <span className="font-mono font-bold text-billboard-greenDeep">{rand(earnings)}</span>
    </div>
  );
}

function FeeCalculator() {
  const [value, setValue] = useState(500);
  const fee = value * PLATFORM_COMMISSION_RATE;
  const earnings = value - fee;
  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
      <label className="font-mono text-[11px] uppercase tracking-wide text-billboard-inkSoft block mb-2">
        Campaign amount
      </label>
      <input
        type="number"
        min={0}
        step={50}
        value={value}
        onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))}
        className="w-full border-2 border-billboard-ink rounded px-3 py-2 mb-5 font-mono text-lg"
      />
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">Campaign</div>
          <div className="font-display text-xl">{rand(value)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">Marketplace fee ({commissionPct}%)</div>
          <div className="font-display text-xl">-{rand(fee)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">You earn</div>
          <div className="font-display text-xl text-billboard-greenDeep">{rand(earnings)}</div>
        </div>
      </div>
    </div>
  );
}

const FAQS = [
  { q: "Do publishers pay to join?", a: "A basic profile is free. Full Publisher Network access — campaign opportunities, analytics, earnings dashboard, and approving requests — needs a one-time R199 activation, no renewal, ever. The marketplace fee below applies to a completed campaign transaction either way." },
  { q: "What is the marketplace fee?", a: `ChatSched currently charges a flat ${commissionPct}% marketplace fee on completed campaign transactions. It's the same rate on every channel, for every publisher.` },
  { q: "What does a publisher earn?", a: `A publisher keeps ${sharePct}% of the agreed campaign value. For a R500 campaign, that's a ${formatCurrencyShared(500 * PLATFORM_COMMISSION_RATE)} fee and ${formatCurrencyShared(500 * PUBLISHER_SHARE)} in earnings.` },
  { q: "Are there additional payout charges?", a: "Your actual net payout may also reflect standard payment or payout processing charges, shown on your payout screen alongside the marketplace fee." },
  { q: "Are there business fees?", a: "A business pays the agreed campaign price. Any platform or payment charges on the business side are shown clearly at checkout, before payment." },
  { q: "When do I see the fees?", a: "Before completing a transaction — in the pricing builder when you set your rate, on the campaign acceptance screen, and again in your dashboard and payout statement." },
  { q: "Can fees change?", a: "Pricing may change in the future. If it does, we'll give appropriate notice — see the Terms for specifics." },
];

export default function Fees() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="Fees · ChatSched"
        description={`ChatSched's transparent marketplace pricing — a flat ${commissionPct}% fee on completed campaign transactions, with worked examples and a calculator.`}
      />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Fees</span>
      <h1 className="text-3xl md:text-4xl mb-3">Simple, transparent marketplace pricing.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        One flat commission, shown before you commit — never a surprise deduction at payout. Here's exactly what ChatSched charges and what
        that means in real amounts.
      </p>

      <section className="mb-14">
        <h2 className="font-display text-lg mb-2">Businesses</h2>
        <p className="text-sm text-billboard-inkSoft mb-2">
          A business pays the agreed campaign price to the publisher — nothing added on top. Any applicable
          payment-processing charges are shown clearly at checkout, before you pay.
        </p>
        <Link to="/how-payment-works" className="text-xs font-semibold underline text-billboard-ink transition-colors hover:text-billboard-greenDeep">See how payment works →</Link>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-lg mb-4">Publishers</h2>
        <p className="text-sm text-billboard-inkSoft mb-5">
          ChatSched currently charges a flat {commissionPct}% marketplace fee on completed campaign
          transactions. It's the same rate on every channel, every time — no tiers, nothing extra deducted
          at payout. Your actual net payout may also be affected by any applicable payment or payout
          processing charges.
        </p>
        <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-billboard-paperDim">
          <div className="grid grid-cols-3 gap-3 pb-2 mb-1 border-b-2 border-billboard-ink text-[11px] font-mono uppercase text-billboard-inkSoft">
            <span>Campaign value</span>
            <span>Marketplace fee</span>
            <span>Publisher earnings</span>
          </div>
          {EXAMPLES.map((amount) => <ExampleRow key={amount} amount={amount} />)}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-lg mb-4">Calculate your earnings</h2>
        <FeeCalculator />
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Fee FAQ</h2>
        <div className="divide-y-2 divide-billboard-ink/10">
          {FAQS.map((f) => (
            <div key={f.q} className="py-4">
              <h3 className="font-bold text-sm mb-1">{f.q}</h3>
              <p className="text-sm text-billboard-inkSoft">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
