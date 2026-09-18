// Ported from a separate concept workspace and merged into the existing
// Visual Identity Studio. Named VisualAvatar/VisualCover — deliberately NOT
// PublisherAvatar/PublisherCover — because this codebase already has a
// PublisherAvatar.tsx (the real photo-upload avatar used on Browse cards,
// profiles, and the publisher dashboard). These components serve a
// different purpose (illustrating four possible design *systems* for
// review, including one that doesn't exist yet) and must never be
// confused with, or accidentally substituted for, the production one.
//
// Preview-only, same as everywhere else in this merge: only
// AdminVisualIdentity.tsx imports this file. PublisherCard.tsx,
// PublisherProfile.tsx, and Browse.tsx are untouched.
import { LEVEL_META } from "../lib/publisherDisplay";
import { getChannelBySlug } from "../lib/channelRegistry";
import { crestFor, parseSwatch, type VisualSystem } from "../lib/publisherVisual";
import { useVisualSystem } from "../contexts/VisualSystemContext";
import type { Publisher } from "../lib/types";

function isCurrentlyFeatured(p: Publisher): boolean {
  return p.featured && (!p.featured_until || new Date(p.featured_until) > new Date());
}

export function ChatSchedMark({ className = "w-4 h-3.5", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 26 22" className={className} style={style} fill="none" aria-hidden="true">
      <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="2.4" />
      <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2.4" />
      <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

function ChannelMark({ slug, className = "w-full h-full" }: { slug: string; className?: string }) {
  const stroke = { fill: "none" as const, stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (slug) {
    case "radio":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="14" r="2.2" fill="currentColor" />
          <path d="M7.5 14a4.5 4.5 0 0 1 9 0" {...stroke} />
          <path d="M4.5 14a7.5 7.5 0 0 1 15 0" {...stroke} />
        </svg>
      );
    case "transport":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M4 14h16l-2.2-6.5H6.2L4 14z" {...stroke} />
          <circle cx="8" cy="16.5" r="1.6" fill="currentColor" />
          <circle cx="16" cy="16.5" r="1.6" fill="currentColor" />
        </svg>
      );
    case "restaurants":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M8 5v8M8 13c0 3 2 4 4 4s4-1 4-4V5" {...stroke} />
          <path d="M16 5v4M12 5v8" {...stroke} />
        </svg>
      );
    case "podcast":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="9" y="5" width="6" height="10" rx="3" {...stroke} />
          <path d="M8 12a4 4 0 0 0 8 0M12 16v3" {...stroke} />
        </svg>
      );
    case "sports":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="7" {...stroke} />
          <path d="M12 5c2 2.4 3 4.6 3 7s-1 4.6-3 7c-2-2.4-3-4.6-3-7s1-4.6 3-7z" {...stroke} />
        </svg>
      );
    case "influencer":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 4.5l1.7 4.4 4.8.3-3.7 3.1 1.2 4.6L12 14.8 8 16.9l1.2-4.6L5.5 9.2l4.8-.3z" {...stroke} />
        </svg>
      );
    case "community":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="8" cy="10" r="2.4" {...stroke} />
          <circle cx="16" cy="10" r="2.4" {...stroke} />
          <path d="M4.5 18c.6-2.6 2.4-4 4.8-4s4.2 1.4 4.8 4M10 18c.6-2.6 2.4-4 4.8-4s4.2 1.4 4.8 4" {...stroke} />
        </svg>
      );
    case "website":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="1.5" {...stroke} />
          <path d="M4 9h16" {...stroke} />
        </svg>
      );
    case "informal-retail":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M5 10h14l-1.2 8H6.2L5 10z" {...stroke} />
          <path d="M5 10l1.5-4h11L19 10" {...stroke} />
        </svg>
      );
    // Bug fix on merge: "associations" and "in-venue-screens" fell through
    // to the generic default icon before (a plain rectangle) since the
    // source workspace's switch never had cases for them — same class of
    // gap as the missing CHANNEL_CREST entry in publisherVisual.ts. A
    // generic icon isn't wrong the way a missing crest colour is, so this
    // is a polish fix rather than a correctness one, but worth closing
    // while merging this file rather than carrying the gap forward.
    case "associations":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 4l7 3.5v1L12 12 5 8.5v-1z" {...stroke} />
          <path d="M5 11v5l7 3.5 7-3.5v-5" {...stroke} />
        </svg>
      );
    case "in-venue-screens":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="4" y="5" width="16" height="11" rx="1.2" {...stroke} />
          <path d="M9 19h6M12 16v3" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="5" y="6" width="14" height="9" {...stroke} />
          <path d="M9 15v4M15 15v4" {...stroke} />
        </svg>
      );
  }
}

