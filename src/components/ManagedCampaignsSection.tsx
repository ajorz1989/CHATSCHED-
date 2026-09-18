import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { formatCurrency } from "../lib/currency";
import BankDetailsPanel from "./BankDetailsPanel";
import type { MyManagedCampaign, MyManagedCampaignBooking, AgencyCampaignTotals } from "../lib/types";
import Button from "./Button";

const STATUS_LABEL: Record<string, string> = {
  draft: "Being planned",
  proposed: "Proposal sent",
  payment_pending: "Awaiting payment",
  planning: "Planning",
  in_progress: "In progress",
  reporting: "Wrapping up",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-billboard-paperDim text-billboard-inkSoft border-billboard-inkSoft",
  proposed: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  payment_pending: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  planning: "bg-billboard-paperDim text-billboard-ink border-billboard-ink",
  in_progress: "bg-billboard-green text-white border-billboard-greenDeep",
  reporting: "bg-billboard-green/20 text-billboard-greenDeep border-billboard-greenDeep",
  completed: "bg-billboard-ink text-white border-billboard-ink",
  cancelled: "bg-white text-billboard-red border-billboard-red",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function CampaignCard({ campaign, onCampaignUpdated }: { campaign: MyManagedCampaign; onCampaignUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [totals, setTotals] = useState<AgencyCampaignTotals | undefined>(undefined);
  const [bookings, setBookings] = useState<MyManagedCampaignBooking[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function expand() {
    setExpanded(true);
    if (totals !== undefined) return; // already loaded
    setError(null);
    const [{ data: totalsData, error: totalsError }, { data: bookingsData, error: bookingsError }] = await Promise.all([
      supabase.rpc("get_my_managed_campaign_totals", { p_campaign_id: campaign.id }).maybeSingle(),
      supabase.rpc("get_my_managed_campaign_bookings", { p_campaign_id: campaign.id }),
    ]);
    const fetchErr = totalsError || bookingsError;
    if (fetchErr) {
      setError(formatSupabaseError(fetchErr, "Couldn't load campaign details"));
      return;
    }
    setTotals(totalsData as AgencyCampaignTotals);
    setBookings((bookingsData ?? []) as MyManagedCampaignBooking[]);
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded-lg p-4">
      <button onClick={() => (expanded ? setExpanded(false) : expand())} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-sm">{campaign.name}</p>
            {campaign.objective && <p className="text-xs text-billboard-inkSoft mt-0.5">{campaign.objective}</p>}
          </div>
          <span className={`shrink-0 inline-block font-mono text-[10px] font-semibold uppercase px-2.5 py-1 rounded border-2 ${STATUS_STYLE[campaign.status] ?? STATUS_STYLE.draft}`}>
            {STATUS_LABEL[campaign.status] ?? campaign.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-billboard-inkSoft">
          {campaign.campaign_manager_name && <span>Managed by {campaign.campaign_manager_name}</span>}
          {campaign.package_price != null ? (
            <span>Campaign price {formatCurrency(campaign.package_price)}</span>
          ) : (
            campaign.budget != null && <span>Budget {formatCurrency(campaign.budget)}</span>
          )}
          {(campaign.start_date || campaign.end_date) && <span>{formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}</span>}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
          {error && <p className="text-billboard-red text-xs font-semibold mb-2">{error}</p>}
          {campaign.package_price != null && <PackagePayment campaign={campaign} onPaid={onCampaignUpdated} />}
          {campaign.brief && (
            <div className="mb-3">
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Brief</p>
              <p className="text-sm whitespace-pre-wrap">{campaign.brief}</p>
            </div>
          )}
          {campaign.target_audience && (
            <div className="mb-3">
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Target audience</p>
              <p className="text-sm">{campaign.target_audience}</p>
            </div>
          )}
          {totals && (
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div>
                <div className="font-display text-lg">{totals.linked_requests}</div>
                <div className="text-[9px] font-mono uppercase text-billboard-inkSoft">Bookings</div>
              </div>
              <div>
                <div className="font-display text-lg">{totals.paid_requests}</div>
                <div className="text-[9px] font-mono uppercase text-billboard-inkSoft">Paid</div>
              </div>
              <div>
                <div className="font-display text-lg">{formatCurrency(totals.total_spend)}</div>
                <div className="text-[9px] font-mono uppercase text-billboard-inkSoft">Spent so far</div>
              </div>
            </div>
          )}
          {bookings && bookings.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1.5">Bookings in this campaign</p>
              <div className="space-y-1.5">
                {bookings.map((b) => (
                  <Link key={b.id} to={`/campaigns/${b.id}`} className="flex items-center justify-between gap-2 border-2 border-billboard-ink/15 rounded px-3 py-2 text-xs hover:border-billboard-ink transition">
                    <span className="font-semibold">{b.status.replace(/_/g, " ")}</span>
                    <span className="text-billboard-inkSoft">{b.amount != null ? formatCurrency(b.amount) : "—"} · {formatDate(b.created_at)} →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {bookings && bookings.length === 0 && (
            <p className="text-xs text-billboard-inkSoft">Nothing booked yet — your account manager is still planning this one.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** The client's payment step for a package-priced campaign — bank
 * details plus a "confirm the transfer" action, same submit-then-admin-
 * confirms shape channel_requests' own payment step already uses (see
 * schema_phase65_campaign_packages.sql). The reference shown is
 * deterministic (derived from the campaign id, not typed by the client)
 * so it matches BankDetailsPanel's existing convention elsewhere in this
 * app — a pre-generated reference to quote on the transfer, not a
 * free-text field. */
function PackagePayment({ campaign, onPaid }: { campaign: MyManagedCampaign; onPaid: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reference = `CS-PKG-${campaign.id.slice(0, 8).toUpperCase()}`;

  async function submit() {
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("submit_managed_campaign_package_payment", { p_campaign_id: campaign.id, p_reference: reference });
    setSubmitting(false);
    if (rpcError) {
      setError(formatSupabaseError(rpcError, "Couldn't submit payment"));
      return;
    }
    onPaid();
  }

  if (campaign.package_payment_status === "paid") {
    return (
      <div className="border-2 border-billboard-greenDeep bg-billboard-green/10 rounded p-3 mb-3">
        <p className="text-xs font-semibold text-billboard-greenDeep">Campaign price paid — you're all set.</p>
      </div>
    );
  }

  if (campaign.package_payment_status === "payment_submitted") {
    return (
      <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-3 mb-3">
        <p className="text-xs font-semibold">Payment submitted — your account manager will confirm receipt shortly.</p>
      </div>
    );
  }

  return (
    <div className="border-2 border-billboard-ink rounded p-3 mb-3">
      <p className="text-xs font-semibold mb-2">Pay {formatCurrency(campaign.package_price ?? 0)} for this whole campaign — one transfer covers everything in it.</p>
      <BankDetailsPanel amount={campaign.package_price ?? 0} reference={reference} />
      {error && <p className="text-billboard-red text-xs font-semibold mt-2">{error}</p>}
      <Button onClick={submit} disabled={submitting} variant="dark" size="sm" className="mt-2">
        {submitting ? "Submitting…" : "I've made this payment"}
      </Button>
    </div>
  );
}

/**
 * The business-facing half of the Campaign Command Centre
 * (PHASE6_AGENCY_CAMPAIGNS_DELIVERY.md's "Not done" list) — renders
 * nothing for the ~everyone who isn't a managed client, so ordinary
 * self-service businesses never see an empty, confusing section. Every
 * read here goes through the get_my_managed_campaign* RPCs
 * (schema_phase61_managed_campaign_client_view.sql), which return a
 * narrower, business-safe projection — never agency_clients/agency_leads
 * themselves, which stay admin-only exactly as Phase 5 built them.
 */
export default function ManagedCampaignsSection() {
  const [campaigns, setCampaigns] = useState<MyManagedCampaign[] | undefined>(undefined);

  function load() {
    supabase.rpc("get_my_managed_campaigns").then(({ data }) => {
      setCampaigns((data ?? []) as MyManagedCampaign[]);
    }, () => setCampaigns([]));
  }

  useEffect(load, []);

  if (!campaigns || campaigns.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="font-display text-lg mb-1">Managed campaigns</h2>
      <p className="text-xs text-billboard-inkSoft mb-4">Campaigns ChatSched is running for you — tap one for the full picture.</p>
      <div className="space-y-3">
        {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} onCampaignUpdated={load} />)}
      </div>
    </div>
  );
}
