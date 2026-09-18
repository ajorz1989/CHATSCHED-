import type { ChannelSlug } from "../lib/channelTypes";

/**
 * Purpose-built line icons for each channel, matching the ink-stroke style
 * already used elsewhere on the site (NotificationBell, InstallAppButton) —
 * replaces the raw emoji (ch.emoji) that used to sit bare on channel hero
 * sections and cards. Falls back to a generic megaphone glyph for any
 * channel slug that doesn't have a custom icon yet, so this never breaks
 * when a new channel is added to the registry.
 */
function InfluencerGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="9" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 23c0-4.5 4-7.5 9-7.5s9 3 9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20.5 6.5l2 2-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22.5 8.5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WebsiteGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="5" width="22" height="18" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <line x1="3" y1="10.5" x2="25" y2="10.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="6.5" cy="7.7" r="0.9" fill="currentColor" />
      <circle cx="9.3" cy="7.7" r="0.9" fill="currentColor" />
      <path d="M8 17l3-3.5 2.5 2.5L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PodcastGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="10.5" y="3" width="7" height="12" rx="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M6.5 13.5a7.5 7.5 0 0 0 15 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="21" x2="14" y2="25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9.5" y1="25" x2="18.5" y2="25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RadioGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="11" width="22" height="13" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="17.5" r="3" stroke="currentColor" strokeWidth="2" />
      <line x1="17" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="18.5" x2="21" y2="18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 11L18 4M13 11l7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="4" r="1.2" fill="currentColor" />
    </svg>
  );
}

function SocialGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="6" y="2" width="16" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
      <line x1="6" y1="21" x2="22" y2="21" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="23.5" r="0.9" fill="currentColor" />
      <path d="M10.5 10.5l3-3 3 3M13.5 7.5v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SportsGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M9 4h10v6a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 6H5.5a2.5 2.5 0 0 0 0 5H9M19 6h3.5a2.5 2.5 0 0 1 0 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="15" x2="14" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9.5" y1="24" x2="18.5" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 20h6l1 4H10l1-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function EventsGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M3 10a2.5 2.5 0 0 1 0-5V4a1 1 0 0 1 1-1h20a1 1 0 0 1 1 1v1a2.5 2.5 0 0 1 0 5v8a2.5 2.5 0 0 1 0 5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1a2.5 2.5 0 0 1 0-5v-8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="14" y1="4" x2="14" y2="24" stroke="currentColor" strokeWidth="2" strokeDasharray="2.2 2.2" strokeLinecap="round" />
    </svg>
  );
}

function CommunityGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="10.5" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="18.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 23c0-4.5 3.5-7 7-7s7 2.5 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 16.5c2.8 0 5.5 2 5.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TransportGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M3 17V9a1.5 1.5 0 0 1 1.5-1.5h15L25 12v5a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M3 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="7.5" x2="14" y2="17" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="19" r="2.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="19.5" cy="19" r="2.3" stroke="currentColor" strokeWidth="2" />
      <line x1="10.8" y1="19" x2="17.2" y2="19" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function InformalRetailGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M4 11l1.5-6h17L24 11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M4 11a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 2-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11v11.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V11" stroke="currentColor" strokeWidth="2" />
      <rect x="11.5" y="16" width="5" height="7.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function AssociationsGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="20" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="22" cy="20" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8.5L8 17.5M16 8.5l4 9M9 20h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RestaurantsGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M9 3v9a2 2 0 0 1-2 2v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 3v6M9 3v6M11.5 3v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 3c-2 0-3 2.5-3 6s1 5 3 5v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GenericGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M3 12v4l5 1.5V10.5L3 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 10v8l13 4V6L8 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 17.5v4a2 2 0 0 0 2 2h.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const GLYPHS: Partial<Record<ChannelSlug, () => React.ReactElement>> = {
  influencer: InfluencerGlyph,
  website: WebsiteGlyph,
  podcast: PodcastGlyph,
  radio: RadioGlyph,
  "social-media": SocialGlyph,
  sports: SportsGlyph,
  events: EventsGlyph,
  community: CommunityGlyph,
  transport: TransportGlyph,
  "informal-retail": InformalRetailGlyph,
  associations: AssociationsGlyph,
  restaurants: RestaurantsGlyph,
};

export default function ChannelIcon({ slug, size = "md" }: { slug: ChannelSlug; size?: "sm" | "md" | "lg" }) {
  const Glyph = GLYPHS[slug] ?? GenericGlyph;
  const dims = size === "lg" ? "w-16 h-16" : size === "sm" ? "w-9 h-9" : "w-12 h-12";
  // The flat "billboard poster" drop shadow (shadow-blockSm, a hard 5px
  // offset with no blur) is a hero treatment that reads well on the
  // larger md/lg badges (48px/64px) — see e.g. the channel cards on
  // /for-businesses. At "sm" (36px), used in dense grids/lists like
  // Register's channel picker and Browse's channel filter, that same
  // fixed 5px offset is proportionally much heavier and reads as a
  // detached dark blob behind the icon rather than a crisp shadow —
  // tried scaling it down to 3px first, still looked like a duplicate
  // icon at this size, so "sm" drops the shadow entirely instead: a
  // crisp flat badge with no elevation effect, right for an icon this
  // small sitting next to a text label rather than standing alone.
  const shadow = size === "sm" ? "" : "shadow-blockSm";
  return (
    <span className={`inline-flex ${dims} shrink-0 rounded-xl border-[3px] border-billboard-ink bg-billboard-yellow flex items-center justify-center ${shadow} text-billboard-ink`}>
      <Glyph />
    </span>
  );
}
