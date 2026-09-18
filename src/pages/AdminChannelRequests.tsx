import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getChannelBySlug } from "../lib/channelRegistry";
import { PLATFORM_COMMISSION_RATE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import { StatCardGridSkeleton, SkeletonRows } from "../components/Skeleton";
import ExportCsvButton from "../components/ExportCsvButton";
import PayoutComplianceHint from "../components/PayoutComplianceHint";
import MessageThread from "../components/MessageThread";
import RequestMetadataDetails from "../components/RequestMetadataDetails";
import ChannelIcon from "../components/ChannelIcon";
import type { CsvRow } from "../lib/csvExport";
import type { ChannelRequest } from "../lib/types";

/**
 * Admin's view of the request-flow channel workflow (every channel
 * except social-media). The creator handles
 * approve/decline/mark-live themselves (PublisherDashboardView) — admin's
 * only two jobs here are the two steps that need someone to confirm money
 * actually moved: payment received, and payout sent. Everything else is
 * read-only status/monitoring, same division of labour as AdminPayouts.
 */
function buildChannelRequestRows(requests: ChannelRequest[]): CsvRow[] {
  return requests.map((r) => {
    const chDef = r.creator ? getChannelBySlug(r.creator.channel_slug)?.definition : getChannelBySlug(r.channel_slug)?.definition;
    // A counter never changes the platform's cut in this model — it only
    // changes what the business pays and the creator receives — so the
    // commission/share columns are always computed off whichever amount
    // actually applies: the counter once one exists, the original
    // proposal otherwise.
    const finalAmount = r.status === "countered" || r.counter_amount != null ? (r.counter_amount ?? r.proposed_amount) : r.proposed_amount;
    return {
      Channel: chDef?.name || r.channel_slug,
      Creator: r.creator?.name || "",
      Business: r.business?.company_name || r.business?.full_name || "",
      "Advertising method": r.advertising_method,
      "Proposed amount (R)": r.proposed_amount,
      "Counter amount (R)": r.counter_amount ?? "",
      "Countered at": r.countered_at ? new Date(r.countered_at).toISOString().slice(0, 10) : "",
      "Final amount (R)": finalAmount,
      "Platform commission (R)": (finalAmount * PLATFORM_COMMISSION_RATE).toFixed(2),
      "Creator share (R)": (finalAmount * (1 - PLATFORM_COMMISSION_RATE)).toFixed(2),
      Status: r.status,
      Created: new Date(r.created_at).toISOString().slice(0, 10),
      "Live at": r.live_at ? new Date(r.live_at).toISOString().slice(0, 10) : "",
      "Completed at": r.completed_at ? new Date(r.completed_at).toISOString().slice(0, 10) : "",
    };
  });
}

export default function AdminChannelRequests() {
  const [requests, setRequests] = useState<ChannelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"needs_action" | "all" | "overdue">("needs_action");
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("channel_requests")
      .select("*, creator:publishers(id, name, city, province, channel_slug), business:profiles(full_name, company_name, phone)")
      .order("created_at", { ascending: false });
    setRequests((data ?? []) as unknown as ChannelRequest[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function confirmPayment(id: string) {
    setActingId(id);
    await supabase.from("channel_requests").update({ status: "paid" }).eq("id", id);
    setActingId(null);
    load();
  }

  async function confirmPayout(id: string) {
    setActingId(id);
    await supabase.from("channel_requests").update({ status: "completed" }).eq("id", id);
    setActingId(null);
    load();
  }

  async function closeExpired(id: string, next: "declined" | "cancelled") {
    setActingId(id);
    await supabase.from("channel_requests").update({ status: next }).eq("id", id);
    setActingId(null);
    load();
  }

  const now = Date.now();
  const isOverdue = (r: ChannelRequest) =>
    ((r.status === "pending" || r.status === "countered") && new Date(r.approval_due_at).getTime() < now) ||
    (r.status === "awaiting_payment" && r.payment_due_at != null && new Date(r.payment_due_at).getTime() < now);

  const needsAction = requests.filter((r) => r.status === "payment_submitted" || r.status === "live");
  const overdue = requests.filter(isOverdue);
  const visible = filter === "needs_action" ? needsAction : filter === "overdue" ? overdue : requests;

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    awaitingPayment: requests.filter((r) => r.status === "awaiting_payment").length,
    needsPaymentConfirm: requests.filter((r) => r.status === "payment_submitted").length,
    needsPayoutConfirm: requests.filter((r) => r.status === "live").length,
  };

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading channel requests">
        <StatCardGridSkeleton count={4} />
        <SkeletonRows count={3} className="mt-6" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-billboard-inkSoft text-sm mb-6">
        Influencer, website, podcast, and radio requests. Creators approve, decline, and mark their own posts live —
        your two jobs here are confirming a business's payment landed, and confirming a creator's payout went out.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="border-2 border-billboard-ink rounded p-3">
          <div className="font-display text-xl">{stats.needsPaymentConfirm}</div>
          <div className="text-[11px] font-mono uppercase text-billboard-inkSoft">Payment to confirm</div>
        </div>
        <div className="border-2 border-billboard-ink rounded p-3">
          <div className="font-display text-xl">{stats.needsPayoutConfirm}</div>
          <div className="text-[11px] font-mono uppercase text-billboard-inkSoft">Payout to confirm</div>
        </div>
        <div className="border-2 border-billboard-ink rounded p-3">
          <div className="font-display text-xl">{stats.awaitingPayment}</div>
          <div className="text-[11px] font-mono uppercase text-billboard-inkSoft">Awaiting business payment</div>
        </div>
        <div className="border-2 border-billboard-ink rounded p-3">
          <div className="font-display text-xl">{stats.pending}</div>
          <div className="text-[11px] font-mono uppercase text-billboard-inkSoft">Awaiting creator response</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-2">
          {(["needs_action", "overdue", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${filter === f ? "bg-billboard-ink text-white" : "bg-white"}`}
            >
              {f === "needs_action" ? `Needs action (${needsAction.length})` : f === "overdue" ? `Overdue (${overdue.length})` : `All (${requests.length})`}
            </button>
          ))}
        </div>
        <ExportCsvButton label="Export CSV" filenameBase="channel-requests" rows={buildChannelRequestRows(visible)} />
      </div>

      {visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft text-sm">
          Nothing here right now.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const chDef = r.creator ? getChannelBySlug(r.creator.channel_slug)?.definition : getChannelBySlug(r.channel_slug)?.definition;
            return (
              <div key={r.id} className="border-2 border-billboard-ink rounded p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div>
                  <p className="font-semibold text-sm">
                    {chDef ? <><ChannelIcon slug={chDef.slug} size="sm" /> {chDef.name}</> : r.channel_slug} · {r.creator?.name ?? "Unknown creator"} ← {r.business?.company_name || r.business?.full_name || "Unknown business"}
                  </p>
                  <p className="text-xs text-billboard-inkSoft mt-1">
                    {r.advertising_method} · {formatCurrency(r.proposed_amount)} (platform {formatCurrency(r.proposed_amount * PLATFORM_COMMISSION_RATE, { cents: true })} · creator {formatCurrency(r.proposed_amount * (1 - PLATFORM_COMMISSION_RATE), { cents: true })}){r.duration_days ? ` · ${r.duration_days} days` : ""} · status: <span className="font-mono">{r.status}</span>
                    {r.status === "countered" && r.counter_amount != null && <span className="font-mono"> (countered to {formatCurrency(r.counter_amount)})</span>}
                    {isOverdue(r) && <span className="text-billboard-red font-semibold"> · overdue</span>}
                  </p>
                  {r.campaign_message && <p className="text-sm text-billboard-inkSoft mt-1 max-w-md">{r.campaign_message}</p>}
                  <RequestMetadataDetails channelSlug={r.channel_slug} metadata={r.request_metadata} />
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status === "payment_submitted" && (
                    <button onClick={() => confirmPayment(r.id)} disabled={actingId === r.id} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-3 py-1.5 rounded text-xs hover:-translate-y-0.5 transition disabled:opacity-60">
                      Confirm payment received
                    </button>
                  )}
                  {r.status === "live" && (
                    <span className="flex items-center gap-2">
                      <PayoutComplianceHint campaignId={r.id} />
                      <button onClick={() => confirmPayout(r.id)} disabled={actingId === r.id} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-3 py-1.5 rounded text-xs hover:-translate-y-0.5 transition disabled:opacity-60">
                        Confirm payout sent
                      </button>
                    </span>
                  )}
                  {r.status === "pending" && isOverdue(r) && (
                    <button onClick={() => closeExpired(r.id, "declined")} disabled={actingId === r.id} className="border-2 border-billboard-red text-billboard-red font-bold px-3 py-1.5 rounded text-xs hover:bg-billboard-red hover:text-white transition disabled:opacity-60">
                      Close as expired
                    </button>
                  )}
                  {r.status === "countered" && isOverdue(r) && (
                    <button onClick={() => closeExpired(r.id, "cancelled")} disabled={actingId === r.id} className="border-2 border-billboard-red text-billboard-red font-bold px-3 py-1.5 rounded text-xs hover:bg-billboard-red hover:text-white transition disabled:opacity-60">
                      Close as expired
                    </button>
                  )}
                  {r.status === "awaiting_payment" && isOverdue(r) && (
                    <button onClick={() => closeExpired(r.id, "cancelled")} disabled={actingId === r.id} className="border-2 border-billboard-red text-billboard-red font-bold px-3 py-1.5 rounded text-xs hover:bg-billboard-red hover:text-white transition disabled:opacity-60">
                      Cancel — unpaid
                    </button>
                  )}
                </div>
                </div>
                <MessageThread channelRequestId={r.id} senderRole="admin" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
