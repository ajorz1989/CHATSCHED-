import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const PRINCIPLES = [
  { title: "Real audiences, not vanity metrics", body: "We manually check every channel before it's listed. A follower count means nothing if nobody's actually looking." },
  { title: "On-platform, in the open", body: "Businesses and publishers work through a clear request-and-approve process inside ChatSched — no black box, no hidden hand-off." },
  { title: "Proof before promises", body: "We're not pretending to be bigger than we are. We're proving this works, one real channel and one real business at a time, before we automate anything." },
];

const CHANNELS = [
  { name: "Social Media", body: "Pages and groups with real, engaged local followings." },
  { name: "Influencers", body: "Creators with an audience that trusts their recommendation." },
  { name: "Websites", body: "Local sites with steady, relevant traffic." },
  { name: "Podcasts", body: "Shows with listeners who stick around for the whole episode." },
  { name: "Radio", body: "Local stations reaching a broad, local audience." },
  { name: "Sports Teams & Leagues", body: "Reach a team's fans through the club itself, not a proxy." },
  { name: "Events & Tournaments", body: "Sponsor the moment, not just the medium." },
  { name: "Community Groups", body: "Reach a community through someone it already trusts." },
  { name: "Minibus Taxi & Transport Media", body: "The route your customers already take, every day." },
  { name: "Spaza Shops & Township Traders", body: "The shop on the corner your customers already trust." },
  { name: "Local Associations & Business Networks", body: "Reach decision-makers through the network they already belong to." },
  { name: "Restaurants & Cafés", body: "The table your customers already sit at." },
];

const COMPARISON = [
  { us: "You know exactly who's featuring you and why they fit your customers.", them: "Your ad competes for attention inside an anonymous feed algorithm." },
  { us: "Publishers are manually checked before they're ever listed.", them: "Reach numbers are self-reported and can't always be verified." },
  { us: "Every request goes through a real person who reviews and approves it.", them: "Placement is decided by a bidding system, not a relationship." },
  { us: "Local, trusted channels your customers already follow.", them: "Increasingly blocked by ad blockers and ignored by banner blindness." },
];

export default function About() {
  // "Proof before promises" above is a principle; this section is what
  // makes it checkable — real counts, pulled from the same publicly
  // readable data Browse and each publisher profile already show (RLS:
  // reviews_select_public, and the same approved-publishers count Browse
  // uses), not a claim anyone has to take on faith. When there's nothing
  // real yet, it says so plainly instead of showing an empty "0" that
  // reads as broken.
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [publisherCount, setPublisherCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from("reviews").select("rating", { count: "exact" }).then(({ data, count }) => {
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
    supabase.from("publishers_public").select("id", { count: "exact", head: true }).then(({ count }) => {
      setPublisherCount(count ?? 0);
    });
  }, []);

  return (
    <div>
      <Seo title="About · ChatSched" description="Why ChatSched exists, and the principles we build around: real audiences, direct dealing, proof before promises." />
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">About</span>
          <h1 className="text-3xl md:text-4xl mb-5">Every audience worth reaching already exists locally.</h1>
          <p className="text-lg text-billboard-inkSoft">
            South African businesses want to reach real local audiences, and the people who've built those audiences — on social pages, as influencers, through websites, podcasts and radio — want to be found and booked properly. ChatSched helps them find each other and keeps the campaign request, communication and proof inside one tracked workflow.
          </p>
        </div>
      </section>

      {/* Platform story: the twelve channels */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-2">One marketplace, local reach across multiple channel types</h2>
        <p className="text-billboard-inkSoft text-sm mb-8 max-w-xl">Businesses submit a request, the publisher reviews it, and the creator schedules and executes the placement — the same simple flow across every channel.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {CHANNELS.map((c) => (
            <div key={c.name} className="border-[3px] border-billboard-ink rounded p-4 bg-white transition hover:-translate-y-1 hover:shadow-blockSm">
              <h3 className="font-bold text-sm mb-1">{c.name}</h3>
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

      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-8">What we believe</h2>
        <div className="space-y-6">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="border-l-4 border-billboard-green pl-5">
              <h3 className="font-bold mb-1">{p.title}</h3>
              <p className="text-billboard-inkSoft text-sm">{p.body}</p>
            </div>
          ))}
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

      <section className="bg-billboard-paperDim border-t-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-xl mb-3">Where we are right now</h2>
          <p className="text-billboard-inkSoft mb-6">
            We're live across South Africa, onboarding businesses and publishers personally. If something breaks or feels rough around the edges, it's because we're still building it in the open — tell us, and we'll fix it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded bg-white">Browse Advertising →</Link>
            <Link to="/contact" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded bg-billboard-yellow">Get in touch →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
