import type { ChannelSlug } from "./channelTypes";
import type { Publisher } from "./types";

// Ported from a separate concept workspace and merged into the existing
// Visual Identity Studio (src/pages/AdminVisualIdentity.tsx) as the shared
// rendering logic behind it — see VisualIdentitySystem.tsx. Preview-only:
// nothing here is imported by PublisherCard.tsx, PublisherProfile.tsx, or
// Browse.tsx, so it has zero effect on what a business or publisher sees
// anywhere in the live product. See that page's own doc comment for why.
export type VisualSystem = "current" | "plate" | "crest" | "storefront";

export const VISUAL_SYSTEMS: Record<
  VisualSystem,
  { id: VisualSystem; name: string; headline: string; scenario: "A" | "B" | "C" | "now" }
> = {
  current: {
    id: "current",
    name: "Current (initials + swatch)",
    headline: "What ships today — a yellow circle of letters on a gradient.",
    scenario: "now",
  },
  plate: {
    id: "plate",
    name: "Yellow Plate",
    headline: "A ChatSched-issued municipal plate. Publisher name is the billboard.",
    scenario: "C",
  },
  crest: {
    id: "crest",
    name: "Channel Crest",
    headline: "Each of the 13 channels gets a herald. Initials sit inside it.",
    scenario: "B",
  },
  storefront: {
    id: "storefront",
    name: "Publisher Storefront",
    headline: "ChatSched owns the frame. The publisher owns the window.",
    scenario: "C",
  },
};

export const SWATCH_HEX: Record<string, string> = {
  "billboard-yellow": "#f5b700",
  "billboard-yellowDeep": "#d9a400",
  "billboard-ink": "#1a1712",
  "billboard-inkSoft": "#4a4335",
  "billboard-green": "#1c6b45",
  "billboard-greenDeep": "#134f34",
  "billboard-red": "#d4451f",
  "billboard-paper": "#faf9f5",
  "billboard-paperDim": "#f0eee6",
};

// Bug fix on merge: the source workspace's CHANNEL_CREST only covered 12 of
// this project's 13 ChannelSlug values (see channelTypes.ts) — it had no
// entry for "in-venue-screens". crestFor()'s ?? fallback meant that channel
// silently rendered as social-media's green instead of crashing, which is
// arguably worse than a crash: every in-venue-screens publisher would have
// shown the wrong crest colour with no error to notice it by. Added here
// using the same fill/ink pairing AdminVisualIdentity.tsx's own (now
// superseded) local CHANNEL_CREST copy already used for this channel.
export const CHANNEL_CREST: Record<
  ChannelSlug,
  { fill: string; onFill: string; label: string; short: string }
> = {
  "social-media": { fill: "#f5b700", onFill: "#1a1712", label: "Social", short: "SOC" },
  influencer: { fill: "#d4451f", onFill: "#faf9f5", label: "Influencer", short: "INF" },
  website: { fill: "#1c6b45", onFill: "#faf9f5", label: "Website", short: "WEB" },
  podcast: { fill: "#1a1712", onFill: "#f5b700", label: "Podcast", short: "POD" },
  radio: { fill: "#134f34", onFill: "#faf9f5", label: "Radio", short: "RAD" },
  sports: { fill: "#1c6b45", onFill: "#f5b700", label: "Sports", short: "SPT" },
  events: { fill: "#d4451f", onFill: "#faf9f5", label: "Events", short: "EVT" },
  community: { fill: "#d9a400", onFill: "#1a1712", label: "Community", short: "COM" },
  transport: { fill: "#f5b700", onFill: "#1a1712", label: "Transport", short: "TAX" },
  "informal-retail": { fill: "#d4451f", onFill: "#faf9f5", label: "Spaza", short: "SPZ" },
  associations: { fill: "#134f34", onFill: "#faf9f5", label: "Association", short: "ASC" },
  restaurants: { fill: "#d4451f", onFill: "#f5b700", label: "Restaurant", short: "RST" },
  "in-venue-screens": { fill: "#1a1712", onFill: "#f5b700", label: "In-Venue Screens", short: "IVS" },
};

export function parseSwatch(swatch: string): { from: string; to: string } {
  const fromToken = swatch.match(/from-([a-zA-Z0-9-]+)/)?.[1] ?? "billboard-yellow";
  const toToken = swatch.match(/to-([a-zA-Z0-9-]+)/)?.[1] ?? "billboard-ink";
  return {
    from: SWATCH_HEX[fromToken] ?? "#f5b700",
    to: SWATCH_HEX[toToken] ?? "#1a1712",
  };
}

export function crestFor(publisher: Publisher) {
  return CHANNEL_CREST[publisher.channel_slug] ?? CHANNEL_CREST["social-media"];
}

export const VISUAL_STORAGE_KEY = "chatsched-visual-identity-studio-preview";

export function readStoredVisualSystem(): VisualSystem {
  if (typeof window === "undefined") return "current";
  try {
    const raw = window.localStorage.getItem(VISUAL_STORAGE_KEY);
    if (raw === "plate" || raw === "crest" || raw === "storefront" || raw === "current") return raw;
  } catch {
    /* ignore — e.g. storage disabled/blocked; just fall back to "current" */
  }
  return "current";
}

export function writeStoredVisualSystem(system: VisualSystem) {
  try {
    window.localStorage.setItem(VISUAL_STORAGE_KEY, system);
  } catch {
    /* ignore */
  }
}
