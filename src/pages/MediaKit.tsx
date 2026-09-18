import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePublishers } from "../hooks/usePublishers";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import SetupNotice from "../components/SetupNotice";
import EmptyState from "../components/EmptyState";
import Seo from "../components/Seo";
import { SkeletonBlock, SkeletonLine } from "../components/Skeleton";
import { buildAndDownloadMediaKit } from "../lib/mediaKit";
import { getCompletedCampaignCount } from "../lib/mediaKitData";
import { fetchReviewAuthors } from "../lib/businessContact";
import type { Review } from "../lib/types";

const SECTIONS = [
  "Profile, category & location",
  "Platforms & audience description",
  "Followers & engagement",
  "Pricing & ad formats",
  "Portfolio",
  "Reviews",
  "Trust score, level & verification",
  "Campaign history",
];

export default function MediaKit() {
  const { user, profile } = useAuth();
  const { publishers, loading: loadingPublishers } = usePublishers();
  const [searchParams] = useSearchParams();
  const paramId = searchParams.get("publisher");

  const isRegisteredViewer = !!user && (profile?.role === "business" || profile?.role === "publisher" || profile?.role === "admin");

  // No ?publisher= given — if the viewer is a publisher, default to their
  // own listing (the common case: a creator opening this page to grab
  // their own media kit) rather than making them look up their own id.
  const ownPublisherId = profile?.role === "publisher" ? publishers.find((p) => p.user_id === user?.id)?.id : undefined;
  const publisherId = paramId ?? ownPublisherId;
  const publisher = publishers.find((p) => p.id === publisherId);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [completedCampaigns, setCompletedCampaigns] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publisher || !isSupabaseConfigured) return;
    let cancelled = false;
    // business:profiles(...) used to be embedded directly here, which
    // relied on the now-dropped profiles_select_via_shared_request policy
    // — it silently returns null for every non-admin/non-owner viewer,
    // including the anonymous visitors who make up most of this page's
    // real traffic. reviews themselves are already public
    // (reviews_select_public); review_author_public (schema_phase98)
    // resolves just the attribution safely. See src/lib/businessContact.ts.
    supabase
      .from("reviews")
      .select("*")
      .eq("publisher_id", publisher.id)
      .eq("author_role", "business")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as Review[];
        const authors = await fetchReviewAuthors(rows.map((r) => r.business_id));
        if (cancelled) return;
        setReviews(rows.map((r) => ({ ...r, business: authors.get(r.business_id) ?? null })));
      });
    getCompletedCampaignCount(publisher.id).then((n) => { if (!cancelled) setCompletedCampaigns(n); });
    return () => { cancelled = true; };
  }, [publisher?.id]);

  async function handleGenerate() {
    if (!publisher) return;
    setGenerating(true);
    setError(null);
    try {
      await buildAndDownloadMediaKit({
        publisher,
        reviews,
        completedCampaigns: completedCampaigns ?? 0,
        profileUrl: `${window.location.origin}/browse/${publisher.id}`,
      });
    } catch {
      setError("Couldn't generate the PDF just now — try again in a moment.");
    } finally {
      setGenerating(false);
    }
  }

  if (!isSupabaseConfigured) return <SetupNotice />;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <Seo title="Media Kit · ChatSched" noindex />
        <h1 className="text-2xl mb-3">Sign in to generate a media kit.</h1>
        <p className="text-billboard-inkSoft mb-6">Media kits pull from a publisher's full profile, which is only visible to registered accounts.</p>
        <Link to="/login" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">Log in</Link>
      </div>
    );
  }

  if (!isRegisteredViewer) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <Seo title="Media Kit · ChatSched" noindex />
        <h1 className="text-2xl mb-3">Not available for this account.</h1>
        <p className="text-billboard-inkSoft">Media kits are available to registered businesses and publishers.</p>
      </div>
    );
  }

  if (loadingPublishers) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16">
        <SkeletonLine className="w-1/3 h-4 mb-4" />
        <SkeletonBlock className="h-10 w-2/3 mb-8" />
        <SkeletonBlock className="h-64" />
      </div>
    );
  }

  if (!publisher) {
    return (
      <div className="max-w-md mx-auto px-5 py-24">
        <Seo title="Media Kit · ChatSched" noindex />
        <div className="border-[3px] border-dashed border-billboard-ink rounded">
          <EmptyState
            kind="list"
            title={paramId ? "Publisher not found" : "Open this from a publisher's profile"}
            description={
              paramId
                ? "This listing may have moved."
                : "Visit a publisher's profile and use \"Download Media Kit\" there, or — if you're a publisher yourself — list your channel first."
            }
            compact
            action={<Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded text-sm">Browse Advertising →</Link>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <Seo title={`Media Kit · ${publisher.name} · ChatSched`} noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Media Kit</span>
      <h1 className="text-3xl md:text-4xl mb-3">One PDF, everything a business needs to say yes.</h1>
      <p className="text-billboard-inkSoft mb-10">
        Generated on the spot from {publisher.name}'s live profile — audience, pricing, portfolio, reviews and
        verification, all in one branded document. Nothing is stored; it's built fresh in your browser every time.
      </p>

      <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-billboard-yellow border-[3px] border-billboard-ink flex items-center justify-center font-display text-sm shrink-0">
            {publisher.initials}
          </div>
          <div>
            <p className="font-display text-lg leading-tight">{publisher.name}</p>
            <p className="text-xs text-billboard-inkSoft">{publisher.city}, {publisher.province} · {publisher.category}</p>
          </div>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-2">What's included</p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-6">
          {SECTIONS.map((s) => (
            <li key={s} className="flex items-start gap-2 text-sm">
              <span className="text-billboard-green mt-0.5 shrink-0">✓</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>

        {error && <p className="text-billboard-red text-sm font-semibold mb-3">{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || completedCampaigns === null}
          className="w-full inline-flex justify-center items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {generating ? "Generating…" : completedCampaigns === null ? "Loading profile data…" : "📄 Generate Media Kit"}
        </button>
      </div>

      <Link to={`/browse/${publisher.id}`} className="text-sm font-semibold underline text-billboard-inkSoft hover:text-billboard-ink">
        ← Back to {publisher.name}'s profile
      </Link>
    </div>
  );
}
