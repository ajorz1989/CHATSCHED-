import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { getAllChannels } from "../lib/channelRegistry";
import { isChannelEnabled } from "../lib/featureFlags";

// Consolidated principles list. Previously About.tsx and Mission.tsx each
// declared their own `PRINCIPLES` array (a naming collision waiting to
// happen once merged) with overlapping content — both had a near-identical
// "real audiences, not vanity metrics" entry worded slightly differently.
// This is the single, merged, de-duplicated version.
const PRINCIPLES = [
  { title: "Real audiences, not vanity metrics", body: "We manually check every channel before it's listed — reviewing real, engaged audiences, not follower counts. A number means nothing if nobody's actually paying attention." },
  { title: "On-platform, in the open", body: "Businesses and publishers work through a clear request-and-approve process inside ChatSched — no black box, no hidden hand-off." },
  { title: "Proof before promises", body: "We're not pretending to be bigger than we are. We're proving this works, one real channel and one real business at a time, before we automate anything." },
  { title: "Fair by default", body: "Publishers keep the large majority of every placement. The people bringing the audience should be the ones benefiting most from it." },
  { title: "No lock-in", body: "No contracts, no minimum spend. Browsing and listing are always free — a subscription is only needed to send or approve a request, and you can cancel one any time." },
  { title: "Built for South Africa first", body: "Not a global platform adapted after the fact — every part of this is built around South African businesses and South African audiences." },
  { title: "Small team, direct accountability", body: "No layers between a decision and the person who made it. If something's wrong, you're talking to the person who can actually fix it." },
];

// The underlying beliefs behind the principles above — carried over from
// the standalone Mission page's "What we believe" section, kept in its
// original numbered-list format as a closing subsection here.
const BELIEFS = [
  "Every business deserves real local reach — not just the ones with the budget for a national ad campaign.",
  "Trust has to be earned placement by placement, not assumed from a follower count or a badge.",
  "Local still matters, even in a world of global feeds and national platforms.",
  "The best technology gets out of the way — it shouldn't add a layer between a business and the audience it's trying to reach.",
];

const CHANNELS = getAllChannels().map(({ definition: ch }) => ({
  slug: ch.slug,
  name: ch.name,
  body: ch.tagline,
}));

const COMPARISON = [
  { us: "You know exactly who's featuring you and why they fit your customers.", them: "Your ad competes for attention inside an anonymous feed algorithm." },
  { us: "Publishers are manually checked before they're ever listed.", them: "Reach numbers are self-reported and can't always be verified." },
  { us: "Every request goes through a real person who reviews and approves it.", them: "Placement is decided by a bidding system, not a relationship." },
  { us: "Local, trusted channels your customers already follow.", them: "Increasingly blocked by ad blockers and ignored by banner blindness." },
];

// Roadmap content, carried over from the standalone Roadmap page.
const NOW = [
  "11 live advertising channels — social media, influencer, website, podcast, radio, sports, events, community, associations, restaurants, and in-venue screens",
  "The two development channels are Minibus Taxi & Transport Media and Spaza Shops & Township Traders.",
  "Held payments, with a publisher paid out within 48 hours of going live",
  "Manual publisher verification and automated authenticity checks on every listing",
  "Self-serve applications for both businesses and publishers, with no minimum spend or contract",
  "A dispute process for when a campaign doesn't go as agreed",
  "Business and Publisher Success Centres, a live Transparency page, and an ecosystem of partner and advertising options",
];

const NEXT = [
  {
    title: "More channel categories",
    body: "The platform's own channel taxonomy already has room for print (newspaper, magazine), outdoor (digital billboards, events), and direct (SMS, email) — categories defined in the codebase today with no channels live in them yet. Which of these actually gets built depends on where real demand shows up first.",
  },
  {
    title: "Deeper integrations",
    body: "Technology Partners are already part of the ecosystem (see Partners); a public API and documented integration points are a natural next step, not yet built.",
  },
  {
    title: "Programmatic buying",
    body: "Algorithm-driven, automated placement buying is a defined category in the platform's channel taxonomy, alongside the manually-reviewed model that exists today.",
  },
];

