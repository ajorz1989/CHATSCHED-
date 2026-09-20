import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { CommunityAnnouncement, CommunityEvent } from "../lib/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export default function Community() {
  const [announcements, setAnnouncements] = useState<CommunityAnnouncement[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let outstanding = 2;
    const done = () => { if (--outstanding === 0) setLoading(false); };
    supabase.from("community_announcements").select("*").eq("is_published", true)
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3)
      .then(({ data, error }) => {
        if (error) setLoadError(true);
        else setAnnouncements((data ?? []) as CommunityAnnouncement[]);
        done();
      });
    supabase.from("community_events").select("*").eq("is_published", true)
      .gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(3)
      .then(({ data, error }) => {
        if (error) setLoadError(true);
        else setEvents((data ?? []) as CommunityEvent[]);
        done();
      });
  }, []);

  return (
    <div>
      <Seo title="Community · ChatSched" description="Articles, Q&A, announcements, webinars and events for the businesses and publishers building with ChatSched." />

      <section className="bg-billboard-green text-white border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-white px-3 py-1.5 rounded mb-4">Community</span>
          <h1 className="text-3xl md:text-4xl mb-5">Real questions from real businesses and publishers — not a support ticket, a conversation.</h1>
          <p className="text-lg text-white/85 max-w-xl">Articles, real Q&amp;A, events, and what's new on the platform — starting simple, growing as the community does.</p>
        </div>
      </section>

      {/* Publisher & Business Community */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        {loadError && (
          <p className="border-[3px] border-dashed border-billboard-ink rounded p-5 text-sm text-billboard-inkSoft mb-6">
            Some community content couldn't load right now — refresh to try again.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="border-[3px] border-billboard-ink rounded p-6">
            <h2 className="font-display text-lg mb-2">Publisher Community</h2>
            <p className="text-sm text-billboard-inkSoft mb-4">Pricing, media kits, negotiation, and everything else that comes with running a channel businesses want to book.</p>
            <div className="flex flex-col gap-2">
              <Link to="/publisher-success" className="text-sm font-semibold underline">Publisher Success Centre →</Link>
              <Link to="/community/qa?category=publisher" className="text-sm font-semibold underline">Publisher Q&amp;A →</Link>
            </div>
          </div>
          <div className="border-[3px] border-billboard-ink rounded p-6">
            <h2 className="font-display text-lg mb-2">Business Community</h2>
            <p className="text-sm text-billboard-inkSoft mb-4">Budgets, ROI, publisher picks, and what other businesses have learned running campaigns of their own.</p>
            <div className="flex flex-col gap-2">
              <Link to="/business-success" className="text-sm font-semibold underline">Business Success Centre →</Link>
              <Link to="/community/qa?category=business" className="text-sm font-semibold underline">Business Q&amp;A →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Marketing Discussions */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="font-display text-xl mb-2">Marketing Discussions</h2>
          <p className="text-billboard-inkSoft text-sm mb-6 max-w-xl">Broader marketing questions — not specific to being a business or a publisher.</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/blog" className="border-[3px] border-billboard-ink rounded px-4 py-2.5 font-semibold text-sm bg-billboard-paper hover:-translate-y-0.5 transition">Blog →</Link>
            <Link to="/community/qa?category=marketing" className="border-[3px] border-billboard-ink rounded px-4 py-2.5 font-semibold text-sm bg-billboard-paper hover:-translate-y-0.5 transition">Marketing Q&amp;A →</Link>
            <Link to="/community/qa?ask=1" className="border-[3px] border-billboard-ink rounded px-4 py-2.5 font-semibold text-sm bg-billboard-yellow hover:-translate-y-0.5 transition">Ask a question →</Link>
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <div className="flex items-end justify-between gap-3 mb-6">
          <h2 className="font-display text-xl">Events</h2>
          <Link to="/community/events" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink">See all →</Link>
        </div>
        {loading ? (
          <div className="skeleton-shimmer h-24 border-[3px] border-billboard-ink rounded" />
        ) : events.length === 0 ? (
          <div className="border-[3px] border-dashed border-billboard-ink rounded p-8 text-center text-billboard-inkSoft text-sm">Nothing scheduled yet — check back soon.</div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {events.map((ev) => (
              <Link key={ev.id} to="/community/events" className="border-[3px] border-billboard-ink rounded p-4 bg-white hover:-translate-y-0.5 transition">
                <p className="font-mono text-xs text-billboard-inkSoft mb-1.5">{formatDate(ev.starts_at)}</p>
                <h3 className="font-bold text-sm">{ev.title}</h3>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Announcements */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5">
          <div className="flex items-end justify-between gap-3 mb-6">
            <h2 className="font-display text-xl">Announcements</h2>
            <Link to="/community/announcements" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink">See all →</Link>
          </div>
          {loading ? (
            <div className="skeleton-shimmer h-24 border-[3px] border-billboard-ink rounded" />
          ) : announcements.length === 0 ? (
            <div className="border-[3px] border-dashed border-billboard-ink rounded p-8 text-center text-billboard-inkSoft text-sm">Nothing posted yet — check back soon.</div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <Link key={a.id} to="/community/announcements" className="block border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition">
                  <p className="font-mono text-xs text-billboard-inkSoft mb-1">{formatDate(a.created_at)}</p>
                  <h3 className="font-bold text-sm">{a.title}</h3>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-billboard-green text-white border-t-[3px] border-billboard-ink py-16 text-center">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="font-display text-2xl md:text-3xl mb-4">Still have a question?</h2>
          <p className="text-white/85 mb-6 max-w-lg mx-auto">
            Ask it in the Q&amp;A — real questions from businesses and publishers, answered by the team and posted for everyone who comes next.
          </p>
          <Link to="/community/qa?ask=1" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition">
            Ask a question in the Q&amp;A →
          </Link>
        </div>
      </section>
    </div>
  );
}
