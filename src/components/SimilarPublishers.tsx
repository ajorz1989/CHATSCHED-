import { Link } from "react-router-dom";
import PublisherCard from "./PublisherCard";
import type { Publisher } from "../lib/types";

const MAX_SHOWN = 3;

/**
 * "Similar publishers" module for the bottom of PublisherProfile.tsx.
 * Reuses the same `publishers` array PublisherProfile already has in
 * scope from usePublishers() — no extra query. Same-category first (a
 * buyer comparing options usually cares about audience fit more than
 * channel), falls back to same-channel when a category has too few peers
 * to be worth a "similar" claim.
 */
export default function SimilarPublishers({ current, publishers }: { current: Publisher; publishers: Publisher[] }) {
  const sameCategory = publishers.filter((p) => p.id !== current.id && p.category === current.category);
  const pool = sameCategory.length >= MAX_SHOWN
    ? sameCategory
    : publishers.filter((p) => p.id !== current.id && p.channel_slug === current.channel_slug);

  const similar = [...pool]
    .sort((a, b) => (b.publisher_score ?? 0) - (a.publisher_score ?? 0) || (b.trust_score ?? 0) - (a.trust_score ?? 0))
    .slice(0, MAX_SHOWN);

  if (similar.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto px-5 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg">Similar publishers</h2>
        <Link to="/browse" className="text-xs font-semibold underline text-billboard-inkSoft">Browse all →</Link>
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
        {similar.map((p) => (
          <PublisherCard key={p.id} publisher={p} />
        ))}
      </div>
    </div>
  );
}
