import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { PUBLISHER_SHARE } from "../lib/constants";
import { scoreLabel } from "../lib/publisherDisplay";
import TrustBadge from "../components/TrustBadge";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import { SkeletonBlock, SkeletonLine, StatCardGridSkeleton, SkeletonRows } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import type { Publisher, PublisherRequest, Payment } from "../lib/types";

interface EarningsData {
  publisher: Publisher;
  requests: PublisherRequest[];
}

function StatCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`border-[3px] rounded p-5 ${accent ? "border-billboard-green bg-[#EAF3EC]" : "border-billboard-ink bg-white"}`}>
      <div className={`font-display text-2xl md:text-3xl ${accent ? "text-billboard-greenDeep" : ""}`}>{value}</div>
      <div className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mt-1">{label}</div>
      {sub && <div className="text-xs text-billboard-inkSoft mt-1">{sub}</div>}
    </div>
  );
}

function formatR(n: number): string {
  return formatCurrencyShared(n);
}

export default function EarningsDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) { setLoading(false); return; }

    async function load() {
      const { data: pub } = await supabase
        .from("publishers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!pub) { setLoading(false); return; }

      const { data: reqs } = await supabase
        .from("requests")
        .select("*, payments(*)")
        .eq("publisher_id", pub.id)
        .order("created_at", { ascending: false });

      setData({ publisher: pub as Publisher, requests: (reqs ?? []) as unknown as PublisherRequest[] });
      setLoading(false);
    }

    load();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-16" aria-busy="true" aria-label="Loading earnings">
        <SkeletonLine className="w-40 h-6 mb-4" />
        <SkeletonLine className="w-72 h-8 mb-2" />
        <SkeletonLine className="w-40 mb-8" />
        <StatCardGridSkeleton count={4} />
        <SkeletonBlock className="h-48 mt-8 mb-6" />
        <SkeletonRows count={4} />
      </div>
    );
  }

  if (!user || !profile) return <Navigate to="/login" replace />;
  if (profile.role !== "publisher") return <Navigate to="/dashboard" replace />;
  if (!isSupabaseConfigured) return <SetupNotice />;

  if (!data) {
    return (
      <div className="max-w-lg mx-auto px-5 py-24 text-center">
        <h1 className="text-2xl mb-3">No publisher profile found</h1>
        <p className="text-billboard-inkSoft mb-6">You need an approved publisher profile to view earnings.</p>
        <Link to="/apply" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
          Apply as publisher →
        </Link>
      </div>
    );
  }

  const { publisher, requests } = data;

  // ── Compute metrics ──
  const allPayments: Payment[] = requests.flatMap(r => (r.payments ?? []) as Payment[]);
  const paidPayments = allPayments.filter(p => p.status === "paid");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const payDate = (p: Payment) => new Date(p.paid_at ?? p.created_at);

  const thisMonthPaid = paidPayments.filter(p => payDate(p) >= monthStart);
  const thisWeekPaid = paidPayments.filter(p => payDate(p) >= weekAgo);

  const totalEarned = paidPayments.reduce((s, p) => s + p.amount * PUBLISHER_SHARE, 0);
  const monthEarned = thisMonthPaid.reduce((s, p) => s + p.amount * PUBLISHER_SHARE, 0);
  const weekEarned = thisWeekPaid.reduce((s, p) => s + p.amount * PUBLISHER_SHARE, 0);

  const pendingRequests = requests.filter(r => r.status === "pending" || r.status === "contacted");
  const completedRequests = requests.filter(r => r.status === "completed");
  const confirmedRequests = requests.filter(r => r.status === "confirmed");
  const declinedRequests = requests.filter(r => r.status === "declined");

  const withAmount = requests.filter(r => r.agreed_amount != null && r.agreed_amount > 0);
  const avgCampaignValue = withAmount.length
    ? withAmount.reduce((s, r) => s + (r.agreed_amount ?? 0), 0) / withAmount.length
    : 0;

  const decided = completedRequests.length + confirmedRequests.length + declinedRequests.length;
  const accepted = completedRequests.length + confirmedRequests.length;
  const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0;

  // Projected monthly: extrapolate current month pace
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedMonthly = dayOfMonth > 0 ? Math.round((monthEarned / dayOfMonth) * daysInMonth) : 0;

  // Last 3 months' average for comparison
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const last3MonthsPaid = paidPayments.filter(p => payDate(p) >= threeMonthsAgo && payDate(p) < monthStart);
  const avgMonthly3 = last3MonthsPaid.length ? last3MonthsPaid.reduce((s, p) => s + p.amount * PUBLISHER_SHARE, 0) / 3 : 0;
  const forecastBase = avgMonthly3 > 0 ? avgMonthly3 : projectedMonthly;

  // Recent 10 earnings entries
  const recentEarnings = [...paidPayments]
    .sort((a, b) => payDate(b).getTime() - payDate(a).getTime())
    .slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <Seo title="Earnings Dashboard · ChatSched" description="Your publisher earnings, projections, and campaign performance." />

      {/* Header */}
      <div className="mb-2">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
          Earnings
        </span>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl mb-1">Your earnings overview</h1>
            <p className="text-billboard-inkSoft">{publisher.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {publisher.level && (
              <span className="bg-billboard-ink text-white text-xs font-mono font-semibold px-2.5 py-1.5 rounded">
                <TrustBadge kind="publisher" level={publisher.level} />
              </span>
            )}
            {publisher.publisher_score > 0 && (
              <span className="text-xs font-mono uppercase text-billboard-inkSoft">
                Publisher Score: {scoreLabel(publisher.publisher_score)}
              </span>
            )}
            <Link to="/dashboard" className="text-xs font-semibold underline text-billboard-inkSoft">← Dashboard</Link>
          </div>
        </div>
      </div>

      {/* Forecast disclaimer */}
      <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-4 mb-8 mt-4">
        <p className="text-sm font-semibold">📊 About these forecasts</p>
        <p className="text-sm text-billboard-inkSoft mt-1">
          Projected figures are estimates based on your historical activity and typical marketplace patterns — not guarantees. Actual earnings depend on campaign bookings and payment completion.
        </p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Projected this month"
          value={formatR(forecastBase)}
          sub={avgMonthly3 > 0 ? "Based on last 3 months avg" : "Based on current pace"}
          accent
        />
        <StatCard
          label="Earned this month"
          value={formatR(monthEarned)}
          sub={`${thisMonthPaid.length} payment${thisMonthPaid.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Earned this week"
          value={formatR(weekEarned)}
          sub={`${thisWeekPaid.length} payment${thisWeekPaid.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Total lifetime"
          value={formatR(totalEarned)}
          sub={`${paidPayments.length} paid campaign${paidPayments.length !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Pending requests" value={String(pendingRequests.length)} sub="Awaiting response" />
        <StatCard label="Completed campaigns" value={String(completedRequests.length)} />
        <StatCard label="Avg campaign value" value={avgCampaignValue > 0 ? formatR(avgCampaignValue) : "—"} sub="Agreed amount" />
        <StatCard
          label="Acceptance rate"
          value={decided > 0 ? `${acceptanceRate}%` : "—"}
          sub={decided > 0 ? `${accepted} of ${decided} decided` : "No decisions yet"}
        />
      </div>

      {/* Monthly earnings breakdown */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent payments */}
        <div>
          <h2 className="font-display text-lg mb-4">Recent payments</h2>
          {recentEarnings.length === 0 ? (
            <div className="border-[3px] border-dashed border-billboard-ink rounded">
              <EmptyState kind="wallet" title="No payments yet" description="Completed campaigns will show up here once paid." compact />
            </div>
          ) : (
            <div className="border-[3px] border-billboard-ink rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-billboard-paperDim border-b-2 border-billboard-ink">
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase text-billboard-inkSoft">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-mono uppercase text-billboard-inkSoft">Campaign</th>
                    <th className="text-right px-4 py-3 text-xs font-mono uppercase text-billboard-inkSoft">Your cut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEarnings.map(p => (
                    <tr key={p.id} className="border-t border-billboard-paperDim hover:bg-billboard-paperDim/50">
                      <td className="px-4 py-3 text-xs text-billboard-inkSoft whitespace-nowrap">
                        {payDate(p).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-billboard-inkSoft">
                        {formatR(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-billboard-greenDeep">
                        {formatR(p.amount * PUBLISHER_SHARE)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-billboard-inkSoft mt-2">
            Your share is {Math.round(PUBLISHER_SHARE * 100)}% of each campaign payment.{" "}
            <Link to="/fees" className="underline font-semibold text-billboard-ink">How is this calculated?</Link>
          </p>
        </div>

        {/* Pipeline */}
        <div>
          <h2 className="font-display text-lg mb-4">Campaign pipeline</h2>
          <div className="space-y-3">
            {[
              { label: "Pending / in discussion", count: pendingRequests.length, color: "bg-billboard-inkSoft" },
              { label: "Confirmed (awaiting payment)", count: confirmedRequests.length, color: "bg-billboard-yellow" },
              { label: "Completed", count: completedRequests.length, color: "bg-billboard-green" },
              { label: "Declined", count: declinedRequests.length, color: "bg-billboard-red" },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                <div className="flex-1 text-sm">{label}</div>
                <span className="font-mono font-bold text-sm">{count}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t-2 border-billboard-paperDim">
            <h3 className="font-semibold text-sm mb-3">Projected pipeline value</h3>
            {confirmedRequests.length > 0 ? (
              <div>
                <p className="font-display text-2xl text-billboard-greenDeep">
                  {formatR(
                    confirmedRequests
                      .filter(r => r.agreed_amount != null)
                      .reduce((s, r) => s + (r.agreed_amount ?? 0) * PUBLISHER_SHARE, 0)
                  )}
                </p>
                <p className="text-xs text-billboard-inkSoft mt-1">
                  From {confirmedRequests.length} confirmed campaign{confirmedRequests.length !== 1 ? "s" : ""} awaiting payment.
                  Based on historical marketplace data — actual amounts may differ.
                </p>
              </div>
            ) : (
              <p className="text-sm text-billboard-inkSoft">No confirmed campaigns in pipeline.</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
            <p className="text-xs text-billboard-inkSoft">
              <strong>Response time matters.</strong> Publishers who respond within 24 hours earn{" "}
              <strong>40% more</strong> on average, based on marketplace data. Head to{" "}
              <Link to="/dashboard" className="underline">your dashboard</Link> to reply to pending requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