type AvatarSize = "sm" | "card" | "md" | "lg";

const AVATAR_BOX: Record<AvatarSize, string> = {
  sm: "w-9 h-9 text-[10px]",
  card: "w-12 h-12 text-xs",
  md: "w-14 h-14 text-sm",
  lg: "w-24 h-24 text-xl md:w-28 md:h-28 md:text-2xl",
};

export function VisualAvatar({
  publisher,
  size = "md",
  system: forced,
  className = "",
}: {
  publisher: Publisher;
  size?: AvatarSize;
  system?: VisualSystem;
  className?: string;
}) {
  const { system: ctx } = useVisualSystem();
  const system = forced ?? ctx;
  const crest = crestFor(publisher);
  const box = AVATAR_BOX[size];

  if (system === "current") {
    return (
      <div className={`${box} rounded-full bg-billboard-yellow border-[3px] border-billboard-ink flex items-center justify-center font-display ${className}`}>
        {publisher.initials}
      </div>
    );
  }

  if (system === "crest") {
    return (
      <div
        className={`${box} rounded-full border-[3px] border-billboard-ink flex items-center justify-center font-display relative overflow-hidden ${className}`}
        style={{ background: crest.fill, color: crest.onFill }}
      >
        <span className="absolute inset-1 opacity-25">
          <ChannelMark slug={publisher.channel_slug} />
        </span>
        <span className="relative">{publisher.initials}</span>
      </div>
    );
  }

  if (system === "storefront") {
    return (
      <div className={`${box} relative ${className}`}>
        {size === "lg" && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-3 border-2 border-billboard-ink bg-billboard-ink rounded-sm" aria-hidden />
        )}
        <div className="w-full h-full rounded-full bg-billboard-paper border-[3px] border-billboard-ink ring-[3px] ring-billboard-yellow flex items-center justify-center font-display shadow-blockSm">
          {publisher.initials}
        </div>
      </div>
    );
  }

  // plate
  return (
    <div className={`${box} relative ${className}`}>
      <div className="w-full h-full rounded-md bg-billboard-yellow border-[3px] border-billboard-ink flex items-center justify-center font-display shadow-blockSm leading-none tracking-tight">
        {publisher.initials}
      </div>
      <span className="absolute -bottom-1 -right-1 bg-billboard-ink text-billboard-yellow rounded-[2px] p-0.5 border border-billboard-ink">
        <ChatSchedMark className={size === "lg" ? "w-3.5 h-3" : "w-2.5 h-2"} />
      </span>
    </div>
  );
}

type CoverSize = "card" | "profile" | "compact";

function CoverBadges({ publisher, size, system }: { publisher: Publisher; size: CoverSize; system: VisualSystem }) {
  const pill = size === "compact" ? "text-[8px] px-1.5 py-0.5" : "text-[10px] px-2 py-1";
  return (
    <>
      {publisher.level && size !== "compact" && system === "current" && (
        <span className={`absolute top-2.5 left-2.5 bg-white/95 text-billboard-ink font-mono font-semibold rounded border border-billboard-ink ${pill}`}>
          {LEVEL_META[publisher.level].label.replace(" Publisher", "")}
        </span>
      )}
      {publisher.verified && (
        <span className={`absolute top-2.5 right-2.5 bg-billboard-ink text-white font-mono font-semibold rounded z-[1] ${pill}`}>
          Verified
        </span>
      )}
      {isCurrentlyFeatured(publisher) && size !== "compact" && (
        <span className={`absolute bottom-2.5 right-2.5 bg-billboard-yellow text-billboard-ink font-mono font-semibold rounded border border-billboard-ink z-[1] ${pill}`}>
          Featured
        </span>
      )}
    </>
  );
}

