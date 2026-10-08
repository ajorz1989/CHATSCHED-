import { Link } from "react-router-dom";
import { useId, useState, type ReactNode } from "react";
import Seo from "../components/Seo";
import MarketingIcon, { type MarketingIconName } from "../components/MarketingIcon";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import { PLATFORM_COMMISSION_RATE, PREMIUM_ACCESS_PRICE, SALES_EMAIL } from "../lib/constants";

const FAQS = [
  { q: "Can my business also appear on the browse page as a publisher?", a: "Yes. With Premium access you can create one publisher listing from your dashboard — no second fee. Channels with no manual verification go live on the browse page straight away; social media and high-trust channels are submitted for ChatSched verification first. You can't book your own listing." },
  { q: "How do I know a publisher is legitimate?", a: "Publishers and creators on high-trust channels — and every social media listing — are verified before they go live, and every listing carries a visible trust score and level built from campaign history and profile signals — not just follower count." },
  { q: "Do I need a contract or subscription?", a: "No contract, and signing up, browsing, listing and booking are all free. Premium access is optional (R199 per month, cancel any time) and unlocks the Opportunities job board and the Marketing Suite." },
  { q: "What do I get with Premium access?", a: "Premium access unlocks the Opportunities job board and the full Marketing Suite, for businesses and creators alike. Booking and listing never need it." },
  { q: "How does payment actually work?", a: "Payment happens after the booking reaches its required approval stage. The payment method depends on the channel, and payment is tracked through ChatSched before the placement moves live." },
  { q: "Can I choose which channels to advertise on?", a: "Yes. ChatSched spans 12 channels: social media, influencer, website, podcast, radio, sports & recreation, events, community groups, transport, spaza shops & informal retail, local associations, and restaurants & cafés — availability depends on what's live in your area." },
];

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b-2 border-billboard-ink">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full text-left py-4 flex justify-between items-center gap-4 font-bold"
      >
        {q}
        <span aria-hidden="true" className={`font-mono text-xl transition-transform shrink-0 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div className={`overflow-hidden transition-all ${open ? "max-h-96 pb-4" : "max-h-0"}`}>
        <p className="text-billboard-inkSoft text-sm leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/** The request → verified → live → tracked flow, as a visual pipeline — no figures, just the mechanics that make it trustworthy on both sides. */
function ValueFlow() {
  const steps: { icon: MarketingIconName; label: string }[] = [
    { icon: "document", label: "Request sent" },
    { icon: "check", label: "Confirmed & secured" },
    { icon: "megaphone", label: "Campaign goes live" },
    { icon: "money", label: "Payout tracked" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {steps.map((s, i) => (
        <div key={s.label} className="relative border-2 border-billboard-ink/20 bg-white/35 rounded p-4 text-center">
          <MarketingIcon name={s.icon} className="w-7 h-7 mx-auto mb-1.5" />
          <span className="font-mono text-[11px] uppercase tracking-wide">{s.label}</span>
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="hidden sm:block absolute top-1/2 -right-3 -translate-y-1/2 text-billboard-ink font-bold">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** A mini mockup of a business's view into a publisher before booking — audience data, verification, and fit, all visible up front. */
function ReachMockup() {
  return (
    <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">Publisher profile preview</span>
        <span className="font-mono text-[10px] uppercase text-billboard-greenDeep font-bold border border-billboard-greenDeep rounded px-1.5 py-0.5">Verified</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-billboard-inkSoft">Audience fit</span>
          <span className="font-mono font-bold text-billboard-greenDeep">Strong match</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-billboard-inkSoft">Engagement</span>
          <span className="font-mono font-bold">Above average</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-billboard-inkSoft">Trust score</span>
          <MarketingIcon name="star" className="w-6 h-6" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-billboard-inkSoft">Campaign history</span>
          <span className="font-mono font-bold">Track record visible</span>
        </div>
      </div>
    </div>
  );
}

/** A mini mockup of a publisher's dashboard queue — the same shape as the real thing, no figures, just showing that every request is tracked to a clear outcome. */
function PayoutMockup() {
  const rows = [
    { label: "Request from a business", status: "Awaiting your response" },
    { label: "You approve", status: "Payment confirmed" },
    { label: "Content goes live", status: "Payout window starts" },
  ];
  return (
    <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim">
      <span className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft block mb-3">Your dashboard</span>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <span>{r.label}</span>
            <span className="font-mono text-[11px] font-semibold text-billboard-greenDeep text-right">{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BenefitItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed">
      <span aria-hidden="true" className="mt-[3px] inline-flex items-center justify-center w-4 h-4 rounded-full border-2 border-billboard-ink text-[10px] font-bold shrink-0">✓</span>
      <span>{children}</span>
    </li>
  );
}

function PricingFeeTeaser() {
  const inputId = useId();
  const [raw, setRaw] = useState("500");
  const value = Math.max(0, Number(raw) || 0);
  const fee = value * PLATFORM_COMMISSION_RATE;
  const earnings = value - fee;
  const fmt = (n: number) => formatCurrencyShared(n, { cents: true });
  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-billboard-paperDim">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">Quick fee check</span>
          <h3 className="font-display text-xl">See the maths before you commit.</h3>
        </div>
        <label htmlFor={inputId} className="font-mono text-xs">
          Campaign value
          <input
            id={inputId}
            type="number"
            min={0}
            step={50}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={(e) => {
              // Clamp to 0 on blur, not every keystroke, so typing a new number doesn't fight the cursor
              const n = Number(e.target.value);
              setRaw(String(Math.max(0, isNaN(n) ? 0 : n)));
            }}
            aria-describedby={`${inputId}-result`}
            className="ml-2 w-28 border-2 border-billboard-ink rounded px-2 py-1"
          />
        </label>
      </div>
      <div
        id={`${inputId}-result`}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center"
        aria-live="polite"
        aria-label={`Campaign ${fmt(value)}, marketplace fee ${fmt(fee)}, publisher earns ${fmt(earnings)}`}
      >
        <div><div className="font-display text-xl">{fmt(value)}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Campaign</div></div>
        <div><div className="font-display text-xl">-{fmt(fee)}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Marketplace fee</div></div>
        <div className="col-span-2 sm:col-span-1"><div className="font-display text-xl text-billboard-greenDeep">{fmt(earnings)}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Publisher earns</div></div>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <div>
      <Seo
        title="Pricing | ChatSched"
        description="See what ChatSched costs: free sign-up, the creator booking fee and commission, and optional Premium access for the Opportunities job board and the Marketing Suite."
      />

      {/* Hero */}
      <section className="bg-billboard-yellow text-billboard-ink py-16 border-b-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink px-3 py-1.5 rounded mb-3">Pricing</span>
          <h1 className="text-3xl md:text-5xl mb-4 max-w-3xl">Pay once. Unlock the tools you need to advertise or earn.</h1>
          <p className="text-billboard-inkSoft max-w-2xl mb-10 leading-relaxed">
            ChatSched keeps membership simple: no recurring activation subscription. Businesses pay once to unlock campaign buying and business tools; publishers pay once to unlock Network features and paid opportunities.
          </p>
          <ValueFlow />
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-16">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Pricing</span>
        <h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">Free to join. Pay only when you book.</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-10 leading-relaxed">
          Signing up, browsing, listing and booking are free. Premium access is one optional monthly plan that unlocks the Opportunities job board and the Marketing Suite, for businesses and publishers alike.
        </p>

        <div className="grid md:grid-cols-2 gap-5 items-stretch">
          {/* Business offer */}
          <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-yellow flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-white px-2.5 py-1 rounded">ChatSched Business</span>
              <span className="font-mono text-[10px] uppercase tracking-wider bg-billboard-ink text-white rounded px-2 py-1">For advertisers</span>
            </div>
            <p className="font-display text-4xl mb-1">Free<span className="text-base font-normal"> to join</span></p>
            <p className="text-sm font-semibold mb-2">Create your account, browse the marketplace and send booking requests at no cost.</p>
            <p className="text-sm text-billboard-inkSoft mb-6">When a creator accepts, you pay their price plus a small booking fee (R30 under R500, R50 from R500). That total is shown on your Payment Card before you pay.</p>

            <div className="border-2 border-billboard-ink/20 rounded-lg bg-white/60 p-4 mb-5">
              <p className="font-mono text-[10px] uppercase tracking-wider font-bold mb-2">What you get</p>
              <ul className="space-y-2.5">
                <BenefitItem>Full marketplace access — search, compare, save and request advertising from publishers.</BenefitItem>
                <BenefitItem>Business-to-publisher messaging inside ChatSched, keeping the booking conversation on-platform.</BenefitItem>
                <BenefitItem>Flexible campaign builder for your goal, channels, audience, location, budget, dates and creative brief.</BenefitItem>
                <BenefitItem>Done-for-you campaign support — submit your brief and a ChatSched campaign manager coordinates the media plan. Most managed campaigns are billed per booking at the standard marketplace fee; larger campaigns may instead use a single agreed package price, always confirmed with you before anything is booked.</BenefitItem>
                <BenefitItem>Campaign tracking, booking history and reporting so you can follow the job from request through delivery.</BenefitItem>
                <BenefitItem>List your own business on the browse page with Premium access and other businesses can book you. One listing per account.</BenefitItem>
              </ul>
            </div>

            <p className="text-xs text-billboard-inkSoft mt-auto pt-2">Best for SMMEs, brands, venues, schools, event organisers and businesses that want one place to discover and book advertising.</p>
            <Link to="/build-my-campaign" className="mt-5 inline-flex items-center justify-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-white font-bold px-4 py-3 rounded text-sm hover:-translate-y-0.5 transition">Start Building My Campaign →</Link>
          </div>

          {/* Publisher offer */}
          <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paperDim px-2.5 py-1 rounded">ChatSched Publisher Network</span>
              <span className="font-mono text-[10px] uppercase tracking-wider bg-billboard-green text-white rounded px-2 py-1">For media owners</span>
            </div>
            <p className="font-display text-4xl mb-1">Free<span className="text-base font-normal"> to list</span></p>
            <p className="text-sm font-semibold mb-2">Turn your audience or advertising inventory into bookable opportunities.</p>
            <p className="text-sm text-billboard-inkSoft mb-6">No sign-up fee. ChatSched takes {Math.round(PLATFORM_COMMISSION_RATE * 100)}% of your price on a completed booking, and you set your own price.</p>

            <div className="border-2 border-billboard-ink/20 rounded-lg bg-billboard-paperDim p-4 mb-5">
              <p className="font-mono text-[10px] uppercase tracking-wider font-bold mb-2">What you unlock</p>
              <ul className="space-y-2.5">
                <BenefitItem>Verified publisher profile with your audience information, positioning and advertising inventory.</BenefitItem>
                <BenefitItem>Media kit and rate card tools so businesses can understand what you offer before requesting a booking.</BenefitItem>
                <BenefitItem>Opportunity feed and access to relevant business advertising opportunities on the Network.</BenefitItem>
                <BenefitItem>Control over your advertising prices and the placements you choose to offer.</BenefitItem>
                <BenefitItem>Dashboard tools to review, approve or decline booking requests and track active relationships.</BenefitItem>
                <BenefitItem>Earnings dashboard and analytics so you can monitor campaign value and performance.</BenefitItem>
                <BenefitItem>Tracked payment and payout workflow through ChatSched instead of manually chasing every booking.</BenefitItem>
                <BenefitItem>Greater visibility to businesses searching the marketplace for advertising inventory that fits their audience.</BenefitItem>
              </ul>
            </div>

            <p className="text-xs text-billboard-inkSoft mt-auto pt-2">Best for creators, publishers, media owners, community channels, websites, podcasts, radio and other advertising inventory owners.</p>
            <Link to="/register?role=publisher" className="mt-5 inline-flex items-center justify-center gap-2 border-[3px] border-billboard-ink bg-white font-bold px-4 py-3 rounded text-sm hover:-translate-y-0.5 transition">Join the Publisher Network →</Link>
          </div>
        </div>

        <div className="mt-6 border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-paperDim">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-yellow px-2.5 py-1 rounded mb-3">Premium access · optional</span>
              <p className="font-display text-3xl mb-1">{formatCurrencyShared(PREMIUM_ACCESS_PRICE)}<span className="text-base font-normal"> per month</span></p>
              <p className="text-sm text-billboard-inkSoft">For businesses and creators. Unlocks the gated Opportunities job board (post or apply for sponsorship and advertising opportunities) and the full Marketing Suite: Match, Reach Planner, Content Studio, Caption Writer, Campaign Builder, Campaign Tracker and ROI Calculator. Cancel any time.</p>
            </div>
            <Link to="/register" className="inline-flex items-center justify-center gap-2 border-[3px] border-billboard-ink bg-white font-bold px-4 py-3 rounded text-sm hover:-translate-y-0.5 transition">Create a free account →</Link>
          </div>
        </div>
        <p className="text-xs text-billboard-inkSoft mt-6 max-w-3xl leading-relaxed">
          Booking fees and commission are separate from Premium access and are always shown before a transaction. Featured &amp; Advertise placements are separate optional products and start from R99/month.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-10">
        <div className="border-[3px] border-billboard-ink rounded-lg overflow-hidden bg-billboard-ink text-white shadow-blockSm">
          <div className="p-6 md:p-8 bg-billboard-ink">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <span className="inline-block font-mono text-[10px] font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-3">How payment works</span>
                <h2 className="font-display text-2xl md:text-3xl max-w-2xl">See what happens to your money before you book.</h2>
              </div>
              <Link to="/how-payment-works" className="inline-flex items-center gap-2 border-2 border-white/70 text-white font-bold px-4 py-2.5 rounded text-sm hover:bg-white/10 transition shrink-0">Full payment guide →</Link>
            </div>
            <p className="text-white/80 max-w-3xl leading-relaxed text-sm md:text-base mb-7">
              The payment step depends on the advertising channel, but the principle stays clear: the booking is approved first, payment is verified, the placement goes live, and the publisher payout follows the rules for that booking.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { n: "01", title: "Choose & request", body: "Find the publisher or channel that fits your campaign and send the booking request." },
                { n: "02", title: "Approval", body: "The publisher accepts the request and the final booking amount is confirmed." },
                { n: "03", title: "Pay & verify", body: "Pay using the method shown for the booking. ChatSched records and verifies the payment." },
                { n: "04", title: "Go live & payout", body: "The placement is delivered and marked live, then the publisher payout is processed." },
              ].map((step) => (
                <div key={step.n} className="border-2 border-white/20 rounded-lg p-4 bg-white/5">
                  <span className="font-mono text-[10px] text-billboard-yellow font-bold">{step.n}</span>
                  <h3 className="font-display text-lg mt-1 mb-1.5">{step.title}</h3>
                  <p className="text-xs text-white/70 leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-3 text-xs md:text-sm">
              <div className="border border-billboard-yellow/40 rounded p-3 bg-billboard-yellow/10">
                <strong className="text-billboard-yellow">Every channel:</strong> once the creator accepts, you receive a Payment Card and pay ChatSched by bank transfer.
              </div>
              <div className="border border-billboard-green/50 rounded p-3 bg-billboard-green/10">
                <strong className="text-billboard-green">Going live:</strong> a placement goes live only once the money has cleared in the ChatSched bank account.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-8">
        <PricingFeeTeaser />
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-8">
        <div className="border-2 border-billboard-ink bg-billboard-paperDim rounded p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm max-w-[58ch] leading-relaxed">
            Beyond Premium access, <strong className="text-billboard-ink">ChatSched Tools</strong> is a growing catalogue of practical add-ons for getting leads, handling customers, taking bookings and running campaigns — free, once-off, monthly and annual pricing, priced individually per tool.
          </p>
          <Link to="/tools" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm bg-white shrink-0 hover:-translate-y-0.5 transition">Explore ChatSched Tools →</Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-16 grid md:grid-cols-2 gap-10">
        <div className="border-[3px] border-billboard-ink rounded p-6">
          <h2 className="font-display text-lg mb-3">What businesses can do for free</h2>
          <p className="text-billboard-inkSoft text-sm mb-4">Everything you need to find and book advertising is free. Premium access is only for the Opportunities board and the Marketing Suite.</p>
          <ReachMockup />
          <ul className="text-sm text-billboard-inkSoft space-y-2 mt-5">
            <li>• See publisher profiles, audience fit and trust information before you commit</li>
            <li>• Compare available advertising inventory and channels</li>
            <li>• Send booking requests and pay only when a creator accepts</li>
          </ul>
          <Link to="/browse" className="inline-flex mt-5 items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition">Browse Advertising →</Link>
        </div>
        <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim">
          <h2 className="font-display text-lg mb-3">What publishers can do for free</h2>
          <p className="text-billboard-inkSoft text-sm mb-4">Create your profile and start receiving requests. Premium access is optional and adds the Opportunities board and the Marketing Suite.</p>
          <PayoutMockup />
          <ul className="text-sm text-billboard-inkSoft space-y-2 mt-5">
            <li>• Build your basic listing and decide what you want to sell</li>
            <li>• Set your own advertising rates and placement details</li>
            <li>• Approve or decline requests and see your earnings</li>
          </ul>
          <Link to="/register?role=publisher" className="inline-flex mt-5 items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition">Join as a Publisher →</Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-10">
        <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm max-w-[58ch] leading-relaxed">
            Before you commit to a campaign, ChatSched shows the applicable campaign pricing, marketplace fees and expected publisher earnings. The booking fee is separate from the creator’s price.
          </p>
          <Link to="/fees" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm bg-white shrink-0 hover:-translate-y-0.5 transition">See exact fees →</Link>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 pb-14">
        <h2 className="font-display text-xl mb-2">Common questions</h2>
        <div>{FAQS.map((f) => <FaqRow key={f.q} {...f} />)}</div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper py-14">
        <div className="max-w-5xl mx-auto px-5 text-center">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-3">Ready when you are</span>
          <h2 className="text-3xl md:text-4xl mb-3">Put ChatSched to work for your next opportunity.</h2>
          <p className="text-billboard-paperDim max-w-2xl mx-auto mb-7">
            Discover advertising inventory, launch a campaign, or join the Publisher Network and start turning your audience into bookable media.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/build-my-campaign" className="inline-flex items-center gap-2 bg-billboard-yellow text-billboard-ink border-[3px] border-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition text-sm">Build My Campaign →</Link>
            <Link to="/register?role=publisher" className="inline-flex items-center gap-2 bg-white text-billboard-ink border-[3px] border-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition text-sm">Join as a Publisher →</Link>
            <Link to="/fees" className="inline-flex items-center gap-2 bg-transparent text-white border-[3px] border-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition text-sm">Review Fees</Link>
          </div>
          <p className="text-billboard-paperDim/80 text-sm mt-6">
            Running a bigger campaign or have a custom pricing question? Talk to sales at{" "}
            <a href={`mailto:${SALES_EMAIL}`} className="underline font-semibold text-white">{SALES_EMAIL}</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
