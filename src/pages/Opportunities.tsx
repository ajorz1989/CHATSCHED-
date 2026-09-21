import { Link, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo";

export default function Opportunities() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/opportunities/feed";
  const loginHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <div>
      <Seo
        title="Opportunities · ChatSched"
        description="Discover advertising and sponsorship opportunities on ChatSched. Businesses publish targeted briefs and publishers find relevant briefs without exposing private contact details."
      />

      <section className="bg-billboard-green text-white border-b-[3px] border-billboard-ink py-16 md:py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-5">
                Opportunities
              </span>
              <h1 className="font-display text-5xl md:text-7xl leading-[.98] mb-5">
                Where real advertising needs meet the right local supply.
              </h1>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-8">
                Businesses publish targeted advertising or sponsorship briefs. Publishers discover opportunities that fit their channel, audience and location. ChatSched keeps proposals and communication on-platform.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={loginHref}
                  className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
                >
                  View available opportunities →
                </Link>
                <Link
                  to="/register?role=business"
                  className="inline-flex items-center gap-2 border-[3px] border-white/70 text-white font-semibold px-5 py-3 rounded hover:bg-white/10 transition"
                >
                  Post a business brief
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="border-[3px] border-billboard-yellow rounded-xl bg-white/5 p-5 shadow-block rotate-1">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/70">Sample opportunity board</span>
                  <span className="font-mono text-[10px] font-bold uppercase bg-billboard-yellow text-billboard-ink px-2 py-1 rounded">OPEN BRIEF</span>
                </div>
                <div className="space-y-3">
                  <div className="border-2 border-white/20 rounded-lg p-4 bg-white/5">
                    <div className="text-xs font-mono text-billboard-yellow mb-1">Event sponsorship</div>
                    <div className="font-display text-lg">Local brand partner needed</div>
                    <div className="text-xs text-white/70 mt-2">Cape Town · Events · Custom budget</div>
                  </div>
                  <div className="border-2 border-white/20 rounded-lg p-4 bg-white/5">
                    <div className="text-xs font-mono text-billboard-yellow mb-1">Newsletter sponsorship</div>
                    <div className="font-display text-lg">Reach a focused business audience</div>
                    <div className="text-xs text-white/70 mt-2">South Africa · Associations · Verified brief</div>
                  </div>
                  <div className="border-2 border-white/20 rounded-lg p-4 bg-white/5">
                    <div className="text-xs font-mono text-billboard-yellow mb-1">In-venue display</div>
                    <div className="font-display text-lg">Local screen placement</div>
                    <div className="text-xs text-white/70 mt-2">Neighbourhood targeting · Physical media</div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink rounded-lg px-4 py-2 font-mono text-[10px] font-bold uppercase -rotate-2">
                Private contact details stay private
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b-[3px] border-billboard-ink">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="border-[3px] border-billboard-ink rounded-xl p-7 bg-billboard-yellow shadow-blockSm">
              <span className="font-mono text-xs font-bold uppercase">For businesses</span>
              <h2 className="font-display text-3xl mt-3 mb-3">Turn a marketing need into a clear brief.</h2>
              <p className="text-billboard-inkSoft mb-5">
                Need a school partnership, event sponsor, newsletter placement, influencer product placement, radio or podcast spot, or another live channel opportunity? Publish the requirement and let eligible publishers respond.
              </p>
              <ul className="space-y-2 text-sm">
                <li>✓ Define the audience, location, timing and budget.</li>
                <li>✓ Receive relevant proposals through ChatSched.</li>
                <li>✓ Keep communication, approvals and next steps in one workflow.</li>
              </ul>
              <Link to="/register?role=business" className="inline-flex mt-6 border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-2.5 rounded">
                Create a business account →
              </Link>
            </div>

            <div className="border-[3px] border-billboard-ink rounded-xl p-7 bg-billboard-paper shadow-blockSm">
              <span className="font-mono text-xs font-bold uppercase">For publishers</span>
              <h2 className="font-display text-3xl mt-3 mb-3">Find briefs that actually fit your inventory.</h2>
              <p className="text-billboard-inkSoft mb-5">
                Explore opportunities that match your channel, audience, geography and strengths. Respond without exposing your private contact details or moving the conversation off-platform.
              </p>
              <ul className="space-y-2 text-sm">
                <li>✓ Discover briefs beyond inbound profile requests.</li>
                <li>✓ Pitch for opportunities that fit your audience.</li>
                <li>✓ Build a track record through completed campaigns.</li>
              </ul>
              <Link to="/register?role=publisher" className="inline-flex mt-6 border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-5 py-2.5 rounded">
                Join as a Publisher →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          <div className="max-w-2xl mb-9">
            <span className="font-mono text-xs font-bold uppercase tracking-wider">How opportunities work</span>
            <h2 className="font-display text-3xl md:text-4xl mt-2 mb-3">One brief. Relevant supply. One tracked conversation.</h2>
            <p className="text-billboard-inkSoft">
              Opportunities complement the normal request flow. A business can publish a need, eligible publishers can respond, and the parties can keep the proposal process inside ChatSched.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              ["01", "Business posts", "Define the objective, audience, channel, location, timing and budget."],
              ["02", "Publishers discover", "Eligible publishers see opportunities relevant to their inventory."],
              ["03", "Proposal stays inside", "Questions, proposals and next steps stay on-platform."],
              ["04", "Campaign moves forward", "Once selected, the normal ChatSched campaign and payment workflow takes over."],
            ].map(([n, title, body]) => (
              <div key={n} className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
                <div className="font-display text-3xl text-billboard-green mb-3">{n}</div>
                <h3 className="font-bold mb-1.5">{title}</h3>
                <p className="text-sm text-billboard-inkSoft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-yellow">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h2 className="font-display text-3xl md:text-5xl mb-4">The public page explains the model. Verified members see the actual briefs.</h2>
          <p className="text-billboard-paperDim max-w-2xl mx-auto mb-7">
            Create or verify the relevant account, then use the Opportunities workspace to view or publish real briefs.
          </p>
          <Link to={loginHref} className="inline-flex border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded">
            Log in to Opportunities →
          </Link>
        </div>
      </section>
    </div>
  );
}
