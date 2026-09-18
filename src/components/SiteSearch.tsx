import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePublishers } from "../hooks/usePublishers";
import { getAllChannels } from "../lib/channelRegistry";
import { BLOG_POSTS } from "../lib/blogPosts";

/**
 * Site-wide search — a real gap flagged in the "7 Qualities of a Great
 * Website" review: the site had strong filtered browsing (Browse.tsx) but
 * nothing letting a "searcher" who already knows what they want (a page,
 * a channel, a city, a specific publisher) jump straight there from
 * anywhere on the site.
 *
 * Deliberately client-side and lightweight rather than a real search
 * index/service: PAGE_INDEX is a small hand-maintained list of marketing/
 * reference pages (the kind of thing someone searches for by name —
 * "pricing", "how it works" — not full-text site content), channels and
 * blog posts are already fully available in memory, and publishers reuse
 * the same usePublishers() hook Browse.tsx already fetches from — no new
 * network request, no new backend.
 */

interface PageEntry {
  title: string;
  path: string;
  keywords: string; // extra terms that should match even if not in the title
}

// Deliberately not every route in the app — just the pages someone would
// plausibly search for by name. Utility/auth/dashboard routes excluded.
const PAGE_INDEX: PageEntry[] = [
  { title: "Build My Campaign", path: "/build-my-campaign", keywords: "managed advertising agency quote wizard" },
  { title: "Browse the Marketplace", path: "/browse", keywords: "publishers directory search filter" },
  { title: "For Publishers", path: "/for-publishers", keywords: "creators monetise join network" },
  { title: "The ChatSched Media Network", path: "/network", keywords: "supply aggregation channels" },
  { title: "Channels", path: "/channels", keywords: "social media influencer podcast website radio directory" },
  { title: "Audience Finder", path: "/audience-finder", keywords: "match ai recommend" },
  { title: "Pricing", path: "/pricing", keywords: "cost subscription r199 r99" },
  { title: "Fees", path: "/fees", keywords: "commission cost breakdown" },
  { title: "How It Works", path: "/how-it-works", keywords: "steps process explainer" },
  { title: "How Payment Works", path: "/how-payment-works", keywords: "escrow held payment timeline payout" },
  { title: "Budget Calculator", path: "/budget-calculator", keywords: "estimate reach roi" },
  { title: "Channel Quiz", path: "/channel-quiz", keywords: "which channel is right for me" },
  { title: "Case Studies", path: "/case-studies", keywords: "examples success stories walkthrough" },
  { title: "Safety", path: "/safety", keywords: "trust verification protection" },
  { title: "Trust Centre", path: "/trust-centre", keywords: "disputes refund process" },
  { title: "Glossary", path: "/glossary", keywords: "terms definitions escrow commission" },
  { title: "Compliance", path: "/compliance", keywords: "advertising standards rules" },
  { title: "Categories", path: "/categories", keywords: "food beauty fitness fashion" },
  { title: "FAQ", path: "/faq", keywords: "questions help" },
  { title: "About", path: "/about", keywords: "company story" },
  { title: "Contact", path: "/contact", keywords: "email whatsapp support" },
  { title: "Careers", path: "/careers", keywords: "jobs hiring work with us" },
  { title: "Blog", path: "/blog", keywords: "articles insights" },
];

interface SearchResult {
  group: "Pages" | "Channels" | "Blog" | "Publishers";
  title: string;
  subtitle?: string;
  path: string;
}

export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { publishers } = usePublishers();

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
      // overflow:hidden alone doesn't reliably stop background scroll/bounce
      // on iOS Safari — pinning the body in place with position:fixed and
      // restoring the scroll offset on close is the standard workaround.
      const scrollY = window.scrollY;
      const body = document.body.style;
      body.position = "fixed";
      body.top = `-${scrollY}px`;
      body.left = "0";
      body.right = "0";
      return () => {
        body.position = "";
        body.top = "";
        body.left = "";
        body.right = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const pageMatches: SearchResult[] = PAGE_INDEX
      .filter((p) => p.title.toLowerCase().includes(q) || p.keywords.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({ group: "Pages" as const, title: p.title, path: p.path }));

    const channelMatches: SearchResult[] = getAllChannels()
      .filter((m) => m.definition.name.toLowerCase().includes(q) || m.definition.tagline.toLowerCase().includes(q))
      .slice(0, 4)
      .map((m) => ({ group: "Channels" as const, title: m.definition.name, subtitle: m.definition.tagline, path: `/channels/${m.definition.slug}` }));

    const blogMatches: SearchResult[] = BLOG_POSTS
      .filter((b) => b.title.toLowerCase().includes(q) || b.tag.toLowerCase().includes(q))
      .slice(0, 4)
      .map((b) => ({ group: "Blog" as const, title: b.title, subtitle: b.tag, path: `/blog/${b.slug}` }));

    const publisherMatches: SearchResult[] = (publishers ?? [])
      .filter((p) => p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({ group: "Publishers" as const, title: p.name, subtitle: `${p.city}, ${p.province}`, path: `/browse/${p.id}` }));

    return [...pageMatches, ...channelMatches, ...blogMatches, ...publisherMatches];
  }, [query, publishers]);

  const grouped = useMemo(() => {
    const byGroup: Record<string, SearchResult[]> = {};
    for (const r of results) {
      (byGroup[r.group] ??= []).push(r);
    }
    return byGroup;
  }, [results]);

  function goTo(path: string) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search ChatSched"
        title="Search (Ctrl+K)"
        className="w-9 h-9 flex items-center justify-center border-2 border-billboard-ink rounded text-billboard-inkSoft hover:bg-billboard-paperDim hover:text-billboard-ink transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-billboard-ink/40 flex items-start justify-center pt-4 sm:pt-[10vh] px-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg bg-billboard-paper border-[3px] border-billboard-ink rounded-lg shadow-block overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-2 border-billboard-ink px-4 py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-billboard-inkSoft shrink-0">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, channels, publishers, blog…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="text-billboard-inkSoft hover:text-billboard-ink text-xs font-mono border border-billboard-ink/30 rounded px-1.5 py-0.5">
                Esc
              </button>
            </div>

            <div className="max-h-[40vh] sm:max-h-[50vh] overflow-y-auto">
              {query.trim().length < 2 ? (
                <p className="text-xs text-billboard-inkSoft px-4 py-6 text-center">Type at least 2 characters to search.</p>
              ) : results.length === 0 ? (
                <p className="text-xs text-billboard-inkSoft px-4 py-6 text-center">No matches for "{query}".</p>
              ) : (
                (Object.entries(grouped) as [string, SearchResult[]][]).map(([group, items]) => (
                  <div key={group} className="border-b border-billboard-ink/10 last:border-b-0">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft px-4 pt-2.5 pb-1">{group}</p>
                    {items.map((r) => (
                      <button
                        key={`${r.group}-${r.path}-${r.title}`}
                        type="button"
                        onClick={() => goTo(r.path)}
                        className="w-full text-left px-4 py-2 hover:bg-billboard-paperDim transition-colors"
                      >
                        <span className="block text-sm font-semibold">{r.title}</span>
                        {r.subtitle && <span className="block text-xs text-billboard-inkSoft">{r.subtitle}</span>}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
