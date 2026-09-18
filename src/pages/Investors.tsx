import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { CONTACT_EMAIL } from "../lib/constants";

const FLOW = [
  { label: "Businesses", body: "Local businesses looking for an audience that's already paying attention." },
  { label: "Publishers", body: "Social pages, influencers, websites, podcasts and radio slots with real, reviewed audiences." },
  { label: "Campaigns", body: "A request becomes a scheduled placement, tracked through to live and paid." },
];

export default function Investors() {
  return (
    <div>
      <Seo title="Investors · ChatSched" description="Company overview — the problem ChatSched solves, how the marketplace works, and where it's headed." />

      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">Company overview</span>
          <h1 className="text-3xl md:text-4xl mb-5">Local advertising, built as a marketplace.</h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl">A short overview of the problem ChatSched solves, how the marketplace works, and where it's headed.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-red">Problem</span>
            <h2 className="font-display text-xl mt-2 mb-3">Small businesses struggle to find local audiences.</h2>
            <p className="text-billboard-inkSoft">Reaching the right customers nearby means guessing at ad platforms built for national scale, or relying on word of mouth — neither is built for a local business trying to reach a local audience.</p>
          </div>
          <div>
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-green">Solution</span>
            <h2 className="font-display text-xl mt-2 mb-3">ChatSched connects businesses with publishers who already have those audiences.</h2>
            <p className="text-billboard-inkSoft">Social pages, creators, websites, podcasts and radio slots — every one of them already has a local audience paying attention. ChatSched is the layer that connects a business to the right one.</p>
          </div>
        </div>
      </section>

      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">Marketplace</span>
          <h2 className="font-display text-xl mt-2 mb-8">Businesses → Publishers → Campaigns.</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {FLOW.map((step, i) => (
              <div key={step.label} className="relative">
                <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper h-full">
                  <span className="font-display text-lg block mb-2">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-bold mb-1.5">{step.label}</h3>
                  <p className="text-sm text-billboard-inkSoft">{step.body}</p>
                </div>
                {i < FLOW.length - 1 && (
                  <span className="hidden sm:block absolute top-1/2 -right-4 -translate-y-1/2 font-display text-xl text-billboard-ink z-10">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-yellowDeep">Vision</span>
        <h2 className="font-display text-xl mt-2 mb-3">Build the infrastructure connecting businesses with trusted audiences.</h2>
        <p className="text-billboard-inkSoft max-w-xl">Not another ad platform bolted onto someone else's feed — the underlying layer that makes finding, booking and trusting a local audience as simple as it should already be.</p>
      </section>

      <section className="max-w-3xl mx-auto px-5 pb-20">
        <div className="border-[3px] border-billboard-ink rounded p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg mb-1">Interested in ChatSched's story?</h2>
            <p className="text-sm text-billboard-inkSoft">Get in touch and we'll share more — or reach us directly at {CONTACT_EMAIL}.</p>
          </div>
          <Link to="/contact" className="inline-block bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition shrink-0 text-center">
            Get in touch →
          </Link>
        </div>
      </section>
    </div>
  );
}
