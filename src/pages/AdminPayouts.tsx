import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { PAYOUT_DUE_DAYS } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import { SkeletonRows } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";

// This whole page is the admin UI for the experimental ledger/batch payout
// pipeline described in workers/README.md — it is NOT the live payout
// mechanism (that's the "Mark payout sent" button on the Requests tab in
// Admin.tsx, which works today). Read workers/README.md before relying on
// this for anything real: the worker that would actually move money is
// still a placeholder, and this UI exists so the batch/ledger data model
// has somewhere to be inspected while that gets built out for real.

interface PayoutItem {
  id: string;
  publisher_id: string;
  amount_cents: number;
  status: string;
}

interface PayoutBatch {
  id: string;
  status: string;
  total_items: number;
  total_amount_cents: number;
  created_at: string;
  payout_items?: PayoutItem[];
}

export default function AdminPayouts() {
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("payouts")
      .select("*, payout_items(*)")
      .order("created_at", { ascending: false });
    setBatches((data ?? []) as PayoutBatch[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createBatch() {
    setActionError(null);
    const { error } = await supabase.rpc("create_payout_batch");
    if (error) setActionError(formatSupabaseError(error, "Could not create batch"));
    else load();
  }

  async function approve(batchId: string) {
    setActionError(null);
    const { error } = await supabase.rpc("approve_payout", { p_payout_id: batchId });
    if (error) setActionError(formatSupabaseError(error, "Could not approve"));
    else load();
  }

  return (
    <div>
      <div className="border-[3px] border-billboard-red rounded p-4 mb-6 bg-[#FBEAEA]">
        <p className="font-bold text-billboard-red text-sm mb-1">⚠ Experimental — not the live payout system</p>
        <p className="text-xs text-billboard-inkSoft leading-relaxed">
          Publishers are actually paid from the <strong>Requests</strong> tab today ("Mark payout sent"). This batch/ledger
          pipeline is unfinished — the worker that would call PayFast is still a placeholder and refuses to start unless
          explicitly opted into (see <code className="font-mono">workers/README.md</code>).
          Approving a batch here updates real database rows but nothing downstream sends money yet.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={createBatch} className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded hover:-translate-y-0.5 transition">
          + Create batch
        </button>
        <Button onClick={load} variant="outline" size="md">
          Reload
        </Button>
      </div>

      {actionError && <p className="text-billboard-red text-xs font-semibold mb-4">{actionError}</p>}

      {loading ? (
        <SkeletonRows count={3} />
      ) : batches.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded">
          <EmptyState kind="wallet" title="No payout batches yet" compact />
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((b) => (
            <div key={b.id} className="border-[3px] border-billboard-ink rounded p-5">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="font-mono text-[10px] text-billboard-inkSoft">{b.id}</p>
                  <p className="text-sm mt-0.5">
                    Status: <strong className="uppercase">{b.status}</strong> · {b.total_items} item{b.total_items === 1 ? "" : "s"} ·{" "}
                    <span className="font-mono font-bold text-billboard-greenDeep">{formatCurrency(b.total_amount_cents / 100, { cents: true })}</span>
                  </p>
                </div>
                {b.status === "pending" && (
                  <button onClick={() => approve(b.id)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition">
                    Approve
                  </button>
                )}
              </div>

              {(b.payout_items?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-mono uppercase text-billboard-inkSoft">
                        <th className="pb-2 pr-3">Publisher</th>
                        <th className="pb-2 pr-3">Amount</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.payout_items!.map((it) => (
                        <tr key={it.id} className="border-t border-billboard-paperDim">
                          <td className="py-1.5 pr-3 font-mono text-xs">{it.publisher_id}</td>
                          <td className="py-1.5 pr-3 font-mono">{formatCurrency(it.amount_cents / 100, { cents: true })}</td>
                          <td className="py-1.5 uppercase text-xs">{it.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-billboard-inkSoft mt-6">
        The Requests tab flags any payment paid for more than {PAYOUT_DUE_DAYS} days without a payout marked sent —
        that's the number worth checking regularly until this pipeline is finished for real.
      </p>
    </div>
  );
}
