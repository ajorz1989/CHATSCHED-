import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePublishers } from "../hooks/usePublishers";
import { supabase } from "../lib/supabase";
import { makeDefaults, matchesFilters, summarizeFilters, type Filters } from "../lib/browseFilters";
import { browseUrlForFilters } from "../lib/searchParamsCodec";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";
import { SkeletonRows } from "../components/Skeleton";
import type { SavedSearch } from "../lib/types";

function asFilters(raw: Record<string, unknown>): Filters {
  // Saved before a field existed, or edited by hand — makeDefaults fills
  // in anything missing rather than the page breaking on an old row.
  return makeDefaults(raw as Partial<Filters>);
}

export default function SavedSearches() {
  const { user, profile } = useAuth();
  const { publishers } = usePublishers();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("business_id", user.id)
      .order("created_at", { ascending: false });
    setSearches((data ?? []) as SavedSearch[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function toggleAlerts(s: SavedSearch) {
    setBusyId(s.id);
    setSearches((prev) => prev.map((x) => (x.id === s.id ? { ...x, alerts_enabled: !x.alerts_enabled } : x)));
    await supabase.from("saved_searches").update({ alerts_enabled: !s.alerts_enabled }).eq("id", s.id);
    setBusyId(null);
  }

  async function remove(s: SavedSearch) {
    setBusyId(s.id);
    await supabase.from("saved_searches").delete().eq("id", s.id);
    setSearches((prev) => prev.filter((x) => x.id !== s.id));
    setBusyId(null);
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role === "publisher" || profile?.role === "admin") return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Saved Searches · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Saved searches</span>
      <h1 className="text-3xl md:text-4xl mb-2">Get told when a new match joins.</h1>
      <p className="text-billboard-inkSoft mb-10">
        Save a search from <Link to="/browse" className="underline font-semibold">Browse</Link>, and we'll email
        you the moment a newly-approved publisher matches it — no need to keep checking back.
      </p>

      {loading ? (
        <SkeletonRows count={2} />
      ) : searches.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded">
          <EmptyState
            kind="search"
            title="No saved searches yet"
            description="Filter for what you want on Browse, then use “Save this search” to get alerted about new matches."
            compact
            action={<Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">Go to Browse →</Link>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {searches.map((s) => {
            const filters = asFilters(s.filters);
            const liveCount = publishers.filter((p) => matchesFilters(p, filters)).length;
            return (
              <div key={s.id} className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-display text-lg leading-tight">{s.name}</p>
                    <p className="text-xs text-billboard-inkSoft mt-0.5">{summarizeFilters(filters)}</p>
                  </div>
                  <span className={`font-mono text-[10px] font-semibold uppercase px-2.5 py-1 rounded border-2 shrink-0 ${s.alerts_enabled ? "bg-billboard-green text-white border-billboard-greenDeep" : "bg-white text-billboard-inkSoft border-billboard-inkSoft"}`}>
                    {s.alerts_enabled ? "Alerts on" : "Alerts off"}
                  </span>
                </div>

                <p className="text-sm text-billboard-inkSoft mb-4">
                  {liveCount} publisher{liveCount === 1 ? "" : "s"} match right now
                  {s.last_alerted_at && <> · last alert {new Date(s.last_alerted_at).toLocaleDateString("en-ZA")}</>}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={browseUrlForFilters(filters)}
                    className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:bg-billboard-paperDim transition"
                  >
                    View results →
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => toggleAlerts(s)}
                    className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:bg-billboard-paperDim transition disabled:opacity-60"
                  >
                    {s.alerts_enabled ? "Turn alerts off" : "Turn alerts on"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => remove(s)}
                    className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-2.5 py-1.5 hover:bg-billboard-red/10 transition disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
