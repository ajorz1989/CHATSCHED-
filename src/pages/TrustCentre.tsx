import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Seo from "../components/Seo";
import TrustBadge from "../components/TrustBadge";
import MarketingIcon from "../components/MarketingIcon";
import {
  CREATOR_APPROVAL_WINDOW_DAYS,
  BUSINESS_PAYMENT_WINDOW_DAYS,
  CREATOR_PAYOUT_WINDOW_HOURS,
  CONTACT_EMAIL,
} from "../lib/constants";

const PUBLISHER_LEVELS = [
  { key: "rising" as const, label: "Rising", requirement: "3,000+ followers.", className: "bg-billboard-paperDim border-billboard-ink" },
  { key: "verified" as const, label: "Verified", requirement: "5,000+ followers, phone number confirmed by OTP, and the account is at least 6 months old.", className: "bg-billboard-ink text-white border-billboard-ink" },
  { key: "premium" as const, label: "Premium", requirement: "20,000+ followers.", className: "bg-billboard-yellow border-billboard-ink" },
  { key: "elite" as const, label: "Elite", requirement: "100,000+ followers and identity verified.", className: "bg-billboard-green text-white border-billboard-greenDeep" },
];

const BUSINESS_LEVELS = [
  { key: "bronze" as const, label: "Bronze Verified", requirement: "Email address confirmed.", className: "bg-billboard-paperDim border-billboard-ink" },
  { key: "silver" as const, label: "Silver Verified", requirement: "Email and phone number (OTP) both confirmed.", className: "bg-billboard-yellow border-billboard-ink" },
  { key: "gold" as const, label: "Gold Verified", requirement: "Business registration confirmed by the ChatSched team.", className: "bg-billboard-ink text-white border-billboard-ink" },
];

interface DisputeCategory {
  label: string;
  desc: string;
}

const DISPUTE_CATEGORIES: DisputeCategory[] = [
  { label: "Non-delivery", desc: "The agreed placement never went live." },
  { label: "Quality issue", desc: "It went live, but not as agreed — wrong format, wrong timing, taken down early." },
  { label: "Payment issue", desc: "A problem with the payment release, payout, or amount." },
  { label: "Communication", desc: "One side has gone quiet or is unresponsive." },
  { label: "Other", desc: "Anything that doesn't fit the categories above." },
];

interface DisputeOutcome {
  label: string;
  desc: string;
  className: string;
}

const DISPUTE_OUTCOMES: DisputeOutcome[] = [
  { label: "Refund to business", desc: "Held funds are returned to the business.", className: "border-billboard-red text-billboard-red" },
  { label: "Release to publisher", desc: "Held funds are paid out as originally agreed.", className: "border-billboard-greenDeep text-billboard-greenDeep" },
  { label: "Partial", desc: "Funds are split between both sides.", className: "border-billboard-yellowDeep text-billboard-ink" },
  { label: "No action", desc: "The booking stands as it was.", className: "border-billboard-ink text-billboard-ink" },
];

const REPORT_REASONS = [
  "Fake or inflated followers",
  "No response after booking",
  "Inappropriate content",
  "Scam or fraud",
  "Something else",
];

