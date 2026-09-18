import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { SkeletonRows } from "../components/Skeleton";
import { formatCurrency } from "../lib/currency";
import type { Opportunity, OpportunityApplication, OpportunityStatus, OpportunityApplicationStatus } from "../lib/types";

const STATUSES: OpportunityStatus[] = ["draft", "open", "filled", "closed", "cancelled"];
const STATUS_LABEL: Record<OpportunityStatus, string> = {
  draft: "Draft",
  open: "Open",
  filled: "Filled",
  closed: "Closed",
  cancelled: "Cancelled",
};
const STATUS_TONE: Record<OpportunityStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-400",
  open: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  filled: "bg-green-100 text-green-800 border-green-800",
  closed: "bg-billboard-inkSoft/10 text-billboard-inkSoft border-billboard-inkSoft",
  cancelled: "bg-billboard-inkSoft/10 text-billboard-inkSoft border-billboard-inkSoft",
};
const APP_STATUS_LABEL: Record<OpportunityApplicationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};
const APP_STATUS_TONE: Record<OpportunityApplicationStatus, string> = {
  pending: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  accepted: "bg-green-100 text-green-800 border-green-800",
  declined: "bg-billboard-inkSoft/10 text-billboard-inkSoft border-billboard-inkSoft",
  withdrawn: "bg-billboard-inkSoft/10 text-billboard-inkSoft border-billboard-inkSoft",
};

interface BusinessOption {
  id: string;
  full_name: string | null;
  company_name: string | null;
}
interface PublisherOption {
  id: string;
  name: string;
}

function businessLabel(id: string, businesses: Record<string, BusinessOption>): string {
  const b = businesses[id];
  if (!b) return "Business";
  return b.company_name || b.full_name || "Business";
}

/**
 * Admin's read-mostly view of the opportunity feed / reverse marketplace
 * (schema_phase68_opportunity_marketplace.sql) — the one major surface
 * from that phase without an admin tab, per its own "Not done" list.
 *
 * Deliberately scoped as visibility + light moderation, not a way for
 * admin to accept/decline on a business's behalf — RLS already allows
 * that (opportunity_applications_update_admin), but the decision of who
 * gets picked is the business's, same as it's always been for a direct
 * request. The one admin action here is closing/cancelling a posting —
 * moderation, not participation. Mirrors AdminMessageSafety's own
 * monitor-not-do-the-messaging framing.
 */
