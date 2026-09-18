import { Link } from "react-router-dom";
import Seo from "../components/Seo";

/**
 * /trust/fraud-prevention — brief section 34. Unlike /trust/payments and
 * /trust/platform-compliance (which redirect — see App.tsx — because
 * HowPaymentWorks.tsx and /compliance already cover that ground in full),
 * this is a genuinely new page: nothing else describes fraud prevention
 * to the public today. Every mechanism named here is real and traceable
 * to actual code — src/lib/authenticitySignals.ts, the reports table
 * (schema_phase24_fraud_authenticity.sql), and the publisher-
 * authenticity-check edge function — not aspirational copy. Same honesty
 * rule as that schema file's own comments: this is decision support for
 * admin review, not a verification claim, and the limits are stated as
 * plainly as the mechanisms.
 */

const SIGNALS: { label: string; desc: string }[] = [
  { label: "Engagement rate vs. audience size", desc: "Engagement percentages that are implausible outright, or unusually high for a given follower count — bigger audiences mechanically see lower engagement rates, so a large page with a very high one is worth a second look." },
  { label: "Reach far exceeding followers", desc: "A claimed monthly reach many times larger than the follower count. Sometimes that's a genuinely viral account — this flags it for a look, it doesn't assume the worst." },
  { label: "Price far outside the typical band", desc: "Pricing well below or above what ChatSched's own pricing guide suggests for that size and engagement level — informational, not accusatory." },
  { label: "Large audience, no verification", desc: "A sizeable claimed following with neither email nor phone confirmed." },
  { label: "Minimal profile for the size claimed", desc: "A large claimed audience paired with an empty or very short bio." },
];

export default function FraudPrevention() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="Fraud Prevention · ChatSched"
        description="How ChatSched flags fake engagement and inflated audiences for review — rule-based signals, an AI second opinion, and the reporting process, explained plainly."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Trust centre
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">How ChatSched flags fake engagement.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-4">
        Follower counts and engagement numbers are self-reported by publishers — there's no way for ChatSched
        or anyone else to independently confirm a number a platform itself doesn't expose. What ChatSched does
        instead is flag things worth a second look, and give businesses and creators a way to report what the
        automated checks miss.
      </p>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        None of this is a verdict. It's decision support for a human reviewer, same as everywhere else on
        ChatSched that involves a judgment call.
      </p>

      <section className="mb-14">
        <h2 className="font-display text-xl mb-3">Rule-based signals</h2>
        <p className="text-sm text-billboard-inkSoft mb-6 max-w-2xl">
          Every publisher application is checked against a small set of explainable rules — plain arithmetic on
          numbers already on the profile, not a black-box score. Legitimate publishers can trip one of these;
          a genuinely viral community page can have reach well above its follower count, for example. That's
          why these are signals for a reviewer, not automatic rejections.
        </p>
        <div className="space-y-3">
          {SIGNALS.map((s) => (
            <div key={s.label} className="border-2 border-billboard-ink rounded p-3.5 bg-white">
              <p className="text-sm font-semibold mb-0.5">{s.label}</p>
              <p className="text-xs text-billboard-inkSoft">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-xl mb-3">An AI second opinion, on request</h2>
        <p className="text-sm text-billboard-inkSoft max-w-2xl mb-4">
          For applications that need a closer look, the ChatSched team can run an AI-assisted check on the
          text a publisher submitted — bio, audience description, category, platforms. It reads for internal
          inconsistencies a busy reviewer might skim past.
        </p>
        <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-5">
          <p className="text-sm font-semibold mb-1">🔍 What this can't do</p>
          <p className="text-sm text-billboard-inkSoft">
            It has no way to check whether a follower count is real — nothing does, short of the platform
            itself confirming it. It's a second pair of eyes on the words someone wrote, not a fraud detector.
            A human on the ChatSched team makes the actual call, always.
          </p>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-xl mb-3">Reporting a profile</h2>
        <p className="text-sm text-billboard-inkSoft max-w-2xl mb-4">
          Anyone can flag a publisher's listing directly — before booking them, or without ever booking them at
          all. Reports go straight to the ChatSched team and are never visible to the publisher being reported,
          which protects the reporter and rules out retaliation.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Fake or inflated followers", "No response after booking", "Inappropriate content", "Scam or fraud", "Something else"].map((r) => (
            <span key={r} className="font-mono text-[11px] font-semibold uppercase px-2.5 py-1.5 rounded border-2 border-billboard-ink bg-billboard-paperDim">
              {r}
            </span>
          ))}
        </div>
      </section>

      <div className="text-center border-t-2 border-billboard-paperDim pt-8">
        <p className="text-billboard-inkSoft mb-4">This sits alongside the rest of how ChatSched handles trust.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/trust#verification" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            Verification levels
          </Link>
          <Link to="/trust#disputes" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            Dispute policy
          </Link>
          <Link to="/trust/creator-standards" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            Creator standards
          </Link>
        </div>
      </div>
    </div>
  );
}
