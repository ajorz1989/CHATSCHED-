import type { ChannelSlug } from "./channelTypes";
import type { Opportunity } from "./types";

export interface OpportunityPublisherProfile {
  channel_slug: ChannelSlug;
  city: string | null;
  province: string | null;
  category: string | null;
  audience: string | null;
  bio: string | null;
  followers: number | null;
  price_per_post: number | null;
  trust_score: number | null;
  languages: string[];
}

export interface OpportunityMatch {
  score: number;
  reasons: string[];
}

function contains(source: string | null | undefined, terms: string[]): boolean {
  const haystack = (source ?? "").toLowerCase();
  return terms.some((term) => term.length > 2 && haystack.includes(term.toLowerCase()));
}

export function scoreOpportunity(
  opportunity: Pick<Opportunity, "channel_slug" | "target_city" | "target_province" | "target_audience" | "opportunity_type" | "budget_min" | "budget_max" | "expires_at" | "application_deadline"> & { match_keywords?: string[] | null },
  publisher: OpportunityPublisherProfile,
): OpportunityMatch {
  let score = 0;
  const reasons: string[] = [];

  if (opportunity.channel_slug) {
    if (opportunity.channel_slug === publisher.channel_slug) {
      score += 40;
      reasons.push("Channel match");
    }
  } else {
    score += 12;
    reasons.push("Open to your channel");
  }

  if (opportunity.target_city) {
    if ((publisher.city ?? "").toLowerCase() === opportunity.target_city.toLowerCase()) {
      score += 25;
      reasons.push("City match");
    }
  } else if (opportunity.target_province) {
    if ((publisher.province ?? "").toLowerCase() === opportunity.target_province.toLowerCase()) {
      score += 18;
      reasons.push("Province match");
    }
  } else {
    score += 6;
  }

  const targetTerms = [
    ...(opportunity.match_keywords ?? []),
    ...(opportunity.target_audience ?? "").split(/[,/\\s]+/),
    ...(opportunity.opportunity_type ?? "").split(/[-_\\s]+/),
  ].filter(Boolean);

  if (contains(
    [publisher.category, publisher.audience, publisher.bio].filter(Boolean).join(" "),
    targetTerms,
  )) {
    score += 18;
    reasons.push("Audience/category fit");
  }

  const audienceWords = (publisher.audience ?? "").split(/[,/\\s]+/).filter(Boolean);
  if (
    audienceWords.length &&
    contains(
      [opportunity.target_audience, opportunity.opportunity_type].filter(Boolean).join(" "),
      audienceWords.slice(0, 8),
    )
  ) {
    score += 5;
    if (!reasons.includes("Audience/category fit")) reasons.push("Audience fit");
  }

  if (opportunity.budget_max != null && publisher.price_per_post != null) {
    if (opportunity.budget_max >= publisher.price_per_post) {
      score += 10;
      reasons.push("Budget can cover your starting price");
    }
  } else if (opportunity.budget_min != null) {
    score += 5;
  }

  if (opportunity.application_deadline || opportunity.expires_at) {
    score += 2;
    reasons.push("Active deadline");
  }

  return {
    score: Math.min(100, Math.round(score)),
    reasons: reasons.slice(0, 4),
  };
}
