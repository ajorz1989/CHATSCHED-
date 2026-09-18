import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { usePublishers } from "../../hooks/usePublishers";
import { matchPublishers, type MatchResult } from "../../lib/marketingSuite";
import { formatCurrency } from "../../lib/currency";
import EmptyState from "../EmptyState";

export default function MatchSearch() {
  const { publishers, loading } = usePublishers();
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState("");
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [ran, setRan] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const matches = matchPublishers(query, publishers, {
      budget: budget ? Number(budget) : null,
      limit: 6,
    });
    setResults(matches);
    setRan(true);
  }

  return (
    <div>
      <p className="text-sm text-billboard-inkSoft mb-4">
        Describe what you do and who you want to reach. Matching is rule-based from the live directory
        (category, location, audience text, price, engagement) — ready for a smarter model later.
      </p>

      <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-5 mb-6 bg-billboard-paperDim">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">What do you do?</label>
        <textarea
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder='e.g. I own a pizza shop in Mitchells Plain — want families nearby for weekend specials'
          className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 mb-3 bg-white text-sm"
        />
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Budget per post (optional)</label>
        <input
          type="number"
          min={0}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="R"
          className="w-full sm:w-40 border-2 border-billboard-ink rounded px-3 py-2 mb-4 bg-white text-sm"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
        >
          {loading ? "Loading directory…" : "Find best publishers"}
        </button>
      </form>

      {ran && results && (
        results.length === 0 ? (
          <div className="border-[3px] border-dashed border-billboard-ink rounded">
            <EmptyState
              kind="search"
              title="No strong matches yet"
              description={<>Try broader wording, or <Link to="/browse" className="underline font-semibold text-billboard-ink">browse the directory</Link>.</>}
              compact
            />
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((r) => (
              <Link
                key={r.publisher.id}
                to={`/browse/${r.publisher.id}`}
                className="block border-[3px] border-billboard-ink rounded p-4 bg-white hover:-translate-y-0.5 hover:shadow-block transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-bold">{r.publisher.name}</p>
                    <p className="text-xs text-billboard-inkSoft">
                      {r.publisher.city}, {r.publisher.province} · {r.publisher.category} · {formatCurrency(r.publisher.price_per_post)}/post
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold bg-billboard-green text-white px-2.5 py-1 rounded shrink-0">
                    {r.score}% match
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-mono uppercase text-billboard-inkSoft mt-2 mb-2">
                  <span>~{r.estimatedReach.toLocaleString()} est. reach</span>
                  <span>{r.engagement}% engagement</span>
                  <span>{r.publisher.followers.toLocaleString()} followers</span>
                </div>
                <ul className="text-sm text-billboard-inkSoft list-disc pl-4">
                  {r.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
