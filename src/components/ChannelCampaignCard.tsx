import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { formatCurrency } from "../lib/currency";
import { buildAndDownloadInvoice } from "../lib/invoice";
import { getChannelBySlug } from "../lib/channelRegistry";
import BankDetailsPanel from "./BankDetailsPanel";
import EscrowNote from "./EscrowNote";
import DisputeSection from "./DisputeSection";
import CampaignComplianceStrip from "./CampaignComplianceStrip";
import MessageThread from "./MessageThread";
import ContentApprovalPanel from "./ContentApprovalPanel";
import CampaignActivityTimeline from "./CampaignActivityTimeline";
import Button from "./Button";
import type { ChannelRequest, ChannelRequestStatus, Profile } from "../lib/types";
import { CREATOR_PAYOUT_WINDOW_HOURS, CONTACT_ADDRESS_LINES } from "../lib/constants";

const STATUS_STYLE: Record<ChannelRequestStatus, string> = {
  pending: "bg-billboard-paperDim text-billboard-inkSoft border-billboard-inkSoft",
  countered: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  declined: "bg-white text-billboard-red border-billboard-red",
  cancelled: "bg-white text-billboard-inkSoft border-billboard-inkSoft",
  awaiting_payment: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  payment_submitted: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  paid: "bg-billboard-green text-white border-billboard-greenDeep",
  live: "bg-billboard-green text-white border-billboard-greenDeep",
  completed: "bg-billboard-ink text-white border-billboard-ink",
};

const STATUS_LABEL: Record<ChannelRequestStatus, string> = {
  pending: "Awaiting creator response",
  countered: "Creator proposed a different price",
  declined: "Declined",
  cancelled: "Cancelled",
  awaiting_payment: "Payment due",
  payment_submitted: "Payment submitted",
  paid: "Paid — scheduling",
  live: "Live",
  completed: "Completed",
};

type StepKey = "submitted" | "approved" | "payment" | "live" | "completed";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "payment", label: "Paid" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
];

