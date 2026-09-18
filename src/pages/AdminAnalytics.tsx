import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { StatCardGridSkeleton, SkeletonBlock, SkeletonLine } from "../components/Skeleton";
import Button from "../components/Button";
import { PLATFORM_COMMISSION_RATE, PUBLISHER_SUBSCRIPTION_PRICE, BUSINESS_SUBSCRIPTION_PRICE } from "../lib/constants";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";

interface Overview {
  ok: boolean;
  total_gmv: number;
  total_paid_payments: number;
  total_requests: number;
  paid_requests: number;
  avg_order_value: number;
  new_publishers: number;
  new_businesses: number;
  applications: number;
  approved_applications: number;
  // Margin/economics — see analytics_functions.sql's header comment for
  // why total_gmv above already includes these, and why MRR/credit are
  // current snapshots rather than period totals.
  channel_gmv: number;
  paid_channel_requests: number;
  active_publisher_subs: number;
  active_business_subs: number;
  failed_publisher_subs: number;
  failed_business_subs: number;
  credit_granted: number;
  credit_redeemed: number;
  credit_outstanding: number;
  credit_applied_in_period: number;
}

interface SeriesPoint { ts: string; value: number }
interface TopItem { id: string; label: string; value: number }

function formatCurrency(n: number | null | undefined): string {
  return formatCurrencyShared(n == null ? 0 : Number(n), { cents: true });
}

