import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { CATEGORIES, PROVINCES } from "../lib/constants";
import Button from "../components/Button";

interface ReachResult {
  count: number;
  totalFollowers: number;
  sample: { id: string; name: string; followers: number }[];
}

export default function ReachChecker() {
  const [categorySlug, setCategorySlug] = useState(CATEGORIES[0].slug);
  const [province, setProvince] = useState(PROVINCES[0]);
  const [suburb, setSuburb] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<ReachResult | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setSearched(true);

    // publishers_public (schema_phase82) — public reach estimation over
    // the approved directory, already narrow-selected, just no longer
    // needing the approved filter since the view bakes it in.
    let query = supabase
      .from("publishers_public")
      .select("id, name, followers")
      .eq("category", categorySlug)
      .eq("province", province);
    if (suburb.trim()) query = query.ilike("suburb", `%${suburb.trim()}%`);

    const { data } = await query.order("followers", { ascending: false }).limit(200);
    const rows = data ?? [];
    const totalFollowers = rows.reduce((sum, r) => sum + (r.followers || 0), 0);

    setResult({
      count: rows.length,
      totalFollowers,
      sample: rows.slice(0, 5),
    });
    setLoading(false);
  }

  const categoryLabel = CATEGORIES.find((c) => c.slug === categorySlug)?.name ?? categorySlug;
  const browseUrl = `/browse?category=${categorySlug}&province=${encodeURIComponent(province)}${suburb.trim() ? `&suburb=${encodeURIComponent(suburb.trim())}` : ""}`;

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title="Local Reach Checker · ChatSched" description="See how many real, approved local publishers exist for your category and area — a live count, not an estimate." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-green text-billboard-greenDeep px-3 py-1.5 rounded mb-3">Business Tools</span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">Is there an audience for you here?</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">A live count of real, approved publishers matching your category and area — not a guess.</p>

      <form onSubmit={handleSearch} className="border-[3px] border-billboard-ink rounded p-6 mb-8 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Category</label>
            <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Province</label>
            <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">Suburb / area <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
          <input value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="e.g. Sea Point" className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
        </div>
        <Button type="submit" variant="primary" size="md" disabled={loading || !isSupabaseConfigured} className="w-full">
          {loading ? "Checking…" : "Check reach"}
        </Button>
        {!isSupabaseConfigured && <p className="text-xs text-billboard-inkSoft text-center">The database isn't connected yet, so this can't run live results.</p>}
      </form>

      {searched && result && (
        result.count > 0 ? (
          <div className="space-y-4">
            <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-green text-white text-center">
              <p className="font-display text-4xl mb-1">{result.count}</p>
              <p className="font-mono text-xs uppercase tracking-wide text-white/80">approved {categoryLabel.toLowerCase()} publisher{result.count === 1 ? "" : "s"} in {province}{suburb.trim() ? ` · ${suburb.trim()}` : ""}</p>
            </div>
            <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paper text-center">
              <p className="font-display text-2xl mb-1">{result.totalFollowers.toLocaleString()}</p>
              <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft">combined potential reach{result.count >= 200 ? " (top 200 shown)" : ""}</p>
            </div>
            {result.sample.length > 0 && (
              <div className="border-[3px] border-billboard-ink rounded p-5">
                <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-3">A few of them</p>
                <ul className="space-y-1.5 text-sm">
                  {result.sample.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-billboard-inkSoft">{p.followers.toLocaleString()} followers</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link to={browseUrl} className="block text-center bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
              Browse them all →
            </Link>
          </div>
        ) : (
          <div className="border-[3px] border-dashed border-billboard-ink rounded p-8 text-center">
            <p className="font-bold mb-2">No approved publishers match yet.</p>
            <p className="text-sm text-billboard-inkSoft mb-4">Try a wider area, or a different category. Either way, this is a real gap — if you're a publisher who fits it, listing here means being first.</p>
            <Link to="/register?role=publisher" className="inline-block font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-4 py-2 hover:-translate-y-0.5 transition">
              List your audience →
            </Link>
          </div>
        )
      )}
    </div>
  );
}
