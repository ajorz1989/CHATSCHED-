import { Link } from "react-router-dom";
import { PUBLISHER_SHARE } from "../lib/constants";
import { computePublisherChecklist } from "../lib/onboardingChecklist";
import type { Publisher, PublisherRequest, ChannelRequest, Payment } from "../lib/types";
import Button from "./Button";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatR(n: number): string {
  return formatCurrencyShared(n);
}

// Everything here is derived from data PublisherDashboardView.tsx already
// has loaded (publisher, requests, channelRequests, connected platform
// count) — no separate fetch, so this doesn't add a single extra query.
export default function CreatorHomeSummary({
  firstName, publisher, isRequestFlowChannel, requests, channelRequests, connectedPlatformCount,
}: {
  firstName: string | null;
  publisher: Publisher;
  isRequestFlowChannel: boolean;
  requests: PublisherRequest[];
  channelRequests: ChannelRequest[];
  connectedPlatformCount: number;
}) {
  // ── Campaigns that need a response right now ──────────────────────────
  const actionableRequests = requests.filter((r) => r.status === "pending" || r.status === "contacted");
  const actionableChannelRequests = channelRequests.filter((r) => r.status === "pending" || r.status === "countered");
  const matchCount = actionableRequests.length + actionableChannelRequests.length;

  // ── New opportunities — the freshest of those ──────────────────────────
  const opportunities = [
    ...actionableRequests.map((r) => ({ id: r.id, name: r.business?.company_name || r.business?.full_name || "A business", created_at: r.created_at, kind: "request" as const })),
    ...actionableChannelRequests.map((r) => ({ id: r.id, name: r.business?.company_name || r.business?.full_name || "A business", created_at: r.created_at, kind: "channel" as const })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);

  // ── Profile completeness ────────────────────────────────────────────────
  const checklist = computePublisherChecklist(publisher, isRequestFlowChannel, requests, channelRequests, connectedPlatformCount);
  const doneCount = checklist.filter((i) => i.done).length;
  const completePct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0;
  const nextAction = checklist.find((i) => !i.done);

  // ── Earnings ─────────────────────────────────────────────────────────────
  // Same PUBLISHER_SHARE math EarningsDashboard.tsx uses, applied to
  // whichever flow this publisher's channel actually uses — request-flow
  // publishers earn via payments on `requests`, others via paid_at on
  // `channel_requests`. Only one of the two arrays is ever populated for
  // a given publisher, matching how load() above already branches.
  const paidPayments = requests.flatMap((r) => (r.payments ?? []) as Payment[]).filter((p) => p.status === "paid");
  const requestEarnings = paidPayments.reduce((s, p) => s + p.amount * PUBLISHER_SHARE, 0);
  const channelEarnings = channelRequests.filter((r) => r.paid_at).reduce((s, r) => s + (r.proposed_amount ?? 0) * PUBLISHER_SHARE, 0);
  const totalEarned = requestEarnings + channelEarnings;

  return (
    <div className="mb-10">
      <h1 className="text-3xl md:text-4xl mb-2">
        {greeting()}{firstName ? `, ${firstName}` : ""}.
      </h1>
      <p className="text-billboard-inkSoft mb-8">
        {matchCount === 0
          ? "No campaigns need a response right now — here's how to get more of them."
          : `${matchCount} campaign${matchCount === 1 ? "" : "s"} match${matchCount === 1 ? "es" : ""} your profile.`}
      </p>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        {/* New opportunities */}
        <div className="border-[3px] border-billboard-ink rounded p-5">
          <h2 className="font-bold text-sm mb-3">New opportunities</h2>
          {opportunities.length === 0 ? (
            <p className="text-sm text-billboard-inkSoft">Nothing waiting on you right now — new requests will show up here.</p>
          ) : (
            <div className="space-y-2.5">
              {opportunities.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{o.name}</span>
                  <span className="text-billboard-inkSoft font-mono text-[10px]">{new Date(o.created_at).toLocaleDateString("en-ZA")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile completeness */}
        <div className="border-[3px] border-billboard-ink rounded p-5">
          <h2 className="font-bold text-sm mb-3">Your profile is {completePct}% complete</h2>
          <div className="h-2.5 bg-billboard-paperDim border-2 border-billboard-ink rounded overflow-hidden mb-3">
            <div className="h-full bg-billboard-green" style={{ width: `${completePct}%` }} />
          </div>
          {nextAction ? (
            <p className="text-xs text-billboard-inkSoft">Next: {nextAction.label}</p>
          ) : (
            <p className="text-xs text-billboard-inkSoft">Everything's filled in.</p>
          )}
        </div>

        {/* Earnings */}
        <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-green text-white">
          <h2 className="font-mono text-xs uppercase tracking-wide text-white/80 mb-1">Your earnings</h2>
          <p className="font-display text-2xl mb-2">{formatR(totalEarned)}</p>
          <Link to="/dashboard/earnings" className="text-xs font-semibold underline text-white/90">Full earnings breakdown →</Link>
          <Link to="/publisher/relationships" className="block mt-1 text-xs font-semibold underline text-white/90">Businesses you've worked with →</Link>
          <Link to="/publisher/opportunities" className="block mt-1 text-xs font-semibold underline text-white/90">Browse open opportunities →</Link>
        </div>

        {/* Recommended actions */}
        <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-yellow">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wide mb-1.5">Recommended actions</h2>
          {nextAction ? (
            <>
              <p className="font-bold mb-1">{nextAction.label}</p>
              <p className="text-sm text-billboard-inkSoft mb-3">{nextAction.hint}</p>
              {nextAction.actionTo && (
                <Button to={nextAction.actionTo}>
                  {nextAction.actionLabel ?? "Do this now"} →
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-billboard-inkSoft">You're fully set up — respond to new requests as they come in.</p>
          )}
        </div>
      </div>
    </div>
  );
}
