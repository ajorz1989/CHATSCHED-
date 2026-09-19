import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";
import { getEnabledChannels } from "../lib/channelRegistry";

type CaseStudy = {
  id: string;
  label: string;
  title: string;
  channelSlugs: string[];
  challenge: string;
  strategy: string;
  result: string;
  metrics: string[];
};

const CASE_STUDIES: CaseStudy[] = [
  {
    id: "local-product-launch",
    label: "01 · Local product launch",
    title: "Turn one product launch into repeated multi-channel exposure.",
    channelSlugs: ["social-media", "podcast", "website"],
    challenge: "A consumer brand needs concentrated awareness in a defined city before launch week. The objective is repeated exposure across complementary audiences and touchpoints, not a one-off post.",
    strategy: "ChatSched coordinates social media, local podcast and website inventory under one brief. Social publishers introduce the product visually, the podcast adds trusted host-read context, and website inventory extends the campaign beyond social feeds.",
    result: "The campaign is structured as one measurable brief instead of three disconnected buys. Reporting can be reviewed against estimated impressions, reach, engagement, clicks and conversion activity, with spend tied back to the final publisher schedule. Where revenue data is available, cost per acquisition and ROAS can be evaluated alongside reach.",
    metrics: ["Estimated impressions", "Reach by channel", "Engagement rate", "CTR", "Leads / enquiries", "CPA / CAC", "Revenue / ROAS"],
  },
  {
    id: "retail-promotion",
    label: "02 · Local retail promotion",
    title: "Put a time-bound retail offer in front of people close enough to act.",
    channelSlugs: ["community", "radio", "in-venue-screens"],
    challenge: "A retailer needs to drive foot traffic and immediate demand for a time-bound promotion. The audience is concentrated geographically, so distribution needs to stay locally relevant.",
    strategy: "ChatSched combines community publishers with local radio and in-venue advertising. Community inventory creates neighbourhood relevance, social or community content makes the offer shareable, radio adds local frequency, and screens reinforce the message at the point of attention.",
    result: "The promotion is managed as a single campaign with channel-level delivery tracked against the same objective. The business can compare impressions, estimated reach, engagement, click or WhatsApp activity, redemption signals and final spend to understand which distribution points contributed to demand.",
    metrics: ["Local reach", "Frequency", "Engagement / shares", "Clicks / WhatsApp enquiries", "Redemptions", "Cost per response", "Sales / ROAS"],
  },
  {
    id: "event-attendance",
    label: "03 · Event attendance campaign",
    title: "Build event momentum from awareness through registration.",
    channelSlugs: ["social-media", "events", "podcast", "sports"],
    challenge: "An event organiser needs to build awareness, generate registrations and keep momentum over several weeks without relying on one media format.",
    strategy: "ChatSched coordinates event-focused social publishers, community or local-interest media, podcast inventory and event or sports placements where the audience overlaps with the event profile. Messaging can move from awareness to registration reminders as the event date approaches.",
    result: "One campaign brief keeps the distribution plan coordinated while each channel is evaluated on the action it is best suited to support. Performance can be assessed through reach, registrations, traffic, engagement, cost per registration and revenue from ticket or booking activity.",
    metrics: ["Awareness reach", "Event-page traffic", "Registrations / bookings", "Cost per registration", "Engagement rate", "Channel contribution", "Ticket / booking revenue"],
  },
  {
    id: "service-lead-generation",
    label: "04 · Service lead generation",
    title: "Create a consistent path from local awareness to qualified enquiry.",
    channelSlugs: ["social-media", "influencer", "community", "website"],
    challenge: "A service business wants qualified enquiries from a defined audience rather than broad awareness. The campaign needs enough local relevance to generate conversations and enough distribution diversity to sustain lead flow.",
    strategy: "ChatSched combines social creators, influencer placements, community inventory and website placements. Creative can be adapted to each channel while the core offer, call to action and qualification criteria remain consistent.",
    result: "The business gets one campaign structure with a clear path from exposure to enquiry. Lead volume, qualified-lead rate, response time, cost per lead and downstream conversion can be tracked across selected channels instead of being reported as isolated media buys.",
    metrics: ["Impressions / reach", "CTR", "WhatsApp / enquiry volume", "Qualified-lead rate", "Cost per qualified lead", "Conversion rate", "Customer value / ROAS"],
  },
  {
    id: "community-transport",
    label: "05 · Community + transport awareness",
    title: "Extend digital awareness into the places local audiences already move and shop.",
    channelSlugs: ["community", "transport", "informal-retail", "social-media"],
    challenge: "A local brand needs broader community visibility in areas where conventional digital targeting alone may miss part of the audience. The campaign must extend beyond social feeds while staying geographically relevant.",
    strategy: "ChatSched combines community publishers with transport inventory, informal-retail touchpoints and social distribution. The campaign creates multiple opportunities for recognition across neighbourhood and physical environments while maintaining one core message.",
    result: "The brand gains a broader local media footprint from one managed brief. Measurement can combine estimated reach, placement delivery, geographic coverage, digital engagement, enquiries and spend to show how community and physical touchpoints complement digital distribution.",
    metrics: ["Geographic coverage", "Estimated audience", "Placement delivery", "Digital engagement", "Enquiries", "Cost per response", "Sales / lead lift"],
  },
  {
    id: "sports-sponsorship",
    label: "06 · Sports + sponsorship activation",
    title: "Turn sports attention into a coordinated sponsorship and media programme.",
    channelSlugs: ["sports", "events", "social-media", "radio"],
    challenge: "A brand wants to associate itself with a sports audience and build visibility around a team, competition, event or recurring sports property. The campaign needs more than a logo placement; it needs a coordinated audience strategy.",
    strategy: "ChatSched can combine sports inventory with social creators, event placements, podcast or radio exposure and community distribution. The media plan can be structured around the sports calendar, audience geography and the intended action, such as awareness, attendance, enquiries or product consideration.",
    result: "The campaign can be evaluated as one sponsorship and media programme. Core measures include audience reach, content engagement, event or match-related traffic, lead activity, sponsorship exposure and commercial outcomes where conversion data is available.",
    metrics: ["Sponsorship exposure", "Estimated reach", "Content engagement", "Event / match traffic", "Leads / enquiries", "Cost per action", "Revenue / ROAS"],
  },
];

