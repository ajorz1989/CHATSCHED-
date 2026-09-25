import { Link } from "react-router-dom";
import { useId, useState, type ReactNode } from "react";
import Seo from "../components/Seo";
import MarketingIcon, { type MarketingIconName } from "../components/MarketingIcon";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import { PLATFORM_COMMISSION_RATE } from "../lib/constants";

const FAQS = [
  { q: "How do I know a publisher is legitimate?", a: "Every publisher and creator is reviewed before they go live, and carries a visible trust score and level built from campaign history and profile signals — not just follower count." },
  { q: "Do I need a contract or subscription?", a: "No long-term contract and no recurring membership fee. Browsing and basic listing are free. Sending a booking request needs a one-time ChatSched Business activation of R399, and approving requests as a Publisher needs a one-time R199 activation. Neither renews." },
  { q: "What exactly do I get for the activation fee?", a: "The activation fee unlocks the platform features on your side of the marketplace. Businesses unlock booking, opportunities, campaign tools and their launch credit. Publishers unlock Network access, opportunities, analytics, earnings tools and the ability to approve paid requests." },
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
        description="See ChatSched's once-off Business and Publisher activation fees, what each unlocks, campaign fees, launch credit and the tools included on each side of the marketplace."
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
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Membership</span>
        <h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">Choose the side of ChatSched you need.</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-10 leading-relaxed">
          Browsing and basic listing stay free. Activation unlocks the paid features that let businesses book advertising and let publishers participate in paid opportunities. Both activation fees are once-off — no renewal, ever.
        </p>

        <div className="grid md:grid-cols-2 gap-5 items-stretch">
          {/* Business offer */}
          <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-yellow flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-white px-2.5 py-1 rounded">ChatSched Business</span>
              <span className="font-mono text-[10px] uppercase tracking-wider bg-billboard-ink text-white rounded px-2 py-1">For advertisers</span>
            </div>
            <p className="font-display text-4xl mb-1">R399<span className="text-base font-normal"> once-off</span></p>
            <p className="text-sm font-semibold mb-2">One activation unlocks your business advertising workspace.</p>
            <p className="text-sm text-billboard-inkSoft mb-6">Includes a <strong className="text-billboard-ink">R199 launch credit</strong> toward your first campaign. The credit is included in the R399 — it is not an extra payment.</p>

            <div className="border-2 border-billboard-ink/20 rounded-lg bg-white/60 p-4 mb-5">
              <p className="font-mono text-[10px] uppercase tracking-wider font-bold mb-2">What you unlock</p>
              <ul className="space-y-2.5">
                <BenefitItem>Full marketplace access — search, compare, save and request advertising from publishers.</BenefitItem>
                <BenefitItem>Business-to-publisher messaging inside ChatSched, keeping the booking conversation on-platform.</BenefitItem>
                <BenefitItem>Flexible campaign builder for your goal, channels, audience, location, budget, dates and creative brief.</BenefitItem>
                <BenefitItem>Access to the gated business Opportunities area for relevant sponsorship and advertising opportunities.</BenefitItem>
                <BenefitItem>Done-for-you campaign support — submit your brief and let a ChatSched campaign manager coordinate the media plan.</BenefitItem>
                <BenefitItem>Campaign tracking, booking history and reporting so you can follow the job from request through delivery.</BenefitItem>
                <BenefitItem>AI Content Studio free tier with a monthly allowance to help create campaign copy and marketing content.</BenefitItem>
                <BenefitItem>R199 launch credit applied toward an eligible first campaign after activation.</BenefitItem>
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
            <p className="font-display text-4xl mb-1">R199<span className="text-base font-normal"> once-off</span></p>
            <p className="text-sm font-semibold mb-2">Turn your audience or advertising inventory into bookable opportunities.</p>
            <p className="text-sm text-billboard-inkSoft mb-6">No recurring membership fee. Your activation unlocks the Network tools you need to receive, manage and deliver paid opportunities.</p>

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

        <p className="text-xs text-billboard-inkSoft mt-6 max-w-3xl leading-relaxed">
          Activation is separate from campaign transaction fees. A completed booking can still carry the standard ChatSched marketplace fee shown before the transaction. Featured &amp; Advertise placements are separate optional products and start from R99/month.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-8">
        <PricingFeeTeaser />
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-16 grid md:grid-cols-2 gap-10">
        <div className="border-[3px] border-billboard-ink rounded p-6">
          <h2 className="font-display text-lg mb-3">What businesses can do before activating</h2>
          <p className="text-billboard-inkSoft text-sm mb-4">Explore the marketplace first. Activation is only needed when you want to use the paid business workflow.</p>
          <ReachMockup />
          <ul className="text-sm text-billboard-inkSoft space-y-2 mt-5">
            <li>• See publisher profiles, audience fit and trust information before you commit</li>
            <li>• Compare available advertising inventory and channels</li>
            <li>• Activate once at R399 when you are ready to request and book</li>
          </ul>
          <Link to="/browse" className="inline-flex mt-5 items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition">Browse Advertising →</Link>
        </div>
        <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim">
          <h2 className="font-display text-lg mb-3">What publishers can do before activating</h2>
          <p className="text-billboard-inkSoft text-sm mb-4">Create a basic profile first. Activate when you are ready to participate in paid Network opportunities.</p>
          <PayoutMockup />
          <ul className="text-sm text-billboard-inkSoft space-y-2 mt-5">
            <li>• Build your basic listing and decide what you want to sell</li>
            <li>• Set your own advertising rates and placement details</li>
            <li>• Activate once at R199 when you are ready to receive and manage paid requests</li>
          </ul>
          <Link to="/register?role=publisher" className="inline-flex mt-5 items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition">Join as a Publisher →</Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-10">
        <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm max-w-[58ch] leading-relaxed">
            Before you commit to a campaign, ChatSched shows the applicable campaign pricing, marketplace fees and expected publisher earnings. Your activation fee is separate from the campaign amount.
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
        </div>
      </section>
    </div>
  );
}
