// Single source of truth for Schedy asset paths.
// Files live in /public/schedy and are served from /schedy/* (Vite + Cloudflare).
export const SCHEDY_BASE = '/schedy';

export const SCHEDY_SCENES = {
  notFound: { svg: `${SCHEDY_BASE}/schedy-404.svg`, w: 800, h: 360 },
  emptyOpportunities: { svg: `${SCHEDY_BASE}/schedy-empty-opportunities.svg`, w: 800, h: 360 },
  emptyCampaigns: { svg: `${SCHEDY_BASE}/schedy-empty-campaigns.svg`, w: 800, h: 360 },
  successBooked: { svg: `${SCHEDY_BASE}/schedy-success-booked.svg`, w: 800, h: 450 },
} as const;

export type SchedySceneKey = keyof typeof SCHEDY_SCENES;

export const SCHEDY_LOADER = {
  animated: `${SCHEDY_BASE}/schedy-loading-animated.svg`,
  still: `${SCHEDY_BASE}/schedy-loading-preview.png`,
  w: 800,
  h: 440,
} as const;

export const SCHEDY_STICKERS = [
  'howzit', 'sharp', 'lekker', 'eish', 'booked', 'paid',
  'get-seen', 'new-gig', 'wow', 'hmm', 'thanks', 'on-it',
] as const;

export type SchedyStickerName = (typeof SCHEDY_STICKERS)[number];

// Stickers that make a factual claim. Only show them where the statement is true for this user.
export type SchedyClaimStickerName = 'booked' | 'paid';
