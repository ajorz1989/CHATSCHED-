import { useState } from "react";
import type { ChannelDefinition } from "../lib/channelTypes";
import { formatCurrency } from "../lib/currency";

/**
 * 12-Channel Audit fix D1 — a real, interactive campaign-cost estimate on
 * every channel hub page, using the channel's own pricingModels/
 * minBudgetZAR data that already exists in channelTypes.ts but was never
 * surfaced as anything beyond a printed number in RateCardDisplay-style
 * views. Deliberately simple (min price × quantity, floored at
 * minBudgetZAR) rather than a fully modeled quote engine — the real
 * quote still happens at actual booking time via each channel's own
 * request/checkout flow; this is a discovery/merchandising tool to get a
 * business thinking in concrete numbers before they even click through.
 */
export default function CampaignCostCalculator({ ch }: { ch: ChannelDefinition }) {
  const [modelIndex, setModelIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const model = ch.pricingModels[modelIndex];
  if (!model) return null;

  const estimate = Math.max(ch.minBudgetZAR, model.minPrice * quantity);

  return (
    <section className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
      <h2 className="font-display text-xl mb-1">Estimate your cost</h2>
      <p className="text-billboard-inkSoft text-sm mb-4">A rough starting point — real quotes depend on the specific publisher you book.</p>

      {ch.pricingModels.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {ch.pricingModels.map((m, i) => (
            <button
              key={m.unit}
              type="button"
              onClick={() => setModelIndex(i)}
              className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${i === modelIndex ? "bg-billboard-yellow" : "bg-white"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <label className="block text-xs font-mono uppercase text-billboard-inkSoft mb-1">
        How many {model.label.replace(/^per /, "")}?
      </label>
      <input
        type="range"
        min={1}
        max={20}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        className="w-full mb-3"
      />
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-display text-2xl">{formatCurrency(estimate)}</div>
          <div className="text-xs text-billboard-inkSoft">{quantity} × {formatCurrency(model.minPrice)} {model.label}, minimum {formatCurrency(ch.minBudgetZAR)} campaign</div>
        </div>
      </div>
      <p className="text-xs text-billboard-inkSoft mt-3">{model.description}</p>
    </section>
  );
}