export default function AdminOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [publisherNames, setPublisherNames] = useState<Record<string, string>>({});
  const [businesses, setBusinesses] = useState<Record<string, BusinessOption>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OpportunityStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: oppData }, { data: appData }] = await Promise.all([
      supabase.from("opportunities").select("*").order("created_at", { ascending: false }),
      // publishers is a real public-schema FK (opportunity_applications.publisher_id
      // -> public.publishers.id), so this embed resolves fine — unlike
      // opportunities.business_id, which points at auth.users, not
      // public.profiles, so that one needs a separate lookup below (same
      // reason AdminCampaigns.tsx/AdminLeads.tsx resolve admin names from
      // a plain fetched list rather than an embed).
      supabase.from("opportunity_applications").select("*, publisher:publishers(name)").order("created_at", { ascending: false }),
    ]);

    const opps = (oppData ?? []) as Opportunity[];
    setOpportunities(opps);
    setApplications((appData ?? []) as OpportunityApplication[]);

    const appRows = (appData ?? []) as (OpportunityApplication & { publisher: PublisherOption | null })[];
    const names: Record<string, string> = {};
    for (const a of appRows) if (a.publisher) names[a.publisher_id] = a.publisher.name;
    setPublisherNames(names);

    const businessIds = [...new Set(opps.map((o) => o.business_id))];
    if (businessIds.length > 0) {
      const { data: profileData } = await supabase.from("profiles").select("id, full_name, company_name").in("id", businessIds);
      const byId: Record<string, BusinessOption> = {};
      for (const p of (profileData ?? []) as BusinessOption[]) byId[p.id] = p;
      setBusinesses(byId);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function closeOpportunity(id: string) {
    setActingId(id);
    await supabase.from("opportunities").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.rpc("log_admin_action", { p_action: "opportunity_cancelled", p_target_table: "opportunities", p_target_id: id, p_detail: null });
    setActingId(null);
    load();
  }

  const visible = filter === "all" ? opportunities : opportunities.filter((o) => o.status === filter);

  if (loading) return <SkeletonRows count={5} />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => setFilter("all")} className={`font-mono text-[11px] uppercase px-3 py-1.5 rounded border-2 ${filter === "all" ? "bg-billboard-ink text-white border-billboard-ink" : "border-billboard-ink/30 text-billboard-inkSoft"}`}>
          All ({opportunities.length})
        </button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`font-mono text-[11px] uppercase px-3 py-1.5 rounded border-2 ${filter === s ? "bg-billboard-ink text-white border-billboard-ink" : "border-billboard-ink/30 text-billboard-inkSoft"}`}>
            {STATUS_LABEL[s]} ({opportunities.filter((o) => o.status === s).length})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-billboard-inkSoft">No opportunities here.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const apps = applications.filter((a) => a.opportunity_id === o.id);
            const expanded = expandedId === o.id;
            return (
              <div key={o.id} className="border-2 border-billboard-ink rounded p-4">
                <button onClick={() => setExpandedId(expanded ? null : o.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm">{o.title}</p>
                      <p className="text-xs text-billboard-inkSoft mt-0.5">{businessLabel(o.business_id, businesses)} · {o.channel_slug ?? "any channel"}</p>
                    </div>
                    <span className={`shrink-0 inline-block font-mono text-[10px] font-semibold uppercase px-2.5 py-1 rounded border-2 ${STATUS_TONE[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-billboard-inkSoft">
                    {(o.budget_min != null || o.budget_max != null) && (
                      <span>Budget {o.budget_min != null ? formatCurrency(o.budget_min) : formatCurrency(0)}–{o.budget_max != null ? formatCurrency(o.budget_max) : "R?"}</span>
                    )}
                    <span>{apps.length} application{apps.length === 1 ? "" : "s"}</span>
                    {o.publishers_needed > 1 && (
                      <span>{apps.filter((a) => a.status === "accepted").length} of {o.publishers_needed} accepted</span>
                    )}
                    <span>Posted {new Date(o.created_at).toLocaleDateString()}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
                    <p className="text-sm whitespace-pre-wrap mb-3">{o.brief}</p>

                    {(o.status === "open" || o.status === "filled") && (
                      <button
                        onClick={() => closeOpportunity(o.id)}
                        disabled={actingId === o.id}
                        className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-3 py-1.5 mb-3 disabled:opacity-60"
                      >
                        {actingId === o.id ? "…" : "Cancel this posting"}
                      </button>
                    )}

                    <p className="text-xs font-semibold text-billboard-inkSoft mb-2">Applications</p>
                    {apps.length === 0 ? (
                      <p className="text-xs text-billboard-inkSoft">No applications yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {apps.map((a) => (
                          <div key={a.id} className="border-2 border-billboard-ink/15 rounded p-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-xs font-semibold">{publisherNames[a.publisher_id] ?? "Publisher"}</p>
                              <span className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded border-2 ${APP_STATUS_TONE[a.status]}`}>
                                {APP_STATUS_LABEL[a.status]}
                              </span>
                            </div>
                            <p className="text-xs text-billboard-inkSoft mb-1">{a.message}</p>
                            <div className="flex gap-3 text-[11px] text-billboard-inkSoft">
                              {a.advertising_method && <span>{a.advertising_method}</span>}
                              {a.proposed_amount != null && <span>{formatCurrency(a.proposed_amount)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
