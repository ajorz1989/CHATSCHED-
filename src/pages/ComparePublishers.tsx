import { Link } from "react-router-dom";
import { useComparison } from "../contexts/ComparisonContext";
import { usePublishers } from "../hooks/usePublishers";
import { scoreLabel } from "../lib/publisherDisplay";
import TrustBadge from "../components/TrustBadge";
import { formatCurrency } from "../lib/currency";
import type { Publisher } from "../lib/types";
import Seo from "../components/Seo";
import { SkeletonRows } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "k";
  return String(n);
}

function Stars({ rating, reviews }: { rating: number | null; reviews: number }) {
  if (!rating) return <span className="text-billboard-inkSoft text-xs">No reviews yet</span>;
  return (
    <span>
      <span className="text-billboard-yellow">{"★".repeat(Math.round(rating))}</span>
      <span className="text-billboard-paperDim">{"★".repeat(5 - Math.round(rating))}</span>
      <span className="text-xs text-billboard-inkSoft ml-1">{rating.toFixed(1)} ({reviews})</span>
    </span>
  );
}

function ScoreBar({ value, max = 100, color = "bg-billboard-green" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-billboard-paperDim rounded-full h-2 overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums w-8 text-right">{value}</span>
    </div>
  );
}

interface RowProps {
  label: string;
  sub?: string;
  values: (Publisher | null)[];
  render: (p: Publisher) => React.ReactNode;
}

function MetricRow({ label, sub, values, render }: RowProps) {
  return (
    <tr className="border-t-2 border-billboard-paperDim">
      <td className="py-4 px-4 bg-billboard-paperDim font-semibold text-sm w-40 min-w-[140px] sticky left-0 z-10 border-r-2 border-billboard-ink">
        {label}
        {sub && <div className="text-[10px] font-normal text-billboard-inkSoft font-mono uppercase mt-0.5">{sub}</div>}
      </td>
      {values.map((p, i) => (
        <td key={i} className="py-4 px-5 text-sm align-top min-w-[200px]">
          {p ? render(p) : <span className="text-billboard-inkSoft">—</span>}
        </td>
      ))}
    </tr>
  );
}

