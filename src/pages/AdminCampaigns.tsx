import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { SkeletonRows } from "../components/Skeleton";
import CreateRequestForClient from "../components/CreateRequestForClient";
import type { AgencyCampaign, AgencyCampaignStatus, AgencyCampaignTotals, AgencyClient, LinkableRequest, Profile } from "../lib/types";
import { formatCurrency } from "../lib/currency";
import Button from "../components/Button";

const STATUSES: AgencyCampaignStatus[] = ["draft", "proposed", "payment_pending", "planning", "in_progress", "reporting", "completed", "cancelled"];
const STATUS_LABEL: Record<AgencyCampaignStatus, string> = {
  draft: "Draft",
  proposed: "Proposed",
  payment_pending: "Payment pending",
  planning: "Planning",
  in_progress: "In progress",
  reporting: "Reporting",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_TONE: Record<AgencyCampaignStatus, string> = {
  draft: "bg-white text-billboard-ink border-billboard-ink",
  proposed: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  payment_pending: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  planning: "bg-white text-billboard-ink border-billboard-ink",
  in_progress: "bg-blue-100 text-blue-800 border-blue-800",
  reporting: "bg-blue-100 text-blue-800 border-blue-800",
  completed: "bg-green-100 text-green-800 border-green-800",
  cancelled: "bg-billboard-inkSoft/10 text-billboard-inkSoft border-billboard-inkSoft",
};

interface ClientOption {
  id: string;
  business_id: string;
  label: string;
}
interface AdminOption {
  id: string;
  full_name: string | null;
}

const emptyForm = { client_id: "", name: "", objective: "", brief: "", target_audience: "", budget: "", start_date: "", end_date: "", package_price: "" };

const PACKAGE_STATUS_LABEL: Record<string, string> = {
  unpaid: "Unpaid",
  payment_submitted: "Payment submitted — needs confirming",
  paid: "Paid",
};

/**
 * Admin's managed-campaign workflow — pivot brief section 12, scaled to a
 * Command Centre-lite (section 13): a campaign is a thin wrapper around
 * whichever requests/channel_requests actually execute it. See
 * schema_phase60_agency_campaigns.sql for why status is deliberately
 * coarse and doesn't duplicate per-request execution detail.
 */
export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<AgencyCampaign[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [publisherManagers, setPublisherManagers] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [totalsById, setTotalsById] = useState<Record<string, AgencyCampaignTotals>>({});
  const [linkable, setLinkable] = useState<LinkableRequest[]>([]);
  const [linkableLoading, setLinkableLoading] = useState(false);
  const [creatingForId, setCreatingForId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    // See AdminLeads.tsx's load() for why both queries widen beyond
    // role='admin' — schema_phase94_manager_internal_roles.sql.
    const [{ data: campaignRows }, { data: clientRows }, { data: adminRows }, { data: publisherManagerRows }] = await Promise.all([
      supabase.from("agency_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("agency_clients").select("id, business_id"),
      supabase.from("profiles").select("id, full_name").in("role", ["admin", "campaign_manager"]),
      supabase.from("profiles").select("id, full_name").in("role", ["admin", "publisher_manager"]),
    ]);
    setCampaigns((campaignRows ?? []) as AgencyCampaign[]);
    setAdmins((adminRows ?? []) as AdminOption[]);
    setPublisherManagers((publisherManagerRows ?? []) as AdminOption[]);

    const clientRowsTyped = (clientRows ?? []) as Pick<AgencyClient, "id" | "business_id">[];
    if (clientRowsTyped.length > 0) {
      const { data: businessRows } = await supabase
        .from("profiles")
        .select("id, full_name, company_name")
        .in("id", clientRowsTyped.map((c) => c.business_id));
      const nameById: Record<string, string> = {};
      for (const b of (businessRows ?? []) as Pick<Profile, "id" | "full_name" | "company_name">[]) {
        nameById[b.id] = b.company_name || b.full_name || "Unknown business";
      }
      setClients(clientRowsTyped.map((c) => ({ id: c.id, business_id: c.business_id, label: nameById[c.business_id] || "Unknown business" })));
    } else {
      setClients([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadTotals(campaignId: string) {
    const { data } = await supabase.rpc("agency_campaign_totals", { p_campaign_id: campaignId }).maybeSingle();
    if (data) setTotalsById((prev) => ({ ...prev, [campaignId]: data as AgencyCampaignTotals }));
  }

  // Existing requests/channel_requests for this campaign's client —
  // whether already linked (so they can be unlinked) or still unlinked
  // (so they can be picked up). Two plain queries, no embed hints, same
  // reasoning as Phase 5's AdminLeads/AdminClients: this codebase has no
  // precedent to confirm a `!fkey_name` hint against, so a second lookup
  // query is the safer choice without live Postgres to test on.
  async function loadLinkable(campaign: AgencyCampaign) {
    setLinkableLoading(true);
    const client = clients.find((c) => c.id === campaign.client_id);
    if (!client) {
      setLinkable([]);
      setLinkableLoading(false);
      return;
    }
    const [{ data: reqRows }, { data: chRows }] = await Promise.all([
      supabase.from("requests").select("id, publisher_id, status, agency_campaign_id").eq("business_id", client.business_id),
      supabase.from("channel_requests").select("id, creator_id, channel_slug, status, proposed_amount, agency_campaign_id").eq("business_id", client.business_id),
    ]);
    const publisherIds = [...new Set([...(reqRows ?? []).map((r) => r.publisher_id), ...(chRows ?? []).map((r) => r.creator_id)])];
    const { data: publisherRows } = publisherIds.length > 0 ? await supabase.from("publishers").select("id, name").in("id", publisherIds) : { data: [] };
    const nameById: Record<string, string> = {};
    for (const p of (publisherRows ?? []) as { id: string; name: string }[]) nameById[p.id] = p.name;

    const fromRequests: LinkableRequest[] = (reqRows ?? [])
      .filter((r) => r.agency_campaign_id === null || r.agency_campaign_id === campaign.id)
      .map((r) => ({ id: r.id, kind: "request", label: `${nameById[r.publisher_id] || "Publisher"} — ${r.status}`, agency_campaign_id: r.agency_campaign_id }));
    const fromChannel: LinkableRequest[] = (chRows ?? [])
      .filter((r) => r.agency_campaign_id === null || r.agency_campaign_id === campaign.id)
      .map((r) => ({ id: r.id, kind: "channel_request", label: `${nameById[r.creator_id] || "Creator"} — ${r.channel_slug} — ${formatCurrency(Number(r.proposed_amount))} — ${r.status}`, agency_campaign_id: r.agency_campaign_id }));

    setLinkable([...fromRequests, ...fromChannel]);
    setLinkableLoading(false);
  }

  function toggleExpand(campaign: AgencyCampaign) {
    if (expandedId === campaign.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(campaign.id);
    loadTotals(campaign.id);
    loadLinkable(campaign);
  }

  async function updateStatus(id: string, status: AgencyCampaignStatus) {
    setActingId(id);
    await supabase.from("agency_campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  async function assignManager(id: string, campaignManagerId: string) {
    setActingId(id);
    await supabase.from("agency_campaigns").update({ campaign_manager_id: campaignManagerId || null, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  async function assignPublisherManager(id: string, publisherManagerId: string) {
    setActingId(id);
    await supabase.from("agency_campaigns").update({ publisher_manager_id: publisherManagerId || null, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  async function setPackagePrice(id: string, priceInput: string) {
    setActingId(id);
    const price = priceInput.trim() ? Number(priceInput) : null;
    await supabase.from("agency_campaigns").update({ package_price: price, updated_at: new Date().toISOString() }).eq("id", id);
    setActingId(null);
    load();
  }

  // Confirms receipt and — only for a still-payment_pending campaign —
  // advances it to planning in the same action. maybe_advance_agency_campaign()
  // (schema_phase62) drives that same transition off per-booking payment
  // status, which a package-priced campaign's bookings may never satisfy
  // on their own; this is the client-side equivalent for that path,
  // deliberately not a change to that trigger — see
  // schema_phase65_campaign_packages.sql's header for the full reasoning.
  async function confirmPackagePayment(campaign: AgencyCampaign) {
    setActingId(campaign.id);
    await supabase
      .from("agency_campaigns")
      .update({
        package_payment_status: "paid",
        package_paid_at: new Date().toISOString(),
        status: campaign.status === "payment_pending" ? "planning" : campaign.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("package_payment_status", "payment_submitted"); // only from submitted — don't overwrite an already-paid row from a stale click
    await supabase.rpc("log_admin_action", { p_action: "agency_campaign_package_paid", p_target_table: "agency_campaigns", p_target_id: campaign.id, p_detail: null });
    setActingId(null);
    load();
  }

  async function toggleLink(campaign: AgencyCampaign, item: LinkableRequest) {
    const table = item.kind === "request" ? "requests" : "channel_requests";
    const nextValue = item.agency_campaign_id === campaign.id ? null : campaign.id;
    await supabase.from(table).update({ agency_campaign_id: nextValue }).eq("id", item.id);
    loadLinkable(campaign);
    loadTotals(campaign.id);
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id || !form.name.trim()) return;
    setSaving(true);
    await supabase.from("agency_campaigns").insert({
      client_id: form.client_id,
      name: form.name.trim(),
      objective: form.objective.trim() || null,
      brief: form.brief.trim() || null,
      target_audience: form.target_audience.trim() || null,
      budget: form.budget ? Number(form.budget) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      package_price: form.package_price ? Number(form.package_price) : null,
    });
    setSaving(false);
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  if (loading) return <SkeletonRows count={4} />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-billboard-inkSoft">{campaigns.length} managed campaign{campaigns.length === 1 ? "" : "s"}</p>
        <button onClick={() => setShowForm((v) => !v)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition shrink-0">
          {showForm ? "Cancel" : "+ New campaign"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCampaign} className="border-[3px] border-billboard-ink rounded p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <select required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm sm:col-span-2">
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input required placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="Objective (e.g. grand opening awareness)" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm sm:col-span-2" />
          <textarea placeholder="Brief" value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm sm:col-span-2" rows={2} />
          <input placeholder="Target audience" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="Budget (R)" type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
          <input placeholder="Package price (R) — leave blank for itemized" type="number" min="0" value={form.package_price} onChange={(e) => setForm({ ...form, package_price: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
          </div>
          <Button type="submit" variant="dark" size="md" disabled={saving} className="sm:col-span-2">
            {saving ? "Saving…" : "Create campaign"}
          </Button>
        </form>
      )}

      {campaigns.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          No managed campaigns yet — create one for an existing agency client above. Add clients from the Clients tab first.
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const client = clients.find((cl) => cl.id === c.client_id);
            const totalsRow = totalsById[c.id];
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="border-[3px] border-billboard-ink rounded p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 cursor-pointer" onClick={() => toggleExpand(c)}>
                  <div>
                    <p className="font-display text-base">{c.name}</p>
                    <p className="text-xs text-billboard-inkSoft">
                      {client?.label || "Unknown client"}
                      {c.budget != null && ` · Budget ${formatCurrency(Number(c.budget), { cents: true })}`}
                    </p>
                  </div>
                  <span className={`font-mono text-xs font-semibold uppercase px-2.5 py-1 rounded border-2 ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <select
                    value={c.status}
                    disabled={actingId === c.id}
                    onChange={(e) => updateStatus(c.id, e.target.value as AgencyCampaignStatus)}
                    className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={c.campaign_manager_id ?? ""}
                    disabled={actingId === c.id}
                    onChange={(e) => assignManager(c.id, e.target.value)}
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
                    value={c.publisher_manager_id ?? ""}
                    disabled={actingId === c.id}
                    onChange={(e) => assignPublisherManager(c.id, e.target.value)}
                    className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
                  >
                    <option value="">Unassigned (Publisher Manager)</option>
                    {publisherManagers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name || "Admin"}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => toggleExpand(c)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition">
                    {isExpanded ? "Hide requests" : "Linked requests"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t-2 border-billboard-ink/10 pt-4">
                    {totalsRow && (
                      <p className="text-xs font-semibold mb-3">
                        {totalsRow.paid_requests} of {totalsRow.linked_requests} linked request{totalsRow.linked_requests === 1 ? "" : "s"} paid — {formatCurrency(Number(totalsRow.total_spend), { cents: true })} spent so far
                      </p>
                    )}
                    {c.status === "payment_pending" && (
                      <p className="text-[11px] text-billboard-inkSoft mb-3">
                        Moves to Planning automatically once every linked request above is paid — no need to set that by hand.
                      </p>
                    )}
                    {c.status === "in_progress" && (
                      <p className="text-[11px] text-billboard-inkSoft mb-3">
                        Moves to Reporting automatically once every linked request's proof is verified (or marked not eligible for compliance) — no need to set that by hand.
                      </p>
                    )}

                    <div className="border-2 border-billboard-ink/15 rounded p-3 mb-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-billboard-inkSoft">Package pricing</p>
                        {c.package_price != null && (
                          <span className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded border-2 ${c.package_payment_status === "paid" ? "bg-billboard-green text-white border-billboard-greenDeep" : c.package_payment_status === "payment_submitted" ? "bg-billboard-yellow text-billboard-ink border-billboard-ink" : "border-billboard-inkSoft text-billboard-inkSoft"}`}>
                            {PACKAGE_STATUS_LABEL[c.package_payment_status]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="Leave blank for itemized (pay per booking)"
                          defaultValue={c.package_price ?? ""}
                          disabled={actingId === c.id || c.package_payment_status !== "unpaid"}
                          onBlur={(e) => setPackagePrice(c.id, e.target.value)}
                          className="flex-1 border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm disabled:opacity-60"
                        />
                        {c.package_price != null && <span className="text-xs text-billboard-inkSoft shrink-0">{formatCurrency(Number(c.package_price), { cents: true })}</span>}
                      </div>
                      {c.package_payment_status === "payment_submitted" && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] text-billboard-inkSoft">Client's reference: {c.package_payment_reference || "—"}</p>
                          <button
                            onClick={() => confirmPackagePayment(c)}
                            disabled={actingId === c.id}
                            className="font-mono text-[11px] font-semibold uppercase bg-billboard-green text-white rounded px-2.5 py-1 shrink-0 disabled:opacity-60"
                          >
                            Confirm received
                          </button>
                        </div>
                      )}
                      {c.package_payment_status === "paid" && c.package_paid_at && (
                        <p className="text-[11px] text-billboard-inkSoft mt-2">Paid {new Date(c.package_paid_at).toLocaleDateString()}.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="text-xs font-semibold text-billboard-inkSoft">Linked requests</p>
                      <button
                        onClick={() => setCreatingForId(creatingForId === c.id ? null : c.id)}
                        className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1 hover:-translate-y-0.5 transition shrink-0"
                      >
                        {creatingForId === c.id ? "Cancel" : "+ Create request(s)"}
                      </button>
                    </div>

                    {creatingForId === c.id && client && (
                      <div className="mb-3">
                        <CreateRequestForClient
                          businessId={client.business_id}
                          agencyCampaignId={c.id}
                          onCreated={() => {
                            setCreatingForId(null);
                            loadLinkable(c);
                            loadTotals(c.id);
                          }}
                        />
                      </div>
                    )}

                    {linkableLoading ? (
                      <SkeletonRows count={2} />
                    ) : linkable.length === 0 ? (
                      <p className="text-xs text-billboard-inkSoft">No requests for this client yet — create one above on their behalf, or wait for them to request one themselves, then link it here.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {linkable.map((item) => (
                          <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 text-xs">
                            <span>{item.label}</span>
                            <button
                              onClick={() => toggleLink(c, item)}
                              className={`font-mono font-semibold uppercase px-2 py-1 rounded border-2 border-billboard-ink shrink-0 ${item.agency_campaign_id === c.id ? "bg-billboard-ink text-white" : "bg-white"}`}
                            >
                              {item.agency_campaign_id === c.id ? "Linked" : "Link"}
                            </button>
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
