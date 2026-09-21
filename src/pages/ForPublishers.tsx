import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";
import { getAllChannels, getEnabledChannels } from "../lib/channelRegistry";
import { isChannelEnabled } from "../lib/featureFlags";
import {
  CREATOR_APPROVAL_WINDOW_DAYS,
  CREATOR_PAYOUT_WINDOW_HOURS,
  PLATFORM_COMMISSION_RATE,
  PUBLISHER_SHARE,
} from "../lib/constants";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);
const sharePct = Math.round(PUBLISHER_SHARE * 100);

const STEPS = [
  { n: "01", title: "List your channel", body: "Tell us your niche, audience and format. A basic profile is free — approving requests, plus full Publisher Network access (opportunities, analytics, earnings), needs a one-time R199 activation, no renewal, ever." },
  { n: "02", title: "Review requests", body: `Businesses find you through search and category browsing and send you a feature request to review — you have ${CREATOR_APPROVAL_WINDOW_DAYS} days to approve or decline it. Approving needs an active Publisher Network subscription; declining doesn't.` },
  { n: "03", title: "Approve, schedule, execute", body: "With an active Publisher Network subscription, accept the requests that fit, schedule the placement, and mark it live once it's done — you're always in control." },
  { n: "04", title: "Get paid, on a real clock", body: `Payment is confirmed by ChatSched before you ever post. Your payout lands within ${CREATOR_PAYOUT_WINDOW_HOURS} hours of going live.` },
];

const LEVELS = [
  { key: "rising", label: "Rising", emoji: "🌱", requirement: "3,000+ followers.", className: "bg-billboard-paperDim border-billboard-ink" },
  { key: "verified", label: "Verified", emoji: "✓", requirement: "5,000+ followers, phone number confirmed by OTP, and the account is at least 6 months old.", className: "bg-billboard-ink text-white border-billboard-ink" },
  { key: "premium", label: "Premium", emoji: "⭐", requirement: "20,000+ followers.", className: "bg-billboard-yellow border-billboard-ink" },
  { key: "elite", label: "Elite", emoji: "👑", requirement: "100,000+ followers and identity verified.", className: "bg-billboard-green text-white border-billboard-greenDeep" },
];

const FEATURES = [
  { title: "Trust score & level", body: "Rising, Verified, Premium, or Elite — built from real campaign history and verification, not just a follower count. Shows on your public profile." },
  { title: "Response-time badge", body: "Once you've handled 3+ requests, a \"usually responds within…\" badge appears automatically — a real signal to businesses deciding who to book." },
  { title: "Portfolio", body: "Show up to 5 images and an intro video on your profile, so a business can see your work before they ever send a request." },
  { title: "Reviews", body: "Businesses rate and comment on completed campaigns, right on your public profile — your track record speaks for itself." },
  { title: "Open Opportunities", body: "Browse briefs businesses post across every channel and pitch for the ones that fit — a second way to get booked, alongside waiting for a direct request." },
  { title: "Auto-generated media kit", body: "One click builds a shareable PDF from your live profile — trust score, audience, portfolio and reviews — ready to send to a brand yourself." },
];

const FAQS = [
  { q: "What does joining involve?", a: "Apply with your channel details, get reviewed, and once approved you start receiving requests in your dashboard." },
  { q: "Can I decline a request?", a: "Yes, any time, free — you can also counter or discuss before anything is scheduled. Accepting needs an active Publisher Network subscription." },
  { q: "Do I control scheduling?", a: "Yes. Once you approve a request, you choose when it goes live and mark it done yourself." },
  { q: "When do I actually get paid?", a: `Payment is confirmed by ChatSched before you post anything — never chase an invoice. Once you mark your post live, your payout is due within ${CREATOR_PAYOUT_WINDOW_HOURS} hours.` },
  { q: "What's ChatSched's cut?", a: `A flat ${commissionPct}% platform commission — you keep ${sharePct}% of every booking. Same rate on every channel, every time, no tiers.` },
  { q: "Is there a minimum audience size to apply?", a: "We review every application on its own merits — reach out and we'll walk you through it." },
];

