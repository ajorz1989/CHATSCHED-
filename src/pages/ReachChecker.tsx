import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { CATEGORIES, PROVINCES } from "../lib/constants";
import Button from "../components/Button";
import { getLeadAudience, formatAudienceCount, type LeadAudiencePublisher } from "../lib/leadAudience";
import { getChannelBySlug } from "../lib/channelRegistry";

type ReachRow = LeadAudiencePublisher & { id: string; name: string };

/** One channel's slice of the results. Numbers are never added across channels. */
interface ChannelReach {
  slug: string;
  channelName: string;
  count: number;
  /** Sum of the lead audience number, or null when none of these listings has one. */
  total: number | null;
  label: string;
  sample: { id: string; name: string; text: string }[];
}

interface ReachResult {
  count: number;
  groups: ChannelReach[];
}

function groupByChannel(rows: ReachRow[]): ChannelReach[] {
  const bySlug = new Map<string, ReachRow[]>();
  for (const r of rows) {
    const slug = r.channel_slug || "social-media";
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), r]);
  }
  return [...bySlug.entries()]
    .map(([slug, list]) => {
      const audiences = list.map((r) => ({ r, a: getLeadAudience(r) }));
      const withValue = audiences.filter((x) => x.a.value !== null);
      return {
        slug,
        channelName: getChannelBySlug(slug)?.definition.name ?? slug,
        count: list.length,
        total: withValue.length > 0 ? withValue.reduce((sum, x) => sum + (x.a.value ?? 0), 0) : null,
        label: audiences[0].a.label,
        sample: audiences.slice(0, 5).map(({ r, a }) => ({
          id: r.id,
          name: r.name,
          text: a.value === null ? "Audience not listed" : `${a.value.toLocaleString()} ${a.label}`,
        })),
      };
    })
    .sort((a, b) => b.count - a.count);
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
      .select("id, name, followers, channel_slug, channel_metadata, platforms")
      .eq("category", categorySlug)
      .eq("province", province);
    if (suburb.trim()) query = query.ilike("suburb", `%${suburb.trim()}%`);

    const { data } = await query.order("followers", { ascending: false }).limit(200);
    const rows = (data ?? []) as ReachRow[];

    setResult({
      count: rows.length,
      groups: groupByChannel(rows),
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
            {result.groups.map((g) => (
              <div key={g.slug} className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paper">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="font-display text-lg">{g.channelName}</p>
                  <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft">{g.count} publisher{g.count === 1 ? "" : "s"}</p>
                </div>
                <p className="font-display text-2xl mb-0.5">{g.total === null ? "—" : formatAudienceCount(g.total)}</p>
                <p className="font-mono text-xs uppercase tracking-wide text-billboard-inkSoft mb-4">
                  {g.total === null ? "audience not listed" : `${g.label} combined`}{result.count >= 200 ? " (top 200 shown)" : ""}
                </p>
                <ul className="space-y-1.5 text-sm">
                  {g.sample.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-billboard-inkSoft text-right">{p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {result.groups.length > 1 && (
              <p className="text-xs text-billboard-inkSoft text-center">Audience numbers are counted differently on each channel, so they are shown separately and not added together.</p>
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
