import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError, isUniqueViolation } from "../lib/supabaseErrors";
import { formatCurrency } from "../lib/currency";
import { SkeletonRows } from "../components/Skeleton";
import type { AgencyLead, AgencyLeadStage } from "../lib/types";
import Button from "../components/Button";

/**
 * Admin's lead pipeline — sections 25/26 of the pivot brief. Internal
 * sales data only (schema_phase59_agency_crm.sql is admin-only RLS, no
 * business/publisher participant), so unlike AdminChannelRequests there's
 * no creator/business half of this workflow anywhere else in the app.
 */
const STAGES: AgencyLeadStage[] = ["new", "contacted", "qualified", "proposal", "won", "lost", "campaign", "renewal"];

const STAGE_LABEL: Record<AgencyLeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
  campaign: "Campaign",
  renewal: "Renewal",
};

const STAGE_TONE: Record<AgencyLeadStage, string> = {
  new: "bg-white text-billboard-ink border-billboard-ink",
  contacted: "bg-white text-billboard-ink border-billboard-ink",
  qualified: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  proposal: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  won: "bg-green-100 text-green-800 border-green-800",
  lost: "bg-billboard-inkSoft/10 text-billboard-inkSoft border-billboard-inkSoft",
  campaign: "bg-green-100 text-green-800 border-green-800",
  renewal: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
};

interface AdminOption {
  id: string;
  full_name: string | null;
}

// Same shape, different eligible-role sets — see schema_phase94_manager_internal_roles.sql.
type ManagerOption = AdminOption;

const emptyForm = { business_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_value: "" };

