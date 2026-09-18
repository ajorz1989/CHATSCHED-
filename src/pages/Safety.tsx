import { Link } from "react-router-dom";
import Seo from "../components/Seo";

/**
 * /trust/safety — brief section 34. Deliberately an index/overview, not a
 * sixth copy of content that already lives in depth elsewhere
 * (TrustCentre.tsx, HowPaymentWorks.tsx, /compliance, FraudPrevention.tsx,
 * CreatorStandards.tsx, BusinessStandards.tsx). A page that duplicated
 * all of that would drift out of sync with the real ones the moment
 * either changed — this one links to them instead.
 */

const PILLARS: { title: string; desc: string; to: string; label: string }[] = [
  {
    title: "Who you're dealing with",
    desc: "Every account starts with the basics — a real email, a phone number confirmed by SMS — and builds up from there. Publisher and business tiers reflect exactly what's been confirmed, not just what's claimed.",
    to: "/trust#verification",
    label: "See verification levels",
  },
  {
    title: "Where the money sits",
    desc: "Every booking is paid and held by ChatSched, only released once the placement actually goes live — never straight to the creator up front.",
    to: "/how-payment-works",
    label: "See how payment works",
  },
  {
    title: "What happens if it goes wrong",
    desc: "A dispute has its own message thread, gets reviewed by the ChatSched team rather than either side marking it resolved themselves, and ends with a recorded outcome — refund, release, split, or no action.",
    to: "/trust#disputes",
    label: "See the dispute policy",
  },
  {
    title: "Fake engagement and inflated numbers",
    desc: "Rule-based signals flag things worth a second look on every application, with an AI-assisted second opinion available for closer review — and anyone can report a listing directly.",
    to: "/trust/fraud-prevention",
    label: "See fraud prevention",
  },
  {
    title: "Sponsored campaigns",
    desc: "Paid collaborations come with platform-specific disclosure requirements surfaced before a creator publishes, and a compliance checklist on every campaign.",
    to: "/compliance",
    label: "See the Compliance Centre",
  },
  {
    title: "What's expected of everyone",
    desc: "Truthful representation, no fake engagement, no off-platform payment, and clear disclosure of paid content — the standards both sides agree to just by using ChatSched.",
    to: "/trust/creator-standards",
    label: "See creator & business standards",
  },
];

export default function Safety() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="Safety · ChatSched"
        description="How ChatSched approaches safety across verification, payments, disputes, fraud prevention, and sponsored-content compliance — one overview, linking to the full detail on each."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Trust centre
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">Safety, in one place.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        Safety on a marketplace isn't one feature — it's several working together. Here's how the pieces fit,
        with a link to the full detail on each one.
      </p>

      <div className="space-y-4">
        {PILLARS.map((p) => (
          <Link
            key={p.title}
            to={p.to}
            className="block border-[3px] border-billboard-ink rounded-lg p-5 bg-white hover:-translate-y-0.5 transition"
          >
            <h2 className="font-display text-base mb-1.5">{p.title}</h2>
            <p className="text-sm text-billboard-inkSoft mb-2">{p.desc}</p>
            <span className="font-mono text-[11px] font-semibold uppercase text-billboard-greenDeep">{p.label} →</span>
          </Link>
        ))}
      </div>

      <div className="text-center border-t-2 border-billboard-paperDim pt-8 mt-14">
        <p className="text-billboard-inkSoft mb-4">Something not covered here?</p>
        <Link to="/contact" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
          Contact us
        </Link>
      </div>
    </div>
  );
}
