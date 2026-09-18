import { useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { CheckIcon } from "../components/UiIcons";

type TabKey = "business" | "publisher";

const BUSINESS_STEPS = [
  { title: "Find your channel", body: "Browse social pages, influencers, websites, podcasts and radio slots by category, province and audience to find the match for your customers." },
  { title: "Submit a request", body: "Pick a publisher and send a feature request describing what you want to promote — no account or campaign manager required." },
  { title: "Track it through to live", body: "Watch your request move from submitted to reviewed to scheduled, with proof once it's live." },
];
const OWNER_STEPS = [
  { title: "List your channel", body: "Tell us your niche, audience and format. It's free to join, always." },
  { title: "Review requests", body: "Businesses find you through search and category browsing and send you a feature request to review in your dashboard." },
  { title: "Approve, schedule, execute", body: "Accept the requests that fit, schedule the placement, and mark it live once it's done." },
];

interface FlowScenario {
  chromeLabel: string;
  steps: { label: string; title: string }[];
  businessName: string;
  tags: string[];
  quote: string;
  dashboardLabel: string;
  statusDetail: string;
  confirmTitle: string;
  confirmDetail: string;
  liveMessage: string;
}

const FLOW_SCENARIOS: FlowScenario[] = [
  {
    chromeLabel: "Request flow · Social media",
    steps: [
      { label: "01", title: "Business submits a request" },
      { label: "02", title: "Publisher reviews it" },
      { label: "03", title: "Creator approves, schedules & executes" },
    ],
    businessName: "Bean & Bay Coffee Club",
    tags: ["Social Media", "Johannesburg"],
    quote: "\"Looking to feature our new autumn menu — flexible on timing this month.\"",
    dashboardLabel: "Publisher dashboard",
    statusDetail: "Social Media · Autumn menu feature",
    confirmTitle: "Placement scheduled",
    confirmDetail: "Set to go live this week",
    liveMessage: "Live now — proof sent to the business",
  },
  {
    chromeLabel: "Request flow · Influencer",
    steps: [
      { label: "01", title: "Business sends a channel request" },
      { label: "02", title: "Influencer reviews the brief" },
      { label: "03", title: "Influencer posts & marks it live" },
    ],
    businessName: "Sandton Nail Studio",
    tags: ["Influencer", "Johannesburg"],
    quote: "\"Short-form video reviewing our new gel-extension service, filmed in-studio.\"",
    dashboardLabel: "Influencer dashboard",
    statusDetail: "Influencer · Gel-extension review",
    confirmTitle: "Content scheduled",
    confirmDetail: "Filming booked for this week",
    liveMessage: "Live now — proof sent to the business",
  },
  {
    chromeLabel: "Request flow · Podcast",
    steps: [
      { label: "01", title: "Business submits a request" },
      { label: "02", title: "Host reviews the slot" },
      { label: "03", title: "Episode airs & host gets paid" },
    ],
    businessName: "Gqeberha Hardware Co.",
    tags: ["Podcast", "Eastern Cape"],
    quote: "\"Short host-read mention of our Saturday in-store sale, in this week's episode.\"",
    dashboardLabel: "Podcast host dashboard",
    statusDetail: "Podcast · Saturday sale mention",
    confirmTitle: "Slot confirmed",
    confirmDetail: "Airing in this week's episode",
    liveMessage: "Live now — proof sent to the business",
  },
];

const PROCESS_FAQS: Record<TabKey, { q: string; a: string }[]> = {
  business: [
    { q: "How do I know a channel's audience is real?", a: "We manually check every publisher before they're listed — real audience details, not just a follower count." },
    { q: "Do I need to sign a contract?", a: "No. Submit one request or many — there's no minimum commitment." },
    { q: "What happens after I submit a request?", a: "The publisher reviews it in their dashboard and can approve, decline, or ask a question before scheduling anything." },
    { q: "Which channels can I request?", a: "Social media pages and groups, influencers, websites, podcasts and radio slots — all through the same request flow." },
    { q: "Which cities are you in?", a: "We're live across South Africa — from Cape Town to Johannesburg, Durban, Pretoria and beyond." },
  ],
  publisher: [
    { q: "What does joining involve?", a: "Apply with your channel details, get reviewed, and once approved you start receiving requests in your dashboard." },
    { q: "Can I decline a request?", a: "Yes — every request is yours to accept, decline, or discuss before anything is scheduled." },
    { q: "Do I control scheduling?", a: "Yes. Once you approve a request, you choose when it goes live and mark it done yourself." },
    { q: "Is there a minimum audience size to apply?", a: "We review every application on its own merits — reach out and we'll walk you through it." },
    { q: "Which cities are you in?", a: "We're live across South Africa — from Cape Town to Johannesburg, Durban, Pretoria and beyond." },
  ],
};

function ChannelFlowMockup({ scenario }: { scenario: FlowScenario }) {
  const [active, setActive] = useState(0);

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg bg-white shadow-block overflow-hidden">
      <div className="bg-billboard-ink px-3.5 py-2.5 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#6b6250]" /><span className="w-2 h-2 rounded-full bg-[#6b6250]" /><span className="w-2 h-2 rounded-full bg-[#6b6250]" />
        <span className="ml-3 font-mono text-[10px] text-billboard-paper/70 uppercase tracking-wider">{scenario.chromeLabel}</span>
      </div>

      <div className="flex border-b-[3px] border-billboard-ink">
        {scenario.steps.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setActive(i)}
            className={`flex-1 px-3 py-3 text-left border-r-[3px] border-billboard-ink last:border-r-0 transition-colors ${
              active === i ? "bg-billboard-yellow" : "bg-billboard-paper hover:bg-billboard-paperDim"
            }`}
          >
            <div className="font-display text-lg mb-0.5" style={{ WebkitTextStroke: active === i ? "0" : "1px #1A1712", color: active === i ? "#1A1712" : "transparent" }}>{s.label}</div>
            <div className="text-xs font-bold leading-tight">{s.title}</div>
          </button>
        ))}
      </div>

      <div className="p-6 min-h-[220px] flex flex-col justify-center">
        {active === 0 && (
          <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim animate-[fadeIn_0.2s_ease]">
            <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">New feature request</div>
            <div className="font-bold mb-1">{scenario.businessName}</div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {scenario.tags.map((tag) => (
                <span key={tag} className="font-mono text-[10px] border border-billboard-ink rounded-full px-2 py-0.5 bg-white">{tag}</span>
              ))}
            </div>
            <div className="border-t-2 border-dashed border-billboard-ink/30 pt-3 text-sm text-billboard-inkSoft">{scenario.quote}</div>
            <button className="mt-4 font-mono text-xs font-bold border-2 border-billboard-ink rounded px-3 py-1.5 bg-billboard-yellow">Submit request →</button>
          </div>
        )}
        {active === 1 && (
          <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim animate-[fadeIn_0.2s_ease]">
            <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">{scenario.dashboardLabel}</div>
            <div className="flex items-center justify-between border-2 border-billboard-ink rounded p-3 bg-white">
              <div>
                <div className="font-bold text-sm">{scenario.businessName}</div>
                <div className="text-xs text-billboard-inkSoft">{scenario.statusDetail}</div>
              </div>
              <span className="font-mono text-[10px] font-bold uppercase bg-billboard-yellow border-2 border-billboard-ink rounded-full px-2 py-1">Pending review</span>
            </div>
            <div className="flex gap-2 mt-3">
              <span className="font-mono text-xs font-bold border-2 border-billboard-ink rounded px-3 py-1.5 bg-billboard-green text-white">Approve</span>
              <span className="font-mono text-xs font-bold border-2 border-billboard-ink rounded px-3 py-1.5 bg-white">Decline</span>
            </div>
          </div>
        )}
        {active === 2 && (
          <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim animate-[fadeIn_0.2s_ease]">
            <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">Scheduled &amp; executed</div>
            <div className="flex items-center gap-3 border-2 border-billboard-ink rounded p-3 bg-white">
              <div className="w-10 h-10 rounded-full bg-billboard-green flex items-center justify-center text-white shrink-0">
                <CheckIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm">{scenario.confirmTitle}</div>
                <div className="text-xs text-billboard-inkSoft">{scenario.confirmDetail}</div>
              </div>
            </div>
            <div className="mt-3 max-w-[85%] px-3 py-2 rounded-xl text-xs border-[1.5px] border-billboard-greenDeep bg-billboard-green text-white rounded-bl-sm flex items-center gap-1.5">
              {scenario.liveMessage} <CheckIcon className="w-3 h-3 shrink-0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FlowMockups() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const labels = ["Social media", "Influencer", "Podcast"];
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setScenarioIndex(i)}
            className={`font-mono text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border-2 transition ${
              scenarioIndex === i ? "border-billboard-ink bg-billboard-ink text-billboard-paper" : "border-billboard-ink/30 text-billboard-inkSoft hover:border-billboard-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ChannelFlowMockup scenario={FLOW_SCENARIOS[scenarioIndex]} />
    </div>
  );
}

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
      {items.map((f, i) => (
        <div key={f.q} className={i !== items.length - 1 ? "border-b-2 border-billboard-ink" : ""}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-billboard-paperDim transition-colors"
          >
            <span className="font-bold text-sm">{f.q}</span>
            <span className={`font-display text-lg shrink-0 transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
          </button>
          {open === i && (
            <div className="px-5 pb-4 text-sm text-billboard-inkSoft">{f.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HowItWorks() {
  const [tab, setTab] = useState<TabKey>("business");
  const steps = tab === "business" ? BUSINESS_STEPS : OWNER_STEPS;

  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <Seo title="How It Works · ChatSched" description="How businesses submit a feature request and how publishers review, approve and execute it — the simple version, for both sides." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">How it works</span>
      <h1 className="text-3xl md:text-4xl mb-8 max-w-xl">From first message to proof of results — here's exactly what happens.</h1>

      <div className="inline-flex border-[3px] border-billboard-ink rounded overflow-hidden mb-10">
        <button
          onClick={() => setTab("business")}
          className={`px-5 py-3 font-bold text-sm ${tab === "business" ? "bg-billboard-ink text-billboard-paper" : "bg-billboard-paper"}`}
        >
          For Businesses
        </button>
        <button
          onClick={() => setTab("publisher")}
          className={`px-5 py-3 font-bold text-sm border-l-[3px] border-billboard-ink ${tab === "publisher" ? "bg-billboard-ink text-billboard-paper" : "bg-billboard-paper"}`}
        >
          For Publishers &amp; Creators
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-16">
        {steps.map((s, i) => (
          <div key={s.title} className="border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-blockSm">
            <div className="font-display text-2xl text-billboard-yellowDeep mb-2" style={{ WebkitTextStroke: "1.5px #1A1712" }}>0{i + 1}</div>
            <h3 className="font-bold mb-1.5">{s.title}</h3>
            <p className="text-sm text-billboard-inkSoft">{s.body}</p>
          </div>
        ))}
      </div>

      {/* See it in action */}
      <div className="bg-billboard-paperDim border-[3px] border-billboard-ink rounded-lg p-8 md:p-10 mb-16">
        <h2 className="font-display text-xl mb-1.5">See it in action</h2>
        <p className="text-sm text-billboard-inkSoft mb-8">Tap a step to see how a request moves from submission to live, across three different channels.</p>
        <FlowMockups />
      </div>

      <div className="max-w-2xl mx-auto mb-16">
        <h2 className="font-display text-xl mb-2 text-center">Guided steps &amp; FAQ</h2>
        <p className="text-sm text-billboard-inkSoft mb-6 text-center">Answers for {tab === "business" ? "businesses" : "publishers and creators"} — switch tabs above to see the other side.</p>
        <FaqAccordion items={PROCESS_FAQS[tab]} />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded">Find Publishers →</Link>
        <Link to={tab === "business" ? "/register?role=business" : "/register?role=publisher"} className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded">
          {tab === "business" ? "Register as a Business →" : "Join as a Publisher →"}
        </Link>
      </div>
    </div>
  );
}
