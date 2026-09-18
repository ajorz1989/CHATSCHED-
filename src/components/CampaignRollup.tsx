import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { computeTotals, topCampaigns, bucketClicksByWeek, type WeekPoint } from "../lib/campaignRollup";
import { formatCurrency } from "../lib/currency";
import type { CampaignStats } from "../lib/types";

/**
 * Sits on the business Dashboard, above the Marketing Suite. Campaign
 * Tracker (inside the Marketing Suite) already shows real per-link
 * clicks/visits/leads/conversions — this rolls all of a business's
 * campaigns up into one "how am I doing overall" view, since a business
 * running several tracking links at once had no single place that
 * answered that without adding them up by hand.
 *
 * No new schema: `campaign_stats` is the same owner-scoped view Campaign
 * Tracker already reads, and the weekly click trend comes straight from
 * `campaign_events` — RLS on that table already restricts a business to
 * only the events belonging to its own campaigns (see
 * schema_phase30_campaign_tracking.sql's `campaign_events_select_owner`
 * policy), so no explicit owner filter is even needed in the query below.
 */

const WEEKS = 8;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-2 border-billboard-ink rounded p-3">
      <div className="font-display text-lg">{value}</div>
      <div className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-0.5">{label}</div>
    </div>
  );
}

function Sparkbars({ series }: { series: WeekPoint[] }) {
  const max = Math.max(...series.map((s) => s.clicks), 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {series.map((s) => (
        <div key={s.label} className="flex-1 h-full flex items-end" title={`${s.label}: ${s.clicks} click${s.clicks === 1 ? "" : "s"}`}>
          <div
            className="w-full bg-billboard-yellow border-2 border-billboard-ink rounded-t transition-all"
            style={{ height: `${Math.max(6, (s.clicks / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function CampaignRollup() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CampaignStats[]>([]);
  const [weeklyClicks, setWeeklyClicks] = useState<WeekPoint[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - WEEKS * 7);

    const [{ data: statsData }, { data: eventsData }] = await Promise.all([
      supabase.from("campaign_stats").select("*").eq("owner_id", user.id),
      supabase
        .from("campaign_events")
        .select("created_at")
        .eq("event_type", "click")
        .gte("created_at", rangeStart.toISOString()),
    ]);

    setStats((statsData ?? []) as CampaignStats[]);
    setWeeklyClicks(bucketClicksByWeek((eventsData ?? []) as { created_at: string }[], rangeStart, WEEKS));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white mb-8 animate-pulse h-48" />;
  }

  // Nothing created yet — Campaign Tracker's own empty state (inside the
  // Marketing Suite, right below this) already covers "create your first
  // tracking link", so this section just stays out of the way rather than
  // showing a second, redundant empty state above it.
  if (stats.length === 0) return null;

  const totals = computeTotals(stats);
  const activeCount = stats.filter((s) => s.status === "active").length;
  const top = topCampaigns(stats);
  const hasClickHistory = weeklyClicks.some((w) => w.clicks > 0);

  return (
    <section className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display text-lg">Campaign performance</h2>
        <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">{activeCount} active · {stats.length} total</span>
      </div>
      <p className="text-xs text-billboard-inkSoft mb-5">
        Rolled up across every tracking link you've created — manage individual links in Marketing Suite → Campaign Tracker below.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Clicks" value={totals.clicks} />
        <Stat label="Visits" value={totals.visits} />
        <Stat label="Leads" value={totals.leads} />
        <Stat label="Conversions" value={totals.conversions} />
      </div>

      {hasClickHistory && (
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-2">Clicks, last {WEEKS} weeks</p>
          <Sparkbars series={weeklyClicks} />
        </div>
      )}

      {top.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-2">Top campaigns</p>
          <div className="space-y-1.5">
            {top.map((t) => (
              <div key={t.campaign_id} className="flex items-center justify-between gap-3 text-sm border-b border-billboard-ink/10 pb-1.5 last:border-b-0 last:pb-0">
                <span className="font-semibold truncate">{t.name}</span>
                <span className="text-billboard-inkSoft font-mono text-xs shrink-0">{t.clicks} click{t.clicks === 1 ? "" : "s"} · {t.conversions} conv.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totals.conversionValue > 0 && (
        <p className="text-xs text-billboard-inkSoft mt-5 pt-4 border-t border-billboard-ink/10">
          Total conversion value logged: <strong className="text-billboard-ink">{formatCurrency(totals.conversionValue)}</strong>
        </p>
      )}
    </section>
  );
}