function stepIndex(r: ChannelRequest): number {
  if (r.status === "declined" || r.status === "cancelled") return -1;
  if (r.status === "completed") return 4;
  if (r.status === "live") return 3;
  if (r.status === "paid") return 2;
  return r.status === "payment_submitted" || r.status === "awaiting_payment" ? 1 : 0; // pending or countered
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function dueIn(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "overdue";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "due today";
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

function Timeline({ request: r }: { request: ChannelRequest }) {
  const idx = stepIndex(r);
  if (idx === -1) return null; // declined/cancelled — a step tracker implies progress that isn't happening
  return (
    <div className="flex items-center gap-1.5 my-4">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5 flex-1 last:flex-none">
          <div className={`flex flex-col items-center gap-1 ${i <= idx ? "" : "opacity-40"}`}>
            <span className={`w-3 h-3 rounded-full border-2 border-billboard-ink shrink-0 ${i <= idx ? "bg-billboard-green" : "bg-white"}`} />
            <span className="font-mono text-[9px] uppercase text-billboard-inkSoft whitespace-nowrap">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 ${i < idx ? "bg-billboard-green" : "bg-billboard-ink/15"}`} />}
        </div>
      ))}
    </div>
  );
}


function downloadBusinessChannelInvoice(r: ChannelRequest, profile: Profile | null) {
  const billName = profile?.company_name || profile?.full_name || "Your business";
  const invoiceNumber = `CS-${r.id.slice(0, 8).toUpperCase()}`;
  const issueDate = new Date(r.paid_at ?? r.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  buildAndDownloadInvoice({
    invoiceNumber,
    issueDate,
    statusLabel: `Paid${r.paid_at ? ` on ${new Date(r.paid_at).toLocaleDateString("en-ZA")}` : ""}`,
    billTo: { heading: "Billed to", lines: [billName, ...(profile?.phone ? [profile.phone] : [])] },
    from: { heading: "From", lines: ["ChatSched", ...CONTACT_ADDRESS_LINES] },
    description: `Advertising placement — ${r.creator?.name ?? "Publisher"}`,
    channelLabel: getChannelBySlug(r.channel_slug)?.definition.name ?? r.advertising_method,
    grossAmount: r.proposed_amount,
    showCommissionSplit: false,
    fileName: `invoice-${invoiceNumber}`,
  });
}

export default function ChannelCampaignCard({ request: r, onChange }: { request: ChannelRequest; onChange: () => void }) {
  const { profile } = useAuth();
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [respondingToCounter, setRespondingToCounter] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reference = `CS-${r.id.slice(0, 8).toUpperCase()}`;

  async function cancel() {
    setCancelling(true);
    setError(null);
    const { error: updateError } = await supabase.from("channel_requests").update({ status: "cancelled" }).eq("id", r.id);
    setCancelling(false);
    setConfirmingCancel(false);
    if (updateError) {
      setError(formatSupabaseError(updateError, "Couldn't cancel that request"));
      return;
    }
    onChange();
  }

  async function respondToCounter(accept: boolean) {
    setRespondingToCounter(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("channel_requests")
      .update({ status: accept ? "awaiting_payment" : "cancelled" })
      .eq("id", r.id);
    setRespondingToCounter(false);
    if (updateError) {
      setError(formatSupabaseError(updateError, "Couldn't respond to counter-offer"));
      return;
    }
    onChange();
  }

  async function confirmPaid() {
    setConfirming(true);
    setError(null);
    const { error: updateError } = await supabase.from("channel_requests").update({ status: "payment_submitted" }).eq("id", r.id);
    setConfirming(false);
    if (updateError) {
      setError(formatSupabaseError(updateError, "Couldn't confirm payment submission"));
      return;
    }
    onChange();
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link to={`/browse/${r.creator_id}`} className="font-bold hover:text-billboard-greenDeep">
            {r.creator?.name ?? "Publisher"}
          </Link>
          <p className="text-sm text-billboard-inkSoft mt-1 max-w-md">{r.campaign_message}</p>
          <p className="text-xs text-billboard-inkSoft mt-1 font-mono">{r.advertising_method} · {formatCurrency(r.proposed_amount)}</p>
        </div>
        <span className={`inline-block font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 shrink-0 ${STATUS_STYLE[r.status]}`}>
          {STATUS_LABEL[r.status]}
        </span>
      </div>

      <Timeline request={r} />
      <CampaignActivityTimeline request={r} onChange={onChange} />

      {/* Status-specific panel */}
      {r.status === "pending" && (
        <div className="border-t-2 border-billboard-paperDim pt-4 mt-1">
          <p className="text-sm text-billboard-inkSoft mb-3">
            Waiting on {r.creator?.name ?? "the creator"} to approve or decline — {dueIn(r.approval_due_at)}.
          </p>
          {!confirmingCancel ? (
            <button onClick={() => setConfirmingCancel(true)} disabled={cancelling} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60">
              Cancel request
            </button>
          ) : (
            <div className="border-2 border-billboard-red rounded p-3 bg-billboard-red/5">
              <p className="text-xs font-semibold mb-2">Cancel this request? {r.creator?.name ?? "The creator"} won't be able to approve it after this.</p>
              <div className="flex gap-2">
                <button onClick={cancel} disabled={cancelling} className="font-mono text-xs font-semibold uppercase bg-billboard-red text-white border-2 border-billboard-red rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60">
                  {cancelling ? "Cancelling…" : "Yes, cancel it"}
                </button>
                <button onClick={() => setConfirmingCancel(false)} disabled={cancelling} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:bg-billboard-paperDim transition disabled:opacity-60">
                  Never mind
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {r.status === "declined" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          {r.creator?.name ?? "The creator"} declined this request.
        </p>
      )}

      {r.status === "countered" && (
        <div className="border-t-2 border-billboard-paperDim pt-4 mt-1">
          <p className="text-sm font-semibold text-billboard-ink mb-1">
            {r.creator?.name ?? "The creator"} proposed <span className="font-mono">{formatCurrency(r.counter_amount ?? NaN)}</span> instead of your {formatCurrency(r.proposed_amount)}.
          </p>
          {r.counter_note && <p className="text-xs text-billboard-inkSoft mb-2 italic">"{r.counter_note}"</p>}
          <p className="text-xs text-billboard-inkSoft mb-3">Accept to move ahead at the new price, or decline to close this request — {dueIn(r.approval_due_at)} to decide.</p>
          <div className="flex gap-2">
            <button onClick={() => respondToCounter(true)} disabled={respondingToCounter} className="bg-billboard-green text-white border-[3px] border-billboard-ink font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
              {respondingToCounter ? "…" : `Accept ${formatCurrency(r.counter_amount ?? 0)}`}
            </button>
            <button onClick={() => respondToCounter(false)} disabled={respondingToCounter} className="border-[3px] border-billboard-ink font-bold px-4 py-2 rounded text-sm hover:bg-billboard-paperDim transition disabled:opacity-60">
              Decline
            </button>
          </div>
        </div>
      )}

      {r.status === "cancelled" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          {r.counter_amount != null
            ? `${r.creator?.name ?? "The creator"}'s counter-offer of ${formatCurrency(r.counter_amount)} was declined or went unanswered.`
            : "This request was cancelled."}
        </p>
      )}

      {r.status === "awaiting_payment" && (
        <div className="border-t-2 border-billboard-paperDim pt-4 mt-1">
          <p className="text-sm font-semibold text-billboard-ink mb-1">
            {r.creator?.name ?? "The creator"} approved — payment is {dueIn(r.payment_due_at)}.
          </p>
          <p className="text-xs text-billboard-inkSoft mb-3">Pay by EFT using the details below, using the reference exactly as shown, then confirm below.</p>
          <EscrowNote until="your placement goes live" />
          <div className="mb-3">
            <BankDetailsPanel amount={r.proposed_amount} reference={reference} />
          </div>
          <Button variant="primary" size="md" onClick={confirmPaid} disabled={confirming}>
            {confirming ? "Confirming…" : "I've made this payment"}
          </Button>
          <p className="text-xs text-billboard-inkSoft mt-2">This tells ChatSched to check for it — a real person confirms it before your campaign moves forward.</p>
        </div>
      )}

      {r.status === "payment_submitted" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          You confirmed payment on {formatDate(r.payment_submitted_at)} — waiting on ChatSched to verify it's arrived.
        </p>
      )}

      {(r.status === "paid" || r.status === "live" || r.status === "completed") && (
        <div className="border-t-2 border-billboard-paperDim pt-4 mt-1 flex flex-wrap items-center gap-3">
          <p className="text-sm text-billboard-inkSoft">✓ Paid — {formatCurrency(r.proposed_amount)}</p>
          <button
            onClick={() => downloadBusinessChannelInvoice(r, profile)}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:bg-billboard-paperDim transition"
          >
            Download Invoice
          </button>
        </div>
      )}

      {r.status === "paid" && (
        <div className="border-t-2 border-billboard-paperDim pt-4 mt-1">
          <p className="text-sm text-billboard-inkSoft mb-1">
            Payment confirmed on {formatDate(r.paid_at)} — review and approve the content below before it goes live.
          </p>
          <ContentApprovalPanel
            channelRequestId={r.id}
            requestStatus={r.status}
            isCreator={false}
            isBusiness
            advertisingMethod={r.advertising_method}
            onPublished={onChange}
          />
        </div>
      )}

      {r.status === "live" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          Live since {formatDate(r.live_at)}. Nothing else needed from you — {r.creator?.name ?? "the creator"}'s payout is due within {CREATOR_PAYOUT_WINDOW_HOURS} hours.
        </p>
      )}

      {r.status === "completed" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          Completed on {formatDate(r.completed_at)} — {r.creator?.name ?? "the creator"} has been paid out.
        </p>
      )}

      {error && <p className="text-billboard-red text-xs font-semibold mt-3">{error}</p>}

      <Link to={`/campaigns/${r.id}`} className="inline-block font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft underline mt-3">
        Open campaign workspace →
      </Link>
      <CampaignComplianceStrip campaignId={r.id} />
      <MessageThread channelRequestId={r.id} senderRole="business" />
      {r.status !== "pending" && r.status !== "countered" && r.status !== "cancelled" && <DisputeSection channelRequestId={r.id} />}
    </div>
  );
}
