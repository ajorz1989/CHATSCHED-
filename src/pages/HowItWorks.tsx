import { useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { CheckIcon } from "../components/UiIcons";

type TabKey = "business" | "publisher";

const BUSINESS_STEPS = [
  { title: "Explore the right channel", body: "Browse available publishers and media inventory across social, influencer, website, podcast and radio by channel, audience, category and location." },
  { title: "Activate and send your brief", body: "Activate ChatSched Business when you're ready to request a booking, then describe the goal, placement, audience, budget and timing you need." },
  { title: "Track the booking to delivery", body: "Follow the request through review, payment, scheduling and delivery. Depending on the channel, proof can include screenshots, links, audio evidence or photos." },
];
const OWNER_STEPS = [
  { title: "Create your publisher profile", body: "List your channel, audience, advertising methods, pricing and availability so businesses can understand what you offer." },
  { title: "Review incoming opportunities", body: "With Publisher Network activation, review requests and opportunities in your dashboard and decide which ones fit your audience and inventory." },
  { title: "Approve, deliver and get paid", body: "Agree the placement, deliver it on schedule, mark it live and follow the tracked payout process inside ChatSched." },
];

interface FlowScenario {
  chromeLabel: string;
  channelLabel: string;
  channelAccent: "yellow" | "green";
  steps: { label: string; title: string }[];
  businessName: string;
  tags: string[];
  quote: string;
  audience: string;
  adFormat: string;
  timing: string;
  dashboardLabel: string;
  statusDetail: string;
  confirmTitle: string;
  confirmDetail: string;
  liveMessage: string;
}

const FLOW_SCENARIOS: FlowScenario[] = [
  {
    chromeLabel: "Booking flow · Social media",
    channelLabel: "Social Media",
    channelAccent: "yellow",
    steps: [
      { label: "01", title: "Business submits a request" },
      { label: "02", title: "Publisher reviews the request" },
      { label: "03", title: "Placement goes live" },
    ],
    businessName: "Bean & Bay Coffee Club",
    tags: ["Social Media", "Johannesburg"],
    quote: ""Feature our new autumn menu with a clear local call-to-action."",
    audience: "Local food & lifestyle audience",
    adFormat: "Sponsored social post",
    timing: "Agreed posting window",
    dashboardLabel: "Publisher dashboard",
    statusDetail: "Social Media · Autumn menu feature",
    confirmTitle: "Placement scheduled",
    confirmDetail: "Set to go live this week",
    liveMessage: "Live now — proof sent to the business",
  },
  {
    chromeLabel: "Booking flow · Influencer",
    channelLabel: "Influencer",
    channelAccent: "green",
    steps: [
      { label: "01", title: "Business sends the creative brief" },
      { label: "02", title: "Influencer reviews the brief" },
      { label: "03", title: "Content goes live" },
    ],
    businessName: "Sandton Nail Studio",
    tags: ["Influencer", "Johannesburg"],
    quote: ""Create a short-form review of our new gel-extension service, filmed in-studio."",
    audience: "Beauty & lifestyle followers",
    adFormat: "Short-form sponsored video",
    timing: "Filming + agreed publish date",
    dashboardLabel: "Influencer dashboard",
    statusDetail: "Influencer · Gel-extension review",
    confirmTitle: "Content scheduled",
    confirmDetail: "Filming booked for this week",
    liveMessage: "Live now — proof sent to the business",
  },
  {
    chromeLabel: "Booking flow · Podcast",
    channelLabel: "Podcast",
    channelAccent: "yellow",
    steps: [
      { label: "01", title: "Business requests an episode slot" },
      { label: "02", title: "Host reviews the opportunity" },
      { label: "03", title: "Episode airs" },
    ],
    businessName: "Gqeberha Hardware Co.",
    tags: ["Podcast", "Eastern Cape"],
    quote: ""Run a short host-read mention of our Saturday in-store sale in this week's episode."",
    audience: "Listeners around the show's topic and region",
    adFormat: "Host-read sponsor mention",
    timing: "Agreed episode / air date",
    dashboardLabel: "Podcast host dashboard",
    statusDetail: "Podcast · Saturday sale mention",
    confirmTitle: "Slot confirmed",
    confirmDetail: "Airing in this week's episode",
    liveMessage: "Live now — proof sent to the business",
  },
  {
    chromeLabel: "Booking flow · Website",
    channelLabel: "Website",
    channelAccent: "green",
    steps: [
      { label: "01", title: "Business chooses the placement" },
      { label: "02", title: "Publisher confirms the slot" },
      { label: "03", title: "Ad placement goes live" },
    ],
    businessName: "Cape Home Solar",
    tags: ["Website", "Cape Town"],
    quote: ""Place our home-energy offer where readers already browse local services."",
    audience: "Website visitors matching the site's niche",
    adFormat: "Banner or sponsored content placement",
    timing: "Agreed placement dates",
    dashboardLabel: "Publisher dashboard",
    statusDetail: "Website · Energy offer placement",
    confirmTitle: "Web slot confirmed",
    confirmDetail: "Placement scheduled for the agreed dates",
    liveMessage: "Live now — link or screenshot proof recorded",
  },
  {
    chromeLabel: "Booking flow · Radio",
    channelLabel: "Radio",
    channelAccent: "yellow",
    steps: [
      { label: "01", title: "Business requests a radio slot" },
      { label: "02", title: "Station reviews the schedule" },
      { label: "03", title: "Spot airs on the agreed date" },
    ],
    businessName: "Khaya Home Stores",
    tags: ["Radio", "Western Cape"],
    quote: ""Promote our weekend sale with a 30-second community-radio spot."",
    audience: "Local listeners across the station's coverage area",
    adFormat: "30-second commercial or host-read",
    timing: "Confirmed schedule / air window",
    dashboardLabel: "Station dashboard",
    statusDetail: "Radio · Weekend sale campaign",
    confirmTitle: "Air slot confirmed",
    confirmDetail: "Spot scheduled in the station rotation",
    liveMessage: "Aired — delivery evidence recorded",
  },
];

const PROCESS_FAQS: Record<TabKey, { q: string; a: string }[]> = {
  business: [
    { q: "How do I know a channel's audience is real?", a: "We manually check every publisher before they're listed — real audience details, not just a follower count." },
    { q: "Do I need a contract?", a: "There is no long-term contract required to use the marketplace. You choose the bookings and campaigns you want to run, subject to the applicable activation and campaign terms." },
    { q: "What happens after I submit a request?", a: "The publisher reviews the request and can approve, decline, or discuss it before anything is scheduled. Once the booking is accepted, payment and delivery follow the applicable channel flow." },
    { q: "Which channels can I request?", a: "Available channels currently include social media, influencer, website, podcast and radio. More channel types are registered in the platform and can be launched as verified supply becomes available." },
    { q: "Where can campaigns run?", a: "ChatSched is built for South African advertising, with channel and publisher availability varying by location. Filter by geography and audience when you browse." },
  ],
  publisher: [
    { q: "What does joining involve?", a: "Create your publisher profile, provide your channel details and complete the review process. Publisher Network activation is required for the paid opportunity and request-management features." },
    { q: "Can I decline a request?", a: "Yes — every request is yours to accept, decline, or discuss before anything is scheduled." },
    { q: "Do I control scheduling?", a: "Yes. Once you approve a request, you choose when it goes live and mark it done yourself." },
    { q: "Is there a minimum audience size to apply?", a: "We review every application on its own merits — reach out and we'll walk you through it." },
    { q: "Where can I list my audience or inventory?", a: "ChatSched is designed for South African publishers and media owners. Your listing can describe its local, regional or national coverage, and businesses can filter by geography when browsing." },
  ],
};

function ChannelFlowMockup({ scenario }: { scenario: FlowScenario }) {
  const [active, setActive] = useState(0);
  const accentClasses = scenario.channelAccent === "yellow"
    ? "bg-billboard-yellow border-billboard-yellow"
    : "bg-billboard-green text-white border-billboard-green";

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg bg-white shadow-block overflow-hidden">
      <div className="bg-billboard-ink px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-billboard-paper/40" />
          <span className="w-2 h-2 rounded-full bg-billboard-paper/40" />
          <span className="w-2 h-2 rounded-full bg-billboard-paper/40" />
          <span className="ml-3 font-mono text-[10px] text-billboard-paper/70 uppercase tracking-wider truncate">{scenario.chromeLabel}</span>
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-billboard-yellow shrink-0">{scenario.channelLabel}</span>
      </div>

      <div className="grid md:grid-cols-3 border-b-[3px] border-billboard-ink">
        {scenario.steps.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={active === i}
            onClick={() => setActive(i)}
            className={`px-4 py-4 text-left transition-colors ${i > 0 ? "md:border-l-[3px] border-t-[3px] md:border-t-0 border-billboard-ink" : ""} ${active === i ? accentClasses : "bg-billboard-paper hover:bg-billboard-paperDim"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`font-mono text-[10px] font-bold ${active === i && scenario.channelAccent === "green" ? "text-white/80" : "text-billboard-inkSoft"}`}>{s.label}</span>
              <span className="text-xs" aria-hidden="true">→</span>
            </div>
            <div className="font-bold text-sm leading-tight mt-1">{s.title}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.35fr_.65fr]">
        <div className="p-6 min-h-[250px] flex flex-col justify-center">
          {active === 0 && (
            <div className="border-2 border-billboard-ink rounded-lg p-5 bg-billboard-paperDim animate-[fadeIn_0.2s_ease]">
              <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">Business brief</div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="font-bold">{scenario.businessName}</div>
                <span className="font-mono text-[10px] font-bold border-2 border-billboard-ink rounded-full px-2 py-0.5 bg-white shrink-0">REQUEST</span>
              </div>
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {scenario.tags.map((tag) => (
                  <span key={tag} className="font-mono text-[10px] border border-billboard-ink/40 rounded-full px-2 py-0.5 bg-white">{tag}</span>
                ))}
              </div>
              <div className="border-t-2 border-dashed border-billboard-ink/30 pt-3 text-sm text-billboard-inkSoft leading-relaxed">{scenario.quote}</div>
              <div className="grid sm:grid-cols-3 gap-2 mt-4">
                {[
                  ["Audience", scenario.audience],
                  ["Format", scenario.adFormat],
                  ["Timing", scenario.timing],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white border border-billboard-ink/15 rounded p-2.5">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-billboard-inkSoft">{label}</div>
                    <div className="text-xs font-semibold mt-1 leading-tight">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {active === 1 && (
            <div className="border-2 border-billboard-ink rounded-lg p-5 bg-billboard-paperDim animate-[fadeIn_0.2s_ease]">
              <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-3">{scenario.dashboardLabel}</div>
              <div className="border-2 border-billboard-ink rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{scenario.businessName}</div>
                    <div className="text-xs text-billboard-inkSoft mt-1">{scenario.statusDetail}</div>
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase bg-billboard-yellow border-2 border-billboard-ink rounded-full px-2 py-1 shrink-0">Pending review</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="font-mono text-xs font-bold border-2 border-billboard-ink rounded px-3 py-1.5 bg-billboard-green text-white">Approve</span>
                  <span className="font-mono text-xs font-bold border-2 border-billboard-ink rounded px-3 py-1.5 bg-white">Decline</span>
                  <span className="font-mono text-xs font-bold border-2 border-billboard-ink rounded px-3 py-1.5 bg-white">Discuss</span>
                </div>
              </div>
            </div>
          )}
          {active === 2 && (
            <div className="border-2 border-billboard-ink rounded-lg p-5 bg-billboard-paperDim animate-[fadeIn_0.2s_ease]">
              <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-3">Delivery &amp; tracking</div>
              <div className="border-2 border-billboard-ink rounded-lg p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-billboard-green flex items-center justify-center text-white shrink-0">
                    <CheckIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{scenario.confirmTitle}</div>
                    <div className="text-xs text-billboard-inkSoft mt-1">{scenario.confirmDetail}</div>
                  </div>
                </div>
                <div className="mt-4 max-w-[90%] px-3 py-2 rounded-xl text-xs border-[1.5px] border-billboard-greenDeep bg-billboard-green text-white rounded-bl-sm flex items-center gap-1.5">
                  {scenario.liveMessage} <CheckIcon className="w-3 h-3 shrink-0" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="border border-billboard-ink/15 rounded p-2 bg-white"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft">Booking</div><div className="text-xs font-bold mt-0.5">Tracked</div></div>
                <div className="border border-billboard-ink/15 rounded p-2 bg-white"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft">Delivery</div><div className="text-xs font-bold mt-0.5">Logged</div></div>
                <div className="border border-billboard-ink/15 rounded p-2 bg-white"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft">Payout</div><div className="text-xs font-bold mt-0.5">Tracked</div></div>
              </div>
            </div>
          )}
        </div>

        <aside className="border-t-[3px] lg:border-t-0 lg:border-l-[3px] border-billboard-ink bg-billboard-paperDim p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-3">What changes by channel</div>
          <div className="space-y-3">
            <div>
              <div className="font-bold text-sm">{scenario.channelLabel}</div>
              <p className="text-xs text-billboard-inkSoft mt-1 leading-relaxed">{scenario.audience}</p>
            </div>
            <div className="border-t-2 border-billboard-ink/10 pt-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-billboard-inkSoft">Typical placement</div>
              <p className="text-xs font-semibold mt-1">{scenario.adFormat}</p>
            </div>
            <div className="border-t-2 border-billboard-ink/10 pt-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-billboard-inkSoft">Timing</div>
              <p className="text-xs font-semibold mt-1">{scenario.timing}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FlowMockups() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const labels = FLOW_SCENARIOS.map((scenario) => scenario.channelLabel);
  const current = FLOW_SCENARIOS[scenarioIndex];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 snap-x" aria-label="See it in action channels">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={scenarioIndex === i}
            onClick={() => setScenarioIndex(i)}
            className={`shrink-0 snap-start font-mono text-xs font-bold uppercase tracking-wide px-3.5 py-2 rounded-full border-2 transition ${scenarioIndex === i ? "border-billboard-ink bg-billboard-ink text-billboard-paper" : "border-billboard-ink/25 bg-white text-billboard-inkSoft hover:border-billboard-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ChannelFlowMockup scenario={current} />
      <p className="text-[11px] text-billboard-inkSoft mt-3 text-center">
        These are illustrative booking walkthroughs. Exact deliverables, timing, pricing and proof requirements depend on the publisher and channel.
      </p>
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
            type="button"
            aria-expanded={open === i}
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
          type="button"
          onClick={() => setTab("business")}
          className={`px-5 py-3 font-bold text-sm ${tab === "business" ? "bg-billboard-ink text-billboard-paper" : "bg-billboard-paper"}`}
        >
          For Businesses
        </button>
        <button
          type="button"
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
      <section className="mb-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
          <div className="max-w-2xl">
            <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-3 py-1.5 rounded mb-3">Interactive examples</span>
            <h2 className="font-display text-2xl md:text-3xl mb-2">See it in action</h2>
            <p className="text-sm text-billboard-inkSoft leading-relaxed">
              One platform, different media. Switch channels to see how the same core workflow adapts to a social post, creator content, podcast sponsorship, website placement or radio spot.
            </p>
          </div>
          <Link to="/channels" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-white font-bold px-4 py-2.5 rounded text-sm shrink-0 hover:-translate-y-0.5 transition">
            Explore all channels →
          </Link>
        </div>
        <div className="bg-billboard-paperDim border-[3px] border-billboard-ink rounded-lg p-4 md:p-6">
          <FlowMockups />
        </div>
      </section>

      <section className="mb-16">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["01", "Discovery", "Find publishers and media inventory by channel, audience, category and location."],
            ["02", "Coordination", "Keep the request, questions, approvals and booking history inside ChatSched."],
            ["03", "Payment", "Use the payment method that applies to the booking, with the transaction tracked before delivery."],
            ["04", "Proof & reporting", "Follow the campaign to live status and keep delivery evidence and performance information attached to the booking where available."],
          ].map(([n, title, body]) => (
            <div key={n} className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
              <div className="font-display text-xl text-billboard-yellowDeep mb-2" style={{ WebkitTextStroke: "1px #1A1712" }}>{n}</div>
              <h2 className="font-bold text-sm mb-1.5">{title}</h2>
              <p className="text-xs text-billboard-inkSoft leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="border-[3px] border-billboard-ink rounded-lg overflow-hidden bg-white">
          <div className="bg-billboard-yellow p-6 md:p-7 border-b-[3px] border-billboard-ink">
            <span className="font-mono text-[10px] uppercase tracking-wider font-bold">Choose your route</span>
            <h2 className="font-display text-2xl mt-1">Self-serve or let ChatSched coordinate it.</h2>
            <p className="text-sm text-billboard-inkSoft max-w-2xl mt-2 leading-relaxed">
              Some bookings are straightforward enough to handle yourself. For a multi-channel campaign, you can send one brief and have a ChatSched campaign manager coordinate the media plan and publisher schedule.
            </p>
          </div>
          <div className="grid md:grid-cols-2 divide-y-[3px] md:divide-y-0 md:divide-x-[3px] divide-billboard-ink">
            <div className="p-6">
              <h3 className="font-display text-xl mb-2">Marketplace</h3>
              <p className="text-sm text-billboard-inkSoft leading-relaxed mb-4">Choose the publisher, placement and budget yourself, then manage the booking through your dashboard.</p>
              <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition">Browse advertising →</Link>
            </div>
            <div className="p-6">
              <h3 className="font-display text-xl mb-2">ChatSched Agency</h3>
              <p className="text-sm text-billboard-inkSoft leading-relaxed mb-4">Send your campaign goal, audience, channels, budget and dates. A campaign manager reviews the brief and coordinates the next steps with you.</p>
              <Link to="/build-my-campaign" className="inline-flex items-center gap-2 bg-billboard-ink text-white border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition">Build a campaign →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-2xl text-center mb-2">Before you send a request</h2>
          <p className="text-sm text-billboard-inkSoft text-center mb-6">A clear brief makes publisher approval and campaign delivery easier.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "What are you promoting and what action do you want people to take?",
              "Which audience, city, province or location are you targeting?",
              "What advertising format or placement are you looking for?",
              "What budget and preferred dates should the publisher work with?",
              "Do you have the creative asset, copy, link, offer or script ready?",
              "What proof or tracking would help you judge the campaign?",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 border-2 border-billboard-ink/15 rounded-lg p-4 bg-white text-sm">
                <CheckIcon className="w-4 h-4 mt-0.5 shrink-0 text-billboard-greenDeep" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


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