function channelName(slug: string, enabledChannels: ReturnType<typeof getEnabledChannels>) {
  return enabledChannels.find((channel) => channel.definition.slug === slug)?.definition.name ?? slug.replace(/-/g, " ");
}

export default function CaseStudies() {
  const enabledChannels = getEnabledChannels();

  return (
    <>
      <Seo
        title="Case Studies — Multi-Channel Advertising | ChatSched"
        description="See how ChatSched structures multi-channel advertising campaigns across social, influencer, podcast, radio, events, sports, community, transport and venue inventory."
      />

      <main className="bg-billboard-paper">
        <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-5">
            <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-5">
              Case studies
            </span>
            <h1 className="text-4xl md:text-6xl leading-[1.05] max-w-4xl mb-5">
              How brands turn one campaign brief into coordinated distribution.
            </h1>
            <p className="text-lg md:text-xl text-billboard-inkSoft max-w-3xl mb-8">
              ChatSched connects businesses with advertising inventory across digital, social, broadcast,
              community, sports, events, transport, retail, hospitality and venue channels. Each campaign is
              planned around the audience, geography, timing and budget, then translated into a channel mix
              that can be reviewed and scheduled through ChatSched.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/build-my-campaign" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
                Build a campaign →
              </Link>
              <Link to="/channels" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-paper font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
                Explore channels
              </Link>
            </div>
          </div>
        </section>

        <section className="py-10 border-b-2 border-billboard-paperDim">
          <div className="max-w-6xl mx-auto px-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="border-[3px] border-billboard-ink rounded-lg bg-white p-5">
                <div className="font-display text-3xl text-billboard-greenDeep">{enabledChannels.length}</div>
                <div className="font-mono text-xs uppercase tracking-wider text-billboard-inkSoft mt-1">enabled channels</div>
              </div>
              <div className="border-[3px] border-billboard-ink rounded-lg bg-white p-5">
                <div className="font-display text-3xl">1</div>
                <div className="font-mono text-xs uppercase tracking-wider text-billboard-inkSoft mt-1">campaign brief</div>
              </div>
              <div className="border-[3px] border-billboard-ink rounded-lg bg-white p-5">
                <div className="font-display text-3xl">7</div>
                <div className="font-mono text-xs uppercase tracking-wider text-billboard-inkSoft mt-1">core KPI families</div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 py-16">
          <div className="grid lg:grid-cols-2 gap-6">
            {CASE_STUDIES.map((study) => (
              <article key={study.id} className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden shadow-blockSm">
                <div className="bg-billboard-paperDim border-b-[3px] border-billboard-ink px-6 py-4">
                  <div className="font-mono text-xs font-semibold uppercase tracking-wide text-billboard-red mb-1">
                    {study.label}
                  </div>
                  <h2 className="text-2xl md:text-3xl">{study.title}</h2>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {study.channelSlugs.map((slug) => (
                      <Link
                        key={slug}
                        to={`/channels/${slug}`}
                        className="inline-flex items-center gap-1.5 border-2 border-billboard-ink rounded px-2.5 py-1.5 text-xs font-semibold hover:bg-white transition"
                      >
                        <ChannelIcon slug={slug} size="sm" />
                        {channelName(slug, enabledChannels)}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="p-6 space-y-7">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">The Challenge</p>
                    <p className="text-sm leading-6">{study.challenge}</p>
                  </div>

                  <div className="border-t-2 border-billboard-paperDim pt-6">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">The Multi-Channel Strategy</p>
                    <p className="text-sm leading-6">{study.strategy}</p>
                  </div>

                  <div className="border-t-2 border-billboard-paperDim pt-6">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">The Result</p>
                    <p className="text-sm leading-6">{study.result}</p>
                  </div>

                  <div className="border-t-2 border-billboard-paperDim pt-6">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-3">Performance metrics</p>
                    <div className="grid grid-cols-2 gap-2">
                      {study.metrics.map((metric) => (
                        <div key={metric} className="border-2 border-billboard-ink/10 rounded px-3 py-2 text-xs font-semibold bg-billboard-paperDim">
                          {metric}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-billboard-ink text-billboard-paper border-y-[3px] border-billboard-ink py-16">
          <div className="max-w-6xl mx-auto px-5">
            <span className="inline-block font-mono text-xs font-semibold uppercase tracking-wider border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">
              What these case studies show
            </span>
            <h2 className="text-3xl md:text-4xl max-w-3xl mb-5">
              One campaign structure. Multiple distribution paths.
            </h2>
            <p className="text-billboard-paperDim max-w-3xl text-base md:text-lg leading-7">
              The common principle is simple: ChatSched is built to coordinate distribution, not force every
              business into the same advertising package. A campaign can start with a specific audience,
              geography, objective and custom budget. ChatSched can then structure the media plan across the
              available inventory, keep the booking process coordinated and give the business a clearer
              framework for reviewing delivery and commercial performance.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-5 py-16">
          <div className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
            <div className="bg-billboard-green text-white px-6 py-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider mb-1">Measurement framework</p>
              <h2 className="font-display text-2xl md:text-3xl">Every campaign is measured against the objective it was built to achieve.</h2>
            </div>
            <div className="grid md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-billboard-ink">
              {[
                ["Awareness", "Reach, impressions, frequency, video views and engagement."],
                ["Traffic", "Clicks, CTR, landing-page visits and cost per visit."],
                ["Lead generation", "Enquiries, qualified leads, cost per lead and conversion rate."],
                ["Sales", "Purchases, revenue, customer acquisition cost and ROAS."],
                ["Events & sponsorships", "Registrations, attendance, exposure, engagement and commercial response."],
                ["Channel delivery", "Placement completion, timing, geography and publisher-level reporting."],
              ].map(([title, body]) => (
                <div key={title} className="p-5 md:p-6">
                  <h3 className="font-bold mb-1">{title}</h3>
                  <p className="text-sm text-billboard-inkSoft leading-6">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-billboard-paperDim border-t-[3px] border-billboard-ink py-16">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <h2 className="font-display text-3xl md:text-4xl mb-4">Ready to build your campaign?</h2>
            <p className="text-billboard-inkSoft max-w-2xl mx-auto mb-7">
              Start with your objective, audience, geography, timing and custom budget. ChatSched can then
              review the brief and work through the appropriate publisher and media mix.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/build-my-campaign" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
                Build a campaign →
              </Link>
              <Link to="/channels" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
                Explore advertising channels
              </Link>
              <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
                Browse live inventory
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
