import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { usePublishers } from "../hooks/usePublishers";
import { getEnabledChannels } from "../lib/channelRegistry";
import { WarningIcon } from "../components/UiIcons";
import MarketingIcon from "../components/MarketingIcon";
import ChannelIcon from "../components/ChannelIcon";
import { SCENARIOS } from "../lib/caseStudyScenarios";

export default function CaseStudies() {
  const { publishers, loading } = usePublishers();
  const channels = getEnabledChannels();

  const provinceCounts = new Map<string, number>();
  for (const p of publishers) {
    provinceCounts.set(p.province, (provinceCounts.get(p.province) ?? 0) + 1);
  }
  const topProvinces = [...provinceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const channelCounts = new Map<string, number>();
  for (const p of publishers) {
    const slug = p.channel_slug || "social-media";
    channelCounts.set(slug, (channelCounts.get(slug) ?? 0) + 1);
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <Seo
        title="Illustrative Examples · ChatSched"
        description="Walkthroughs of how a booking moves through ChatSched, from request to payout — illustrative examples, not real customer campaigns."
        noindex
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Illustrative examples
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-2xl">What a booking looks like, start to finish.</h1>
      <p className="text-billboard-inkSoft max-w-2xl mb-3">
        ChatSched is in its pilot phase, so we don't have real published case studies yet — this page
        walks through three fictional scenarios instead, to show exactly how a request moves from first
        contact to a creator getting paid.
      </p>
      <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-4 mb-12 max-w-2xl">
        <p className="text-sm font-semibold flex items-center gap-1.5"><WarningIcon className="w-3.5 h-3.5" /> These are illustrative walkthroughs, not real customers</p>
        <p className="text-sm text-billboard-inkSoft mt-1">
          The businesses and creators below are made up to demonstrate the process. No names, figures, or
          results on this page describe an actual ChatSched campaign. Real stories will replace them here
          as they happen.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {SCENARIOS.map((s) => (
          <div key={s.channel} className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
            <div className="bg-billboard-paperDim border-b-[3px] border-billboard-ink px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MarketingIcon name={s.channelIcon} className="w-6 h-6" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wide">{s.channel} · Illustrative</span>
              </div>
            </div>

            <div className="p-6 grid md:grid-cols-2 gap-6 border-b-2 border-billboard-paperDim">
              <div>
                <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">The business</p>
                <p className="font-bold">{s.business}</p>
                <p className="text-sm text-billboard-inkSoft mt-1">{s.businessDetail}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">The creator</p>
                <p className="font-bold">{s.creator}</p>
                <p className="text-sm text-billboard-inkSoft mt-1">{s.creatorDetail}</p>
              </div>
              <div className="md:col-span-2 border-t border-billboard-ink/10 pt-4">
                <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">What's requested</p>
                <p className="text-sm">{s.request}</p>
              </div>
            </div>

            <div className="p-6">
              <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-3">How it would play out</p>
              <div className="flex flex-col gap-3">
                {s.steps.map((step, i) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-billboard-yellow border-2 border-billboard-ink flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="text-xs text-billboard-inkSoft mt-0.5">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Everything below this line is real — pulled live from the same
          publisher directory Browse uses, not illustrative. Kept clearly
          separate from the scenarios above rather than blended in, so it's
          never ambiguous which parts of this page are made up and which
          aren't. */}
      <div className="border-t-[3px] border-billboard-ink pt-12 mt-14">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-billboard-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-billboard-green" />
          </span>
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-green">Live data — not illustrative</span>
        </div>
        <h2 className="text-2xl md:text-3xl mb-3 max-w-xl">What's actually on the platform right now.</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-8">
          Real counts from the same publisher directory Browse searches — no invented names or numbers below this line.
        </p>

        <div className="grid md:grid-cols-2 gap-5 mb-10">
          {/* Channel breakdown */}
          <div className="border-[3px] border-billboard-ink rounded-lg bg-white p-6">
            <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-4">Approved publishers by channel</p>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-billboard-paperDim animate-pulse" />)}
              </div>
            ) : publishers.length === 0 ? (
              <p className="text-sm text-billboard-inkSoft">No approved publishers yet — check back soon.</p>
            ) : (
              <div className="space-y-3">
                {channels.map(({ definition: ch }) => {
                  const count = channelCounts.get(ch.slug) ?? 0;
                  const pct = publishers.length > 0 ? Math.round((count / publishers.length) * 100) : 0;
                  return (
                    <div key={ch.slug}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="inline-flex items-center gap-2 font-semibold"><ChannelIcon slug={ch.slug} size="sm" />{ch.name}</span>
                        <span className="font-mono text-xs text-billboard-inkSoft">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-billboard-paperDim overflow-hidden">
                        <div className="h-full bg-billboard-green rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Province reach */}
          <div className="border-[3px] border-billboard-ink rounded-lg bg-white p-6">
            <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-4">Where publishers are based</p>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-billboard-paperDim animate-pulse" />)}
              </div>
            ) : topProvinces.length === 0 ? (
              <p className="text-sm text-billboard-inkSoft">No approved publishers yet — check back soon.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {topProvinces.map(([province, count]) => (
                  <div key={province} className="border-2 border-billboard-paperDim rounded p-3">
                    <div className="font-mono text-xl font-bold text-billboard-greenDeep">{count}</div>
                    <div className="text-xs text-billboard-inkSoft">{province}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-[3px] border-billboard-ink rounded-lg bg-billboard-ink text-billboard-paper p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-paper/60 mb-1">Total approved publishers, live now</p>
            <p className="font-display text-3xl">{loading ? "—" : publishers.length}</p>
          </div>
          <Link to="/browse" className="inline-flex items-center gap-2 bg-billboard-yellow text-billboard-ink border-[3px] border-billboard-yellow font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
            See them on Browse →
          </Link>
        </div>
      </div>

      <div className="text-center border-t-2 border-billboard-paperDim pt-10 mt-12">
        <p className="text-billboard-inkSoft mb-4 max-w-md mx-auto">
          Want to see the actual mechanics behind payment holds and payout timing, or find a real publisher to work with?
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/how-payment-works" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
            See how payment works
          </Link>
          <Link to="/browse" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
            Browse publishers
          </Link>
        </div>
      </div>
    </div>
  );
}
