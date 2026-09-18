import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import type { Dispute, DisputeCategory, DisputeMessage } from "../lib/types";

const CATEGORY_LABEL: Record<DisputeCategory, string> = {
  payment_issue: "Payment issue",
  quality_issue: "Quality issue",
  non_delivery: "Non-delivery",
  communication: "Communication",
  other: "Other",
};

const STATUS_STYLE: Record<Dispute["status"], string> = {
  open: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  awaiting_response: "bg-white text-billboard-inkSoft border-billboard-inkSoft",
  resolved: "bg-billboard-green text-white border-billboard-greenDeep",
  closed: "bg-billboard-ink text-white border-billboard-ink",
};

const STATUS_LABEL: Record<Dispute["status"], string> = {
  open: "Open",
  awaiting_response: "Awaiting your response",
  resolved: "Resolved",
  closed: "Closed",
};

const OUTCOME_LABEL: Record<NonNullable<Dispute["resolution_outcome"]>, string> = {
  refund_business: "Refunded to business",
  release_to_publisher: "Released to publisher",
  partial: "Partially resolved",
  no_action: "No action taken",
  other: "Other outcome",
};

/**
 * Dispute ticketing, scoped to exactly one campaign — pass either requestId
 * (the original social-media/PayFast flow) or channelRequestId (the 4
 * request-flow channels), never both. Shows existing disputes on this
 * campaign with their own threads, plus an "Open a dispute" form when there
 * are none in progress. Used from both the business and publisher sides of
 * a campaign — and, unmodified, from nowhere on the admin side, which gets
 * its own cross-campaign view in Admin.tsx's Disputes tab instead.
 */
export default function DisputeSection({ requestId, channelRequestId }: { requestId?: string; channelRequestId?: string }) {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    let query = supabase.from("disputes").select("*, dispute_messages(*)").order("created_at", { ascending: false });
    query = requestId ? query.eq("request_id", requestId) : query.eq("channel_request_id", channelRequestId);
    const { data } = await query;
    setDisputes(((data ?? []) as unknown as Dispute[]).map((d) => ({
      ...d,
      dispute_messages: (d.dispute_messages ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
    })));
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, channelRequestId]);

  const hasOpenDispute = disputes.some((d) => d.status !== "resolved" && d.status !== "closed");

  if (!loaded) return null;

  return (
    <div className="mt-3">
      {disputes.map((d) => (
        <DisputeCard key={d.id} dispute={d} currentUserId={user?.id} onChange={load} />
      ))}

      {!hasOpenDispute && (
        showForm ? (
          <OpenDisputeForm
            requestId={requestId}
            channelRequestId={channelRequestId}
            onDone={() => { setShowForm(false); load(); }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="font-mono text-xs font-semibold uppercase text-billboard-red underline mt-2"
          >
            {disputes.length > 0 ? "Open another dispute" : "Open a dispute"}
          </button>
        )
      )}
    </div>
  );
}

function OpenDisputeForm({
  requestId, channelRequestId, onDone, onCancel,
}: {
  requestId?: string;
  channelRequestId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [category, setCategory] = useState<DisputeCategory>("payment_issue");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!user || !subject.trim() || !body.trim()) {
      setError("Add a short subject and describe the issue.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data: dispute, error: disputeError } = await supabase.from("disputes").insert({
      request_id: requestId ?? null,
      channel_request_id: channelRequestId ?? null,
      category,
      subject: subject.trim(),
    }).select().single();

    if (disputeError || !dispute) {
      setSubmitting(false);
      setError(formatSupabaseError(disputeError, "Couldn't open that dispute"));
      return;
    }

    const { error: msgError } = await supabase.from("dispute_messages").insert({
      dispute_id: dispute.id,
      sender_id: user.id,
      body: body.trim(),
    });
    setSubmitting(false);
    if (msgError) {
      setError(formatSupabaseError(msgError, "The dispute was opened, but the initial message failed to send"));
    }
    onDone();
  }

  return (
    <div className="mt-2 border-2 border-billboard-red rounded p-3.5 bg-white">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-billboard-red mb-2">Open a dispute</p>
      <select value={category} onChange={(e) => setCategory(e.target.value as DisputeCategory)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm mb-2 bg-white">
        {(Object.keys(CATEGORY_LABEL) as DisputeCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </select>
      <input
        value={subject} onChange={(e) => setSubject(e.target.value)} placeholder='Short subject, e.g. "Post never went live"'
        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-2"
      />
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What happened? An admin will review and help resolve it."
        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-2"
      />
      {error && <p className="text-billboard-red text-xs font-semibold mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting} className="border-2 border-billboard-red bg-billboard-red text-white font-bold px-4 py-1.5 rounded text-xs hover:-translate-y-0.5 transition disabled:opacity-60">
          {submitting ? "Opening…" : "Open dispute"}
        </button>
        <button onClick={onCancel} className="text-xs font-semibold text-billboard-inkSoft">Cancel</button>
      </div>
    </div>
  );
}

function DisputeCard({ dispute: d, currentUserId, onChange }: { dispute: Dispute; currentUserId: string | undefined; onChange: () => void }) {
  const [open, setOpen] = useState(d.status !== "resolved" && d.status !== "closed");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim() || !currentUserId) return;
    setSending(true);
    const { error } = await supabase.from("dispute_messages").insert({ dispute_id: d.id, sender_id: currentUserId, body: body.trim() });
    setSending(false);
    if (!error) {
      setBody("");
      onChange();
    }
  }

  const messages: DisputeMessage[] = d.dispute_messages ?? [];

  return (
    <div className="border-2 border-billboard-ink rounded mb-3 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-billboard-paperDim text-left">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{d.subject}</p>
          <p className="font-mono text-[10px] text-billboard-inkSoft uppercase mt-0.5">{CATEGORY_LABEL[d.category]}</p>
        </div>
        <span className={`font-mono text-[10px] font-semibold uppercase border-2 rounded-full px-2 py-1 shrink-0 ${STATUS_STYLE[d.status]}`}>
          {STATUS_LABEL[d.status]}
        </span>
      </button>

      {open && (
        <div className="p-3.5 bg-white">
          {d.resolution_outcome && (
            <div className="border-2 border-billboard-greenDeep bg-[#EAF3EC] rounded p-2.5 mb-3">
              <p className="font-mono text-[10px] uppercase font-semibold text-billboard-greenDeep">{OUTCOME_LABEL[d.resolution_outcome]}</p>
              {d.resolution_notes && <p className="text-sm mt-1">{d.resolution_notes}</p>}
            </div>
          )}

          {messages.length === 0 ? (
            <p className="text-xs text-billboard-inkSoft mb-2">No messages yet.</p>
          ) : (
            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={`text-sm p-2.5 rounded border-2 ${m.sender_id === currentUserId ? "border-billboard-greenDeep bg-[#EAF3EC] ml-6" : "border-billboard-ink bg-billboard-paperDim mr-6"}`}>
                  <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">
                    {m.sender_role === "admin" ? "Platform" : m.sender_role === "publisher" ? "Publisher" : "Business"} · {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
          )}

          {d.status !== "closed" && (
            <div className="flex gap-2">
              <input
                value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Reply…" className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
              />
              <button onClick={send} disabled={sending || !body.trim()} className="border-2 border-billboard-ink font-bold px-4 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
