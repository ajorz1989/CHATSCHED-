import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { StatCardGridSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import type { FlagReason } from "../lib/messageSafety";
import type { SenderRole } from "../lib/types";

/**
 * Admin visibility into flagged messages — closes the gap left in
 * PHASE3_MESSAGE_SAFETY_DELIVERY.md's "Not done" list: the trigger in
 * schema_phase57_message_safety.sql has been redacting and flagging since
 * that phase shipped, but nothing showed an admin what it caught. This is
 * read-only monitoring, not a moderation workflow — there's no
 * reviewed/resolved state in the schema, so there's nothing here to mark
 * done. Adding that is a reasonable next step, not attempted in this
 * pass, same as this codebase's own habit of saying so rather than
 * quietly leaving it out.
 *
 * Rendered as a tab inside Admin.tsx, matching how AdminCompliance /
 * AdminChannelRequests / AdminSecurity already work here — Admin.tsx
 * owns the one /admin route, this doesn't introduce a second one.
 *
 * Three queries, not one: flagged rows live on two tables
 * (`conversation_messages`, `messages`), and `messages` itself splits
 * across two mutually-exclusive parent columns (`request_id` /
 * `channel_request_id`, see schema_phase56_channel_messaging.sql) with
 * different business/publisher FKs on each side. Merged and sorted
 * client-side rather than forcing a single query across three shapes.
 */

type Surface = "direct" | "request" | "channel_request";

interface FlaggedRow {
  id: string;
  surface: Surface;
  body: string;
  flag_reason: FlagReason | null;
  flagged_at: string | null;
  sender_role: SenderRole;
  businessName: string;
  publisherName: string;
}

const SURFACE_LABEL: Record<Surface, string> = {
  direct: "Contact Publisher",
  request: "Campaign request",
  channel_request: "Channel request",
};

const REASON_LABEL: Record<FlagReason, string> = {
  phone_number: "Phone number",
  email: "Email",
  external_platform: "Named off-platform app",
};

const REASON_COLOR: Record<FlagReason, string> = {
  phone_number: "border-billboard-red text-billboard-red",
  email: "border-billboard-red text-billboard-red",
  external_platform: "border-billboard-yellowDeep text-billboard-yellowDeep",
};

function businessLabel(b?: { full_name: string | null; company_name: string | null } | null): string {
  return b?.company_name || b?.full_name || "Unknown business";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AdminMessageSafety() {
  const [rows, setRows] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [directRes, requestRes, channelRes] = await Promise.all([
      supabase
        .from("conversation_messages")
        .select(
          "id, body, flag_reason, flagged_at, sender_role, conversation:conversations(business:profiles!business_id(full_name, company_name), publisher:publishers!publisher_id(name))"
        )
        .eq("flagged", true)
        .order("flagged_at", { ascending: false }),
      supabase
        .from("messages")
        .select(
          "id, body, flag_reason, flagged_at, sender_role, request:requests(business:profiles!business_id(full_name, company_name), publisher:publishers!publisher_id(name))"
        )
        .eq("flagged", true)
        .not("request_id", "is", null)
        .order("flagged_at", { ascending: false }),
      supabase
        .from("messages")
        .select(
          "id, body, flag_reason, flagged_at, sender_role, channel_request:channel_requests(business:profiles!business_id(full_name, company_name), creator:publishers!creator_id(name))"
        )
        .eq("flagged", true)
        .not("channel_request_id", "is", null)
        .order("flagged_at", { ascending: false }),
    ]);

    const loadErr = directRes.error || requestRes.error || channelRes.error;
    if (loadErr) {
      setError(formatSupabaseError(loadErr, "Couldn't load flagged messages"));
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const direct = (directRes.data ?? []).map((r: any) => ({
      id: r.id,
      surface: "direct" as const,
      body: r.body,
      flag_reason: r.flag_reason,
      flagged_at: r.flagged_at,
      sender_role: r.sender_role,
      businessName: businessLabel(r.conversation?.business),
      publisherName: r.conversation?.publisher?.name ?? "Unknown publisher",
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = (requestRes.data ?? []).map((r: any) => ({
      id: r.id,
      surface: "request" as const,
      body: r.body,
      flag_reason: r.flag_reason,
      flagged_at: r.flagged_at,
      sender_role: r.sender_role,
      businessName: businessLabel(r.request?.business),
      publisherName: r.request?.publisher?.name ?? "Unknown publisher",
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (channelRes.data ?? []).map((r: any) => ({
      id: r.id,
      surface: "channel_request" as const,
      body: r.body,
      flag_reason: r.flag_reason,
      flagged_at: r.flagged_at,
      sender_role: r.sender_role,
      businessName: businessLabel(r.channel_request?.business),
      publisherName: r.channel_request?.creator?.name ?? "Unknown creator",
    }));

    const merged: FlaggedRow[] = [...direct, ...request, ...channel].sort(
      (a, b) => new Date(b.flagged_at ?? 0).getTime() - new Date(a.flagged_at ?? 0).getTime()
    );
    setRows(merged);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) return <StatCardGridSkeleton count={4} />;

  const byReason = (reason: FlagReason) => rows.filter((r) => r.flag_reason === reason).length;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBlock label="Total flagged" value={rows.length} accent={rows.length > 0} />
        <StatBlock label="Phone numbers" value={byReason("phone_number")} />
        <StatBlock label="Emails" value={byReason("email")} />
        <StatBlock label="Named off-platform apps" value={byReason("external_platform")} />
      </div>

      {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}

      {rows.length === 0 ? (
        <EmptyState kind="list" title="Nothing flagged" compact />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={`${r.surface}-${r.id}`} className="border-[3px] border-billboard-ink rounded p-4 bg-white">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink px-2 py-0.5 rounded">
                  {SURFACE_LABEL[r.surface]}
                </span>
                {r.flag_reason && (
                  <span className={`font-mono text-[10px] font-semibold uppercase border-2 px-2 py-0.5 rounded ${REASON_COLOR[r.flag_reason]}`}>
                    {REASON_LABEL[r.flag_reason]}
                  </span>
                )}
                <span className="font-mono text-[10px] text-billboard-inkSoft ml-auto">{relativeTime(r.flagged_at)}</span>
              </div>
              <p className="text-sm mb-2">{r.body}</p>
              <p className="text-[11px] text-billboard-inkSoft">
                {r.businessName} ↔ {r.publisherName} · sent by {r.sender_role}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border-[3px] rounded p-4 ${accent ? "border-billboard-red" : "border-billboard-ink"}`}>
      <p className={`text-2xl font-display ${accent ? "text-billboard-red" : ""}`}>{value}</p>
      <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">{label}</p>
    </div>
  );
}
