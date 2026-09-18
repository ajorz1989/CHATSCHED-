import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getContentApproval } from "../lib/contentApproval";
import type { ChannelRequest, ContentApproval } from "../lib/types";

/**
 * A chronological, timestamped log of what's actually happened on one
 * campaign (channel_requests row) — "10:42 Publisher accepted campaign,
 * 11:05 Payment confirmed, ..." — shown on the business dashboard inside
 * each ChannelCampaignCard. Deliberately separate from that file's own
 * `Timeline` component just above it in the same file, which is a
 * five-dot progress stepper (Submitted → Approved → Paid → Live →
 * Completed) showing WHERE a campaign currently is — this one shows WHEN
 * each real step actually happened, and both are worth keeping: the
 * stepper for an at-a-glance read, this for the detail underneath. Named
 * differently (CampaignActivityTimeline, not Timeline) to avoid colliding
 * with that existing one.
 *
 * Built from real timestamp columns already on channel_requests
 * (created_at, countered_at, responded_at, payment_submitted_at, paid_at,
 * live_at, completed_at) and content_approvals (submitted_at,
 * draft_submitted_at, reviewed_at, approved_at, published_at) — nothing
 * here is invented or estimated. One real limitation, stated plainly
 * rather than glossed over: these are milestone columns on the CURRENT
 * row, not an append-only event log, so a request that went through more
 * than one counter-offer round, or more than one changes-requested round,
 * only has the most recent instance of each represented — accurate for
 * the common, straight-through path (which is what most campaigns
 * actually are), not a complete history of every back-and-forth for the
 * unusual ones.
 *
 * Genuinely real-time, not just accurately timestamped: channel_requests
 * and content_approvals weren't in the Realtime publication before this
 * (schema_phase45_realtime.sql only ever added notifications/messages/
 * conversation_messages/conversations) — a naive subscribe() against
 * either table would silently never fire, not error, which is exactly
 * the kind of gap that looks like it works until you actually watch two
 * browser tabs. Fixed in schema_phase84_realtime_channel_requests.sql,
 * alongside this component.
 *
 * Used on both sides of the same channel_request: the business dashboard
 * (ChannelCampaignCard.tsx) and the creator's own dashboard
 * (PublisherDashboardView.tsx's ChannelRequestCard), which is why
 * creator-attributed events (accepted/declined/proposed a price/
 * submitted content) take a `viewerIsCreator` flag — reads "The creator
 * accepted the campaign" on the business's screen, "You accepted the
 * campaign" on the creator's own. Business-attributed events (brief
 * submitted, content approved) aren't attributed by name either way —
 * there's only one business per request, so naming them added nothing a
 * viewer wouldn't already know from context.
 */

interface ActivityEvent {
  at: string; // ISO timestamp
  label: string;
}

function buildEvents(r: ChannelRequest, approval: ContentApproval | null, viewerIsCreator: boolean): ActivityEvent[] {
  const creatorName = viewerIsCreator ? "You" : (r.creator?.name ?? "The creator");
  const events: ActivityEvent[] = [{ at: r.created_at, label: "Campaign request sent" }];

  if (r.countered_at) {
    events.push({ at: r.countered_at, label: `${creatorName} proposed a different price` });
  }

  if (r.responded_at) {
    if (r.status === "declined") {
      events.push({ at: r.responded_at, label: `${creatorName} declined` });
    } else if (r.status === "cancelled") {
      events.push({ at: r.responded_at, label: "Request cancelled" });
    } else if (r.countered_at) {
      events.push({ at: r.responded_at, label: "Price agreed" });
    } else {
      events.push({ at: r.responded_at, label: `${creatorName} accepted the campaign` });
    }
  }

  if (r.payment_submitted_at) events.push({ at: r.payment_submitted_at, label: "Payment submitted for review" });
  if (r.paid_at) events.push({ at: r.paid_at, label: "Payment confirmed" });
  if (approval?.submitted_at) events.push({ at: approval.submitted_at, label: "Content brief submitted" });
  if (approval?.draft_submitted_at) events.push({ at: approval.draft_submitted_at, label: `${creatorName} submitted content for review` });
  if (approval?.reviewed_at && approval.change_request_notes) events.push({ at: approval.reviewed_at, label: "Changes requested" });
  if (approval?.approved_at) events.push({ at: approval.approved_at, label: "Content approved" });

  const publishedAt = approval?.published_at ?? r.live_at;
  if (publishedAt) events.push({ at: publishedAt, label: "Campaign went live" });
  if (r.completed_at) events.push({ at: r.completed_at, label: "Campaign completed" });

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function CampaignActivityTimeline({ request: r, onChange, viewerIsCreator = false }: { request: ChannelRequest; onChange: () => void; viewerIsCreator?: boolean }) {
  const [approval, setApproval] = useState<ContentApproval | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function loadApproval() {
    try {
      setApproval(await getContentApproval(r.id));
    } catch {
      setApproval(null); // no content_approvals row yet (payment not confirmed) — not an error
    }
  }

  useEffect(() => {
    loadApproval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  // Realtime, not polling — same pattern MessageThread.tsx already uses.
  // Filtered to this one campaign's rows; RLS (channel_requests_select_participant,
  // content_approvals_select_participant) is still the actual security
  // boundary, same reasoning as every other subscription in this codebase
  // (schema_phase45_realtime.sql's own header comment) — this filter is
  // only a bandwidth narrowing.
  useEffect(() => {
    const channel = supabase
      .channel(`campaign-activity:${r.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_requests", filter: `id=eq.${r.id}` },
        () => onChange()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_approvals", filter: `channel_request_id=eq.${r.id}` },
        () => loadApproval()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  const events = buildEvents(r, approval, viewerIsCreator);

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-mono uppercase font-semibold text-billboard-inkSoft hover:text-billboard-ink transition-colors"
      >
        {expanded ? "Hide activity ▲" : `Show activity (${events.length}) ▾`}
      </button>
      {expanded && (
        <ol className="mt-2 border-l-2 border-billboard-ink/15 pl-4 space-y-2">
          {events.map((e, i) => (
            <li key={i} className="text-xs">
              <span className="font-mono text-billboard-inkSoft">{formatDateTime(e.at)}</span>{" "}
              <span className="text-billboard-ink">{e.label}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
