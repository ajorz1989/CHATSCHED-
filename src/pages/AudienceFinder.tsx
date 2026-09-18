import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import { formatCurrency } from "../lib/currency";
import { usePublishers } from "../hooks/usePublishers";
import { matchPublishers, type MatchResult } from "../lib/marketingSuite";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";

export default function AudienceFinder() {
  const { user } = useAuth();
  const { publishers, loading: loadingPublishers } = usePublishers();
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [ranSearch, setRanSearch] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setResults(matchPublishers(description, publishers, { budget: budget ? Number(budget) : null, limit: 6 }));
    setRanSearch(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Audience Finder · ChatSched" description="Describe your business and ideal customer — our own matching algorithm ranks the real publisher directory against it and explains why each one fits." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Audience Finder</span>
      <h1 className="text-3xl md:text-4xl mb-2">Describe your customer. We'll find who already has their attention.</h1>
      <p className="text-billboard-inkSoft mb-8">
        Describe your business and your ideal customer in plain language — our own matching algorithm ranks the publisher directory against it (category, location, audience text, price, engagement) and shows exactly why each result fits.
      </p>

      {!user ? (
        <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim">
          <p className="mb-3">Log in to run a match.</p>
          <Link to="/login" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition">Log in</Link>
          <p className="text-xs text-billboard-inkSoft mt-3">New here? <Link to="/register" className="underline font-semibold">Create a business account</Link></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim mb-8">
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Your business and ideal customer</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="e.g. We're a family dentist in Menlyn, Pretoria. We want to reach parents and young professionals nearby who are looking for a new dentist."
            className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 mb-4 bg-white text-sm"
          />
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Budget per post (optional)</label>
          <input
            type="number" min={0} value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="R"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 mb-4 bg-white text-sm sm:w-48"
          />
          <Button type="submit" variant="primary" size="md" disabled={loadingPublishers}>
            {loadingPublishers ? "Loading publishers…" : "Find my matches"}
          </Button>
        </form>
      )}

      {ranSearch && (
        results.length === 0 ? (
          <div className="border-[3px] border-dashed border-billboard-ink rounded">
            <EmptyState
              kind="search"
              title="No strong matches yet"
              description="Try widening your description, or browse everything directly."
              compact
            />
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((r) => (
              <Link key={r.publisher.id} to={`/browse/${r.publisher.id}`} className="block border-[3px] border-billboard-ink rounded p-5 bg-white hover:-translate-y-0.5 hover:shadow-block transition">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-bold">{r.publisher.name}</p>
                    <p className="text-xs text-billboard-inkSoft">{r.publisher.city}, {r.publisher.province} · {r.publisher.category} · {formatCurrency(r.publisher.price_per_post)}/post</p>
                  </div>
                  <span className="font-mono text-xs font-bold bg-billboard-green text-white px-2.5 py-1 rounded shrink-0">{r.score}% match</span>
                </div>
                <ul className="text-sm text-billboard-inkSoft space-y-0.5">
                  {r.reasons.map((reason, i) => <li key={i}>· {reason}</li>)}
                </ul>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
