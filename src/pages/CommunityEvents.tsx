import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { COMMUNITY_EVENT_TYPES } from "../lib/constants";
import type { CommunityEvent, CommunityEventType } from "../lib/types";

const TYPE_LABEL: Record<CommunityEventType, string> = Object.fromEntries(
  COMMUNITY_EVENT_TYPES.map((t) => [t.value, t.label])
) as Record<CommunityEventType, string>;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CommunityEvents() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.from("community_events").select("*").eq("is_published", true).order("starts_at", { ascending: true }).then(({ data }) => {
      setEvents((data ?? []) as CommunityEvent[]);
      setLoading(false);
    });
  }, []);

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now).reverse();
  const visible = tab === "upcoming" ? upcoming : past;

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title="Events & Webinars · ChatSched Community" description="Upcoming and past ChatSched community events and webinars, for businesses and publishers." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Community</span>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h1 className="text-3xl md:text-4xl max-w-xl">Events &amp; webinars</h1>
        <Link to="/community" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink">← Community</Link>
      </div>
      <p className="text-billboard-inkSoft max-w-xl mb-8">Live sessions and get-togethers for businesses and publishers.</p>

      <div className="flex gap-2 mb-8">
        <button onClick={() => setTab("upcoming")} className={`font-mono text-xs font-semibold uppercase px-3 py-2 rounded border-2 border-billboard-ink transition ${tab === "upcoming" ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}>Upcoming ({upcoming.length})</button>
        <button onClick={() => setTab("past")} className={`font-mono text-xs font-semibold uppercase px-3 py-2 rounded border-2 border-billboard-ink transition ${tab === "past" ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}>Past ({past.length})</button>
      </div>

      {loading ? (
        <p className="text-billboard-inkSoft text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          {tab === "upcoming" ? "Nothing scheduled yet — check back soon." : "No past events yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((ev) => (
            <div key={ev.id} className="border-[3px] border-billboard-ink rounded p-5">
              <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2 py-0.5 rounded mb-3">{TYPE_LABEL[ev.event_type]}</span>
              <h2 className="font-bold text-lg mb-1.5">{ev.title}</h2>
              <p className="text-sm text-billboard-inkSoft mb-3">{ev.description}</p>
              <p className="font-mono text-xs text-billboard-inkSoft mb-1">{formatDateTime(ev.starts_at)}</p>
              {ev.event_type === "in_person" ? (
                <p className="text-xs text-billboard-inkSoft">{ev.location_or_link}</p>
              ) : (
                tab === "upcoming" && (
                  <a href={ev.location_or_link} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition">
                    Join link →
                  </a>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
