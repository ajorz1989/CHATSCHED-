import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { calculateSuggestedPrice, MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import { formatCurrency, formatCurrencyRange } from "../lib/currency";

const CAMPAIGNS_PER_MONTH_OPTIONS = [1, 2, 4, 8];

export default function EarningsEstimator({ embedded = false }: { embedded?: boolean }) {
  const [followers, setFollowers] = useState(5000);
  const [engagement, setEngagement] = useState(3);
  const [trustScore, setTrustScore] = useState<number | null>(null); // null = "I'm new, don't have one yet"
  const [monthlyReach, setMonthlyReach] = useState<number | null>(null);
  const [campaignsPerMonth, setCampaignsPerMonth] = useState(2);

  const valuation = useMemo(
    () => calculateSuggestedPrice({ followers, engagement, trustScore, monthlyReach }),
    [followers, engagement, trustScore, monthlyReach]
  );

  const monthlyLow = valuation.low * campaignsPerMonth;
  const monthlyHigh = valuation.high * campaignsPerMonth;

  return (
    <div id={embedded ? "earnings-estimator" : undefined} className="max-w-3xl mx-auto px-5 py-16">
      {!embedded && <Seo title="Publisher Earnings Estimator · ChatSched" description="Estimate what your page, channel or audience could earn on ChatSched — using the same Suggested Price formula the platform itself uses." />}

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Publisher Tools</span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">What could your audience earn?</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">This runs the exact same Suggested Price calculation your dashboard would show you once you're a publisher — not a separate guess, the real formula.</p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-6">
          <div>
            <label className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Followers / audience size</span>
              <span className="font-mono text-billboard-inkSoft">{followers.toLocaleString()}</span>
            </label>
            <input type="range" min={0} max={100000} step={500} value={followers} onChange={(e) => setFollowers(Number(e.target.value))} className="w-full accent-billboard-yellow" />
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Engagement rate</span>
              <span className="font-mono text-billboard-inkSoft">{engagement.toFixed(1)}%</span>
            </label>
            <input type="range" min={0} max={15} step={0.1} value={engagement} onChange={(e) => setEngagement(Number(e.target.value))} className="w-full accent-billboard-yellow" />
            <p className="text-xs text-billboard-inkSoft mt-1.5">The model is centred around a ~2% baseline — typical for South African social platforms.</p>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Monthly reach <span className="font-normal text-billboard-inkSoft">(optional)</span></span>
              <span className="font-mono text-billboard-inkSoft">{monthlyReach !== null ? monthlyReach.toLocaleString() : "—"}</span>
            </label>
            <input
              type="number" min={0} placeholder="Leave blank if unsure"
              value={monthlyReach ?? ""}
              onChange={(e) => setMonthlyReach(e.target.value === "" ? null : Number(e.target.value))}
              className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-billboard-inkSoft mt-1.5">If your monthly reach is meaningfully higher than your follower count (shares, group activity), it's worth a small bonus.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Trust score</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTrustScore(null)}
                className={`font-mono text-xs font-semibold uppercase px-3 py-2 rounded border-2 border-billboard-ink transition ${trustScore === null ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}
              >
                I'm new — no score yet
              </button>
              {[25, 50, 75, 100].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTrustScore(s)}
                  className={`font-mono text-xs font-semibold px-3 py-2 rounded border-2 border-billboard-ink transition ${trustScore === s ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Campaigns per month</label>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGNS_PER_MONTH_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCampaignsPerMonth(n)}
                  className={`font-mono text-xs font-semibold px-3 py-2 rounded border-2 border-billboard-ink transition ${campaignsPerMonth === n ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-green text-white text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-white/80 mb-1">Suggested price per placement</p>
            <p className="font-display text-4xl mb-1">{formatCurrency(valuation.suggested)}</p>
            <p className="text-sm text-white/80">typically {formatCurrencyRange(valuation.low, valuation.high)}</p>
          </div>

          <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paper text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-1">Estimated monthly, at {campaignsPerMonth} placement{campaignsPerMonth > 1 ? "s" : ""}</p>
            <p className="font-display text-3xl mb-1">{formatCurrencyRange(monthlyLow, monthlyHigh)}</p>
            <p className="text-xs text-billboard-inkSoft">Only if you actually book {campaignsPerMonth} a month — nothing here is guaranteed or automatic.</p>
          </div>

          <p className="text-xs text-billboard-inkSoft">
            The minimum price on any placement is {formatCurrency(MIN_PRICE_PER_POST)}. This is a starting guide — you always set your own final price, and it moves as your engagement and trust score change.
          </p>

          <Link to="/register?role=publisher" className="block text-center bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
            Apply as a publisher →
          </Link>
        </div>
      </div>

      <div className="mt-14 pt-10 border-t-2 border-billboard-ink/10 text-center">
        <p className="text-sm text-billboard-inkSoft">Want the reasoning behind these numbers? Read the <Link to="/publisher-success/how-to-price-your-advertising" className="underline font-semibold text-billboard-ink">pricing guide</Link> in the Publisher Success Centre.</p>
      </div>
    </div>
  );
}
