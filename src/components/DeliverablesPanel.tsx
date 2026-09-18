import { useEffect, useState } from "react";
import {
  listDeliverables,
  addDeliverable,
  removeDeliverable,
  submitDeliverable,
  sendDeliverableBack,
  approveDeliverable,
  publishDeliverable,
  verifyDeliverable,
  setCampaignDuration,
} from "../lib/deliverables";
import { DELIVERABLE_QUICK_ADD } from "../lib/constants";
import Button from "./Button";
import type { Deliverable, DeliverableStatus } from "../lib/types";

const STATUS_LABEL: Record<DeliverableStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  approved: "Approved",
  published: "Published",
  verified: "Verified",
};

const STATUS_STYLE: Record<DeliverableStatus, string> = {
  pending: "bg-billboard-paperDim text-billboard-inkSoft border-billboard-inkSoft",
  submitted: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  approved: "bg-billboard-green/20 text-billboard-greenDeep border-billboard-greenDeep",
  published: "bg-billboard-green text-white border-billboard-greenDeep",
  verified: "bg-billboard-ink text-white border-billboard-ink",
};

const STEPS: DeliverableStatus[] = ["pending", "submitted", "approved", "published", "verified"];

function ProgressDots({ status }: { status: DeliverableStatus }) {
  const idx = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {STEPS.map((s, i) => (
        <span key={s} className={`w-1.5 h-1.5 rounded-full ${i <= idx ? "bg-billboard-ink" : "bg-billboard-ink/15"}`} />
      ))}
    </div>
  );
}

