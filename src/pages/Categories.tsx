import { Link } from "react-router-dom";
import { CATEGORIES } from "../lib/constants";
import { usePublishers } from "../hooks/usePublishers";
import CategoryIcon from "../components/CategoryIcon";
import LiveChannelTabs from "../components/LiveChannelTabs";
import Seo from "../components/Seo";

// Bug fix: BLURBS was previously keyed by `c.icon` (e.g. "lifestyle",
// "community"), which is fragile — if two categories ever share the same
// icon name, they'd silently share blurbs too, and any new category without
// a matching icon key rendered nothing (undefined in JSX). Rekeyed by
// `c.slug` instead, which is guaranteed unique per Category definition.
const BLURBS: Record<string, string> = {
  // Existing categories
  "food": "Cafés, restaurants, food reviewers and deal pages.",
  "fitness": "Gyms, trainers, running clubs and wellness communities.",
  "beauty": "Salons, barbers, skincare and grooming pages.",
  "home": "Trades, contractors and household service providers.",
  "family": "Parenting groups, school communities and neighbourhood pages.",
  "auto": "Workshops, dealers and motoring communities.",
  "fashion": "Streetwear, thrift and style-focused accounts.",
  "tech": "Gaming, gadgets and local tech communities.",
  "local-lifestyle": "Things-to-do, local culture and lifestyle pages.",
  "regional-news": "Local news, traffic, alerts and municipal updates.",
  "community-groups": "Neighbourhood watch, suburb groups and buy-swap-sell pages.",
  "retail": "Malls, markets, local shops and deal pages.",
  "property": "Property listings, rentals and real estate groups.",
  "pets": "Pet owners, animal welfare and vet communities.",
  "events": "Local events, nightlife and what's-on pages.",
  "social-followers": "Doesn't fit a category yet? List here by follower count instead.",
  // New channel-aligned categories
  "sports-recreation": "Football clubs, netball leagues, running crews and local sports communities.",
  "transport-commute": "Minibus taxi networks, commuter channels and transport-route audiences.",
  "township-trade": "Spaza shops, township traders and informal market communities.",
  "business-professional": "Business associations, professional networks and trade body members.",
};

export default function Categories() {
  const { publishers } = usePublishers();

  return (
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo
        title="Categories · ChatSched"
        description="Browse South African advertising publishers by category — food, lifestyle, community, retail, sports, township trade, and more — or by channel."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Categories</span>
      <h1 className="text-3xl md:text-4xl mb-2 max-w-xl">Whatever your customers care about, there's already a local page for it.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-10">Every category below is filled by real, verified South African pages and creators — pick one and see who's already on the board.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((c) => {
          const count = publishers.filter((p) => p.category === c.name).length;
          // Bug fix: was `BLURBS[c.icon]` — now `BLURBS[c.slug]` so the lookup
          // is always unambiguous and never silently returns undefined.
          const blurb = BLURBS[c.slug] ?? "";
          return (
            <Link
              key={c.slug}
              to={`/browse?category=${encodeURIComponent(c.name)}`}
              className="border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-block"
            >
              <CategoryIcon name={c.icon} className="w-8 h-8 mb-3" />
              <h3 className="font-bold mb-1">{c.name}</h3>
              <p className="text-xs text-billboard-inkSoft mb-3">{blurb}</p>
              <span className="font-mono text-xs text-billboard-greenDeep font-semibold">
                {count} {count === 1 ? "publisher" : "publishers"} →
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-16 pt-14 border-t-[3px] border-billboard-ink/15">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Or by channel</span>
        <h2 className="text-3xl md:text-4xl mb-3 max-w-xl">Same customers, different ways in.</h2>
        <p className="text-billboard-inkSoft max-w-xl mb-8">Categories sort publishers by audience. Channels are a different way to reach the same local customers — explore what is live now and what is coming next.</p>
        <LiveChannelTabs />
      </div>
    </div>
  );
}
