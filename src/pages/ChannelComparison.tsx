/**
 * Channel Comparison Hub — /channels/compare
 *
 * The page the marketplace was missing: /channels lists what exists and
 * /channels/:slug explains one channel in depth, but nothing let a business
 * put two channels side by side and answer "which one should I actually
 * spend my R2 000 on?" before committing to a request.
 *
 * Deliberately 100% registry-driven (getAllChannels + isChannelEnabled) —
 * same contract as ChannelHub.tsx. Nothing here is hand-written per
 * channel, so adding a 14th channel to src/channels/<slug>/index.ts makes
 * it appear in every row of this table with zero changes to this file.
 * Live-vs-opening status comes from the feature flag, which is the same
 * source the Channel Hub badge and the Browse channel filter use, so this
 * page can never advertise a channel that has no supply behind it.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAllChannels } from "../lib/channelRegistry";
import { isChannelEnabled } from "../lib/featureFlags";
import type { ChannelModule } from "../lib/channelTypes";
import { formatCurrency } from "../lib/currency";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";

type SortKey = "minBudget" | "leadTime" | "name";

const AUDIENCE_SIGNAL_LABELS: Record<string, string> = {
  follower_count: "Followers",
  subscriber_count: "Subscribers",
  listener_count: "Listeners",
  open_rate: "Open rate",
  engagement_rate: "Engagement rate",
  website_traffic: "Site traffic",
  event_attendance: "Attendance",
  listener_reach: "Listener reach",
  circulation: "Circulation",
  estimated_impressions: "Est. impressions",
  geographic_coverage: "Coverage area",
  demographic_profile: "Demographics",
  language_profile: "Language",
  industry_vertical: "Industry",
};

function statusOf(module: ChannelModule) {
  return isChannelEnabled(module.definition.slug) ? "live" : "opening";
}

/** Cheapest way in for this channel — the number an SMME actually budgets against. */
function entryPrice(module: ChannelModule): number {
  const prices = module.definition.pricingModels.map((p) => p.minPrice);
  return prices.length ? Math.min(...prices, module.definition.minBudgetZAR) : module.definition.minBudgetZAR;
}

function entryPriceLabel(module: ChannelModule): string {
  const cheapest = module.definition.pricingModels.reduce(
    (best, p) => (p.minPrice < best.minPrice ? p : best),
    module.definition.pricingModels[0]
  );
  return cheapest ? `${formatCurrency(cheapest.minPrice)} ${cheapest.label.toLowerCase()}` : `${formatCurrency(module.definition.minBudgetZAR)} minimum`;
}

function leadTimeLabel(module: ChannelModule): string {
  const days = Math.max(...module.definition.availability.minLeadTimeDays ? [module.definition.availability.minLeadTimeDays] : [0]);
  if (!days) return "Same week";
  if (days === 1) return "1 day's notice";
  return `${days} days' notice`;
}

