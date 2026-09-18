import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { CommunityAnnouncement } from "../lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function CommunityAnnouncements() {
  const [announcements, setAnnouncements] = useState<CommunityAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.from("community_announcements").select("*").eq("is_published", true)
      .order("pinned", { ascending: false }).order("created_at", { ascending: false })
      .then(({ data }) => {
        setAnnouncements((data ?? []) as CommunityAnnouncement[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title="Announcements · ChatSched Community" description="What's new on ChatSched — platform updates and community announcements." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Community</span>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h1 className="text-3xl md:text-4xl max-w-xl">Announcements</h1>
        <Link to="/community" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink">← Community</Link>
      </div>
      <p className="text-billboard-inkSoft max-w-xl mb-10">What's new on ChatSched.</p>

      {loading ? (
        <p className="text-billboard-inkSoft text-sm">Loading…</p>
      ) : announcements.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">Nothing posted yet — check back soon.</div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className={`border-[3px] rounded p-5 ${a.pinned ? "border-billboard-ink bg-billboard-yellow" : "border-billboard-ink"}`}>
              <div className="flex items-center gap-2 mb-2">
                {a.pinned && <span className="font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-white px-2 py-0.5 rounded">Pinned</span>}
                <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">{formatDate(a.created_at)}</span>
              </div>
              <h2 className="font-bold text-lg mb-1.5">{a.title}</h2>
              <p className="text-sm text-billboard-inkSoft whitespace-pre-wrap">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
