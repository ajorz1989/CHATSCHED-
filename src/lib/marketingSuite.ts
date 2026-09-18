/**
 * Marketing Suite — rule-based helpers.
 * Designed so a smarter, provider-backed layer can later replace or refine
 * scores/reasons without changing the UI contracts. Nothing here invents
 * publishers or pretends a live backend is connected when it is not.
 */

import type { Publisher } from "./types";
import { CATEGORIES } from "./constants";
import { formatCurrency } from "./currency";

export interface MatchResult {
  publisher: Publisher;
  score: number; // 0–100 audience match
  estimatedReach: number;
  engagement: number;
  reasons: string[];
}

export interface ReachPlannerInput {
  businessType: string;
  targetCustomer: string;
  location: string;
  budget: number | null;
  campaignGoal: string;
}

export interface ReachPlannerResult {
  matches: MatchResult[];
  postingSchedule: string[];
  budgetAllocation: { publisherName: string; suggested: number; sharePct: number }[];
  estimatedReach: number;
  notes: string[];
}

export interface CampaignDraft {
  id: string;
  description: string;
  businessType: string;
  location: string;
  budget: number | null;
  goal: string;
  platforms: string[];
  createdAt: string;
  // Placeholders for future generated output
  captions: {
    facebook: string | null;
    instagram: string | null;
    tiktok: string | null;
    whatsapp: string | null;
  };
  hashtags: string[];
  ctas: string[];
  imagePrompts: string[];
  headlines: string[];
  recommendedPublisherIds: string[];
  postingSchedule: string[];
}

export interface QualityScoreResult {
  score: number; // 0–100
  audienceMatch: number;
  estimatedReach: number;
  estimatedClicks: number;
  estimatedLeads: number;
  suggestions: string[];
  providerEnhanced: boolean; // always false until a generation provider is wired
}

export interface RoiEstimate {
  budget: number;
  estimatedReach: number;
  estimatedClicks: number;
  estimatedLeads: number;
  estimatedReturnLow: number;
  estimatedReturnHigh: number;
  assumptions: string[];
}

// ── keyword maps (category + common SA place cues) ───────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ["pizza", "restaurant", "cafe", "coffee", "bakery", "food", "drink", "menu", "takeaway", "burger", "braai", "kitchen", "chef", "dining"],
  fitness: ["gym", "fitness", "yoga", "wellness", "health", "training", "sport", "run", "crossfit", "pilates"],
  beauty: ["salon", "beauty", "hair", "nail", "spa", "grooming", "barber", "skincare", "makeup"],
  home: ["plumber", "electrician", "handyman", "home", "renovation", "cleaning", "garden", "trade", "builder", "paint"],
  family: ["family", "kids", "school", "community", "parent", "child", "church", "creche", "daycare"],
  auto: ["car", "auto", "mechanic", "garage", "tyre", "vehicle", "motors", "panelbeater"],
  fashion: ["fashion", "clothing", "boutique", "style", "apparel", "shoes", "jewellery", "jewelry"],
  tech: ["tech", "software", "gaming", "phone", "laptop", "it ", "computer", "app", "gadget"],
};

const LOCATION_HINTS = [
  "mitchells plain", "cape town", "clermont", "claremont", "bellville", "parow", "khayelitsha",
  "somerset west", "stellenbosch", "paarl", "durbanville", "wynberg", "observatory", "sea point",
  "johannesburg", "pretoria", "sandton", "soweto", "durban", "pietermaritzburg", "port elizabeth",
  "gqeberha", "bloemfontein", "polokwane", "mbombela", "nelspruit", "kimberley", "rustenburg",
  "east london", "centurion", "midrand", "umhlanga", "western cape", "gauteng", "kwazulu",
  "eastern cape", "free state", "limpopo", "mpumalanga", "northern cape", "north west",
];

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function detectCategories(text: string): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  for (const [slug, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) hits.push(slug);
  }
  // also match category display names
  for (const c of CATEGORIES) {
    if (t.includes(c.name.toLowerCase()) || t.includes(c.slug)) {
      if (!hits.includes(c.slug)) hits.push(c.slug);
    }
  }
  return hits;
}

