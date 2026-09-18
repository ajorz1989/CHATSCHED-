import { Link } from "react-router-dom";
import Seo from "../components/Seo";

const NOW = [
  "12 live advertising channels — social media, influencer, website, podcast, radio, sports, events, community, transport, informal retail, associations, and restaurants",
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

export default function Roadmap() {
  return (
    <div>
      <Seo title="Roadmap · ChatSched" description="What's live on ChatSched today, and the directions being explored next — more channel categories, deeper integrations, and programmatic buying." />

      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">Roadmap</span>
          <h1 className="text-3xl md:text-4xl mb-5">Where ChatSched is today, and where it's headed.</h1>
          <p className="text-lg text-billboard-paperDim/90 max-w-xl">A direction, not a promise — what's live now, and the areas being actively explored next. No committed dates, because we'd rather ship something real than hit a deadline we made up.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-greenDeep">Now</span>
        <h2 className="font-display text-xl mt-2 mb-6">What's live today.</h2>
        <ul className="space-y-3">
          {NOW.map((item) => (
            <li key={item} className="flex gap-3 items-start">
              <span className="font-display text-billboard-greenDeep shrink-0 mt-0.5">✓</span>
              <span className="text-billboard-inkSoft">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-yellowDeep">Next</span>
          <h2 className="font-display text-xl mt-2 mb-8">What's being explored.</h2>
          <div className="space-y-5">
            {NEXT.map((item) => (
              <div key={item.title} className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper">
                <h3 className="font-bold mb-1.5">{item.title}</h3>
                <p className="text-sm text-billboard-inkSoft">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 py-16 text-center">
        <p className="text-billboard-inkSoft max-w-xl mx-auto mb-6">This roadmap reflects direction, not a shipping schedule — priorities shift as real usage shows what actually matters. For the thinking behind it, see the mission and vision.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/mission" className="inline-block border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition">Our Mission</Link>
          <Link to="/investors" className="inline-block bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition">Company Overview</Link>
        </div>
      </section>
    </div>
  );
}
