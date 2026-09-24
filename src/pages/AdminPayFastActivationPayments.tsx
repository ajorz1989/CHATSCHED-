import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/currency";
import Seo from "../components/Seo";
import Button from "../components/Button";

type ActivationEvent = {
  id: string;
  pf_payment_id: string | null;
  m_payment_id: string | null;
  activation_type: "business" | "publisher";
  amount: number;
  payer_email: string | null;
  payer_name: string | null;
  payment_status: string;
  matched_user_id: string | null;
  match_status: "auto_activated" | "already_active" | "action_required" | "failed" | "cancelled" | "ignored";
  note: string | null;
  created_at: string;
  processed_at: string | null;
};

export default function AdminPayFastActivationPayments() {
  const [events, setEvents] = useState<ActivationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("payfast_activation_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (loadError) {
      setError(loadError.message);
      setEvents([]);
    } else {
      setEvents((data ?? []) as ActivationEvent[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const attention = events.filter((event) => event.match_status === "action_required");
  const paid = events.filter((event) => event.payment_status === "COMPLETE");
  const autoActivated = events.filter((event) => event.match_status === "auto_activated");
  const totalPaid = useMemo(
    () => paid.reduce((sum, event) => sum + Number(event.amount), 0),
    [paid]
  );
  const visibleEvents = showOlder ? events : events.slice(0, 20);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <Seo title="Admin · PayFast Activation Payments" noindex />

      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">
          Financials & Risk
        </p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">PayFast Activation Payments</h1>
            <p className="text-sm text-billboard-inkSoft mt-2 max-w-2xl">
              Primary Pay Now payments for Business (R399) and Publisher Network (R199) activation.
              Every confirmed PayFast payment is logged here and sent to the admin notification bell.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {attention.length > 0 && (
        <div className="border-[3px] border-billboard-red bg-white rounded-lg p-5 mb-6">
          <p className="font-display text-lg text-billboard-red">Action required: {attention.length}</p>
          <p className="text-sm text-billboard-inkSoft mt-1">
            These confirmed PayFast payments could not be safely matched to the expected ChatSched account.
            Review the payer details before activating anything manually.
          </p>
        </div>
      )}

      {error && (
        <div className="border-2 border-billboard-red text-billboard-red rounded p-3 mb-5 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="border-2 border-billboard-ink rounded p-4">
          <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Confirmed payments</p>
          <p className="text-2xl font-bold">{paid.length}</p>
        </div>
        <div className="border-2 border-billboard-ink rounded p-4">
          <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Auto-activated</p>
          <p className="text-2xl font-bold">{autoActivated.length}</p>
        </div>
        <div className="border-2 border-billboard-ink rounded p-4">
          <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Needs attention</p>
          <p className="text-2xl font-bold">{attention.length}</p>
        </div>
        <div className="border-2 border-billboard-ink rounded p-4">
          <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">Confirmed value</p>
          <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {loading ? (
        <div className="border-[3px] border-billboard-ink rounded p-8 text-sm">
          Loading PayFast activation payments…
        </div>
      ) : events.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-sm text-billboard-inkSoft">
          No PayFast activation payments have been logged yet.
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {visibleEvents.map((event) => {
              const isBusiness = event.activation_type === "business";
              const attentionRow = event.match_status === "action_required";
              const statusLabel =
                event.match_status === "auto_activated"
                  ? "Auto-activated"
                  : event.match_status === "already_active"
                  ? "Already active"
                  : attentionRow
                  ? "Action required"
                  : event.match_status === "failed"
                  ? "Failed"
                  : event.match_status === "cancelled"
                  ? "Cancelled"
                  : event.match_status;

              return (
                <div
                  key={event.id}
                  className={`border-[3px] ${attentionRow ? "border-billboard-red" : "border-billboard-ink"} rounded-lg p-5 bg-white`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">
                          {isBusiness ? "Business Activation" : "Publisher Network Activation"}
                        </p>
                        <span className="font-mono text-[10px] uppercase border-2 border-billboard-ink rounded px-2 py-1">
                          {event.payment_status}
                        </span>
                        <span className="font-mono text-[10px] uppercase border-2 border-billboard-ink rounded px-2 py-1">
                          {statusLabel}
                        </span>
                      </div>

                      <p className="text-sm mt-2">
                        {event.payer_name || "Unknown payer"} · {event.payer_email || "No email returned"}
                      </p>
                      <p className="text-sm font-semibold mt-1">
                        {formatCurrency(Number(event.amount))} ·{" "}
                        {new Date(event.created_at).toLocaleString("en-ZA")}
                      </p>

                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-4 text-xs text-billboard-inkSoft">
                        <p>PayFast payment ID: <span className="font-mono">{event.pf_payment_id || "—"}</span></p>
                        <p>ChatSched payment ID: <span className="font-mono">{event.m_payment_id || "—"}</span></p>
                        <p>Matched user: <span className="font-mono">{event.matched_user_id || "—"}</span></p>
                        <p>Processed: {event.processed_at ? new Date(event.processed_at).toLocaleString("en-ZA") : "—"}</p>
                      </div>

                      {event.note && (
                        <p className="text-sm text-billboard-red mt-3 whitespace-pre-wrap">{event.note}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {events.length > 20 && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setShowOlder((value) => !value)}>
                {showOlder ? "Show recent only" : `Show all ${events.length} events`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