function detectLocations(text: string): string[] {
  const t = text.toLowerCase();
  return LOCATION_HINTS.filter((loc) => t.includes(loc));
}

function categorySlugFromPublisher(p: Publisher): string {
  const name = (p.category || "").toLowerCase();
  const found = CATEGORIES.find(
    (c) => c.name.toLowerCase() === name || c.slug === name || name.includes(c.slug)
  );
  return found?.slug ?? name;
}

/**
 * Rule-based publisher ranking. Returns top matches with transparent reasons.
 * Swap the scoring body for a smarter ranking model later — keep the MatchResult shape.
 */
export function matchPublishers(
  query: string,
  publishers: Publisher[],
  opts?: { budget?: number | null; limit?: number }
): MatchResult[] {
  const qTokens = tokens(query);
  const cats = detectCategories(query);
  const locs = detectLocations(query);
  const budget = opts?.budget ?? null;
  const limit = opts?.limit ?? 5;

  const scored = publishers.map((p) => {
    let score = 0;
    const reasons: string[] = [];
    const pCat = categorySlugFromPublisher(p);
    const audience = (p.audience || "").toLowerCase();
    const bio = (p.bio || "").toLowerCase();
    const city = (p.city || "").toLowerCase();
    const province = (p.province || "").toLowerCase();
    const haystack = `${audience} ${bio} ${city} ${province} ${p.name}`.toLowerCase();

    // Category alignment (up to 35)
    if (cats.length > 0) {
      if (cats.some((c) => pCat.includes(c) || c.includes(pCat) || (p.category || "").toLowerCase().includes(c))) {
        score += 35;
        reasons.push(`Category fit: ${p.category}`);
      } else {
        // soft partial via audience/bio keywords
        const soft = cats.some((c) => (CATEGORY_KEYWORDS[c] || []).some((w) => haystack.includes(w)));
        if (soft) {
          score += 18;
          reasons.push(`Audience overlaps with ${cats.join(", ")} themes`);
        }
      }
    } else {
      // no category signal — small base so location/engagement still rank
      score += 8;
    }

    // Location (up to 30)
    let locHit = false;
    for (const loc of locs) {
      if (city.includes(loc) || province.includes(loc) || haystack.includes(loc)) {
        score += 30;
        reasons.push(`Local to ${p.city}, ${p.province}`);
        locHit = true;
        break;
      }
    }
    if (!locHit && locs.length === 0) {
      // generic SA / western cape bias if query mentions cape-ish terms already handled
      score += 5;
    }

    // Token overlap on audience/bio (up to 15)
    const overlap = qTokens.filter((t) => haystack.includes(t)).length;
    if (overlap > 0) {
      const add = Math.min(15, overlap * 3);
      score += add;
      if (overlap >= 2) reasons.push("Audience description matches your keywords");
    }

    // Engagement quality (up to 10)
    if (p.engagement >= 5) {
      score += 10;
      reasons.push(`${p.engagement}% engagement rate`);
    } else if (p.engagement >= 2) {
      score += 5;
      reasons.push(`${p.engagement}% engagement`);
    }

    // Budget fit (up to 10)
    if (budget != null && budget > 0) {
      if (p.price_per_post <= budget) {
        score += 10;
        reasons.push(`Price ${formatCurrency(p.price_per_post)} fits your budget`);
      } else if (p.price_per_post <= budget * 1.25) {
        score += 4;
        reasons.push(`Slightly above budget (${formatCurrency(p.price_per_post)})`);
      } else {
        score -= 5;
      }
    }

    // Followers as soft reach signal (up to 5)
    if (p.followers >= 20000) score += 5;
    else if (p.followers >= 5000) score += 3;

    score = Math.max(0, Math.min(100, Math.round(score)));

    // Estimated reach: monthly_reach if present, else followers * engagement/100 * 4 (rough monthly)
    const estimatedReach =
      p.monthly_reach && p.monthly_reach > 0
        ? p.monthly_reach
        : Math.round(p.followers * (Math.max(p.engagement, 1) / 100) * 3);

    if (reasons.length === 0) {
      reasons.push(`${p.followers.toLocaleString()} followers · ${p.city}`);
    }

    return {
      publisher: p,
      score,
      estimatedReach,
      engagement: p.engagement,
      reasons,
    };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.estimatedReach - a.estimatedReach)
    .slice(0, limit);
}

export function runReachPlanner(
  input: ReachPlannerInput,
  publishers: Publisher[]
): ReachPlannerResult {
  const blob = [input.businessType, input.targetCustomer, input.location, input.campaignGoal]
    .filter(Boolean)
    .join(" ");
  const matches = matchPublishers(blob, publishers, {
    budget: input.budget,
    limit: 5,
  });

  const totalBudget = input.budget && input.budget > 0 ? input.budget : null;
  const budgetAllocation = matches.map((m, i) => {
    const sharePct = matches.length === 1 ? 100 : i === 0 ? 40 : Math.round(60 / (matches.length - 1));
    const suggested =
      totalBudget != null
        ? Math.round((totalBudget * sharePct) / 100)
        : m.publisher.price_per_post;
    return {
      publisherName: m.publisher.name,
      suggested,
      sharePct: matches.length === 1 ? 100 : sharePct,
    };
  });

  // Simple schedule heuristics from goal
  const goal = (input.campaignGoal || "").toLowerCase();
  const postingSchedule: string[] = [];
  if (goal.includes("launch") || goal.includes("awareness")) {
    postingSchedule.push("Week 1: 2 posts (Tue + Thu) for awareness");
    postingSchedule.push("Week 2: 1 reminder post with offer");
  } else if (goal.includes("sale") || goal.includes("promo") || goal.includes("discount")) {
    postingSchedule.push("Day 1: Announcement post with clear offer");
    postingSchedule.push("Day 3–4: Social proof / urgency follow-up");
  } else {
    postingSchedule.push("1–2 posts over 10 days, mid-week preferred");
    postingSchedule.push("Follow up only if engagement justifies a second post");
  }

  const estimatedReach = matches.reduce((s, m) => s + m.estimatedReach, 0);
  const notes = [
    "Recommendations are rule-based from directory data (category, location, audience text, price, engagement).",
    "A smarter ranking model can refine this and copy later — this version does not invent metrics.",
  ];
  if (matches.length === 0) {
    notes.unshift("No strong directory matches yet — try broader location or category wording, or browse the full directory.");
  }

  return { matches, postingSchedule, budgetAllocation, estimatedReach, notes };
}

export function emptyCampaignDraft(partial?: Partial<CampaignDraft>): CampaignDraft {
  return {
    id: crypto.randomUUID?.() ?? `draft-${Date.now()}`,
    description: "",
    businessType: "",
    location: "",
    budget: null,
    goal: "",
    platforms: [],
    createdAt: new Date().toISOString(),
    captions: { facebook: null, instagram: null, tiktok: null, whatsapp: null },
    hashtags: [],
    ctas: [],
    imagePrompts: [],
    headlines: [],
    recommendedPublisherIds: [],
    postingSchedule: [],
    ...partial,
  };
}

/**
 * Rule-based campaign quality. Clicks/leads use conservative industry-style
 * rates applied to estimated reach — clearly estimates, not guarantees.
 */
export function scoreCampaignQuality(
  draft: CampaignDraft,
  publishers: Publisher[]
): QualityScoreResult {
  let score = 40; // base
  const suggestions: string[] = [];

  if (draft.description.trim().length >= 40) score += 15;
  else suggestions.push("Add a clearer campaign description (what you're promoting and for whom).");

  if (draft.businessType.trim()) score += 8;
  else suggestions.push("Specify your business type so matching is tighter.");

  if (draft.location.trim()) score += 10;
  else suggestions.push("Add a location — local pages convert better for most SA SMEs.");

  if (draft.goal.trim()) score += 8;
  else suggestions.push("State a campaign goal (awareness, leads, foot traffic, sales).");

  if (draft.budget != null && draft.budget > 0) score += 10;
  else suggestions.push("Set a budget so we can filter publishers you can actually book.");

  if (draft.platforms.length > 0) score += 5;
  else suggestions.push("Pick at least one platform (Facebook, Instagram, etc.).");

  const matches = matchPublishers(
    [draft.description, draft.businessType, draft.location, draft.goal].join(" "),
    publishers,
    { budget: draft.budget, limit: 5 }
  );
  const audienceMatch =
    matches.length > 0 ? Math.round(matches.reduce((s, m) => s + m.score, 0) / matches.length) : 0;
  if (audienceMatch >= 60) score += 10;
  else if (audienceMatch >= 40) score += 5;
  else if (matches.length === 0) suggestions.push("Browse publishers and narrow your brief — no strong matches yet.");

  score = Math.max(0, Math.min(100, score));

  const estimatedReach = matches.reduce((s, m) => s + m.estimatedReach, 0);
  // Conservative: ~1.2% CTR on engaged reach, ~8% of clicks → lead-ish action
  const estimatedClicks = Math.round(estimatedReach * 0.012);
  const estimatedLeads = Math.round(estimatedClicks * 0.08);

  if (!draft.captions.facebook && !draft.captions.instagram) {
    suggestions.push("Captions are not generated yet — connect a content provider or write them manually.");
  }

  return {
    score,
    audienceMatch,
    estimatedReach,
    estimatedClicks,
    estimatedLeads,
    suggestions,
    providerEnhanced: false,
  };
}

/**
 * ROI / reach estimator from budget + optional publisher set.
 */
export function estimateRoi(
  budget: number,
  publishers: Publisher[],
  selectedIds?: string[]
): RoiEstimate {
  const pool =
    selectedIds && selectedIds.length > 0
      ? publishers.filter((p) => selectedIds.includes(p.id))
      : publishers;

  const assumptions: string[] = [
    "Estimates use directory engagement and price data — not guarantees.",
    "Click-through ~1.2% of estimated post reach; lead rate ~8% of clicks (conservative).",
    "Return band assumes R80–R250 value per lead depending on your offer.",
  ];

  if (budget <= 0) {
    return {
      budget: 0,
      estimatedReach: 0,
      estimatedClicks: 0,
      estimatedLeads: 0,
      estimatedReturnLow: 0,
      estimatedReturnHigh: 0,
      assumptions: ["Enter a budget above R0 to see estimates."],
    };
  }

  // How many posts can we buy at average price of cheapest viable publishers?
  const priced = [...pool].filter((p) => p.price_per_post > 0).sort((a, b) => a.price_per_post - b.price_per_post);
  if (priced.length === 0) {
    return {
      budget,
      estimatedReach: 0,
      estimatedClicks: 0,
      estimatedLeads: 0,
      estimatedReturnLow: 0,
      estimatedReturnHigh: 0,
      assumptions: ["No priced publishers available to model against."],
    };
  }

  let remaining = budget;
  let reach = 0;
  const used: Publisher[] = [];
  for (const p of priced) {
    if (remaining < p.price_per_post) continue;
    const posts = Math.floor(remaining / p.price_per_post);
    if (posts <= 0) continue;
    const take = Math.min(posts, 2); // cap per publisher for diversity
    remaining -= take * p.price_per_post;
    const perPost =
      p.monthly_reach && p.monthly_reach > 0
        ? Math.round(p.monthly_reach / 4)
        : Math.round(p.followers * (Math.max(p.engagement, 1) / 100));
    reach += perPost * take;
    used.push(p);
    if (remaining < priced[0].price_per_post) break;
  }

  const estimatedClicks = Math.round(reach * 0.012);
  const estimatedLeads = Math.round(estimatedClicks * 0.08);
  const estimatedReturnLow = estimatedLeads * 80;
  const estimatedReturnHigh = estimatedLeads * 250;

  if (used.length > 0) {
    assumptions.push(
      `Modelled against ${used.length} publisher(s), e.g. ${used
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")}.`
    );
  }

  return {
    budget,
    estimatedReach: reach,
    estimatedClicks,
    estimatedLeads,
    estimatedReturnLow,
    estimatedReturnHigh,
    assumptions,
  };
}

/** True when a future VITE_CAPTION_PROVIDER_KEY (or similar) is present. */
export function isCaptionProviderConfigured(): boolean {
  try {
    // Vite only exposes env prefixed with VITE_
    const key = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CAPTION_PROVIDER_KEY;
    return Boolean(key && key.length > 8);
  } catch {
    return false;
  }
}