export default function ForPublishers() {
  const liveChannelCount = getEnabledChannels().length;

  return (
    <div>
      <Seo
        title="For Publishers & Creators · ChatSched"
        description="Monetise the audience you've already built. R199 once-off for the full Publisher Network — approve requests, set your own price, and payment is confirmed before you ever post. No renewal, ever."
      />

      {/* HERO */}
      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-billboard-yellow" /> For Publishers &amp; Creators
          </span>
          <h1 className="text-4xl md:text-6xl leading-[1.05] mb-5 max-w-3xl">
            Monetise the audience you've already built.
          </h1>
          <p className="text-lg text-billboard-paperDim max-w-[56ch] mb-6">
            R199 once-off for the full Publisher Network — set your own price, approve every request yourself, and
            payment is confirmed before you ever post. Never chase an invoice again.
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-6 max-w-[56ch] text-sm">
            {[
              "Access to paid campaigns",
              "A verified profile",
              "Real campaign opportunities",
              "Professional support",
              "Secure, held payments",
              "A performance history that builds over time",
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-1.5 text-billboard-paperDim">
                <span className="text-billboard-yellow mt-0.5">✓</span> {benefit}
              </li>
            ))}
          </ul>
          <p className="font-semibold text-billboard-yellow mb-8 max-w-[56ch]">
            You're not just listing a page — you're building your own media network.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <Link to="/register?role=publisher" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">
              Join as a Publisher →
            </Link>
            <Link to="/how-payment-works" className="inline-flex items-center gap-2 border-[3px] border-billboard-paper bg-transparent font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition">
              See how payment works →
            </Link>
          </div>
        </div>
      </section>

      {/* TRANSPARENT PAYOUTS */}
      <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white flex flex-wrap items-center gap-6">
            <div className="text-2xl shrink-0" aria-hidden="true">🔒</div>
            <p className="text-sm text-billboard-inkSoft flex-1 min-w-[220px]">
              <strong className="text-billboard-ink">Know exactly what you'll earn before you accept.</strong>{" "}
              Same flat rate on every booking, every channel — no tiered pricing, nothing extra deducted at payout.
            </p>
            <Link to="/fees" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm shrink-0 hover:-translate-y-0.5 transition">See exact fees →</Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">How it works</span>
          <h2 className="text-3xl md:text-4xl mb-10 max-w-xl">List once. Approve what fits. Get paid on a real clock.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div key={s.n} className="border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-blockSm">
                <div className="font-display text-2xl text-billboard-yellowDeep mb-2" style={{ WebkitTextStroke: "1.5px #1A1712" }}>{s.n}</div>
                <h3 className="font-bold mb-1.5">{s.title}</h3>
                <p className="text-sm text-billboard-inkSoft">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-5">
            <p className="text-sm font-semibold mb-1">🔒 Why the payment hold protects you</p>
            <p className="text-sm text-billboard-inkSoft">
              A business's payment is held by ChatSched from the moment they pay — not released to you, but not
              refundable to them either without going through the dispute process. You're never doing the work on
              a promise, and you're never left chasing a business for money after the fact.
            </p>
          </div>
        </div>
      </section>

      {/* CHANNELS */}
      <section className="py-16 bg-billboard-paperDim border-y-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">{liveChannelCount} live channels to get booked</span>
          <h2 className="text-3xl md:text-4xl mb-3 max-w-xl">Whatever you've built, there's a channel for it.</h2>
          <p className="text-billboard-inkSoft max-w-xl mb-10">Apply under the live channel that best matches your audience or advertising asset. Every live channel uses the same ChatSched request-and-approval workflow.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {getAllChannels().map((m) => (
              <div key={m.definition.slug} className="border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-blockSm">
                <div className="mb-3"><ChannelIcon slug={m.definition.slug} /></div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm mb-1">{m.definition.name}</h3>
                  {!isChannelEnabled(m.definition.slug) && (
                    <span className="shrink-0 border border-billboard-inkSoft/40 text-billboard-inkSoft font-mono text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-billboard-inkSoft">{m.definition.tagline}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VERIFICATION LEVELS */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Grow your standing</span>
          <h2 className="text-3xl md:text-4xl mb-3 max-w-xl">Your badge levels up as your audience and verification do.</h2>
          <p className="text-billboard-inkSoft max-w-xl mb-10">Shown right on your public profile — a business sees exactly why they can trust you before they ever send a request.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {LEVELS.map((l) => (
              <div key={l.key} className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
                <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase px-2.5 py-1 rounded border-2 mb-3 ${l.className}`}>
                  {l.emoji} {l.label}
                </span>
                <p className="text-sm text-billboard-inkSoft">{l.requirement}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link to="/trust" className="inline-flex items-center gap-2 font-semibold underline text-billboard-inkSoft hover:text-billboard-ink">
              See the full verification process →
            </Link>
          </div>
        </div>
      </section>

      {/* DASHBOARD FEATURES */}
      <section className="py-16 bg-billboard-ink text-billboard-paper border-y-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-3">In your dashboard</span>
          <h2 className="text-3xl md:text-4xl mb-3 max-w-xl">Everything that helps a business say yes.</h2>
          <p className="text-billboard-paperDim max-w-xl mb-10">Real trust signals, built from your own track record — not something you have to talk up yourself.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="border-2 border-[#3A342B] rounded p-4 bg-[#211D17]">
                <h3 className="font-bold text-sm mb-1 text-billboard-paper">{f.title}</h3>
                <p className="text-xs text-billboard-paperDim">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OPPORTUNITIES EXPLAINER — a genuinely different mental model from
          the request-and-approve flow described in STEPS above (pitch for
          an open brief vs. wait for a business to find your profile), so
          it gets its own short section rather than just a FEATURES card. */}
      <section className="py-16 border-b-[3px] border-billboard-ink bg-billboard-paperDim">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-3">Two ways to get booked</span>
          <h2 className="text-2xl md:text-3xl mb-3">Wait for a request, or pitch for one yourself.</h2>
          <p className="text-billboard-inkSoft mb-6">
            Most of the time, a business finds your profile through search and sends you a direct request — that's
            the flow above. Opportunities work the other way round: a business posts an open brief — a school
            partnership, a product launch, a seasonal push — across any channel, and any eligible publisher can pitch
            for it. It's a second, parallel path to get booked, not a replacement for the first.
          </p>
          <Link to="/opportunities/preview" className="inline-flex items-center gap-2 font-semibold underline text-billboard-ink hover:text-billboard-greenDeep">
            See what's open right now →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-8 text-center">Common questions</h2>
        <div className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
          {FAQS.map((f, i) => (
            <div key={f.q} className={i !== FAQS.length - 1 ? "border-b-2 border-billboard-ink" : ""}>
              <details className="group">
                <summary className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-billboard-paperDim transition-colors cursor-pointer list-none font-bold text-sm">
                  {f.q}
                  <span className="font-display text-lg shrink-0 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-4 text-sm text-billboard-inkSoft">{f.a}</p>
              </details>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 bg-billboard-yellow border-t-[3px] border-billboard-ink text-center">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="font-display text-2xl md:text-3xl mb-4">Ready to turn your audience into income?</h2>
          <p className="text-billboard-inkSoft mb-6">
            R199 once-off for the full network — approve every request yourself. Payment's confirmed before you ever post. No renewal, ever.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register?role=publisher" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
              Join as a Publisher →
            </Link>
            <Link to="/how-it-works" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
              See the full request flow →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
