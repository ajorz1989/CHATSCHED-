import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase } from "../lib/supabase";
import type { OpportunityType } from "../lib/types";

const FALLBACK_TYPES = [
  "Newsletter Sponsorship",
  "School Partnership",
  "Event Sponsorship",
  "In-Venue Screen Display",
  "Influencer Product Placement",
  "Radio / Podcast Spot",
  "Sports Sponsorship",
  "Website Advertising",
  "Community Sponsorship",
  "Social Media Promotion",
  "Restaurant Promotion",
  "Transport Advertising",
  "Association Sponsorship",
  "Retail Promotion",
  "Brand Partnership",
];

const V2_FEATURES = [
  {
    number: "01",
    title: "Structured briefs",
    body: "Set the opportunity type, channel, location, audience, budget, publisher capacity, deadlines and campaign dates.",
  },
  {
    number: "02",
    title: "Smart matching",
    body: "Eligible publishers are scored using channel fit, geography, audience signals, budget fit and the opportunity brief.",
  },
  {
    number: "03",
    title: "Better campaign detail",
    body: "Businesses can spell out deliverables and publisher requirements before proposals arrive.",
  },
  {
    number: "04",
    title: "Tracked proposals",
    body: "Publishers submit a proposal and price inside ChatSched. Selected proposals move into the normal booking workflow.",
  },
  {
    number: "05",
    title: "Deadline-aware",
    body: "Application deadlines and campaign windows help both sides see when an opportunity is still actionable.",
  },
  {
    number: "06",
    title: "ChatSched stays in the middle",
    body: "Private contact details are not exposed as part of opportunity discovery, proposal submission or selection.",
  },
];

