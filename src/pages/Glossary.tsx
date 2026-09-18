import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import {
  PLATFORM_COMMISSION_RATE, PUBLISHER_SHARE,
  CREATOR_APPROVAL_WINDOW_DAYS, BUSINESS_PAYMENT_WINDOW_DAYS, CREATOR_PAYOUT_WINDOW_HOURS,
} from "../lib/constants";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);
const sharePct = Math.round(PUBLISHER_SHARE * 100);

interface Term {
  term: string;
  category: string;
  definition: string;
  link?: { to: string; label: string };
}

// Every definition here reflects something real and checkable elsewhere
// in the product — the same numbers used in pricingEngine.ts, constants.ts
// and businessVerification.ts, not simplified-to-the-point-of-wrong copy.
const TERMS: Term[] = [
  { term: "Business", category: "Marketplace basics", definition: "A company or advertiser using ChatSched to find and book publishers to reach a local audience." },
  { term: "Publisher", category: "Marketplace basics", definition: "The account behind a channel or audience — a social page, an influencer, a website, a podcast, or a radio slot — that businesses can request to feature them. Sometimes called a creator." },
  { term: "Channel", category: "Marketplace basics", definition: "One of the five kinds of audience a business can advertise through: social media, influencer, website, podcast, or radio.", link: { to: "/channels", label: "See all channels" } },
  { term: "Request", category: "Marketplace basics", definition: "What a business submits to a publisher asking to be featured. A publisher reviews it and can approve or decline." },
  { term: "Campaign", category: "Marketplace basics", definition: "What a request becomes once it's approved — tracked from approval through payment, going live, and confirmation." },
  { term: "Payment hold", category: "Money & timing", definition: "Where a business's payment is held by ChatSched once a campaign is approved. It's released to the publisher only once the placement is confirmed live — not before, and not automatically on approval alone.", link: { to: "/how-payment-works", label: "See the full payment timeline" } },
  { term: "Platform commission", category: "Money & timing", definition: `The flat ${commissionPct}% fee ChatSched takes from every booking. Applied the same way regardless of channel or publisher size.` },
  { term: "Publisher share", category: "Money & timing", definition: `The ${sharePct}% of a booking a publisher keeps after commission — the majority of every placement, by design.` },
  { term: "Approval window", category: "Money & timing", definition: `The ${CREATOR_APPROVAL_WINDOW_DAYS} days a publisher has to approve or decline a request before it expires.` },
  { term: "Payment window", category: "Money & timing", definition: `The ${BUSINESS_PAYMENT_WINDOW_DAYS} days a business has to pay once a publisher approves a request. The payment is held by ChatSched, not released to the publisher yet.` },
  { term: "Payout window", category: "Money & timing", definition: `The ${CREATOR_PAYOUT_WINDOW_HOURS} hours a publisher is paid within, once their placement is confirmed live.` },
  { term: "Suggested Price", category: "Pricing", definition: "A publisher's calculated starting rate for a placement — based on their follower count, engagement relative to a typical baseline, and trust score. A guide to negotiate from, not a fixed rule.", link: { to: "/publisher-success/how-to-price-your-advertising", label: "Read the pricing guide" } },
  { term: "Trust score", category: "Pricing", definition: "A 0–100 score reflecting a publisher's track record on the platform. New publishers start at a neutral midpoint and it moves as they build a history — it's one of the inputs to Suggested Price, not a public reputation badge." },
  { term: "Verification tiers", category: "Trust & safety", definition: "How verified a business is: Bronze (email verified), Silver (email and phone verified), Gold (full business verification on file). Shown to publishers deciding whether to accept a request." },
  { term: "Authenticity signal", category: "Trust & safety", definition: "An automated flag raised during publisher review when something looks off — engagement far outside a normal range, reach that vastly exceeds followers, pricing well outside the suggested band. A prompt for a closer look, not an automatic rejection." },
  { term: "Dispute", category: "Trust & safety", definition: "The formal process for resolving a disagreement between a business and a publisher over a campaign.", link: { to: "/trust#disputes", label: "How disputes get handled" } },
];

const CATEGORIES = Array.from(new Set(TERMS.map((t) => t.category)));

export default function Glossary() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Glossary · ChatSched" description="Plain-language definitions of ChatSched terms — payment holds, commission, trust score, Suggested Price, verification tiers, and more." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Glossary</span>
      <h1 className="text-3xl md:text-4xl mb-3">What the terms on ChatSched actually mean.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">Every definition here matches the real mechanics behind it — the same numbers used across the platform, not simplified into something that isn't quite true.</p>

      <div className="flex flex-wrap gap-2 mb-10">
        {CATEGORIES.map((c) => (
          <a key={c} href={`#${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 border-billboard-ink bg-white hover:bg-billboard-paperDim transition">
            {c}
          </a>
        ))}
      </div>

      <div className="space-y-12">
        {CATEGORIES.map((category) => (
          <section key={category} id={category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
            <h2 className="font-display text-lg mb-4">{category}</h2>
            <div className="border-[3px] border-billboard-ink rounded divide-y-2 divide-billboard-ink/10">
              {TERMS.filter((t) => t.category === category).map((t) => (
                <div key={t.term} className="p-5">
                  <h3 className="font-bold mb-1.5">{t.term}</h3>
                  <p className="text-sm text-billboard-inkSoft mb-2">{t.definition}</p>
                  {t.link && <Link to={t.link.to} className="text-xs font-semibold underline text-billboard-ink">{t.link.label} →</Link>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 pt-10 border-t-2 border-billboard-ink/10 text-center">
        <p className="text-sm text-billboard-inkSoft">Missing a term, or something here doesn't match what you're seeing? <Link to="/contact" className="underline font-semibold text-billboard-ink">Let us know</Link>.</p>
      </div>
    </div>
  );
}
