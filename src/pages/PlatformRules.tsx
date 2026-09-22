import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PlatformRequirementCard from "../components/PlatformRequirementCard";
import { SkeletonBlock } from "../components/Skeleton";
import { getEnabledPlatformRules } from "../lib/compliance";
import type { PlatformComplianceRule } from "../lib/complianceTypes";

/**
 * Brief section 14 — a dedicated page (distinct from the /compliance hub's
 * compact platform grid) showing each platform's full requirements:
 * disclosure guidance, restrictions, creator/business responsibilities,
 * and proof requirements, with the "last reviewed" date and the
 * non-guarantee disclaimer PlatformRequirementCard already renders on
 * every copy of itself.
 */
export default function PlatformRules() {
  const [platforms, setPlatforms] = useState<PlatformComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  // Bug fix: previously getEnabledPlatformRules had no .catch(), meaning a
  // network/DB failure left the skeleton spinning indefinitely. Now we surface
  // an error state so the user gets actionable feedback instead of a hang.
  const [error, setError] = useState(false);

  useEffect(() => {
    getEnabledPlatformRules()
      .then((p) => {
        setPlatforms(p);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      {/* Dark hero — consistent with Security and other trust pages */}
      <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-yellow py-16">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-4">
            Platform rules
          </span>
          <h1 className="text-3xl md:text-4xl mb-5 max-w-xl">
            What each platform expects — so your campaign doesn’t get pulled.
          </h1>
          <p className="text-billboard-paperDim/90 max-w-xl mb-2">
            ChatSched helps businesses and publishers prepare campaigns for applicable platform
            requirements. Final publication, enforcement, and policy decisions remain with the
            relevant platform.
          </p>
          <p className="text-billboard-paperDim/70 text-sm max-w-xl">
            Requirements may change. Always verify the current platform policy before publishing
            — this list is a starting point, not a substitute for it.
          </p>
        </div>
      </section>

      {/* Platform cards */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} className="h-40" />
            ))}
          </div>
        )}

        {/* Bug fix: previously no error state — a DB failure silently left
            the skeleton spinning forever. Now shows a clear message. */}
        {error && (
          <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim text-center">
            <p className="font-bold mb-1">Couldn’t load platform rules right now.</p>
            <p className="text-sm text-billboard-inkSoft mb-4">
              Please try refreshing the page. If the problem persists, contact us.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Bug fix: previously no empty state — if the DB returned 0 enabled
            rules the page would render a completely blank section with no
            feedback to the user. */}
        {!loading && !error && platforms.length === 0 && (
          <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim text-center">
            <p className="font-bold mb-1">No platform rules published yet.</p>
            <p className="text-sm text-billboard-inkSoft">
              Check back soon — we’re working on adding guidance for every supported platform.
            </p>
          </div>
        )}

        {!loading && !error && platforms.length > 0 && (
          <div className="space-y-4">
            {platforms.map((p) => (
              <PlatformRequirementCard key={p.platform} rule={p} />
            ))}
          </div>
        )}
      </section>

      {/* Related links */}
      <section className="bg-billboard-paperDim border-y-[3px] border-billboard-ink py-12">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-lg mb-5">Related</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link
              to="/compliance"
              className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
            >
              <h3 className="font-bold text-sm mb-1">Compliance Centre</h3>
              <p className="text-xs text-billboard-inkSoft">
                Full overview of how ChatSched approaches compliance across every channel.
              </p>
            </Link>
            <Link
              to="/trust"
              className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
            >
              <h3 className="font-bold text-sm mb-1">Trust Centre</h3>
              <p className="text-xs text-billboard-inkSoft">
                Verification, disputes, creator &amp; business standards.
              </p>
            </Link>
            <Link
              to="/how-it-works"
              className="border-[3px] border-billboard-ink rounded p-4 bg-billboard-paper hover:-translate-y-0.5 transition"
            >
              <h3 className="font-bold text-sm mb-1">How it works</h3>
              <p className="text-xs text-billboard-inkSoft">
                From request to live placement — the full campaign flow.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-5 py-16 text-center">
        <h2 className="font-display text-xl mb-3">
          Ready to run a compliant campaign?
        </h2>
        <p className="text-billboard-inkSoft max-w-md mx-auto mb-6">
          Browse publishers, submit a feature request, and ChatSched will flag the
          platform requirements that apply to your campaign before it goes live.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition"
          >
            Browse publishers →
          </Link>
          <Link
            to="/compliance"
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-paper font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition"
          >
            Compliance Centre
          </Link>
        </div>
      </section>
    </div>
  );
}
