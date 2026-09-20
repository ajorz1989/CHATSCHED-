import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import PlatformRequirementCard from "../components/PlatformRequirementCard";
import { SkeletonRows } from "../components/Skeleton";
import { getEnabledPlatformRules, getCategoryRules } from "../lib/compliance";
import { reportError } from "../lib/errorTracking";
import type { PlatformComplianceRule, CampaignCategoryRule, CategoryStatus } from "../lib/complianceTypes";

const CATEGORY_STATUS_META: Record<CategoryStatus, { label: string; className: string }> = {
  allowed: { label: "Allowed", className: "border-billboard-greenDeep text-billboard-greenDeep" },
  manual_review: { label: "Manual review", className: "border-billboard-yellowDeep text-billboard-ink" },
  restricted: { label: "Restricted", className: "border-billboard-red text-billboard-red" },
  not_accepted: { label: "Not accepted", className: "border-billboard-red text-billboard-red" },
};

/**
 * Exhaustive on purpose: chatsched_status is a fixed four-value DB check
 * constraint (schema_phase39_compliance.sql), so a status the UI hasn't
 * been taught about is a deploy-order bug, not a data possibility. Typing
 * the record to CategoryStatus makes the compiler flag any new status
 * added to the type instead of letting it render an empty badge.
 */

const FAQ: { q: string; a: string }[] = [
  { q: "What is sponsored content?", a: "Content a creator publishes in exchange for payment, product, or another benefit from a business — the collaborations booked through ChatSched." },
  { q: "Why do creators need to disclose paid partnerships?", a: "Most platforms and advertising regulators require audiences to be able to tell when content is paid for. It keeps the creator's account in good standing and keeps the audience's trust intact." },
  { q: "Does ChatSched guarantee platform approval?", a: "No. ChatSched helps businesses and publishers prepare campaigns for applicable platform requirements. Final publication, enforcement, and policy decisions always remain with the relevant platform." },
  { q: "What happens if a platform removes a campaign?", a: "That decision belongs to the platform, not ChatSched. Reach out to support so we can help you understand what happened and adjust the campaign record." },
  { q: "What happens if a campaign violates platform rules?", a: "It may be flagged for manual review, and repeated or serious violations can affect a creator's or business's standing on ChatSched. See /trust/creator-standards and /trust/business-standards." },
  { q: "Who is responsible for advertising claims?", a: "The business. Businesses are responsible for the truthfulness and legality of the claims made in a campaign — ChatSched's screening assists review, it doesn't substitute for legal sign-off." },
  { q: "What happens to my payment if a campaign is rejected?", a: "Payout follows the same held-payment and dispute process as any other booking — see the Trust Centre for how that works." },
];

