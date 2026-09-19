import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import { formatCurrency } from "../lib/currency";
import { getEnabledChannels } from "../lib/channelRegistry";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketStats {
  avgPrice: number | null;
  medianPrice: number | null;
  publisherCount: number | null;
  avgFollowers: number | null;
  topCategory: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTABLE_COST_PRESETS = [10, 20, 30, 40];

const CAMPAIGN_GOALS = [
  { value: "awareness", label: "Brand awareness", conversionRate: 0.02 },
  { value: "leads", label: "Generate leads", conversionRate: 0.05 },
  { value: "sales", label: "Direct sales / conversions", conversionRate: 0.08 },
  { value: "retention", label: "Retention / re-engagement", conversionRate: 0.12 },
  { value: "event", label: "Event / launch", conversionRate: 0.06 },
];

const INDUSTRIES = [
  { value: "retail", label: "Retail / e-commerce", avgLtv: 800 },
  { value: "food", label: "Food & beverage", avgLtv: 300 },
  { value: "fitness", label: "Fitness & wellness", avgLtv: 1200 },
  { value: "beauty", label: "Beauty & personal care", avgLtv: 600 },
  { value: "finance", label: "Financial services", avgLtv: 5000 },
  { value: "education", label: "Education & training", avgLtv: 2000 },
  { value: "hospitality", label: "Hospitality & events", avgLtv: 1500 },
  { value: "tech", label: "Tech & software", avgLtv: 3000 },
  { value: "other", label: "Other", avgLtv: 500 },
];

const CAMPAIGN_DURATIONS = [
  { value: 1, label: "1 month" },
  { value: 2, label: "2 months" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
];

const AUDIENCE_SIZES = [
  { value: "micro", label: "Micro (1k–10k followers)", priceMultiplier: 0.6 },
  { value: "mid", label: "Mid-tier (10k–100k followers)", priceMultiplier: 1.0 },
  { value: "macro", label: "Macro (100k+ followers)", priceMultiplier: 2.2 },
  { value: "mixed", label: "Mixed / don't mind", priceMultiplier: 1.0 },
];

// ─── Stat fetcher ─────────────────────────────────────────────────────────────

async function fetchMarketStats(): Promise<MarketStats> {
  const [priceRes, countRes, followersRes, categoryRes] = await Promise.all([
    supabase
      .from("publishers")
      .select("price_per_post")
      .not("price_per_post", "is", null)
      .gt("price_per_post", 0),
    supabase
      .from("publishers")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("publishers")
      .select("followers")
      .not("followers", "is", null)
      .gt("followers", 0),
    supabase
      .from("publishers")
      .select("category")
      .not("category", "is", null),
  ]);

  // Average + median price
  const prices = (priceRes.data ?? []).map((r) => Number(r.price_per_post)).filter(Boolean);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const sorted = [...prices].sort((a, b) => a - b);
  const medianPrice = sorted.length
    ? sorted.length % 2 === 0
      ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : sorted[Math.floor(sorted.length / 2)]
    : null;

  // Average followers
  const followerNums = (followersRes.data ?? []).map((r) => Number(r.followers)).filter(Boolean);
  const avgFollowers = followerNums.length
    ? Math.round(followerNums.reduce((a, b) => a + b, 0) / followerNums.length)
    : null;

  // Top category
  const categories = (categoryRes.data ?? []).map((r) => String(r.category)).filter(Boolean);
  const freq: Record<string, number> = {};
  categories.forEach((c) => { freq[c] = (freq[c] ?? 0) + 1; });
  const topCategory = categories.length
    ? Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return {
    avgPrice,
    medianPrice,
    publisherCount: countRes.count ?? null,
    avgFollowers,
    topCategory,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BudgetCalculator() {
  const channels = getEnabledChannels();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [industry, setIndustry] = useState("retail");
  const [customerValue, setCustomerValue] = useState(400);
  const [useIndustryLtv, setUseIndustryLtv] = useState(false);
  const [acceptablePct, setAcceptablePct] = useState(20);
  const [targetCustomers, setTargetCustomers] = useState(10);
  const [campaignGoal, setCampaignGoal] = useState("awareness");
  const [durationMonths, setDurationMonths] = useState(1);
  const [audienceSize, setAudienceSize] = useState("mid");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(["social-media"]);
  const [repeatPurchaseRate, setRepeatPurchaseRate] = useState(30);
  const [existingMonthlySpend, setExistingMonthlySpend] = useState(0);

  // ── Live DB stats ───────────────────────────────────────────────────────────
  const [marketStats, setMarketStats] = useState<MarketStats>({
    avgPrice: null,
    medianPrice: null,
    publisherCount: null,
    avgFollowers: null,
    topCategory: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchMarketStats()
      .then(setMarketStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // ── Sync industry LTV ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!useIndustryLtv) return;
    const ind = INDUSTRIES.find((i) => i.value === industry);
    if (ind) setCustomerValue(ind.avgLtv);
  }, [industry, useIndustryLtv]);

  function toggleChannel(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const goal = CAMPAIGN_GOALS.find((g) => g.value === campaignGoal);
    const audience = AUDIENCE_SIZES.find((a) => a.value === audienceSize);
    const priceMultiplier = audience?.priceMultiplier ?? 1;

    // Effective customer value factors in repeat-purchase probability
    const repeatBonus = customerValue * (repeatPurchaseRate / 100) * 0.5;
    const effectiveLtv = customerValue + repeatBonus;

    const costPerCustomer = effectiveLtv * (acceptablePct / 100);
    const totalBudget = Math.round(costPerCustomer * targetCustomers);
    const monthlyBudget = Math.round(totalBudget / Math.max(1, durationMonths));
    const channelCount = Math.max(1, selectedSlugs.length);
    const perChannel = Math.round(monthlyBudget / channelCount);

    // Estimated placements using real market avg or fallback to MIN
    const effectivePrice = marketStats.avgPrice
      ? Math.round(marketStats.avgPrice * priceMultiplier)
      : Math.round(MIN_PRICE_PER_POST * priceMultiplier);
    const placementsTotal = Math.max(1, Math.floor(totalBudget / Math.max(MIN_PRICE_PER_POST, effectivePrice)));
    const placementsPerMonth = Math.max(1, Math.floor(monthlyBudget / Math.max(MIN_PRICE_PER_POST, effectivePrice)));

    // Estimated reach based on avg followers on platform
    const avgFollowersPerPublisher = marketStats.avgFollowers ?? 5000;
    const estimatedReach = placementsTotal * avgFollowersPerPublisher;

    // Estimated conversions from campaign
    const convRate = goal?.conversionRate ?? 0.03;
    const estimatedConversions = Math.round(estimatedReach * convRate);

    // ROI estimate
    const projectedRevenue = estimatedConversions * effectiveLtv;
    const roi = totalBudget > 0 ? ((projectedRevenue - totalBudget) / totalBudget) * 100 : 0;

    // How it compares to existing spend
    const vsExisting = existingMonthlySpend > 0 ? monthlyBudget - existingMonthlySpend : null;

    return {
      costPerCustomer,
      effectiveLtv,
      totalBudget,
      monthlyBudget,
      perChannel,
      placementsTotal,
      placementsPerMonth,
      estimatedReach,
      estimatedConversions,
      projectedRevenue,
      roi,
      vsExisting,
      effectivePrice,
    };
  }, [
    customerValue, acceptablePct, targetCustomers, selectedSlugs,
    campaignGoal, durationMonths, audienceSize, repeatPurchaseRate,
    existingMonthlySpend, marketStats,
  ]);

  const selectedIndustry = INDUSTRIES.find((i) => i.value === industry);

  return (
    <div className="max-w-4xl mx-auto px-5 py-16">
      <Seo
        title="Campaign Budget Calculator · ChatSched"
        description="Data-driven campaign budgeting: work backwards from your customer's lifetime value and get a real number — backed by live publisher pricing on the platform."
      />

      {/* Hero */}
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-green text-billboard-greenDeep px-3 py-1.5 rounded mb-3">
        Business Tools
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-2xl">What should your campaign actually cost?</h1>
      <p className="text-billboard-inkSoft max-w-2xl mb-3">
        Work backwards from what a customer is really worth — factoring in your goal, your industry, and live pricing
        data from publishers on this platform.
      </p>

      {/* Live market stat bar */}
      <div className="flex flex-wrap gap-4 mb-10">
        {[
          {
            label: "Avg. placement price",
            value: statsLoading ? "…" : marketStats.avgPrice ? formatCurrency(marketStats.avgPrice) : "—",
          },
          {
            label: "Median placement price",
            value: statsLoading ? "…" : marketStats.medianPrice ? formatCurrency(marketStats.medianPrice) : "—",
          },
          {
            label: "Active publishers",
            value: statsLoading ? "…" : marketStats.publisherCount?.toLocaleString() ?? "—",
          },
          {
            label: "Avg. audience size",
            value: statsLoading
              ? "…"
              : marketStats.avgFollowers
              ? marketStats.avgFollowers >= 1000
                ? `${(marketStats.avgFollowers / 1000).toFixed(1)}k`
                : String(marketStats.avgFollowers)
              : "—",
          },
        ].map((s) => (
          <div key={s.label} className="border-[3px] border-billboard-ink rounded px-4 py-2.5 flex flex-col">
            <span className="font-mono text-xs text-billboard-inkSoft uppercase tracking-wide">{s.label}</span>
            <span className="font-display text-xl font-bold" aria-live="polite">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* ── Inputs ── */}
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-6">

          {/* 1. Industry */}
          <div>
            <label className="block text-sm font-semibold mb-2">What industry are you in?</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
            {selectedIndustry && (
              <p className="text-xs text-billboard-inkSoft mt-1.5">
                Industry average customer LTV:{" "}
                <span className="font-semibold text-billboard-ink">{formatCurrency(selectedIndustry.avgLtv)}</span>
                {" — "}
                <button
                  type="button"
                  onClick={() => { setUseIndustryLtv(true); setCustomerValue(selectedIndustry.avgLtv); }}
                  className="underline text-billboard-ink font-semibold"
                >
                  use this
                </button>
              </p>
            )}
          </div>

          {/* 2. Customer LTV */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              What's a typical customer worth to you over their lifetime? (R)
            </label>
            <input
              type="number"
              min={0}
              value={customerValue}
              onChange={(e) => { setUseIndustryLtv(false); setCustomerValue(Number(e.target.value) || 0); }}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
            />
            <p className="text-xs text-billboard-inkSoft mt-1">
              Include the value of repeat purchases, not just the first sale.
            </p>
          </div>

          {/* 3. Repeat purchase probability */}
          <div>
            <label className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Chance a new customer buys again (%)</span>
              <span className="font-mono text-billboard-inkSoft">{repeatPurchaseRate}%</span>
            </label>
            <input
              type="range" min={0} max={100} step={5}
              value={repeatPurchaseRate}
              onChange={(e) => setRepeatPurchaseRate(Number(e.target.value))}
              className="w-full accent-billboard-yellow"
            />
            <p className="text-xs text-billboard-inkSoft mt-1">
              Boosts effective LTV — used to calculate a more accurate acquisition ceiling.
            </p>
          </div>

          {/* 4. Acceptable CAC % */}
          <div>
            <label className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Max % of that LTV you'd spend to acquire one customer</span>
              <span className="font-mono text-billboard-inkSoft">{acceptablePct}%</span>
            </label>
            <input
              type="range" min={5} max={60} step={1}
              value={acceptablePct}
              onChange={(e) => setAcceptablePct(Number(e.target.value))}
              className="w-full accent-billboard-yellow mb-2"
            />
            <div className="flex gap-2">
              {ACCEPTABLE_COST_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAcceptablePct(p)}
                  className={`font-mono text-xs font-semibold px-2.5 py-1.5 rounded border-2 border-billboard-ink transition ${
                    acceptablePct === p ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* 5. Target customers */}
          <div>
            <label className="block text-sm font-semibold mb-2">How many new customers is this campaign aiming for?</label>
            <input
              type="number" min={1} value={targetCustomers}
              onChange={(e) => setTargetCustomers(Math.max(1, Number(e.target.value) || 1))}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
            />
          </div>

          {/* 6. Campaign goal */}
          <div>
            <label className="block text-sm font-semibold mb-2">What's the primary goal of this campaign?</label>
            <div className="flex flex-col gap-2">
              {CAMPAIGN_GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setCampaignGoal(g.value)}
                  className={`text-left text-sm px-3 py-2 rounded border-2 border-billboard-ink transition ${
                    campaignGoal === g.value ? "bg-billboard-yellow font-semibold" : "bg-white hover:bg-billboard-paperDim"
                  }`}
                >
                  {g.label}
                  <span className="ml-1.5 font-mono text-xs text-billboard-inkSoft">
                    (~{(g.conversionRate * 100).toFixed(0)}% conversion rate)
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 7. Campaign duration */}
          <div>
            <label className="block text-sm font-semibold mb-2">How long will this campaign run?</label>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDurationMonths(d.value)}
                  className={`font-mono text-xs font-semibold px-3 py-2 rounded border-2 border-billboard-ink transition ${
                    durationMonths === d.value ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* 8. Preferred audience size */}
          <div>
            <label className="block text-sm font-semibold mb-2">What size publisher are you targeting?</label>
            <div className="flex flex-col gap-2">
              {AUDIENCE_SIZES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudienceSize(a.value)}
                  className={`text-left text-sm px-3 py-2 rounded border-2 border-billboard-ink transition ${
                    audienceSize === a.value ? "bg-billboard-yellow font-semibold" : "bg-white hover:bg-billboard-paperDim"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* 9. Channels */}
          <div>
            <label className="block text-sm font-semibold mb-2">Which channels are you spreading this across?</label>
            <div className="flex flex-wrap gap-2">
              {channels.map((m) => (
                <button
                  key={m.definition.slug}
                  type="button"
                  onClick={() => toggleChannel(m.definition.slug)}
                  className={`font-mono text-xs font-semibold px-3 py-2 rounded border-2 border-billboard-ink transition ${
                    selectedSlugs.includes(m.definition.slug)
                      ? "bg-billboard-yellow"
                      : "bg-white hover:bg-billboard-paperDim"
                  }`}
                >
                  {m.definition.name}
                </button>
              ))}
            </div>
          </div>

          {/* 10. Existing marketing spend */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              What do you currently spend on marketing per month? (R)
            </label>
            <input
              type="number" min={0} value={existingMonthlySpend}
              onChange={(e) => setExistingMonthlySpend(Number(e.target.value) || 0)}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2.5"
            />
            <p className="text-xs text-billboard-inkSoft mt-1">Used to show how this campaign compares to what you're already spending.</p>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="space-y-4">

          {/* Total budget */}
          <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-green text-white text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-white/80 mb-1">Suggested total campaign budget</p>
            <p className="font-display text-4xl mb-1">{formatCurrency(results.totalBudget)}</p>
            <p className="text-sm text-white/80">
              {formatCurrency(Math.round(results.monthlyBudget))} / month × {durationMonths} month{durationMonths > 1 ? "s" : ""}
            </p>
          </div>

          {/* Effective LTV */}
          <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper">
            <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-2">How we got there</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-billboard-inkSoft">Base customer value</span>
                <span className="font-semibold">{formatCurrency(customerValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-billboard-inkSoft">+ Repeat purchase bonus ({repeatPurchaseRate}%)</span>
                <span className="font-semibold">+ {formatCurrency(Math.round(results.effectiveLtv - customerValue))}</span>
              </div>
              <div className="flex justify-between border-t border-billboard-ink/10 pt-1.5">
                <span className="font-semibold">Effective LTV</span>
                <span className="font-bold">{formatCurrency(Math.round(results.effectiveLtv))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-billboard-inkSoft">× {acceptablePct}% acquisition ceiling</span>
                <span className="font-semibold">= {formatCurrency(Math.round(results.costPerCustomer))} per customer</span>
              </div>
              <div className="flex justify-between">
                <span className="text-billboard-inkSoft">× {targetCustomers} target customers</span>
                <span className="font-bold">{formatCurrency(results.totalBudget)}</span>
              </div>
            </div>
          </div>

          {/* Per-channel split */}
          <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-1">
              Per channel per month, split across {Math.max(1, selectedSlugs.length)}
            </p>
            <p className="font-display text-3xl mb-1">{formatCurrency(results.perChannel)}</p>
            <p className="text-xs text-billboard-inkSoft">Weight toward the channel that performs best once you have real data.</p>
          </div>

          {/* Placements & reach */}
          <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper">
            <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-3">Estimated reach & placements</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Placements (total)",
                  value: results.placementsTotal.toLocaleString(),
                  sub: `~${results.placementsPerMonth}/month`,
                },
                {
                  label: "Est. total reach",
                  value:
                    results.estimatedReach >= 1000
                      ? `${(results.estimatedReach / 1000).toFixed(0)}k`
                      : String(results.estimatedReach),
                  sub: "unique followers touched",
                },
                {
                  label: "Est. conversions",
                  value: results.estimatedConversions.toLocaleString(),
                  sub: `${(CAMPAIGN_GOALS.find((g) => g.value === campaignGoal)?.conversionRate ?? 0.03 * 100).toFixed(0)}% conversion rate`,
                },
                {
                  label: "Avg. price used",
                  value: formatCurrency(results.effectivePrice),
                  sub: statsLoading ? "loading…" : marketStats.avgPrice ? "live platform avg" : "platform minimum",
                },
              ].map((s) => (
                <div key={s.label} className="border border-billboard-ink/15 rounded p-3">
                  <p className="text-xs text-billboard-inkSoft mb-0.5">{s.label}</p>
                  <p className="font-bold text-lg">{s.value}</p>
                  <p className="text-xs text-billboard-inkSoft">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ROI estimate */}
          <div className={`border-[3px] rounded p-5 ${
            results.roi >= 0 ? "border-billboard-green bg-billboard-green/10" : "border-billboard-red bg-billboard-red/10"
          }`}>
            <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-2">Projected ROI</p>
            <div className="flex items-end gap-3">
              <p className="font-display text-3xl font-bold">
                {results.roi >= 0 ? "+" : ""}{Math.round(results.roi)}%
              </p>
              <p className="text-sm text-billboard-inkSoft pb-1">
                ({formatCurrency(Math.round(results.projectedRevenue))} projected revenue on {formatCurrency(results.totalBudget)} spend)
              </p>
            </div>
            <p className="text-xs text-billboard-inkSoft mt-1">
              Based on estimated conversions × effective LTV. Treat as a planning guide, not a guarantee.
            </p>
          </div>

          {/* vs existing spend */}
          {results.vsExisting !== null && (
            <div className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paperDim">
              <p className="text-xs text-billboard-inkSoft">
                This campaign budget is{" "}
                <strong>
                  {results.vsExisting > 0
                    ? `${formatCurrency(results.vsExisting)} more`
                    : results.vsExisting < 0
                    ? `${formatCurrency(Math.abs(results.vsExisting))} less`
                    : "the same"}
                </strong>
                {" "}
                per month than your current spend of {formatCurrency(existingMonthlySpend)}.
              </p>
            </div>
          )}

          {/* Market benchmark */}
          {!statsLoading && marketStats.medianPrice && (
            <div className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paperDim">
              <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-1">Market benchmark</p>
              <p className="text-xs text-billboard-inkSoft">
                The median placement on this platform costs{" "}
                <strong>{formatCurrency(marketStats.medianPrice)}</strong>. Your budget covers roughly{" "}
                <strong>{results.placementsTotal} placement{results.placementsTotal !== 1 ? "s" : ""}</strong>{" "}
                at current market rates.
              </p>
            </div>
          )}

          <Link
            to="/browse"
            className="block text-center bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
          >
            Browse publishers →
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-14 pt-10 border-t-2 border-billboard-ink/10 text-center">
        <p className="text-sm text-billboard-inkSoft">
          Placement prices shown use live data from approved publishers on ChatSched.{" "}
          Conversion rates are industry estimates.{" "}
          Want the reasoning? Read{" "}
          <Link
            to="/business-success/calculating-your-campaign-budget"
            className="underline font-semibold text-billboard-ink"
          >
            Calculating a campaign budget that actually makes sense
          </Link>{" "}
          in the Business Success Centre.
        </p>
      </div>
    </div>
  );
}
