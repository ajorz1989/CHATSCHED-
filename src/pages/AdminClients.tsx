import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { SkeletonRows } from "../components/Skeleton";
import { formatCurrency } from "../lib/currency";
import type { AgencyClient, AgencyClientTotals, AgencyServiceLevel, AgencyRenewalStatus, Profile } from "../lib/types";

const SERVICE_LEVELS: AgencyServiceLevel[] = ["self_service", "assisted", "managed"];
const SERVICE_LABEL: Record<AgencyServiceLevel, string> = { self_service: "Self-service", assisted: "Assisted", managed: "Managed" };

const RENEWAL_STATUSES: AgencyRenewalStatus[] = ["none", "upcoming", "due", "overdue", "renewed"];
const RENEWAL_LABEL: Record<AgencyRenewalStatus, string> = { none: "—", upcoming: "Upcoming", due: "Due", overdue: "Overdue", renewed: "Renewed" };
const RENEWAL_TONE: Record<AgencyRenewalStatus, string> = {
  none: "text-billboard-inkSoft",
  upcoming: "text-billboard-ink",
  due: "text-amber-700",
  overdue: "text-billboard-red",
  renewed: "text-green-700",
};

interface AdminOption {
  id: string;
  full_name: string | null;
}

type BusinessInfo = Pick<Profile, "id" | "full_name" | "company_name" | "phone">;

/**
 * Admin's client CRM — section 25 of the pivot brief. Lifetime spend and
 * campaign count are never stored (see schema_phase59_agency_crm.sql) —
 * fetched live per client via agency_client_totals(), same reasoning
 * PHASE4_MARGIN_ECONOMICS_DELIVERY.md gives for computing commission/MRR
 * client-side rather than storing a copy that can drift.
 */
export default function AdminClients() {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [businesses, setBusinesses] = useState<Record<string, BusinessInfo>>({});
  const [totals, setTotals] = useState<Record<string, AgencyClientTotals>>({});
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: clientRows }, { data: adminRows }] = await Promise.all([
      supabase.from("agency_clients").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").eq("role", "admin"),
    ]);
    const rows = (clientRows ?? []) as AgencyClient[];
    setClients(rows);
    setAdmins((adminRows ?? []) as AdminOption[]);

    const businessIds = rows.map((c) => c.business_id);
    if (businessIds.length > 0) {
      const { data: businessRows } = await supabase.from("profiles").select("id, full_name, company_name, phone").in("id", businessIds);
      const byId: Record<string, BusinessInfo> = {};
      for (const b of (businessRows ?? []) as BusinessInfo[]) byId[b.id] = b;
      setBusinesses(byId);

      const totalsEntries = await Promise.all(
        businessIds.map(async (id) => {
          const { data } = await supabase.rpc("agency_client_totals", { p_business_id: id }).maybeSingle();
          return [id, data as AgencyClientTotals] as const;
        })
      );
      const totalsById: Record<string, AgencyClientTotals> = {};
      for (const [id, t] of totalsEntries) if (t) totalsById[id] = t;
      setTotals(totalsById);
    } else {
      setBusinesses({});
      setTotals({});
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateField(id: string, patch: Partial<Pick<AgencyClient, "service_level" | "campaign_manager_id" | "renewal_status">>) {
    setActingId(id);
    await supabase.from("agency_clients").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  if (loading) return <SkeletonRows count={4} />;

  if (clients.length === 0) {
    return (
      <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
        No agency clients yet — convert a won lead from the Leads tab, or a client relationship starts here once you flag one.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {clients.map((client) => {
        const business = businesses[client.business_id];
        const totalsRow = totals[client.business_id];
        const name = business?.company_name || business?.full_name || "Unknown business";
        return (
          <div key={client.id} className="border-[3px] border-billboard-ink rounded p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-base">{name}</p>
                <p className="text-xs text-billboard-inkSoft">{business?.phone || "No phone on file"}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs uppercase text-billboard-inkSoft">Lifetime spend</p>
                <p className="font-display text-base">{formatCurrency(totalsRow?.lifetime_spend ?? 0, { cents: true })}</p>
                <p className="text-xs text-billboard-inkSoft">
                  {totalsRow?.campaign_count ?? 0} campaign{(totalsRow?.campaign_count ?? 0) === 1 ? "" : "s"}
                  {totalsRow?.last_campaign_at && ` · last ${new Date(totalsRow.last_campaign_at).toLocaleDateString("en-ZA")}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <select
                value={client.service_level}
                disabled={actingId === client.id}
                onChange={(e) => updateField(client.id, { service_level: e.target.value as AgencyServiceLevel })}
                className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
              >
                {SERVICE_LEVELS.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_LABEL[s]}
                  </option>
                ))}
              </select>

              <select
                value={client.campaign_manager_id ?? ""}
                disabled={actingId === client.id}
                onChange={(e) => updateField(client.id, { campaign_manager_id: e.target.value || null })}
                className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
              >
                <option value="">Unassigned</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || "Admin"}
                  </option>
                ))}
              </select>

              <select
                value={client.renewal_status}
                disabled={actingId === client.id}
                onChange={(e) => updateField(client.id, { renewal_status: e.target.value as AgencyRenewalStatus })}
                className={`border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase ${RENEWAL_TONE[client.renewal_status]}`}
              >
                {RENEWAL_STATUSES.map((r) => (
                  <option key={r} value={r}>
                    {RENEWAL_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>

            {client.notes && <p className="text-xs text-billboard-inkSoft mt-3 border-t-2 border-billboard-ink/10 pt-3">{client.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