export default function Compliance() {
  const [platforms, setPlatforms] = useState<PlatformComplianceRule[]>([]);
  const [categories, setCategories] = useState<CampaignCategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Both getters throw on a failed query, so without this catch a
    // transient network/RLS failure becomes an unhandled rejection and the
    // page sits on skeletons forever. Show a retryable notice instead.
    Promise.all([getEnabledPlatformRules(), getCategoryRules()])
      .then(([p, c]) => {
        setPlatforms(p);
        setCategories(c);
      })
      .catch((error) => {
        reportError(error, { source: "Compliance.loadRules" });
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="Compliance Centre · ChatSched"
        description="Platform requirements, disclosure rules, and advertising categories for sponsored campaigns run through ChatSched."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Compliance centre
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">Run sponsored campaigns the way platforms expect.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-4">
        ChatSched helps businesses and publishers prepare campaigns for applicable platform requirements. Final
        publication, enforcement, and policy decisions remain with the relevant platform — this page is guidance,
        not a guarantee of approval.
      </p>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        Have a specific campaign open?{" "}
        <span className="text-billboard-ink">Its own compliance page (under Dashboard → your campaign) shows exactly what's outstanding.</span>
      </p>

      {loadError && (
        <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim mb-10" role="alert">
          <p className="font-bold text-sm mb-1">We couldn't load the platform rules just now.</p>
          <p className="text-sm text-billboard-inkSoft">
            That's usually a temporary connection problem — refresh to try again. In the meantime, the responsibilities
            and FAQ below still apply, and{" "}
            <Link to="/platform-rules" className="text-billboard-greenDeep underline transition-colors hover:text-billboard-ink">the platform rules page</Link>{" "}
            may still load.
          </p>
        </div>
      )}

      {/* Platform-specific requirements */}
      <section className="mb-14">
        <h2 className="text-xl mb-1">Platform requirements</h2>
        <p className="text-sm text-billboard-inkSoft mb-5">
          What ChatSched currently asks businesses and creators to do for each platform. Non-exhaustive, and always
          subject to the platform's own current policy.{" "}
          <Link to="/platform-rules" className="text-billboard-greenDeep underline transition-colors hover:text-billboard-ink">Full platform rules →</Link>
        </p>
        {loading ? (
          <SkeletonRows count={3} />
        ) : platforms.length === 0 ? (
          <div className="border-[3px] border-dashed border-billboard-ink rounded p-6 text-sm text-billboard-inkSoft">
            {loadError
              ? "Platform rules couldn't be loaded — refresh to try again."
              : "No platform requirements are published yet — check the full platform rules page."}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {platforms.map((p) => <PlatformRequirementCard key={p.platform} rule={p} compact />)}
          </div>
        )}
      </section>

      {/* Advertising categories */}
      <section className="mb-14">
        <h2 className="text-xl mb-1">Advertising categories</h2>
        <p className="text-sm text-billboard-inkSoft mb-5">
          ChatSched's own stance on a campaign category is separate from what a platform decides — "allowed" here can
          still mean a platform requires its own review.
        </p>
        {loading ? (
          <SkeletonRows count={2} />
        ) : categories.length === 0 ? (
          <div className="border-[3px] border-dashed border-billboard-ink rounded p-6 text-sm text-billboard-inkSoft">
            {loadError
              ? "Advertising categories couldn't be loaded — refresh to try again."
              : "No advertising categories are published yet."}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const meta = CATEGORY_STATUS_META[c.chatsched_status];
              return (
                <span key={c.category} className={`font-mono text-[11px] font-semibold uppercase border-2 rounded-full px-3 py-1 ${meta.className}`}>
                  {c.category} · {meta.label}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* Responsibilities */}
      <section className="mb-14 grid sm:grid-cols-2 gap-4">
        <div className="border-[3px] border-billboard-ink rounded p-4 bg-white">
          <h3 className="font-display text-sm mb-2">Creator responsibilities</h3>
          <ul className="text-sm space-y-1.5 text-billboard-inkSoft">
            <li>• Apply the required disclosure before publishing</li>
            <li>• Represent the product or service truthfully</li>
            <li>• Submit real, verifiable publication proof</li>
            <li>• No fake engagement or fraudulent metrics</li>
          </ul>
          <Link to="/trust/creator-standards" className="inline-block mt-3 font-mono text-[11px] font-semibold uppercase text-billboard-greenDeep underline transition-colors hover:text-billboard-ink">
            Full creator standards →
          </Link>
        </div>
        <div className="border-[3px] border-billboard-ink rounded p-4 bg-white">
          <h3 className="font-display text-sm mb-2">Business responsibilities</h3>
          <ul className="text-sm space-y-1.5 text-billboard-inkSoft">
            <li>• Truthful, substantiated campaign claims</li>
            <li>• Accurate pricing and legitimate destination URLs</li>
            <li>• Never instruct a creator to bypass platform rules</li>
            <li>• Complete, accurate campaign materials</li>
          </ul>
          <Link to="/trust/business-standards" className="inline-block mt-3 font-mono text-[11px] font-semibold uppercase text-billboard-greenDeep underline transition-colors hover:text-billboard-ink">
            Full business standards →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-14">
        <h2 className="text-xl mb-5">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="border-2 border-billboard-ink rounded p-3.5 bg-white">
              <summary className="cursor-pointer font-semibold text-sm">{item.q}</summary>
              <p className="text-sm text-billboard-inkSoft mt-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-billboard-green text-white border-t-[3px] border-billboard-ink -mx-5 px-5 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl mb-4">Check your own campaign.</h2>
          <p className="text-white/85 mb-6 max-w-lg mx-auto">
            Every campaign you run has its own compliance page, showing exactly what's still outstanding before you
            publish — the requirements above, applied to that specific brief.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition"
          >
            Open your campaigns →
          </Link>
        </div>
      </section>
    </div>
  );
}