export default function Opportunities() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/opportunities/feed";
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const [opportunityTypes, setOpportunityTypes] = useState<string[]>(FALLBACK_TYPES);

  useEffect(() => {
    let active = true;

    async function loadTypes() {
      const { data } = await supabase
        .from("opportunity_types")
        .select("slug,label,description,suggested_channel_slug,active")
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (!active || !data?.length) return;

      setOpportunityTypes(
        (data as OpportunityType[]).map((type) => type.label).filter(Boolean),
      );
    }

    loadTypes();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <Seo
        title="Advertising Opportunities · ChatSched"
        description="ChatSched Opportunities V2 connects verified businesses with relevant publishers through structured advertising and sponsorship briefs, smart matching, deadlines and on-platform proposals."
      />

      <section className="bg-billboard-green text-white border-b-[3px] border-billboard-ink py-16 md:py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-5">
                Opportunities V2
              </span>
              <h1 className="font-display text-5xl md:text-7xl leading-[.96] mb-5">
                Turn a marketing need into a matched advertising opportunity.
              </h1>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-8">
                Businesses publish structured advertising and sponsorship briefs. Verified publishers discover opportunities matched to their channel, audience and location. ChatSched keeps the proposal and booking process inside the platform.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={loginHref}
                  className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
                >
                  Explore opportunities →
                </Link>
                <Link
                  to="/register?role=business"
                  className="inline-flex items-center gap-2 border-[3px] border-white/70 text-white font-semibold px-5 py-3 rounded hover:bg-white/10 transition"
                >
                  Post a brief
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 mt-7">
                {["15 opportunity types", "Smart publisher matching", "Deadlines + campaign windows", "On-platform proposals"].map((item) => (
                  <span
                    key={item}
                    className="font-mono text-[10px] uppercase tracking-wide border border-white/30 bg-white/10 rounded-full px-3 py-1.5"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="border-[3px] border-billboard-yellow rounded-xl bg-white/5 p-5 shadow-block rotate-1">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/70">V2 opportunity brief</span>
                  <span className="font-mono text-[10px] font-bold uppercase bg-billboard-yellow text-billboard-ink px-2 py-1 rounded">
                    OPEN
                  </span>
                </div>

                <div className="border-2 border-white/20 rounded-lg p-4 bg-white/5 mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono text-billboard-yellow mb-1">Event Sponsorship</div>
                      <div className="font-display text-xl">Local brand partner needed</div>
                    </div>
                    <span className="font-mono text-[9px] font-bold uppercase border border-billboard-yellow text-billboard-yellow px-2 py-1 rounded">
                      MATCH 92
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-white/70">
                    <span>Cape Town · Events</span>
                    <span>Budget: R5k–R12k</span>
                    <span>Applications: 14 Oct</span>
                    <span>Campaign: 20–27 Oct</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["AUDIENCE", "Local families"],
                    ["SUPPLY", "3 publishers"],
                    ["FLOW", "Proposal → booking"],
                  ].map(([label, value]) => (
                    <div key={label} className="border-2 border-white/15 rounded-lg p-3 bg-white/[0.03]">
                      <div className="font-mono text-[9px] text-white/50">{label}</div>
                      <div className="font-semibold text-xs mt-1">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute -bottom-4 -right-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink rounded-lg px-4 py-2 font-mono text-[10px] font-bold uppercase -rotate-2">
                Private contact details stay private
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 bg-white border-b-[3px] border-billboard-ink">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
            <div className="max-w-2xl">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Opportunity catalogue</span>
              <h2 className="font-display text-3xl md:text-4xl mt-2 mb-2">
                One engine. Multiple advertising opportunities.
              </h2>
              <p className="text-billboard-inkSoft">
                ChatSched V2 supports a broader range of digital, physical, community, events, sports and sponsorship briefs.
              </p>
            </div>
            <div className="font-mono text-xs uppercase tracking-wide border-2 border-billboard-ink rounded px-3 py-2 bg-billboard-paperDim">
              {opportunityTypes.length} active opportunity types
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunityTypes.map((label, index) => (
              <div
                key={label}
                className="border-[2px] border-billboard-ink rounded-lg p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
              >
                <div className="font-mono text-[10px] text-billboard-green font-bold mb-1">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="font-semibold">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
        <div className="max-w-6xl mx-auto px-5">
          <div className="max-w-2xl mb-9">
            <span className="font-mono text-xs font-bold uppercase tracking-wider">What changed in V2</span>
            <h2 className="font-display text-3xl md:text-4xl mt-2 mb-3">
              More structure before the first proposal.
            </h2>
            <p className="text-billboard-inkSoft">
              The upgraded engine gives businesses and publishers more useful information before a proposal is made, while keeping the marketplace workflow controlled by ChatSched.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {V2_FEATURES.map((feature) => (
              <div key={feature.number} className="border-[3px] border-billboard-ink rounded-xl p-5 bg-white">
                <div className="font-display text-3xl text-billboard-green mb-3">{feature.number}</div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-billboard-inkSoft">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b-[3px] border-billboard-ink">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="border-[3px] border-billboard-ink rounded-xl p-7 bg-billboard-yellow shadow-blockSm">
              <span className="font-mono text-xs font-bold uppercase">For businesses</span>
              <h2 className="font-display text-3xl mt-3 mb-3">Publish the opportunity. Let the supply come to you.</h2>
              <p className="text-billboard-inkSoft mb-5">
                Create a structured brief with the opportunity type, channel, audience, location, budget, timing, deliverables, requirements and publisher capacity.
              </p>
              <div className="space-y-2 text-sm">
                <div>✓ Choose from the active opportunity catalogue.</div>
                <div>✓ Set an application deadline and campaign window.</div>
                <div>✓ Review publisher proposals in ChatSched.</div>
                <div>✓ Accept proposals into the normal booking flow.</div>
              </div>
              <Link to="/register?role=business" className="inline-flex mt-6 border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-2.5 rounded">
                Create a business account →
              </Link>
            </div>

            <div className="border-[3px] border-billboard-ink rounded-xl p-7 bg-billboard-paper shadow-blockSm">
              <span className="font-mono text-xs font-bold uppercase">For publishers</span>
              <h2 className="font-display text-3xl mt-3 mb-3">See briefs that fit your inventory.</h2>
              <p className="text-billboard-inkSoft mb-5">
                Verified publishers can browse open briefs, search by opportunity type or location, review the budget and campaign details, and submit a proposal without exposing private contact details.
              </p>
              <div className="space-y-2 text-sm">
                <div>✓ Match scores help surface relevant briefs.</div>
                <div>✓ Review deliverables and publisher requirements before applying.</div>
                <div>✓ See deadlines and campaign dates before proposing.</div>
                <div>✓ Track your applications from one workspace.</div>
              </div>
              <Link to="/register?role=publisher" className="inline-flex mt-6 border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-5 py-2.5 rounded">
                Join as a Publisher →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-billboard-green text-white border-b-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          <div className="max-w-2xl mb-9">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-billboard-yellow">Workflow</span>
            <h2 className="font-display text-3xl md:text-4xl mt-2 mb-3">One brief. Relevant supply. One tracked conversation.</h2>
            <p className="text-white/75">
              Opportunities complement the normal request and channel booking flows. The public page explains the system; verified members access the actual briefs.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              ["01", "Business posts", "Define the objective, opportunity type, audience, channel, location, timing, budget and requirements."],
              ["02", "ChatSched matches", "The engine scores eligible publishers using channel, geography, audience, budget and brief signals."],
              ["03", "Publisher proposes", "A verified publisher submits a proposal, placement method and amount through ChatSched."],
              ["04", "Selection becomes a booking", "Acceptance creates the normal request or channel booking so the established campaign/payment workflow can continue."],
            ].map(([number, title, body]) => (
              <div key={number} className="border-[2px] border-white/25 rounded-lg p-5 bg-white/5">
                <div className="font-display text-3xl text-billboard-yellow mb-3">{number}</div>
                <h3 className="font-bold mb-1.5">{title}</h3>
                <p className="text-sm text-white/70">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-yellow">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <span className="font-mono text-xs uppercase tracking-wider text-billboard-yellow">Member access</span>
          <h2 className="font-display text-3xl md:text-5xl mt-2 mb-4">
            Public explanation. Private opportunity workspace.
          </h2>
          <p className="text-billboard-paperDim max-w-2xl mx-auto mb-7">
            Real opportunities are available inside ChatSched to eligible verified members. Businesses can publish briefs; publishers can discover, match and propose against them.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={loginHref} className="inline-flex border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded">
              Log in to Opportunities →
            </Link>
            <Link to="/for-publishers" className="inline-flex border-[3px] border-white/40 text-white font-semibold px-6 py-3 rounded">
              See publisher benefits
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