export default function AdminLeads() {
  const [leads, setLeads] = useState<AgencyLead[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [publisherManagers, setPublisherManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AgencyLeadStage | "all">("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [convertNote, setConvertNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    // Plain select, no embedded join — agency_leads has two FKs into
    // profiles (business_id, campaign_manager_id), and this codebase has
    // no precedent anywhere for PostgREST's `!fkey_name` disambiguation
    // hint to test the exact constraint name against. The admin list
    // fetched alongside already gives the dropdown everything it needs
    // to show the assigned manager's name without a join at all.
    // Campaign Manager assignment accepts an admin OR a profile promoted
    // to the 'campaign_manager' role; Publisher Manager mirrors this with
    // 'publisher_manager' — both roles added in
    // schema_phase94_manager_internal_roles.sql. An admin can still cover
    // either job themselves, so admin accounts appear in both lists.
    const [{ data: leadRows }, { data: adminRows }, { data: publisherManagerRows }] = await Promise.all([
      supabase.from("agency_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").in("role", ["admin", "campaign_manager"]),
      supabase.from("profiles").select("id, full_name").in("role", ["admin", "publisher_manager"]),
    ]);
    setLeads((leadRows ?? []) as unknown as AgencyLead[]);
    setAdmins((adminRows ?? []) as AdminOption[]);
    setPublisherManagers((publisherManagerRows ?? []) as ManagerOption[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStage(id: string, stage: AgencyLeadStage) {
    setActingId(id);
    await supabase.from("agency_leads").update({ stage, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  async function assignManager(id: string, campaignManagerId: string) {
    setActingId(id);
    await supabase.from("agency_leads").update({ campaign_manager_id: campaignManagerId || null, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  async function assignPublisherManager(id: string, publisherManagerId: string) {
    setActingId(id);
    await supabase.from("agency_leads").update({ publisher_manager_id: publisherManagerId || null, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_name.trim()) return;
    setSaving(true);
    await supabase.from("agency_leads").insert({
      business_name: form.business_name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      source: form.source.trim() || null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
    });
    setSaving(false);
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  // A won lead becomes an agency_clients row — the CRM record the
  // Clients tab manages from here on. Doesn't touch the lead's own
  // stage/history; agency_clients.lead_id keeps the link back.
  async function convertToClient(lead: AgencyLead) {
    if (!lead.business_id) {
      setConvertNote("This lead isn't linked to an account yet — add its business_id once they've signed up, then convert.");
      return;
    }
    setActingId(lead.id);
    const { error } = await supabase.from("agency_clients").insert({
      business_id: lead.business_id,
      service_level: "assisted",
      campaign_manager_id: lead.campaign_manager_id,
      lead_id: lead.id,
    });
    if (!error) {
      await supabase.from("agency_leads").update({ stage: "won", updated_at: new Date().toISOString() }).eq("id", lead.id);
    } else if (isUniqueViolation(error)) {
      // A real Postgres code check instead of sniffing the raw message
      // text for the word "duplicate" — more reliable (works regardless
      // of the exact wording Postgres happens to phrase this constraint
      // violation with) and doesn't require reading the raw message at
      // all to make the decision.
      setConvertNote("This business is already an agency client.");
    } else {
      setConvertNote(formatSupabaseError(error, "Couldn't convert this lead"));
    }
    setActingId(null);
    load();
  }

  const visible = filter === "all" ? leads : leads.filter((l) => l.stage === filter);
  const counts = STAGES.reduce((acc, s) => ({ ...acc, [s]: leads.filter((l) => l.stage === s).length }), {} as Record<AgencyLeadStage, number>);

  if (loading) return <SkeletonRows count={4} />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 transition ${filter === "all" ? "bg-billboard-ink text-white border-billboard-ink" : "border-billboard-ink text-billboard-ink"}`}
          >
            All ({leads.length})
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 transition ${filter === s ? "bg-billboard-ink text-white border-billboard-ink" : "border-billboard-ink text-billboard-ink"}`}
            >
              {STAGE_LABEL[s]} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition shrink-0">
          {showForm ? "Cancel" : "+ Add lead"}
        </button>
      </div>

      {convertNote && (
        <p className="text-xs font-semibold text-billboard-red mb-4 border-2 border-billboard-red rounded p-3">
          {convertNote}{" "}
          <button onClick={() => setConvertNote(null)} className="underline">
            Dismiss
          </button>
        </p>
      )}

      {showForm && (
        <form onSubmit={createLead} className="border-[3px] border-billboard-ink rounded p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <input required placeholder="Business name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="Contact name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
          <input placeholder="Contact email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
          <input placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
          <input placeholder="Source (referral, cold outreach…)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
          <input placeholder="Estimated value (R)" type="number" min="0" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm sm:col-span-2" />
          <Button type="submit" variant="dark" size="md" disabled={saving} className="sm:col-span-2">
            {saving ? "Saving…" : "Add lead"}
          </Button>
        </form>
      )}

      {visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No leads in this stage.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((lead) => (
            <div key={lead.id} className="border-[3px] border-billboard-ink rounded p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base">{lead.business_name}</p>
                  <p className="text-xs text-billboard-inkSoft">
                    {[lead.contact_name, lead.contact_email, lead.contact_phone].filter(Boolean).join(" · ") || "No contact details yet"}
                  </p>
                  {lead.estimated_value != null && <p className="text-xs text-billboard-inkSoft mt-0.5">Est. value: {formatCurrency(Number(lead.estimated_value), { cents: true })}</p>}
                </div>
                <span className={`font-mono text-xs font-semibold uppercase px-2.5 py-1 rounded border-2 ${STAGE_TONE[lead.stage]}`}>{STAGE_LABEL[lead.stage]}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <select
                  value={lead.stage}
                  disabled={actingId === lead.id}
                  onChange={(e) => updateStage(lead.id, e.target.value as AgencyLeadStage)}
                  className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>

                <select
                  value={lead.campaign_manager_id ?? ""}
                  disabled={actingId === lead.id}
                  onChange={(e) => assignManager(lead.id, e.target.value)}
                  className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
                >
                  <option value="">Unassigned (Campaign Manager)</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || "Admin"}
                    </option>
                  ))}
                </select>

                <select
                  value={lead.publisher_manager_id ?? ""}
                  disabled={actingId === lead.id}
                  onChange={(e) => assignPublisherManager(lead.id, e.target.value)}
                  className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
                >
                  <option value="">Unassigned (Publisher Manager)</option>
                  {publisherManagers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || "Admin"}
                    </option>
                  ))}
                </select>

                {lead.stage !== "won" && lead.stage !== "campaign" && (
                  <button
                    onClick={() => convertToClient(lead)}
                    disabled={actingId === lead.id}
                    className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60"
                  >
                    Convert to client
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