export default function TrustCentre() {
  const { hash } = useLocation();

  // /trust/verification and /trust/disputes redirect to /trust#verification
  // and /trust#disputes (see App.tsx) rather than duplicating this page's
  // content — but a client-side route change doesn't trigger the browser's
  // native "scroll to fragment" behavior a full page load would, so without
  // this the redirect would silently land at the top of the page instead
  // of the section it promised. Small delay so it runs after this page's
  // own content has actually rendered (it's not lazy-loaded from here, but
  // the parent route still is).
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="Trust Centre · ChatSched"
        description="How ChatSched verifies businesses and publishers, and what happens when a booking goes wrong — the verification process and dispute policy in plain language."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Trust centre
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">Who's who, and what happens if it goes wrong.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-6">
        Two things build trust on a marketplace: knowing who you're dealing with, and knowing there's a fair
        way to sort things out if a booking doesn't go to plan. Here's exactly how ChatSched handles both,
        in plain language.
      </p>
      <nav aria-label="Trust and policy sections" className="flex flex-wrap gap-2 mb-12">
        {[
          ["#verification", "Verification"], ["#disputes", "Disputes"], ["/trust/safety", "Safety"],
          ["/trust/business-standards", "Business standards"], ["/trust/creator-standards", "Creator standards"],
          ["/trust/fraud-prevention", "Fraud prevention"], ["/platform-rules", "Platform rules"], ["/transparency", "Transparency"],
        ].map(([to,label]) => <Link key={to} to={to} className="border-2 border-billboard-ink rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-billboard-paperDim transition-colors">{label}</Link>)}
      </nav>

      {/* ── Verification ───────────────────────────────────────────── */}
      <section id="verification" className="mb-16">
        <h2 className="font-display text-xl mb-3 flex items-baseline gap-2.5">
          <span className="text-billboard-yellowDeep" style={{ WebkitTextStroke: "1px #1A1712" }}>01</span>
          Verification process
        </h2>
        <p className="text-sm text-billboard-inkSoft mb-6 max-w-2xl">
          Verification on ChatSched is layered, not a single tick box. Every account starts with the basics —
          confirming an email address is real and a phone number actually belongs to whoever's applying — and
          builds up from there as more is confirmed.
        </p>

        <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white mb-6">
          <h3 className="font-display text-base mb-1.5">Phone confirmation, the same way everywhere</h3>
          <p className="text-sm text-billboard-inkSoft">
            Whether it's a business profile or a publisher listing, phone verification works the same way: a
            one-time code is sent by SMS, the code is checked, and only a successful match flips the "phone
            verified" flag. Codes expire and can't be reused, and nobody — including our own team — can read
            a code back out once it's issued.
          </p>
        </div>

        <h3 className="font-display text-base mb-3">Publisher &amp; creator levels</h3>
        <p className="text-sm text-billboard-inkSoft mb-4 max-w-2xl">
          A publisher's badge reflects follower count plus how much has actually been confirmed — not just how
          big the audience claims to be.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {PUBLISHER_LEVELS.map((l) => (
            <div key={l.key} className="border-[3px] border-billboard-ink rounded-lg p-4 bg-white">
              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase px-2.5 py-1 rounded border-2 mb-2 ${l.className}`}>
                <TrustBadge kind="publisher" level={l.key} showLabel={false} /> <span>{l.label}</span>
              </span>
              <p className="text-sm text-billboard-inkSoft">{l.requirement}</p>
            </div>
          ))}
        </div>

        <h3 className="font-display text-base mb-3">Business verification</h3>
        <p className="text-sm text-billboard-inkSoft mb-4 max-w-2xl">
          Publishers and creators get the same visibility into who's booking them. A business's tier shows on
          the request they send through.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {BUSINESS_LEVELS.map((l) => (
            <div key={l.key} className="border-[3px] border-billboard-ink rounded-lg p-4 bg-white">
              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase px-2.5 py-1 rounded border-2 mb-2 ${l.className}`}>
                <TrustBadge kind="business" level={l.key} showLabel={false} /> <span>{l.label}</span>
              </span>
              <p className="text-sm text-billboard-inkSoft">{l.requirement}</p>
            </div>
          ))}
        </div>

        <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-5">
          <p className="text-sm font-semibold mb-1">Worth knowing</p>
          <p className="text-sm text-billboard-inkSoft">
            Verification confirms an email is real, a phone number belongs to the applicant, or (at the top
            tier) that a business registration checks out. It's not a promise about how a campaign will
            perform — follower counts and engagement are still self-reported by the publisher, which is
            exactly why the dispute process below exists as a backstop.
          </p>
        </div>
      </section>

      {/* ── Disputes ────────────────────────────────────────────────── */}
      <section id="disputes" className="mb-14">
        <h2 className="font-display text-xl mb-3 flex items-baseline gap-2.5">
          <span className="text-billboard-yellowDeep" style={{ WebkitTextStroke: "1px #1A1712" }}>02</span>
          Dispute policy
        </h2>
        <p className="text-sm text-billboard-inkSoft mb-6 max-w-2xl">
          Every booking is paid and held by ChatSched, only released once the placement goes live — see{" "}
          <Link to="/how-payment-works" className="underline font-semibold text-billboard-ink">
            how payment works
          </Link>{" "}
          for the full timeline. That payment hold is what makes disputes possible to resolve fairly: if
          something goes wrong, the money hasn't gone anywhere yet, or has only just been released.
        </p>

        <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white mb-8">
          <h3 className="font-display text-base mb-3">How it works, step by step</h3>
          <ol className="space-y-3 text-sm text-billboard-inkSoft">
            <li><strong className="text-billboard-ink">1. Open a dispute.</strong> Either the business or the publisher/creator can open one, tied to the specific booking it's about — not a general complaint.</li>
            <li><strong className="text-billboard-ink">2. Pick a category.</strong> Non-delivery, quality issue, payment issue, communication, or other — this routes it correctly and gives the ChatSched team the context up front.</li>
            <li><strong className="text-billboard-ink">3. Both sides make their case.</strong> A dispute has its own message thread, separate from the regular booking chat, so the discussion around the disagreement stays together in one place.</li>
            <li><strong className="text-billboard-ink">4. ChatSched reviews and decides.</strong> Resolution is handled by the ChatSched team, not by either party marking their own dispute "resolved" — that's deliberate, so one side can't unilaterally close something the other side still disagrees with.</li>
            <li><strong className="text-billboard-ink">5. An outcome is recorded.</strong> Whatever held funds are involved get released, refunded, split, or left as they are, and the dispute is closed with that outcome on file.</li>
          </ol>
        </div>

        <h3 className="font-display text-base mb-3">What a dispute can be about</h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {DISPUTE_CATEGORIES.map((c) => (
            <div key={c.label} className="border-2 border-billboard-ink rounded p-3.5 bg-white">
              <p className="text-sm font-semibold mb-0.5">{c.label}</p>
              <p className="text-xs text-billboard-inkSoft">{c.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="font-display text-base mb-3">Possible outcomes</h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {DISPUTE_OUTCOMES.map((o) => (
            <div key={o.label} className={`border-2 rounded p-3.5 bg-white ${o.className}`}>
              <p className="text-sm font-semibold mb-0.5">{o.label}</p>
              <p className="text-xs text-billboard-inkSoft">{o.desc}</p>
            </div>
          ))}
        </div>

        <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-5 mb-8">
          <p className="text-sm font-semibold mb-1 inline-flex items-center gap-1.5"><MarketingIcon name="location" className="w-4 h-4" /> No open-ended waiting</p>
          <p className="text-sm text-billboard-inkSoft">
            The same timing that governs a normal booking also protects a disputed one — a creator has{" "}
            {CREATOR_APPROVAL_WINDOW_DAYS} days to approve or decline a request, a business has{" "}
            {BUSINESS_PAYMENT_WINDOW_DAYS} days to pay once approved, and a creator is paid out within{" "}
            {CREATOR_PAYOUT_WINDOW_HOURS} hours of a post going live. A dispute only exists because one of
            these steps didn't happen as expected — it doesn't reset or bypass the rest of the timeline.
          </p>
        </div>

        <h3 className="font-display text-base mb-3">Reporting a profile outright</h3>
        <p className="text-sm text-billboard-inkSoft mb-4 max-w-2xl">
          Separately from a booking dispute, anyone can flag a publisher's listing itself if something looks
          off — before or without ever booking them. Reports go straight to the ChatSched team for review.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {REPORT_REASONS.map((r) => (
            <span key={r} className="font-mono text-[11px] font-semibold uppercase px-2.5 py-1.5 rounded border-2 border-billboard-ink bg-billboard-paperDim">
              {r}
            </span>
          ))}
        </div>
      </section>

      <div className="text-center border-t-2 border-billboard-paperDim pt-8">
        <p className="text-billboard-inkSoft mb-4">Still have a question about how any of this works?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/contact" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
            Contact us
          </Link>
          <Link to="/how-payment-works" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            See how payment works
          </Link>
          <Link to="/trust/fraud-prevention" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            Fraud prevention
          </Link>
        </div>
        <p className="text-xs text-billboard-inkSoft mt-6">
          Want the full picture in one place? See the <Link to="/trust/safety" className="underline font-semibold text-billboard-ink">Safety overview</Link>.
        </p>
        <p className="text-xs text-billboard-inkSoft mt-2">
          Questions about this policy can also be sent directly to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-semibold text-billboard-ink">{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}
