import { useMemo, useState } from "react";
import { usePublishers } from "../../hooks/usePublishers";
import { estimateRoi } from "../../lib/marketingSuite";
import { formatCurrencyRange } from "../../lib/currency";

export default function RoiCalculator() {
  const { publishers, loading } = usePublishers();
  const [budget, setBudget] = useState("1500");
  const [selected, setSelected] = useState<string[]>([]);

  const estimate = useMemo(() => {
    const n = Number(budget) || 0;
    return estimateRoi(n, publishers, selected.length ? selected : undefined);
  }, [budget, publishers, selected]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const top = [...publishers].sort((a, b) => b.engagement - a.engagement).slice(0, 8);

  return (
    <div>
      <p className="text-sm text-billboard-inkSoft mb-4">
        Estimates of reach, clicks, leads, and return from publisher directory data and your budget.
        These are <strong className="text-billboard-ink">not guarantees</strong> — real results depend
        on creative, offer, and timing.
      </p>

      <div className="border-[3px] border-billboard-ink rounded p-5 mb-5 bg-billboard-paperDim">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Campaign budget (R)</label>
        <input
          type="number"
          min={0}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-full sm:w-48 border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm mb-4"
        />

        <p className="text-xs font-semibold uppercase tracking-wide mb-2">
          Optional: limit to specific publishers
        </p>
        {loading ? (
          <p className="text-sm text-billboard-inkSoft">Loading publishers…</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {top.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`font-mono text-[10px] border-2 border-billboard-ink rounded-full px-2.5 py-1 ${
                  selected.includes(p.id) ? "bg-billboard-ink text-white" : "bg-white"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        {selected.length === 0 && (
          <p className="text-xs text-billboard-inkSoft mt-2">None selected — model uses best-priced directory fit.</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Metric label="Est. reach" value={estimate.estimatedReach.toLocaleString()} />
        <Metric label="Est. clicks" value={estimate.estimatedClicks.toLocaleString()} />
        <Metric label="Est. leads" value={estimate.estimatedLeads.toLocaleString()} />
        <Metric
          label="Est. return band"
          value={
            estimate.estimatedReturnHigh > 0
              ? formatCurrencyRange(estimate.estimatedReturnLow, estimate.estimatedReturnHigh)
              : "—"
          }
        />
      </div>

      <div className="border-2 border-billboard-ink rounded p-4 text-sm text-billboard-inkSoft space-y-1">
        <p className="font-semibold text-billboard-ink text-xs uppercase tracking-wide mb-1">Assumptions</p>
        {estimate.assumptions.map((a, i) => (
          <p key={i}>• {a}</p>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[3px] border-billboard-ink rounded p-3 bg-white">
      <div className="font-display text-lg leading-tight">{value}</div>
      <div className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-1">{label}</div>
    </div>
  );
}