export default function About() {
  // "Proof before promises" above is a principle; this section is what
  // makes it checkable — real counts, pulled from the same publicly
  // readable data Browse and each publisher profile already show (RLS:
  // reviews_select_public, and the same approved-publishers count Browse
  // uses), not a claim anyone has to take on faith. When there's nothing
  // real yet, it says so plainly instead of showing an empty "0" that
  // reads as broken.
  //
  // Bug fix: the original queries never checked for `error`, so a failed
  // fetch silently fell back to `count ?? 0` and rendered the "no
  // campaigns yet" empty state even when the request simply failed rather
  // than genuinely returning zero rows. Both queries below now bail out
  // on error and leave the state as `null`, which renders nothing instead
  // of a false "zero".
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [publisherCount, setPublisherCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from("reviews").select("rating", { count: "exact" }).then(({ data, count, error }) => {
      if (error) return;
      setReviewCount(count ?? 0);
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + (r.rating ?? 0), 0) / data.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
    });
    // publishers_public (schema_phase82) — this count query used to rely
    // on publishers_select_approved_or_own_or_admin's approved branch,
    // which no longer exists on the base table; the view is approved-only
    // already, so the .eq("status", "approved") filter is dropped too.
    supabase.from("publishers_public").select("id", { count: "exact", head: true }).then(({ count, error }) => {
      if (error) return;
      setPublisherCount(count ?? 0);
    });
  }, []);

  return (
    <div>
      <Seo
        title="About · ChatSched"
        description="Why ChatSched exists, our mission and principles, what's live today and what's next — real audiences, direct dealing, proof before promises."
      />

      {/* Hero */}
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">About</span>
          <h1 className="text-3xl md:text-4xl mb-5">Every audience worth reaching already exists locally.</h1>
          <p className="text-lg text-billboard-inkSoft">
            South African businesses want to reach real local audiences, and the people who've built those audiences — on social pages, as influencers, through websites, podcasts and radio — want to be found and booked properly. ChatSched helps them find each other and keeps the campaign request, communication and proof inside one tracked workflow.
          </p>
        </div>
      </section>

      {/* Mission & Vision (merged from the standalone Mission page) */}
      <section id="mission" className="max-w-3xl mx-auto px-5 py-16">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">Our mission</span>
        <h2 className="font-display text-xl mt-2 mb-3">Make it possible for any South African business — not just the ones with an ad budget — to reach a real local audience, directly.</h2>
        <div className="mt-8">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">Vision</span>
          <h3 className="font-display text-lg mt-2 mb-3">Build the infrastructure connecting businesses with trusted audiences.</h3>
          <p className="text-billboard-inkSoft max-w-xl">Not another ad platform bolted onto someone else's feed — the underlying layer that makes finding, booking and trusting a local audience as simple as it should already be. If we get this right, reaching your own neighbourhood becomes as easy as reaching anyone else, anywhere.</p>
        </div>
      </section>

      {/* Platform story: the channel types */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-2">One marketplace, local reach across multiple channel types</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">Businesses submit a request, the publisher reviews it, and the creator schedules and executes the placement — the same simple flow across every channel. <strong>{CHANNELS.filter((c) => isChannelEnabled(c.slug)).length} channel types are live today.</strong> Only the two development channels remain outside the live marketplace.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {CHANNELS.map((c) => (
            <div key={c.name} className="border-[3px] border-billboard-ink rounded p-4 bg-white transition hover:-translate-y-1 hover:shadow-blockSm">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-bold text-sm">{c.name}</h3>
                <span className={`shrink-0 border px-1.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide ${
                  isChannelEnabled(c.slug)
                    ? "border-billboard-greenDeep/40 text-billboard-greenDeep bg-billboard-green/10"
                    : "border-billboard-inkSoft/40 text-billboard-inkSoft bg-billboard-paperDim"
                }`}>
                  {isChannelEnabled(c.slug) ? "Live" : "Coming soon"}
                </span>
              </div>
              <p className="text-xs text-billboard-inkSoft">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dual CTAs */}
      <section className="bg-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="font-display text-xl mb-8 text-billboard-paper text-center">Apply as whichever side you are</h2>
          <div className="grid md:grid-cols-2 gap-5">
            <Link
              to="/register?role=business"
              className="group block border-[3px] border-billboard-ink rounded-lg p-7 bg-billboard-yellow transition hover:-translate-y-1 hover:shadow-block"
            >
              <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-white px-2.5 py-1 rounded mb-4">Business / Advertiser</span>
              <h3 className="font-display text-lg mb-2">Get featured by real local channels</h3>
              <p className="text-sm text-billboard-inkSoft mb-4">Browse publishers, submit a feature request, and track it through to live.</p>
              <span className="font-bold text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all">Apply as a business →</span>
            </Link>
            <Link
              to="/register?role=publisher"
              className="group block border-[3px] border-billboard-ink rounded-lg p-7 bg-white transition hover:-translate-y-1 hover:shadow-block"
            >
              <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paperDim px-2.5 py-1 rounded mb-4">Publisher / Creator</span>
              <h3 className="font-display text-lg mb-2">Get booked for the audience you've built</h3>
              <p className="text-sm text-billboard-inkSoft mb-4">List your channel, review requests in your dashboard, and approve what fits.</p>
              <span className="font-bold text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all">Apply as a publisher →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* What we believe — expanded: merged principles + the underlying beliefs */}
      <section id="what-we-believe" className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-8">What we believe</h2>
        <div className="space-y-6">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="border-l-4 border-billboard-green pl-5">
              <h3 className="font-bold mb-1">{p.title}</h3>
              <p className="text-billboard-inkSoft text-sm">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">What we believe</span>
          <h3 className="font-display text-lg mt-2 mb-8">The thinking underneath all of it.</h3>
          <div className="space-y-4">
            {BELIEFS.map((b, i) => (
              <div key={b} className="flex gap-4 items-start border-b-2 border-billboard-paperDim pb-4 last:border-b-0">
                <span className="font-display text-lg text-billboard-yellowDeep shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-billboard-inkSoft">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketplace vs social ad platforms comparison */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="font-display text-xl mb-2">A direct marketplace, not an ad platform</h2>
          <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">How booking through real local publishers compares to running ads on a social media platform.</p>
          <div className="border-[3px] border-billboard-ink rounded-lg overflow-hidden bg-white">
            <div className="grid grid-cols-2">
              <div className="bg-billboard-green text-white font-display text-sm md:text-base px-4 py-3 text-center">ChatSched</div>
              <div className="bg-billboard-inkSoft text-white font-display text-sm md:text-base px-4 py-3 text-center border-l-[3px] border-billboard-ink">Social Ad Platforms</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={i} className={`grid grid-cols-2 ${i !== COMPARISON.length - 1 ? "border-b-2 border-billboard-ink/15" : ""}`}>
                <div className="p-4 md:p-5 text-sm flex items-start gap-2.5 transition-colors hover:bg-billboard-green/5">
                  <span className="text-billboard-green mt-0.5 shrink-0">✓</span>
                  <span>{row.us}</span>
                </div>
                <div className="p-4 md:p-5 text-sm flex items-start gap-2.5 border-l-2 border-billboard-ink/15 text-billboard-inkSoft transition-colors hover:bg-billboard-red/5">
                  <span className="text-billboard-red mt-0.5 shrink-0">✕</span>
                  <span>{row.them}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap (merged from the standalone Roadmap page) */}
      <section id="roadmap" className="max-w-3xl mx-auto px-5 py-16">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">Roadmap</span>
        <h2 className="font-display text-xl mt-2 mb-2">Where ChatSched is today, and where it's headed.</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">A direction, not a promise — what's live now, and the areas being actively explored next. No committed dates, because we'd rather ship something real than hit a deadline we made up.</p>

        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-greenDeep">Now</span>
        <h3 className="font-display text-lg mt-2 mb-6">What's live today.</h3>
        <ul className="space-y-3 mb-12">
          {NOW.map((item) => (
            <li key={item} className="flex gap-3 items-start">
              <span className="font-display text-billboard-greenDeep shrink-0 mt-0.5">✓</span>
              <span className="text-billboard-inkSoft">{item}</span>
            </li>
          ))}
        </ul>

        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-yellowDeep">Next</span>
        <h3 className="font-display text-lg mt-2 mb-8">What's being explored.</h3>
        <div className="space-y-5">
          {NEXT.map((item) => (
            <div key={item.title} className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
              <h4 className="font-bold mb-1.5">{item.title}</h4>
              <p className="text-sm text-billboard-inkSoft">{item.body}</p>
            </div>
          ))}
        </div>

        <p className="text-billboard-inkSoft text-sm mt-10">This roadmap reflects direction, not a shipping schedule — priorities shift as real usage shows what actually matters.</p>
      </section>

      {/* Real numbers, updated live */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-3">Real numbers, updated live — not a projection.</h2>
        {reviewCount === null ? null : reviewCount === 0 ? (
          <p className="text-billboard-inkSoft border-l-4 border-billboard-yellow pl-5">
            No completed campaigns yet — we're that early. This section fills in with real numbers as real businesses and publishers come through, not before.
          </p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="border-[3px] border-billboard-ink rounded p-5 bg-white">
              <p className="text-2xl font-bold">{publisherCount ?? "—"}</p>
              <p className="text-xs text-billboard-inkSoft mt-1">Approved publishers</p>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-5 bg-white">
              <p className="text-2xl font-bold">{reviewCount}</p>
              <p className="text-xs text-billboard-inkSoft mt-1">Reviews from real campaigns</p>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-5 bg-white">
              <p className="text-2xl font-bold">{avgRating ? `★ ${avgRating}` : "—"}</p>
              <p className="text-xs text-billboard-inkSoft mt-1">Average rating</p>
            </div>
          </div>
        )}
      </section>

      {/* Where we are right now + closing CTAs */}
      <section className="bg-billboard-paperDim border-t-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-xl mb-3">Where we are right now</h2>
          <p className="text-billboard-inkSoft mb-6">
            We're live across South Africa, onboarding businesses and publishers personally. If something breaks or feels rough around the edges, it's because we're still building it in the open — tell us, and we'll fix it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded bg-white">Browse Advertising →</Link>
            <Link to="/contact" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded bg-billboard-yellow">Get in touch →</Link>
            <Link to="/investors" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded bg-white">Company Overview →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