export function VisualCover({
  publisher,
  size = "card",
  system: forced,
}: {
  publisher: Publisher;
  size?: CoverSize;
  system?: VisualSystem;
}) {
  const { system: ctx } = useVisualSystem();
  const system = forced ?? ctx;
  const channel = getChannelBySlug(publisher.channel_slug)?.definition;
  const crest = crestFor(publisher);
  const { from, to } = parseSwatch(publisher.swatch);
  const avatarSize: AvatarSize = size === "profile" ? "lg" : size === "compact" ? "sm" : system === "current" ? "card" : "md";
  const height =
    size === "profile" ? "h-64 md:h-80" : size === "compact" ? "h-16" : system === "current" ? "h-28" : "h-36";

  const avatarEl = <VisualAvatar publisher={publisher} size={avatarSize} system={system} />;

  const cardAvatar = size === "profile" ? (
    <div className="absolute inset-x-0 -bottom-10 pointer-events-none">
      <div className="max-w-5xl mx-auto px-5">
        <div className="pointer-events-auto w-fit">{avatarEl}</div>
      </div>
    </div>
  ) : size === "compact" ? (
    <div className="absolute -bottom-3 left-3">{avatarEl}</div>
  ) : (
    <div className="absolute -bottom-6 left-4">{avatarEl}</div>
  );

  if (system === "current") {
    return (
      <div className={`${height} bg-gradient-to-br ${publisher.swatch} relative ${size === "profile" ? "border-b-[3px] border-billboard-ink" : ""}`}>
        <CoverBadges publisher={publisher} size={size} system={system} />
        {cardAvatar}
      </div>
    );
  }

  if (system === "crest") {
    return (
      <div className={`${height} relative ${size === "profile" ? "border-b-[3px] border-billboard-ink" : ""}`} style={{ background: crest.fill, color: crest.onFill }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <span className="absolute -right-6 -top-8 w-48 h-48 opacity-20">
            <ChannelMark slug={publisher.channel_slug} />
          </span>
        </div>
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider">
          <ChatSchedMark className="w-3.5 h-3" />
          ChatSched
        </div>
        <CoverBadges publisher={publisher} size={size} system={system} />
        {size !== "compact" && (
          <div className={`absolute left-4 right-16 ${size === "profile" ? "bottom-14" : "bottom-8"}`}>
            <p className={`font-display leading-[0.95] ${size === "profile" ? "text-3xl md:text-5xl max-w-2xl" : "text-lg"}`}>
              {publisher.name}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider mt-1 opacity-80">
              {crest.label} · {publisher.city}
            </p>
          </div>
        )}
        {cardAvatar}
      </div>
    );
  }

  if (system === "storefront") {
    return (
      <div className={`${height} relative bg-billboard-paperDim ${size === "profile" ? "border-b-[3px] border-billboard-ink" : ""}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 inset-x-0 h-7 bg-billboard-yellow border-b-[3px] border-billboard-ink flex items-center justify-between px-2.5 pointer-events-none">
            <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-billboard-ink">
              <ChatSchedMark className="w-3.5 h-3" />
              ChatSched
            </span>
            <span className="font-mono text-[10px] uppercase truncate max-w-[45%] text-billboard-ink">
              {channel?.name ?? publisher.category}
            </span>
          </div>
          <div
            className="absolute inset-x-3 top-10 bottom-3 border-[3px] border-billboard-ink"
            style={{
              backgroundImage:
                "linear-gradient(#1a1712 2px, transparent 2px), linear-gradient(90deg, #1a1712 2px, transparent 2px)",
              backgroundSize: "50% 50%",
              backgroundPosition: "-1px -1px",
              backgroundColor: "rgba(250,249,245,0.7)",
            }}
          />
        </div>
        {size !== "compact" && (
          <div className={`absolute left-1/2 -translate-x-1/2 bg-white border-[3px] border-billboard-ink px-3 py-1.5 shadow-blockSm z-[1] ${size === "profile" ? "top-16 md:top-20" : "top-12"}`}>
            <p className={`font-display leading-none text-center ${size === "profile" ? "text-2xl md:text-4xl" : "text-sm"}`}>
              {publisher.name}
            </p>
          </div>
        )}
        <CoverBadges publisher={publisher} size={size} system={system} />
        {cardAvatar}
      </div>
    );
  }

  // plate
  return (
    <div
      className={`${height} relative ${size === "profile" ? "border-b-[3px] border-billboard-ink" : ""}`}
      style={{
        backgroundColor: "#1a1712",
        backgroundImage: `repeating-linear-gradient(-18deg, transparent 0 16px, rgba(245,183,0,0.16) 16px 17px), linear-gradient(160deg, ${from}33, ${to}11)`,
        color: "#faf9f5",
      }}
    >
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 text-billboard-yellow font-mono text-[10px] font-semibold uppercase tracking-wider">
        <ChatSchedMark className="w-3.5 h-3" />
        Listed on ChatSched
      </div>
      <CoverBadges publisher={publisher} size={size} system={system} />
      {size !== "compact" && (
        <div className={`absolute left-4 right-4 ${size === "profile" ? "bottom-14 md:left-36" : "bottom-8"}`}>
          <p className={`font-display text-billboard-yellow leading-[0.92] ${size === "profile" ? "text-3xl md:text-5xl max-w-3xl" : "text-lg"}`}>
            {publisher.name}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-paperDim mt-1">
            {publisher.suburb ? `${publisher.suburb} · ` : ""}
            {publisher.city}
            {channel ? ` · ${channel.name}` : ""}
          </p>
        </div>
      )}
      {cardAvatar}
    </div>
  );
}