export default function ChannelComparison() {
  const [sort, setSort] = useState<SortKey>("minBudget");
  const [liveOnly, setLiveOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = getAllChannels().map((module) => ({
      module,
      name: module.definition.name,
      status: statusOf(module),
      entry: entryPrice(module),
      price: entryPriceLabel(module),
      lead: leadTimeLabel(module),
      bestFor: module.definition.audience.typicalAudience,
      signals: module.definition.audience.signals.slice(0, 4).map((s) => AUDIENCE_SIGNAL_LABELS[s] ?? s),
      metrics: module.definition.analyticsMetrics.slice(0, 4).map((m) => m.label),
      useCase: module.definition.exampleUseCases[0] ?? "",
      dueDiligence: module.definition.publisherRequirements.slice(0, 3),
    }));
    const filtered = liveOnly ? all.filter((r) => r.status === "live") : all;
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "leadTime") {
        const da = Math.max(...a.module.definition.availability.minLeadTimeDays ? [a.module.definition.availability.minLeadTimeDays] : [0]);
        const db = Math.max(...b.module.definition.availability.minLeadTimeDays ? [b.module.definition.availability.minLeadTimeDays] : [0]);
        return da - db;
      }
      return a.entry - b.entry;
    });
  }, [sort, liveOnly]);

  const liveCount = getAllChannels().filter((m) => isChannelEnabled(m.definition.slug)).length;
  const totalCount = getAllChannels().length;

  return (
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo
        title="Compare advertising channels — price, lead time & audience | ChatSched"
        description="Put every ChatSched advertising channel side by side: minimum spend, how far ahead you need to book, who the audience is, and what you get back as proof. Social pages, creators, podcasts, radio, venue screens and more."
      />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink px-3 py-1.5 rounded mb-3">
        Channel comparison
      </span>
      <h1 className="text-3xl md:text-5xl mb-3 max-w-3xl">
        Which channel actually gets you customers?
      </h1>
      <p className="text-billboard-inkSoft max-w-2xl mb-8">
        Every channel on ChatSched, side by side — what it costs to get in, how far ahead you need to book,
        who you'll reach, and what you get back as proof. {liveCount} of {totalCount} are open for bookings right now.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="flex items-center gap-2 text-sm font-semibold border-[3px] border-billboard-ink rounded px-4 py-2.5 bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={liveOnly}
            onChange={(e) => setLiveOnly(e.target.checked)}
            className="w-4 h-4 accent-billboard-green"
          />
          Only show channels I can book today
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold border-[3px] border-billboard-ink rounded px-4 py-2.5 bg-white">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent font-semibold outline-none cursor-pointer"
          >
            <option value="minBudget">Cheapest to start</option>
            <option value="leadTime">Fastest to book</option>
            <option value="name">A–Z</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="border-[3px] border-dashed border-billboard-ink rounded p-8 text-center text-billboard-inkSoft">
          No live channels match that filter yet — untick it to see what's opening next.
        </p>
      ) : (
        <div className="overflow-x-auto border-[3px] border-billboard-ink rounded-lg bg-white shadow-blockSm">
          <div className="min-w-[860px]">
            {/* Header row */}
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1.4fr_0.9fr] font-mono text-[10px] uppercase font-bold bg-billboard-paperDim border-b-[3px] border-billboard-ink">
              <div className="p-3.5 border-r-[3px] border-billboard-ink">Channel</div>
              <div className="p-3.5 border-r-[3px] border-billboard-ink">Cheapest way in</div>
              <div className="p-3.5 border-r-[3px] border-billboard-ink">Booking notice</div>
              <div className="p-3.5 border-r-[3px] border-billboard-ink">Who you reach</div>
              <div className="p-3.5">Status</div>
            </div>

            {rows.map((row) => {
              const isOpen = expanded === row.module.definition.slug;
              const live = row.status === "live";
              return (
                <div key={row.module.definition.slug} className="border-b-2 border-billboard-ink/15 last:border-b-0">
                  <div className="grid grid-cols-[1.3fr_1fr_1fr_1.4fr_0.9fr] items-start">
                    <div className="p-3.5 border-r-2 border-billboard-ink/15">
                      <div className="flex items-center gap-2 mb-1">
                        <ChannelIcon slug={row.module.definition.slug} size="sm" />
                        <Link to={`/channels/${row.module.definition.slug}`} className="font-bold text-sm hover:underline">
                          {row.name}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : row.module.definition.slug)}
                        className="text-[11px] font-semibold underline text-billboard-inkSoft hover:text-billboard-ink"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide detail" : "More detail"}
                      </button>
                    </div>
                    <div className="p-3.5 border-r-2 border-billboard-ink/15 text-sm font-semibold">{row.price}</div>
                    <div className="p-3.5 border-r-2 border-billboard-ink/15 text-sm">{row.lead}</div>
                    <div className="p-3.5 border-r-2 border-billboard-ink/15 text-sm text-billboard-inkSoft">{row.bestFor}</div>
                    <div className="p-3.5">
                      {live ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase border-2 border-billboard-greenDeep bg-billboard-green/15 text-billboard-greenDeep px-2 py-1 rounded">
                          Open now
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase border-2 border-billboard-inkSoft/40 text-billboard-inkSoft px-2 py-1 rounded">
                          Opening soon
                        </span>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="grid md:grid-cols-3 gap-6 p-5 bg-billboard-paperDim border-t-2 border-billboard-ink/15">
                      <div>
                        <h3 className="font-mono text-[10px] uppercase font-bold mb-2">What you can measure</h3>
                        <ul className="space-y-1 text-sm text-billboard-inkSoft">
                          {row.metrics.map((m) => (
                            <li key={m}>✓ {m}</li>
                          ))}
                        </ul>
                        <h3 className="font-mono text-[10px] uppercase font-bold mt-4 mb-2">Audience signals you can check first</h3>
                        <p className="text-sm text-billboard-inkSoft">{row.signals.join(" · ")}</p>
                      </div>
                      <div>
                        <h3 className="font-mono text-[10px] uppercase font-bold mb-2">Typical booking</h3>
                        <p className="text-sm text-billboard-inkSoft">
                          {row.useCase || `${row.name} placements are booked the same way as every other channel: request, approve, pay, go live.`}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-mono text-[10px] uppercase font-bold mb-2">Before you book, we check</h3>
                        <ul className="space-y-1 text-sm text-billboard-inkSoft">
                          {row.dueDiligence.map((d) => (
                            <li key={d}>— {d}</li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-2 mt-4">
                          {live ? (
                            <Link
                              to={`/channels/${row.module.definition.slug}`}
                              className="inline-flex items-center border-2 border-billboard-ink bg-billboard-yellow font-bold text-xs px-3 py-2 rounded hover:-translate-y-0.5 transition"
                            >
                              See {row.name} →
                            </Link>
                          ) : (
                            <Link
                              to={`/register?role=publisher&channel=${row.module.definition.slug}`}
                              className="inline-flex items-center border-2 border-billboard-ink font-bold text-xs px-3 py-2 rounded hover:-translate-y-0.5 transition"
                            >
                              Have this inventory? Apply →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-billboard-inkSoft mt-4">
        "Cheapest way in" is the lowest published price for that channel — every placement shows its own price before you send a request.
      </p>

      {/* Bottom CTA */}
      <div className="mt-14 border-[3px] border-billboard-ink rounded p-8 bg-billboard-yellow text-center">
        <h2 className="font-display text-2xl mb-2">Still not sure which one?</h2>
        <p className="text-billboard-inkSoft mb-6 max-w-xl mx-auto">
          Tell us the goal, the area and the budget. We'll pick the channels, book the placements and send you a
          schedule to approve — before a cent is paid.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/build-my-campaign" className="brand-button dark">Build My Campaign →</Link>
          <Link to="/browse" className="brand-button">Browse Ad Space →</Link>
        </div>
      </div>
    </div>
  );
}
