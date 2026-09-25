import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { SkeletonRows } from "../components/Skeleton";
import { formatCurrency } from "../lib/currency";
import type { Opportunity, OpportunityApplication, OpportunityStatus, OpportunityApplicationStatus, OpportunityType } from "../lib/types";

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
  return b ? (b.company_name || b.full_name || "Business") : "Business";
}

function formatDeadline(value: string | null): string {
  if (!value) return "No deadline";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Invalid date" : d.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Admin operations view for the reverse marketplace.
 * Moderates visibility, monitors supply/demand, and manages the opportunity
 * type catalogue without taking the business's applicant-selection decision.
 */
export default function AdminOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [opportunityTypes, setOpportunityTypes] = useState<OpportunityType[]>([]);
  const [publisherNames, setPublisherNames] = useState<Record<string, string>>({});
  const [businesses, setBusinesses] = useState<Record<string, BusinessOption>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OpportunityStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [typeBusy, setTypeBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const [{ data: oppData, error: oppError }, { data: appData, error: appError }, { data: typeData, error: typeError }] = await Promise.all([
      supabase.from("opportunities").select("*").order("created_at", { ascending: false }),
      supabase.from("opportunity_applications").select("*, publisher:publishers(name)").order("created_at", { ascending: false }),
      supabase.from("opportunity_types").select("slug,label,description,suggested_channel_slug,active").order("sort_order", { ascending: true }),
    ]);

    if (oppError || appError || typeError) {
      setError(formatSupabaseError(oppError || appError || typeError, "Couldn't load Opportunities operations"));
    }

    const opps = (oppData ?? []) as Opportunity[];
    const appRows = (appData ?? []) as (OpportunityApplication & { publisher: PublisherOption | null })[];
    setOpportunities(opps);
    setApplications((appData ?? []) as OpportunityApplication[]);
    setOpportunityTypes((typeData ?? []) as OpportunityType[]);

    const names: Record<string, string> = {};
    for (const a of appRows) if (a.publisher) names[a.publisher_id] = a.publisher.name;
    setPublisherNames(names);

    const businessIds = [...new Set(opps.map((o) => o.business_id))];
    if (businessIds.length) {
      const { data: profileData } = await supabase.from("profiles").select("id,full_name,company_name").in("id", businessIds);
      const byId: Record<string, BusinessOption> = {};
      for (const p of (profileData ?? []) as BusinessOption[]) byId[p.id] = p;
      setBusinesses(byId);
    } else {
      setBusinesses({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function cancelOpportunity(id: string) {
    setActingId(id);
    setError(null);
    const { error: updateError } = await supabase
      .from("opportunities")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      setError(formatSupabaseError(updateError, "Couldn't cancel opportunity"));
      setActingId(null);
      return;
    }

    await supabase.rpc("log_admin_action", {
      p_action: "opportunity_cancelled",
      p_target_table: "opportunities",
      p_target_id: id,
      p_detail: null,
    });
    setActingId(null);
    await load();
  }

  async function toggleType(type: OpportunityType) {
    setTypeBusy(type.slug);
    setError(null);
    const { error: toggleError } = await supabase
      .from("opportunity_types")
      .update({ active: !type.active, updated_at: new Date().toISOString() })
      .eq("slug", type.slug);
    if (toggleError) {
      setError(formatSupabaseError(toggleError, "Couldn't update opportunity type"));
      setTypeBusy(null);
      return;
    }
    setTypeBusy(null);
    await load();
  }

  const typeMap = useMemo(() => new Map(opportunityTypes.map((t) => [t.slug, t])), [opportunityTypes]);

  const visible = useMemo(() => {
    return opportunities.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (typeFilter && o.opportunity_type !== typeFilter) return false;
      return true;
    });
  }, [opportunities, filter, typeFilter]);

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const openCount = opportunities.filter((o) => o.status === "open").length;
  const filledCount = opportunities.filter((o) => o.status === "filled").length;
  const activeTypeCount = opportunityTypes.length;

  if (loading) return <SkeletonRows count={6} />;

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ["Open briefs", openCount],
          ["Pending proposals", pendingCount],
          ["Filled", filledCount],
          ["Active types", activeTypeCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="border-[3px] border-billboard-ink rounded-xl p-4 bg-white shadow-blockSm">
            <div className="font-mono text-[9px] uppercase text-billboard-inkSoft">{label}</div>
            <div className="font-display text-2xl mt-1">{value}</div>
          </div>
        ))}
      </div>

      {error && <div className="border-2 border-billboard-red bg-billboard-red/5 text-billboard-red rounded-lg p-3 text-sm mb-5">{error}</div>}

      <section className="border-[3px] border-billboard-ink rounded-xl bg-billboard-paperDim p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Catalogue</span>
            <h2 className="font-display text-xl mt-1">Opportunity types</h2>
          </div>
          <p className="text-xs text-billboard-inkSoft">These are admin-controlled discovery categories. Existing opportunities remain unchanged when a type is switched off.</p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {opportunityTypes.map((type) => (
            <div key={type.slug} className="flex items-center gap-2 border-2 border-billboard-ink rounded-lg bg-white px-3 py-2">
              <div>
                <div className="text-xs font-semibold">{type.label}</div>
                <div className="font-mono text-[9px] uppercase text-billboard-inkSoft">{type.suggested_channel_slug ?? "any channel"}</div>
              </div>
              <span className={"font-mono text-[9px] " + (type.active ? "text-billboard-greenDeep" : "text-billboard-inkSoft")}>{type.active ? "active" : "disabled"}</span>
              <button type="button" disabled={typeBusy === type.slug} onClick={() => toggleType(type)} className="text-[10px] font-semibold underline disabled:opacity-50">
                {type.active ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button type="button" onClick={() => setFilter("all")} className={"font-mono text-[11px] uppercase px-3 py-1.5 rounded border-2 " + (filter === "all" ? "bg-billboard-ink text-white border-billboard-ink" : "border-billboard-ink/30 text-billboard-inkSoft")}>All ({opportunities.length})</button>
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={"font-mono text-[11px] uppercase px-3 py-1.5 rounded border-2 " + (filter === s ? "bg-billboard-ink text-white border-billboard-ink" : "border-billboard-ink/30 text-billboard-inkSoft")}>
            {STATUS_LABEL[s]} ({opportunities.filter((o) => o.status === s).length})
          </button>
        ))}
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border-2 border-billboard-ink/30 rounded px-3 py-1.5 text-xs bg-white ml-auto">
          <option value="">All opportunity types</option>
          {opportunityTypes.map((type) => <option key={type.slug} value={type.slug}>{type.label}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-billboard-inkSoft">No opportunities match this view.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const apps = applications.filter((a) => a.opportunity_id === o.id);
            const accepted = apps.filter((a) => a.status === "accepted").length;
            const pending = apps.filter((a) => a.status === "pending").length;
            const expanded = expandedId === o.id;

            return (
              <article key={o.id} className="border-[3px] border-billboard-ink rounded-xl bg-white overflow-hidden">
                <button type="button" onClick={() => setExpandedId(expanded ? null : o.id)} className="w-full text-left p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{o.title}</p>
                      <p className="text-xs text-billboard-inkSoft mt-0.5">
                        {businessLabel(o.business_id, businesses)} · {typeMap.get(o.opportunity_type ?? "")?.label ?? "Uncategorised"} · {o.channel_slug ?? "any channel"}
                      </p>
                    </div>
                    <span className={"shrink-0 inline-block font-mono text-[10px] font-semibold uppercase px-2.5 py-1 rounded border-2 " + STATUS_TONE[o.status]}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-billboard-inkSoft">
                    {(o.budget_min != null || o.budget_max != null) && <span>Budget {o.budget_min != null ? formatCurrency(o.budget_min) : "R0"} – {o.budget_max != null ? formatCurrency(o.budget_max) : "open"}</span>}
                    <span>{pending} pending</span>
                    <span>{accepted} accepted / {o.publishers_needed} needed</span>
                    <span>Deadline {formatDeadline(o.application_deadline ?? o.expires_at)}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t-[3px] border-billboard-ink bg-billboard-paperDim p-4">
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm whitespace-pre-wrap">{o.brief}</p>
                        {o.target_audience && <p className="text-xs mt-3"><strong>Audience:</strong> {o.target_audience}</p>}
                        {o.deliverables && <p className="text-xs mt-2"><strong>Deliverables:</strong> {o.deliverables}</p>}
                        {o.publisher_requirements && <p className="text-xs mt-2"><strong>Requirements:</strong> {o.publisher_requirements}</p>}
                      </div>
                      <div className="text-xs text-billboard-inkSoft">
                        <p><strong>Campaign:</strong> {formatDeadline(o.campaign_start_at)} → {formatDeadline(o.campaign_end_at)}</p>
                        <p className="mt-2"><strong>Target location:</strong> {[o.target_city, o.target_province].filter(Boolean).join(", ") || "Flexible"}</p>
                        <p className="mt-2"><strong>Keywords:</strong> {(o.match_keywords ?? []).join(", ") || "None"}</p>
                      </div>
                    </div>

                    {(o.status === "open" || o.status === "filled") && (
                      <button
                        type="button"
                        onClick={() => cancelOpportunity(o.id)}
                        disabled={actingId === o.id}
                        className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded-lg px-3 py-1.5 mb-4 disabled:opacity-60"
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
                          <div key={a.id} className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold">{publisherNames[a.publisher_id] ?? "Publisher"}</p>
                              <span className={"font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded border-2 " + APP_STATUS_TONE[a.status]}>{APP_STATUS_LABEL[a.status]}</span>
                            </div>
                            <p className="text-xs mt-1 whitespace-pre-wrap">{a.message}</p>
                            <div className="flex flex-wrap gap-3 text-[11px] text-billboard-inkSoft mt-2">
                              {a.advertising_method && <span>{a.advertising_method}</span>}
                              {a.proposed_amount != null && <span>{formatCurrency(a.proposed_amount)}</span>}
                              <span>{new Date(a.created_at).toLocaleDateString("en-ZA")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
