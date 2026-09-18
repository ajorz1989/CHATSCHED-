import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import { formatCurrency } from "../lib/currency";
import { getEnabledChannels } from "../lib/channelRegistry";

const ACCEPTABLE_COST_PRESETS = [10, 20, 30, 40];

export default function BudgetCalculator() {
  const channels = getEnabledChannels();
  const [customerValue, setCustomerValue] = useState(400);
  const [acceptablePct, setAcceptablePct] = useState(20);
  const [targetCustomers, setTargetCustomers] = useState(10);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(["social-media"]);

  function toggleChannel(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  const results = useMemo(() => {
    const costPerCustomer = customerValue * (acceptablePct / 100);
    const totalBudget = Math.round(costPerCustomer * targetCustomers);
    const channelCount = Math.max(1, selectedSlugs.length);
    const perChannel = Math.round(totalBudget / channelCount);
    const roughPlacements = Math.max(1, Math.floor(totalBudget / MIN_PRICE_PER_POST));
    return { costPerCustomer, totalBudget, perChannel, roughPlacements };
  }, [customerValue, acceptablePct, targetCustomers, selectedSlugs]);

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Campaign Budget Calculator · ChatSched" description="Work backwards from what a new customer is actually worth to your business, and get a budget that makes sense — not a round number that felt safe." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-green text-billboard-greenDeep px-3 py-1.5 rounded mb-3">Business Tools</span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">What should your campaign actually cost?</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">Work backwards from what a new customer is worth to your business — the same approach the budgeting guide walks through, made interactive.</p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">What's a typical customer worth to you? (R)</label>
            <input
              type="number" min={0} value={customerValue}
              onChange={(e) => setCustomerValue(Number(e.target.value) || 0)}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>What % of that would you happily spend to win one?</span>
              <span className="font-mono text-billboard-inkSoft">{acceptablePct}%</span>
            </label>
            <input type="range" min={5} max={60} step={1} value={acceptablePct} onChange={(e) => setAcceptablePct(Number(e.target.value))} className="w-full accent-billboard-yellow mb-2" />
            <div className="flex gap-2">
              {ACCEPTABLE_COST_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAcceptablePct(p)}
                  className={`font-mono text-xs font-semibold px-2.5 py-1.5 rounded border-2 border-billboard-ink transition ${acceptablePct === p ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">How many new customers is this campaign aiming for?</label>
            <input
              type="number" min={1} value={targetCustomers}
              onChange={(e) => setTargetCustomers(Math.max(1, Number(e.target.value) || 1))}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Which channels are you spreading this across?</label>
            <div className="flex flex-wrap gap-2">
              {channels.map((m) => (
                <button
                  key={m.definition.slug}
                  type="button"
                  onClick={() => toggleChannel(m.definition.slug)}
                  className={`font-mono text-xs font-semibold px-3 py-2 rounded border-2 border-billboard-ink transition ${selectedSlugs.includes(m.definition.slug) ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}
                >
                  {m.definition.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-green text-white text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-white/80 mb-1">Suggested total campaign budget</p>
            <p className="font-display text-4xl mb-1">{formatCurrency(results.totalBudget)}</p>
            <p className="text-sm text-white/80">{formatCurrency(Math.round(results.costPerCustomer))} per customer × {targetCustomers} customers</p>
          </div>

          <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paper text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-1">Per channel, split evenly across {Math.max(1, selectedSlugs.length)}</p>
            <p className="font-display text-3xl mb-1">{formatCurrency(results.perChannel)}</p>
            <p className="text-xs text-billboard-inkSoft">An even split is a starting point — weight it toward whichever channel performs best once you have real results.</p>
          </div>

          <div className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paperDim text-center">
            <p className="text-xs text-billboard-inkSoft">At the platform minimum of {formatCurrency(MIN_PRICE_PER_POST)} per placement, that's roughly enough for <strong>{results.roughPlacements}</strong> placement{results.roughPlacements === 1 ? "" : "s"} — actual publisher pricing varies with audience size and engagement.</p>
          </div>

          <Link to="/browse" className="block text-center bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
            Browse publishers →
          </Link>
        </div>
      </div>

      <div className="mt-14 pt-10 border-t-2 border-billboard-ink/10 text-center">
        <p className="text-sm text-billboard-inkSoft">Want the reasoning behind this? Read <Link to="/business-success/calculating-your-campaign-budget" className="underline font-semibold text-billboard-ink">Calculating a campaign budget that actually makes sense</Link> in the Business Success Centre.</p>
      </div>
    </div>
  );
}
