import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo";
import {
  CREATOR_APPROVAL_WINDOW_DAYS,
  BUSINESS_PAYMENT_WINDOW_DAYS,
  CREATOR_PAYOUT_WINDOW_HOURS,
  PLATFORM_COMMISSION_RATE,
  PUBLISHER_SHARE,
  CONTACT_EMAIL,
} from "../lib/constants";
import { MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import { formatCurrency } from "../lib/currency";
import MarketingIcon, { type MarketingIconName } from "../components/MarketingIcon";

const commissionPct = Math.round(PLATFORM_COMMISSION_RATE * 100);
const sharePct = Math.round(PUBLISHER_SHARE * 100);

interface Faq {
  q: string;
  a: string;
}

interface FaqCategory {
  id: string;
  label: string;
  icon: import("../components/MarketingIcon").MarketingIconName;
  items: Faq[];
}

// Every answer here reflects something that actually exists in the product
// today — payment timings, the real commission split, real feature names —
// not aspirational copy. Where a page already goes deeper on a topic
// (Trust Centre, Compliance Centre, How Payment Works), the answer here
// stays short and links out rather than duplicating it at length.
const CATEGORIES: FaqCategory[] = [
  {
    id: "general",
    label: "Getting Started",
    icon: "wave",
    items: [
      {
        q: "What actually is ChatSched?",
        a: "A direct marketplace connecting South African small businesses with the publishers, creators and channels their customers already follow — social media pages, influencers, websites, podcasts and radio — without an ad account or algorithm in between. A business finds a channel, sends a request, pays once it's approved (held by ChatSched, not released to the creator yet), and the creator gets paid once it's confirmed live.",
      },
      {
        q: "Is this just for social media influencers?",
        a: "No — multiple channel types can use the same request-and-approve flow: social media pages and groups, influencers, websites, podcasts, radio, sports teams, events, community groups, transport media, informal retail, business associations, and restaurants.",
      },
      {
        q: "Do I need to sign a contract or subscribe to something?",
        a: "No contract either way. Browsing and listing are always free. Sending a request needs a one-time ChatSched Business activation (R399, once-off — no renewal, ever), and approving one needs a one-time Publisher Network activation (R199, once-off).",
      },
      {
        q: "Is ChatSched free to use?",
        a: `Yes, joining is free for both sides. A business pays exactly the agreed campaign price, nothing added on top. A publisher keeps ${sharePct}% of every booking, with a flat ${commissionPct}% platform commission — no listing fees, no tiers.`,
      },
      {
        q: "Do I need to be technical to use this?",
        a: "No — it's a request form, an approve/decline button, and a dashboard. If you can use WhatsApp and email, you can use ChatSched.",
      },
      {
        q: "Which parts of South Africa does ChatSched cover?",
        a: "Publishers and creators across all nine provinces, filterable by city and suburb on Browse — not limited to one metro.",
      },
    ],
  },
  {
    id: "businesses",
    label: "For Businesses",
    icon: "building",
    items: [
      {
        q: "How do I find the right publisher for my business?",
        a: "Filter Browse by category, location, platform, audience and price, or describe your business in plain language to Audience Finder for a ranked match. You can also save a search and get emailed the moment a new matching publisher joins.",
      },
      {
        q: "What if a publisher never responds to my request?",
        a: `A publisher has ${CREATOR_APPROVAL_WINDOW_DAYS} days to approve or decline a request — if they don't, it closes automatically rather than leaving you waiting indefinitely.`,
      },
      {
        q: "Can I negotiate the price?",
        a: "Yes — on the four request-flow channels (influencer, website, podcast, radio), a creator can counter your proposed amount, and you can accept or decline the counter. You're notified the moment they do.",
      },
      {
        q: "What happens if the publisher never actually posts?",
        a: "That's exactly what the held-payment and dispute process protect against — your payment isn't released until the placement is confirmed live, and \"non-delivery\" is one of the categories a dispute can be opened under if it comes to that.",
      },
      {
        q: "Can I book more than one publisher for the same campaign?",
        a: "Yes — there's no limit on how many requests you can have open or how many publishers you work with at once.",
      },
      {
        q: "Can I track whether a campaign is actually working?",
        a: "Yes — Campaign Tracker gives every campaign a real short link plus a UTM-tagged version of your own destination URL, and logs clicks, visits, leads and conversions for real. Your dashboard also rolls totals up across every campaign you're running, not just one at a time.",
      },
      {
        q: "Can I cancel a request?",
        a: "Yes, before it's paid — declining or withdrawing a pending request costs nothing. Once payment is held by ChatSched, cancelling goes through the same dispute process as any other problem, since the creator may already be relying on that booking.",
      },
      {
        q: "Do I need to be a registered company to book a publisher?",
        a: "No — a business account is enough to send requests. Verifying your business (email, phone, and eventually company registration) unlocks a visible trust badge that some publishers may look for, but it isn't required to use the platform.",
      },
    ],
  },
  {
    id: "publishers",
    label: "For Publishers & Creators",
    icon: "megaphone",
    items: [
      {
        q: "How much does ChatSched actually take?",
        a: `A flat ${commissionPct}% platform commission on every completed booking — you keep ${sharePct}%. Same rate on every channel, no tiers, nothing extra deducted at payout.`,
      },
      {
        q: "When do I actually get paid?",
        a: `Your payment is held securely by ChatSched before you're ever expected to post — no chasing an invoice. Once you mark your placement live, payout is due within ${CREATOR_PAYOUT_WINDOW_HOURS} hours.`,
      },
      {
        q: "Do I have to accept every request I get?",
        a: "No — every request is yours to review. Approve it, decline it, or (on the four request-flow channels) counter with a different price before committing to anything.",
      },
      {
        q: "Can I charge different prices for different types of content?",
        a: "Yes — rate cards let you set structured pricing per format (a Story costs less than a dedicated Reel, a bundle can undercut booking things separately) instead of being stuck with one flat number that's wrong for most of what you actually sell.",
      },
      {
        q: "How do I prove my follower count is real, not just typed in?",
        a: "Connect your account (YouTube, Facebook Page, Instagram or TikTok) and ChatSched imports your real follower count directly from the platform's own API — no self-reported numbers required. It also tends to speed up admin review.",
      },
      {
        q: "What do the Rising / Verified / Premium / Elite badges mean?",
        a: "Follower-count and verification thresholds that unlock a visible level on your profile — see the Trust Centre for the exact criteria at each tier.",
      },
      {
        q: "Can I see who's viewed my profile?",
        a: "You see an aggregate count — \"8 businesses viewed your profile this week\" — never who specifically. Keeping browsing private between businesses matters more than a publisher knowing exactly who looked.",
      },
      {
        q: "Do I need to submit proof that I actually posted?",
        a: "Yes, for campaigns under the compliance checklist — a screenshot of the live post gets submitted and reviewed against the disclosure requirement that applies to that platform/category, so \"it's live\" isn't just taken on trust from either side.",
      },
      {
        q: "Do I need to disclose that a post is paid/sponsored?",
        a: "Generally yes — most platforms and advertising regulators require audiences to be able to tell when content is paid for. The Compliance Centre and Platform Rules page track the specific disclosure requirement per platform and category; ChatSched doesn't guarantee any platform will approve a post, only that the checklist for what it expects is clear upfront.",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments & Payouts",
    icon: "lock",
    items: [
      {
        q: "How does the payment hold actually work here?",
        a: "Once a creator approves a request, the business pays — that Your payment is held securely by ChatSched — not released to the publisher — until your placement is confirmed live. Only then is it released for payout. Neither side is trusting the other on a promise.",
      },
      {
        q: "What payment methods can a business use?",
        a: "Card or instant EFT through PayFast (confirms automatically), or a manual EFT straight to ChatSched's bank account (matched and confirmed by the team once funds land).",
      },
      {
        q: "What happens if a business doesn't pay after approving?",
        a: `The business has ${BUSINESS_PAYMENT_WINDOW_DAYS} days to pay once a creator approves. If payment doesn't land in that window, the booking closes automatically rather than leaving the creator holding a slot indefinitely.`,
      },
      {
        q: "Is there a minimum price for a booking?",
        a: `ChatSched's pricing guidance won't suggest anything below ${formatCurrency(MIN_PRICE_PER_POST)} per post as a floor, though the actual price on any booking is whatever the two sides agree (or counter-offer) to.`,
      },
      {
        q: "Can I get a media kit or proof of my numbers to send a client?",
        a: "Publishers can generate a real, branded PDF media kit on the spot — audience, pricing, portfolio, reviews, trust score and verification, all pulled from the live profile, no design work needed.",
      },
    ],
  },
  {
    id: "trust",
    label: "Trust, Safety & Disputes",
    icon: "shield",
    items: [
      {
        q: "How do you know a publisher is actually legitimate?",
        a: "Every publisher is reviewed by hand before going live, and carries a visible trust score, level, and verification badges built from real account activity and campaign history — not just a follower count someone typed in.",
      },
      {
        q: "What happens if something goes wrong with a booking?",
        a: "Either side can open a dispute against that specific booking — categorised as non-delivery, quality issue, payment issue, communication, or other. ChatSched reviews it and decides the outcome (refund, release, split, or no action); it's never left to either party to decide unilaterally.",
      },
      {
        q: "Who actually decides who's right in a dispute?",
        a: "ChatSched's team, not either side. That's deliberate — it's what stops one party from just marking their own dispute \"resolved\" over the other's objection.",
      },
      {
        q: "Can I report a publisher or business I think is being dishonest?",
        a: "Yes — reports go to the ChatSched team for review, separately from any specific booking dispute, and can lead to a suspension for repeated or serious issues.",
      },
      {
        q: "Is my payment protected if a campaign gets rejected by a platform (e.g. TikTok, Meta)?",
        a: "Yes — that follows the same held-payment and dispute process as any other booking problem. A platform rejecting content is a decision that belongs to that platform, not ChatSched, but your payment still isn't released until the situation is resolved.",
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy & Your Data",
    icon: "lock",
    items: [
      {
        q: "Is ChatSched POPIA compliant?",
        a: "Yes — the full Privacy Policy explains exactly what's collected, why, and how it's protected under the Protection of Personal Information Act.",
      },
      {
        q: "Does ChatSched sell my personal information?",
        a: "No. Personal information is never sold to third parties, and anything shared with a service provider is only for the purpose it was collected for.",
      },
      {
        q: "Can I delete my account and get my data out?",
        a: "Yes — both are self-service from Account settings: a full export of everything tied to your account as a real downloadable file, and a real account deletion, not a support ticket. (Some financial records may be retained longer where required for tax/recordkeeping purposes, even after deletion.)",
      },
      {
        q: "As a publisher, can businesses see my personal contact details?",
        a: "Only what you choose to put on your public profile. Your account login details and any unpublished information stay private.",
      },
    ],
  },
];

function FaqAccordion({ items }: { items: Faq[] }) {
  return (
    <div className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
      {items.map((f, i) => (
        <div key={f.q} className={i !== items.length - 1 ? "border-b-2 border-billboard-ink" : ""}>
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
  );
}

export default function Faq() {
  // Lets other pages (e.g. /help) deep-link straight into a pre-filled
  // search — read once on mount as the initial value, same pattern
  // MediaKit.tsx already uses useSearchParams for. Not kept in sync on
  // every keystroke; the URL is just the entry point, not a persisted
  // search state.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((f) => {
        if (activeCategory && cat.id !== activeCategory) return false;
        if (!q) return true;
        return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [q, activeCategory]);

  const totalCount = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
  const resultCount = filteredCategories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="FAQ · ChatSched"
        description="Real answers about how ChatSched works — payments and payouts, verification, disputes, pricing, and what to expect as a business or a publisher."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        FAQ
      </span>
      <h1 className="text-3xl md:text-4xl mb-3">Questions, answered honestly.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-8">
        {totalCount} real questions about how ChatSched actually works — not marketing copy. If something's still
        unclear after this, <Link to="/contact" className="underline font-semibold text-billboard-ink">reach out directly</Link>.
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions — e.g. &ldquo;payout&rdquo;, &ldquo;dispute&rdquo;, &ldquo;commission&rdquo;"
          className="w-full border-[3px] border-billboard-ink rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-billboard-yellow"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-billboard-inkSoft hover:text-billboard-ink"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-10">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 border-billboard-ink transition ${activeCategory === null ? "bg-billboard-ink text-white" : "bg-white hover:bg-billboard-paperDim"}`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            className={`font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 border-billboard-ink transition ${activeCategory === cat.id ? "bg-billboard-ink text-white" : "bg-white hover:bg-billboard-paperDim"}`}
          >
            <MarketingIcon name={cat.icon} className="w-6 h-6" /> {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {filteredCategories.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded-lg p-10 text-center">
          <p className="font-semibold mb-2">No questions match "{query}".</p>
          <p className="text-sm text-billboard-inkSoft mb-4">
            Try a different word, or just ask us directly — real people read every message.
          </p>
          <Link to="/contact" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            Contact us →
          </Link>
        </div>
      ) : (
        <>
          {query && (
            <p className="text-xs text-billboard-inkSoft mb-4 font-mono uppercase">
              {resultCount} match{resultCount === 1 ? "" : "es"}
            </p>
          )}
          <div className="space-y-10">
            {filteredCategories.map((cat) => (
              <section key={cat.id}>
                <h2 className="font-display text-lg mb-4"><MarketingIcon name={cat.icon} className="w-6 h-6" /> {cat.label}</h2>
                <FaqAccordion items={cat.items} />
              </section>
            ))}
          </div>
        </>
      )}

      {/* Deeper-dive pointers */}
      <div className="mt-14 pt-10 border-t-2 border-billboard-ink/10">
        <h2 className="font-display text-lg mb-4 text-center">Want the full detail on something?</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link to="/how-payment-works" className="border-2 border-billboard-ink rounded p-4 hover:bg-billboard-paperDim transition">
            <p className="font-bold text-sm mb-1">How Payment Works →</p>
            <p className="text-xs text-billboard-inkSoft">The full payment and payout timeline, step by step.</p>
          </Link>
          <Link to="/trust" className="border-2 border-billboard-ink rounded p-4 hover:bg-billboard-paperDim transition">
            <p className="font-bold text-sm mb-1">Trust Centre →</p>
            <p className="text-xs text-billboard-inkSoft">Verification levels and how disputes actually get resolved.</p>
          </Link>
          <Link to="/compliance" className="border-2 border-billboard-ink rounded p-4 hover:bg-billboard-paperDim transition">
            <p className="font-bold text-sm mb-1">Compliance Centre →</p>
            <p className="text-xs text-billboard-inkSoft">Disclosure rules and platform requirements for sponsored content.</p>
          </Link>
          <Link to="/privacy" className="border-2 border-billboard-ink rounded p-4 hover:bg-billboard-paperDim transition">
            <p className="font-bold text-sm mb-1">Privacy Policy →</p>
            <p className="text-xs text-billboard-inkSoft">What's collected, why, and how POPIA applies.</p>
          </Link>
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-billboard-inkSoft">
          Still stuck? Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-semibold text-billboard-ink">{CONTACT_EMAIL}</a> or use the{" "}
          <Link to="/contact" className="underline font-semibold text-billboard-ink">contact form</Link>.
        </p>
      </div>
    </div>
  );
}