function DeliverableRow({
  item, isBusiness, isCreator, isAdmin, onChanged,
}: {
  item: Deliverable;
  isBusiness: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showSendBackForm, setShowSendBackForm] = useState(false);
  const [url, setUrl] = useState(item.submission_url ?? "");
  const [subNotes, setSubNotes] = useState("");
  const [backNotes, setBackNotes] = useState("");

  async function run(fn: () => Promise<void>) {
    setActing(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't do that — try again.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="border-2 border-billboard-ink rounded-lg p-3.5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold text-sm">{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.label}</p>
          {item.notes && <p className="text-xs text-billboard-inkSoft mt-0.5">{item.notes}</p>}
        </div>
        <span className={`shrink-0 inline-block font-mono text-[10px] font-semibold uppercase px-2 py-1 rounded border-2 ${STATUS_STYLE[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      <ProgressDots status={item.status} />

      {error && <p className="text-billboard-red text-xs font-semibold mt-2">{error}</p>}

      {item.status === "pending" && item.business_notes && (
        <div className="border-2 border-billboard-red rounded p-2.5 bg-white mt-2.5">
          <p className="text-[10px] font-mono uppercase text-billboard-red font-semibold mb-1">Changes requested</p>
          <p className="text-xs">{item.business_notes}</p>
        </div>
      )}

      {item.status === "pending" && isCreator && (
        <div className="mt-2.5">
          {!showSubmitForm ? (
            <button onClick={() => setShowSubmitForm(true)} disabled={acting} className="border-2 border-billboard-ink font-semibold px-3 py-1.5 rounded text-xs hover:bg-billboard-paperDim transition">
              {item.business_notes ? "Resubmit" : "Submit"}
            </button>
          ) : (
            <div className="space-y-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link to the post/asset" className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
              <input value={subNotes} onChange={(e) => setSubNotes(e.target.value)} placeholder="Notes (optional)" className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => run(() => submitDeliverable(item.id, { url, notes: subNotes }))} disabled={acting || !url.trim()} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-60">
                  {acting ? "Submitting…" : "Submit"}
                </button>
                <button onClick={() => setShowSubmitForm(false)} className="border-2 border-billboard-ink font-semibold px-3 py-1.5 rounded text-xs">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {item.status === "pending" && isBusiness && !item.business_notes && (
        <p className="text-xs text-billboard-inkSoft mt-2">Waiting on the creator to submit this.</p>
      )}

      {item.status === "submitted" && (
        <div className="mt-2.5 space-y-2">
          <a href={item.submission_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline text-billboard-ink block break-all">
            {item.submission_url}
          </a>
          {item.submission_notes && <p className="text-xs text-billboard-inkSoft">{item.submission_notes}</p>}
          {isBusiness && !showSendBackForm && (
            <div className="flex gap-2">
              <button onClick={() => run(() => approveDeliverable(item.id))} disabled={acting} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-60">
                {acting ? "…" : "Approve"}
              </button>
              <button onClick={() => setShowSendBackForm(true)} disabled={acting} className="border-2 border-billboard-ink font-semibold px-3 py-1.5 rounded text-xs">
                Send back
              </button>
            </div>
          )}
          {isBusiness && showSendBackForm && (
            <div className="space-y-2">
              <input value={backNotes} onChange={(e) => setBackNotes(e.target.value)} placeholder="What needs to change?" className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => run(() => sendDeliverableBack(item.id, backNotes))} disabled={acting || !backNotes.trim()} className="border-[3px] border-billboard-ink bg-billboard-red text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-60">
                  {acting ? "Sending…" : "Send back"}
                </button>
                <button onClick={() => setShowSendBackForm(false)} className="border-2 border-billboard-ink font-semibold px-3 py-1.5 rounded text-xs">Cancel</button>
              </div>
            </div>
          )}
          {isCreator && <p className="text-xs text-billboard-inkSoft">Waiting on business review.</p>}
        </div>
      )}

      {item.status === "approved" && (
        <div className="mt-2.5">
          {isCreator ? (
            <button onClick={() => run(() => publishDeliverable(item.id))} disabled={acting} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-60">
              {acting ? "…" : "Mark published"}
            </button>
          ) : (
            <p className="text-xs text-billboard-inkSoft">Approved — waiting on the creator to confirm it's live.</p>
          )}
        </div>
      )}

      {item.status === "published" && (
        <div className="mt-2.5">
          {isAdmin ? (
            <button onClick={() => run(() => verifyDeliverable(item.id))} disabled={acting} className="border-[3px] border-billboard-ink bg-billboard-ink text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-60">
              {acting ? "…" : "Verify"}
            </button>
          ) : (
            <p className="text-xs text-billboard-inkSoft">Live — ChatSched will verify it shortly.</p>
          )}
        </div>
      )}

      {item.status === "pending" && isBusiness && (
        <button onClick={() => run(() => removeDeliverable(item.id))} disabled={acting} className="text-[11px] text-billboard-inkSoft underline mt-2">
          Remove
        </button>
      )}
    </div>
  );
}

/**
 * Structured deliverables for one campaign — replaces a single freeform
 * "Post on Instagram" ask with a checklist of specific line items, each
 * independently tracked through pending → submitted → approved →
 * published → verified. See schema_phase54_deliverables.sql.
 *
 * Only wired up for the channel_requests flow (campaign duration in
 * particular is a channel_requests-only column — see that migration's
 * comment on why `requests` wasn't extended the same way).
 */
export default function DeliverablesPanel({
  campaign, isBusiness, isCreator, isAdmin, durationDays, canEditDuration,
}: {
  campaign: { kind: "channel_request" | "request"; id: string };
  isBusiness: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  durationDays: number | null;
  canEditDuration: boolean;
}) {
  const [items, setItems] = useState<Deliverable[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const [duration, setDuration] = useState(durationDays != null ? String(durationDays) : "");
  const [savingDuration, setSavingDuration] = useState(false);

  async function load() {
    try {
      const rows = await listDeliverables(campaign);
      setItems(rows);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  async function submitAdd() {
    if (!label.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addDeliverable(campaign, { label, quantity, notes, sortOrder: items?.length ?? 0 });
      setLabel("");
      setQuantity(1);
      setNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that — try again.");
    } finally {
      setAdding(false);
    }
  }

  async function saveDuration() {
    if (campaign.kind !== "channel_request") return;
    setSavingDuration(true);
    try {
      await setCampaignDuration(campaign.id, duration.trim() ? Number(duration) : null);
    } finally {
      setSavingDuration(false);
    }
  }

  return (
    <div className="space-y-5">
      {campaign.kind === "channel_request" && (
        <div className="border-2 border-billboard-ink/15 rounded p-3 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-mono uppercase text-billboard-inkSoft">Campaign duration</span>
          {canEditDuration ? (
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} onBlur={saveDuration} className="w-20 border-2 border-billboard-ink rounded px-2 py-1 text-sm" placeholder="7" />
              <span className="text-xs text-billboard-inkSoft">days{savingDuration ? " · saving…" : ""}</span>
            </div>
          ) : (
            <span className="text-sm font-semibold">{durationDays ? `${durationDays} days` : "Not set"}</span>
          )}
        </div>
      )}

      {error && <p className="text-billboard-red text-xs font-semibold">{error}</p>}

      {items === undefined ? (
        <p className="text-sm text-billboard-inkSoft">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-billboard-inkSoft">No deliverables defined yet{isBusiness ? " — add what's expected below." : "."}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <DeliverableRow key={item.id} item={item} isBusiness={isBusiness} isCreator={isCreator} isAdmin={isAdmin} onChanged={load} />
          ))}
        </div>
      )}

      {isBusiness && (
        <div className="border-2 border-billboard-yellow bg-billboard-yellow/5 rounded p-3.5">
          <p className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft mb-2">Add a deliverable</p>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {DELIVERABLE_QUICK_ADD.map((q) => (
              <button key={q} type="button" onClick={() => setLabel(q)} className={`font-mono text-[10px] uppercase px-2 py-1 rounded border-2 ${label === q ? "border-billboard-ink bg-billboard-ink text-white" : "border-billboard-ink/30 text-billboard-inkSoft"}`}>
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="flex-1 border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} className="w-16 border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional — e.g. promo code value, required hashtags)" className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm mb-2" />
          <Button variant="primary" size="sm" onClick={submitAdd} disabled={adding || !label.trim()}>
            {adding ? "Adding…" : "Add deliverable"}
          </Button>
        </div>
      )}
    </div>
  );
}
