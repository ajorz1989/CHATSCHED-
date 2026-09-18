import Seo from "../components/Seo";

const PRINCIPLES = [
  { title: "Real audiences, not vanity metrics", body: "Every publisher is reviewed before they're listed. A follower count means nothing on its own — an audience that actually pays attention does." },
  { title: "Fair by default", body: "Publishers keep the large majority of every placement. The people bringing the audience should be the ones benefiting most from it." },
  { title: "No lock-in", body: "No contracts, no minimum spend. Browsing and listing are always free — a subscription is only needed to send or approve a request, and you can cancel one any time." },
  { title: "Built for South Africa first", body: "Not a global platform adapted after the fact — every part of this is built around South African businesses and South African audiences." },
  { title: "Small team, direct accountability", body: "No layers between a decision and the person who made it. If something's wrong, you're talking to the person who can actually fix it." },
];

const BELIEFS = [
  "Every business deserves real local reach — not just the ones with the budget for a national ad campaign.",
  "Trust has to be earned placement by placement, not assumed from a follower count or a badge.",
  "Local still matters, even in a world of global feeds and national platforms.",
  "The best technology gets out of the way — it shouldn't add a layer between a business and the audience it's trying to reach.",
];

export default function Mission() {
  return (
    <div>
      <Seo title="Our Mission · ChatSched" description="Make local digital advertising accessible to every business — ChatSched's mission, vision, and the principles behind how we build." />

      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-4">Our mission</span>
          <h1 className="text-3xl md:text-4xl">Make it possible for any South African business — not just the ones with an ad budget — to reach a real local audience, directly.</h1>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">Vision</span>
        <h2 className="font-display text-xl mt-2 mb-3">Build the infrastructure connecting businesses with trusted audiences.</h2>
        <p className="text-billboard-inkSoft max-w-xl">Not another ad platform bolted onto someone else's feed — the underlying layer that makes finding, booking and trusting a local audience as simple as it should already be. If we get this right, reaching your own neighbourhood becomes as easy as reaching anyone else, anywhere.</p>
      </section>

      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">Principles</span>
          <h2 className="font-display text-xl mt-2 mb-8">How we build.</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper">
                <h3 className="font-bold mb-1.5">{p.title}</h3>
                <p className="text-sm text-billboard-inkSoft">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">What we believe</span>
        <h2 className="font-display text-xl mt-2 mb-8">The thinking underneath all of it.</h2>
        <div className="space-y-4">
          {BELIEFS.map((b, i) => (
            <div key={b} className="flex gap-4 items-start border-b-2 border-billboard-paperDim pb-4 last:border-b-0">
              <span className="font-display text-lg text-billboard-yellowDeep shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-billboard-inkSoft">{b}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
