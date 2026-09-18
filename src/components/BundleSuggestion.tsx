import { Link } from "react-router-dom";
import type { ChannelSlug } from "../lib/channelTypes";
import { getChannelBySlug } from "../lib/channelRegistry";

/**
 * 12-Channel Audit fix D3 — cross-sell bundle suggestion at
 * campaign-creation time. Deliberately rule-based and static, not a real
 * recommender: the audit's own proposed v1 ("a simple co-occurrence
 * table... updated weekly") needs real booking-history data this
 * codebase doesn't track yet (same gap noted on EarnedBadges.tsx's
 * "Rising Publisher"). These pairings are a reasonable starting rule set
 * (the four physical/local channels genuinely complement each other for
 * a "reach everyone within a small radius" local campaign, per the
 * audit's own 3.1 section) — not claimed to be learned from real
 * behavior, and no fabricated stats ("+30% reach") are shown, since
 * there's no real number to back that up yet.
 */
const COMPLEMENTARY: Partial<Record<ChannelSlug, ChannelSlug[]>> = {
  "informal-retail": ["transport", "restaurants", "community"],
  transport: ["informal-retail", "restaurants"],
  restaurants: ["informal-retail", "community", "events"],
  community: ["informal-retail", "associations", "restaurants"],
  associations: ["community", "events"],
  events: ["restaurants", "community", "sports"],
  sports: ["events", "community"],
  radio: ["podcast", "social-media"],
  podcast: ["radio", "social-media"],
  "social-media": ["influencer", "website"],
  influencer: ["social-media", "website"],
  website: ["social-media", "influencer"],
};

export default function BundleSuggestion({ channelSlug }: { channelSlug: ChannelSlug | "" }) {
  if (!channelSlug) return null;
  const suggestions = COMPLEMENTARY[channelSlug];
  if (!suggestions || suggestions.length === 0) return null;
  const primary = getChannelBySlug(channelSlug)?.definition;
  if (!primary) return null;

  return (
    <div className="border-2 border-billboard-ink rounded p-3 bg-billboard-yellow/20 text-sm">
      <span className="font-semibold">Pair this with:</span>{" "}
      {suggestions.map((slug, i) => {
        const def = getChannelBySlug(slug)?.definition;
        if (!def) return null;
        return (
          <span key={slug}>
            {i > 0 && ", "}
            <Link to={`/channels/${slug}`} className="underline hover:text-billboard-inkSoft">
              {def.name}
            </Link>
          </span>
        );
      })}{" "}
      <span className="text-billboard-inkSoft">— businesses often combine {primary.name.toLowerCase()} with these for broader local reach.</span>
    </div>
  );
}