export default function ComparePublishers() {
  const { ids, removePublisher, clearComparison, count } = useComparison();
  const { publishers, loading } = usePublishers();

  const selected = ids.map(id => publishers.find(p => p.id === id) ?? null);

  return (
    <div className="max-w-7xl mx-auto px-5 py-16">
      <Seo title="Compare Publishers · ChatSched" description="Compare up to 5 South African publishers side by side — audience, pricing, engagement and more." />

      <div className="mb-10">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Compare</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl mb-2">Side by side, no guessing which one fits.</h1>
            <p className="text-billboard-inkSoft max-w-xl">
              {count === 0
                ? "Add publishers from Browse or Search to compare them here."
                : `Comparing ${count} publisher${count !== 1 ? "s" : ""} — up to 5 at once.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/browse" className="text-sm font-semibold underline text-billboard-inkSoft">Add publishers →</Link>
            {count > 0 && (
              <button onClick={clearComparison} className="text-sm font-semibold text-billboard-red underline">
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {count === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded">
          <EmptyState
            kind="compare"
            title="Nothing to compare yet"
            description={'Browse publishers and click "Compare" on up to 5 to see them side by side.'}
            action={
              <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition bg-billboard-yellow">
                Find publishers →
              </Link>
            }
          />
        </div>
      ) : loading ? (
        <SkeletonRows count={4} />
      ) : (
        <div className="overflow-x-auto rounded border-[3px] border-billboard-ink">
          <table className="w-full border-collapse">
            {/* Publisher header row */}
            <thead>
              <tr>
                <th className="bg-billboard-paperDim sticky left-0 z-20 border-r-2 border-b-2 border-billboard-ink px-4 py-4 text-left text-xs font-mono uppercase tracking-wider text-billboard-inkSoft min-w-[140px]">
                  Publisher
                </th>
                {selected.map((p, i) => (
                  <th key={i} className="border-b-2 border-billboard-ink px-5 py-4 text-left min-w-[200px] align-top">
                    {p ? (
                      <div>
                        <div className={`h-16 rounded-t bg-gradient-to-br ${p.swatch} -mx-5 -mt-4 mb-3 px-5 pt-3 flex items-start justify-between`}>
                          <div className="w-9 h-9 rounded-full bg-white border-2 border-billboard-ink flex items-center justify-center font-display text-xs mt-1">
                            {p.initials}
                          </div>
                          <button
                            onClick={() => removePublisher(p.id)}
                            className="text-billboard-ink bg-white/80 hover:bg-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center mt-1 transition"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                        <Link to={`/browse/${p.id}`} className="font-bold text-base hover:text-billboard-greenDeep transition leading-snug block">
                          {p.name}
                        </Link>
                        <p className="text-xs text-billboard-inkSoft mt-0.5">{p.city}, {p.province}</p>
                        {p.level && (
                          <span className="inline-block mt-1.5 font-mono text-[10px] bg-billboard-ink text-white px-1.5 py-0.5 rounded">
                            <TrustBadge kind="publisher" level={p.level} />
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-billboard-inkSoft text-sm italic">Publisher not found</span>
                    )}
                  </th>
                ))}
                {/* Empty slot hint */}
                {count < 5 && (
                  <th className="border-b-2 border-billboard-ink px-5 py-4 min-w-[200px] align-middle">
                    <Link to="/browse" className="flex flex-col items-center gap-2 text-billboard-inkSoft hover:text-billboard-green transition p-4">
                      <span className="text-3xl">+</span>
                      <span className="text-xs font-semibold">Add publisher</span>
                    </Link>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              <MetricRow label="Category" values={selected} render={p => p.category} />
              <MetricRow label="Verified" values={selected} render={p => (
                p.verified
                  ? <span className="inline-block bg-billboard-green text-white font-mono text-[10px] font-semibold px-2 py-0.5 rounded">✓ Verified</span>
                  : <span className="text-billboard-inkSoft text-xs">Not verified</span>
              )} />
              <MetricRow label="Level" values={selected} render={p => (
                p.level
                  ? <TrustBadge kind="publisher" level={p.level} />
                  : <span className="text-billboard-inkSoft text-xs">—</span>
              )} />
              <MetricRow label="Platforms" values={selected} render={p => (
                <div className="flex flex-wrap gap-1">
                  {p.platforms.map(pl => (
                    <span key={pl} className="font-mono text-[10px] border border-billboard-ink rounded-full px-2 py-0.5 bg-billboard-paperDim whitespace-nowrap">{pl}</span>
                  ))}
                </div>
              )} />
              <MetricRow label="Followers" values={selected} render={p => (
                <span className="font-display text-xl">{fmt(p.followers)}</span>
              )} />
              <MetricRow label="Monthly reach" values={selected} render={p => (
                p.monthly_reach
                  ? <span className="font-display text-xl">{fmt(p.monthly_reach)}</span>
                  : <span className="text-billboard-inkSoft text-xs">Not provided</span>
              )} />
              <MetricRow label="Engagement" sub="rate" values={selected} render={p => (
                <div>
                  <span className="font-display text-xl">{p.engagement}%</span>
                  <div className="mt-1 bg-billboard-paperDim rounded-full h-1.5 w-24 overflow-hidden">
                    <div className="h-full bg-billboard-green rounded-full" style={{ width: `${Math.min(100, p.engagement * 5)}%` }} />
                  </div>
                </div>
              )} />
              <MetricRow label="Price per post" values={selected} render={p => (
                <span className="font-mono font-bold text-billboard-greenDeep text-lg">{formatCurrency(p.price_per_post)}</span>
              )} />
              <MetricRow label="Rating" sub="avg score" values={selected} render={p => <Stars rating={p.rating} reviews={p.reviews} />} />
              <MetricRow label="Trust score" sub="out of 100" values={selected} render={p => (
                p.trust_score > 0
                  ? <ScoreBar value={p.trust_score} color="bg-billboard-yellow" />
                  : <span className="text-billboard-inkSoft text-xs">Not scored</span>
              )} />
              <MetricRow label="Publisher score" sub="ranking" values={selected} render={p => (
                p.publisher_score > 0
                  ? (
                    <div>
                      <span className="font-mono text-sm font-semibold">{scoreLabel(p.publisher_score)}</span>
                      <ScoreBar value={p.publisher_score} />
                    </div>
                  )
                  : <span className="text-billboard-inkSoft text-xs">Not scored</span>
              )} />
              <MetricRow label="Languages" values={selected} render={p => (
                p.languages.length
                  ? <div className="flex flex-wrap gap-1">{p.languages.map(l => <span key={l} className="font-mono text-[10px] border border-billboard-ink rounded-full px-2 py-0.5 bg-billboard-paperDim">{l}</span>)}</div>
                  : <span className="text-billboard-inkSoft text-xs">Not specified</span>
              )} />
              <MetricRow label="Audience" values={selected} render={p => (
                <p className="text-xs text-billboard-inkSoft leading-relaxed max-w-xs">{p.audience}</p>
              )} />
              <MetricRow label="Campaign fit" sub="Audience Finder" values={selected} render={p => (
                <Link to={`/audience-finder?hint=${encodeURIComponent(p.audience)}`} className="text-xs font-semibold text-billboard-green underline">
                  Run match →
                </Link>
              )} />
              <tr className="border-t-2 border-billboard-ink bg-billboard-paperDim">
                <td className="py-4 px-4 sticky left-0 z-10 bg-billboard-paperDim border-r-2 border-billboard-ink" />
                {selected.map((p, i) => (
                  <td key={i} className="py-4 px-5">
                    {p && (
                      <Link
                        to={`/browse/${p.id}`}
                        className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold text-sm px-4 py-2 rounded hover:-translate-y-0.5 transition whitespace-nowrap"
                      >
                        View profile →
                      </Link>
                    )}
                  </td>
                ))}
                {count < 5 && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