function Sparkline({ series }: { series: SeriesPoint[] }) {
  if (!series || series.length === 0) return <div className="h-10" />;
  const max = Math.max(...series.map((s) => s.value), 1);
  const points = series
    .map((s, i) => {
      const x = series.length > 1 ? (i / (series.length - 1)) * 100 : 0;
      const y = 100 - (s.value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-10">
      <polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-billboard-red" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
] as const;

export default function AdminAnalytics() {
  const [range, setRange] = useState<number>(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [gmvSeries, setGmvSeries] = useState<SeriesPoint[]>([]);
  const [reqSeries, setReqSeries] = useState<SeriesPoint[]>([]);
  const [topPublishers, setTopPublishers] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function rangeDates(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    const { start, end } = rangeDates(range);
    const interval = range <= 30 ? "day" : "week";

    const [{ data: ov, error: oe }, { data: gts, error: ge }, { data: rts, error: re }, { data: top, error: te }] = await Promise.all([
      supabase.rpc("analytics_get_overview", { p_start: start, p_end: end }),
      supabase.rpc("analytics_time_series", { p_metric: "gmv", p_interval: interval, p_start: start, p_end: end }),
      supabase.rpc("analytics_time_series", { p_metric: "requests", p_interval: interval, p_start: start, p_end: end }),
      supabase.rpc("analytics_segmented_by", { p_kind: "publisher_gmv", p_start: start, p_end: end, p_limit: 10 }),
    ]);

    const firstError = oe || ge || re || te;
    if (firstError) setLoadError(firstError.message);

    // analytics_*() RPCs return `jsonb`, which supabase-js already parses
    // into a plain object/array — a previous version of this page called
    // JSON.parse() on these fields, which throws once there's any real
    // data (JSON.parse expects a string, not an already-parsed array).
    // That's why removing it matters, not just style.
    setOverview((ov as Overview) ?? null);
    setGmvSeries(((gts as { series?: SeriesPoint[] })?.series ?? []));
    setReqSeries(((rts as { series?: SeriesPoint[] })?.series ?? []));
    setTopPublishers(((top as { items?: TopItem[] })?.items ?? []));
    setLoading(false);
  }

  useEffect(() => { load(); }, [range]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b-[3px] border-billboard-ink pb-4">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setRange(opt.days)}
            className={`font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 transition ${
              range === opt.days ? "bg-billboard-yellow" : "hover:-translate-y-0.5"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <Button onClick={load} variant="outline" size="sm" className="ml-auto">
          Refresh
        </Button>
      </div>

      {loadError && (
        <p className="text-billboard-red text-xs font-semibold mb-4">
          {loadError} — analytics RPCs require an admin session; if this persists, confirm analytics_functions.sql has been run against your Supabase project.
        </p>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading analytics">
          <StatCardGridSkeleton count={4} />
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <div className="border-[3px] border-billboard-ink/15 rounded p-4">
              <SkeletonLine className="w-24 mb-3" />
              <SkeletonBlock className="h-10" />
            </div>
            <div className="border-[3px] border-billboard-ink/15 rounded p-4">
              <SkeletonLine className="w-24 mb-3" />
              <SkeletonBlock className="h-10" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="border-[3px] border-billboard-ink rounded p-4">
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">GMV</p>
              <p className="text-2xl font-bold mt-2">{formatCurrency(overview?.total_gmv ?? 0)}</p>
              <p className="text-xs text-billboard-inkSoft mt-1">
                {overview?.total_paid_payments ?? 0} original-flow + {overview?.paid_channel_requests ?? 0} channel payments
              </p>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-4">
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Requests</p>
              <p className="text-2xl font-bold mt-2">{overview?.total_requests ?? 0}</p>
              <p className="text-xs text-billboard-inkSoft mt-1">{overview?.paid_requests ?? 0} paid</p>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-4">
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Publisher approval rate</p>
              <p className="text-2xl font-bold mt-2">
                {overview?.applications ? Math.round(((overview.approved_applications ?? 0) / overview.applications) * 100) : 0}%
              </p>
              <p className="text-xs text-billboard-inkSoft mt-1">{overview?.new_publishers ?? 0} new publishers</p>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-4">
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Avg order value</p>
              <p className="text-2xl font-bold mt-2">{formatCurrency(overview?.avg_order_value ?? 0)}</p>
              <p className="text-xs text-billboard-inkSoft mt-1">{overview?.new_businesses ?? 0} new businesses</p>
            </div>
          </div>

          <div className="border-[3px] border-billboard-ink rounded p-5 mb-8">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <p className="font-bold text-sm">Revenue &amp; margin</p>
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Commission is period-scoped · activation/credit are today's snapshot</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Commission earned (period)</p>
                <p className="text-xl font-bold mt-1">{formatCurrency((overview?.total_gmv ?? 0) * PLATFORM_COMMISSION_RATE)}</p>
                <p className="text-[11px] text-billboard-inkSoft mt-1">{Math.round(PLATFORM_COMMISSION_RATE * 100)}% of {formatCurrency(overview?.total_gmv ?? 0)} GMV</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Activation revenue (lifetime)</p>
                <p className="text-xl font-bold mt-1">
                  {formatCurrency((overview?.active_publisher_subs ?? 0) * PUBLISHER_SUBSCRIPTION_PRICE + (overview?.active_business_subs ?? 0) * BUSINESS_SUBSCRIPTION_PRICE)}
                </p>
                <p className="text-[11px] text-billboard-inkSoft mt-1">
                  {overview?.active_publisher_subs ?? 0} publisher + {overview?.active_business_subs ?? 0} business — once-off, not recurring (item 10)
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Failed activations</p>
                <p className="text-xl font-bold mt-1">{(overview?.failed_publisher_subs ?? 0) + (overview?.failed_business_subs ?? 0)}</p>
                <p className="text-[11px] text-billboard-inkSoft mt-1">
                  {overview?.failed_publisher_subs ?? 0} publisher · {overview?.failed_business_subs ?? 0} business — can retry any time, nothing lapses
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Launch credit outstanding</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(overview?.credit_outstanding ?? 0)}</p>
                <p className="text-[11px] text-billboard-inkSoft mt-1">
                  {formatCurrency(overview?.credit_granted ?? 0)} granted · {formatCurrency(overview?.credit_applied_in_period ?? 0)} redeemed this period
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-8">
            <div className="border-[3px] border-billboard-ink rounded p-4">
              <p className="font-bold text-sm mb-2">GMV over time</p>
              <Sparkline series={gmvSeries} />
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-4">
              <p className="font-bold text-sm mb-2">Requests over time</p>
              <Sparkline series={reqSeries} />
            </div>
          </div>

          <div className="border-[3px] border-billboard-ink rounded p-5">
            <p className="font-bold text-sm mb-3">Top publishers by GMV</p>
            {topPublishers.length === 0 ? (
              <p className="text-billboard-inkSoft text-sm">No paid campaigns in this period yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase text-billboard-inkSoft">
                    <th className="pb-2">Publisher</th>
                    <th className="pb-2 text-right">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {topPublishers.map((p) => (
                    <tr key={p.id} className="border-t border-billboard-paperDim">
                      <td className="py-2">{p.label}</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
