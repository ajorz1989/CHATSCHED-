import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { reportError } from "../lib/errorTracking";
import { MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import { PLATFORM_COMMISSION_RATE, PUBLISHER_SHARE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import type { PublisherRateCard } from "../lib/types";

const MAX_ITEMS = 8;

export default function RateCardManager({ publisherId, onChange }: { publisherId: string; onChange?: () => void }) {
  const [items, setItems] = useState<PublisherRateCard[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("publisher_rate_cards").select("*").eq("publisher_id", publisherId).order("sort_order").order("created_at");
    setItems((data as PublisherRateCard[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisherId]);

  async function addItem() {
    const priceNum = Number(price);
    if (!label.trim()) {
      setError("Give it a name — e.g. \"Story Post\".");
      return;
    }
    if (!priceNum || priceNum < MIN_PRICE_PER_POST) {
      setError(`Price must be at least ${formatCurrency(MIN_PRICE_PER_POST)}.`);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("publisher_rate_cards").insert({
      publisher_id: publisherId,
      label: label.trim(),
      price: priceNum,
      description: description.trim() || null,
      sort_order: items?.length ?? 0,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setLabel("");
    setPrice("");
    setDescription("");
    setAdding(false);
    await load();
    onChange?.();
  }

  async function removeItem(id: string) {
    setDeletingId(id);
    const { error: deleteError } = await supabase.from("publisher_rate_cards").delete().eq("id", id);
    setDeletingId(null);
    if (deleteError) {
      reportError(deleteError, { source: "RateCardManager.remove" });
      return;
    }
    await load();
    onChange?.();
  }

  if (items === null) return null;

  return (
    <div>
      <div className="flex flex-col gap-2 mb-3">
        {items.length === 0 ? (
          <p className="text-xs text-billboard-inkSoft">
            No rate card yet — add a few line items so businesses can see exactly what different formats cost, instead of one flat number that's rarely right for what they actually want.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 border-2 border-billboard-ink/15 rounded px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.label} <span className="font-mono text-billboard-greenDeep">{formatCurrency(item.price)}</span></p>
                {item.description && <p className="text-xs text-billboard-inkSoft">{item.description}</p>}
              </div>
              <button
                onClick={() => removeItem(item.id)}
                disabled={deletingId === item.id}
                className="text-xs font-semibold text-billboard-red underline shrink-0 disabled:opacity-60"
              >
                {deletingId === item.id ? "…" : "Remove"}
              </button>
            </div>
          ))
        )}
      </div>

      {!adding ? (
        items.length < MAX_ITEMS && (
          <button onClick={() => setAdding(true)} className="text-xs font-semibold underline text-billboard-inkSoft hover:text-billboard-ink">
            + Add a rate card item
          </button>
        )
      ) : (
        <div className="border-2 border-billboard-ink rounded p-3 bg-billboard-paperDim">
          <div className="grid sm:grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Name</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Story Post" maxLength={60} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Price (R)</label>
              <input type="number" min={MIN_PRICE_PER_POST} value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
            </div>
          </div>
          {Number(price) >= MIN_PRICE_PER_POST && (
            <p className="text-xs text-billboard-inkSoft mb-2">
              Business price <strong>{formatCurrency(Number(price))}</strong> · marketplace fee ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%) <strong>-{formatCurrency(Number(price) * PLATFORM_COMMISSION_RATE)}</strong> · your earnings <strong className="text-billboard-greenDeep">{formatCurrency(Number(price) * PUBLISHER_SHARE)}</strong>
            </p>
          )}
          <label className="block text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's included" maxLength={200} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm mb-2" />
          {error && <p className="text-billboard-red text-xs font-semibold mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addItem} disabled={saving} className="border-[3px] border-billboard-ink bg-billboard-green text-white font-bold px-3 py-1.5 rounded text-xs hover:-translate-y-0.5 transition disabled:opacity-60">
              {saving ? "Adding…" : "Add item"}
            </button>
            <button onClick={() => { setAdding(false); setError(null); }} className="border-2 border-billboard-ink font-semibold px-3 py-1.5 rounded text-xs hover:bg-white transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
