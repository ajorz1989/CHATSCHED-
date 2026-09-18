import { useId } from "react";

/**
 * Modern gradient icons for the four live-launch channels (Influencer,
 * Website, Podcast, Radio) — a deliberately richer, more decorative
 * treatment than the flat-stroke UiIcons/CategoryIcon family, reserved for
 * this one moment on the homepage where the brief calls for something
 * more eye-catching. Gradient stops stay within the existing billboard
 * palette (yellow/red/green/ink) rather than introducing off-brand hues.
 *
 * Each uses useId() for its gradient def so multiple instances of the same
 * icon (e.g. one in the tab bar, one enlarged in the active pane) never
 * collide over a shared gradient id.
 */

export function SocialMediaChannelIcon({ className = "w-8 h-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D4451F" />
          <stop offset="100%" stopColor="#1C6B45" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#${id}-a)`} />
      <circle cx="16" cy="16" r="4" fill="#FAF9F5" />
      <circle cx="32" cy="16" r="4" fill="#FAF9F5" opacity="0.85" />
      <circle cx="24" cy="33" r="4" fill="#FAF9F5" opacity="0.7" />
      <path d="M18.5 18.5L21.5 30.5M29.5 18.5L26.5 30.5" stroke="#FAF9F5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function InfluencerChannelIcon({ className = "w-8 h-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5B700" />
          <stop offset="100%" stopColor="#D4451F" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#${id}-a)`} />
      <circle cx="24" cy="19" r="7" fill="none" stroke="#FAF9F5" strokeWidth="2.5" />
      <path d="M11 37c1.5-7.5 6.5-11 13-11s11.5 3.5 13 11" fill="none" stroke="#FAF9F5" strokeWidth="2.5" strokeLinecap="round" />
      <g stroke="#FAF9F5" strokeWidth="2" strokeLinecap="round">
        <path d="M35 13l2.5-2.5" />
        <path d="M37.5 17h3" />
        <path d="M35 21l2.5 2.5" />
      </g>
    </svg>
  );
}

export function WebsiteChannelIcon({ className = "w-8 h-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1C6B45" />
          <stop offset="100%" stopColor="#134F34" />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="40" height="32" rx="6" fill={`url(#${id}-a)`} />
      <rect x="4" y="8" width="40" height="9" rx="6" fill="#134F34" />
      <circle cx="11" cy="12.5" r="1.6" fill="#F5B700" />
      <circle cx="16.5" cy="12.5" r="1.6" fill="#FAF9F5" opacity="0.6" />
      <rect x="10" y="22" width="28" height="4" rx="2" fill="#FAF9F5" opacity="0.85" />
      <rect x="10" y="29" width="18" height="4" rx="2" fill="#FAF9F5" opacity="0.5" />
      <rect x="30" y="29" width="8" height="4" rx="2" fill="#F5B700" />
    </svg>
  );
}

export function PodcastChannelIcon({ className = "w-8 h-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D4451F" />
          <stop offset="100%" stopColor="#F5B700" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#${id}-a)`} />
      <rect x="18" y="10" width="12" height="18" rx="6" fill="#FAF9F5" />
      <path d="M13 23a11 11 0 0022 0" fill="none" stroke="#FAF9F5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 34v5" stroke="#FAF9F5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 39h12" stroke="#FAF9F5" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function RadioChannelIcon({ className = "w-8 h-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#134F34" />
          <stop offset="100%" stopColor="#F5B700" />
        </linearGradient>
      </defs>
      <rect x="8" y="22" width="32" height="18" rx="4" fill={`url(#${id}-a)`} />
      <circle cx="16" cy="31" r="4.5" fill="none" stroke="#FAF9F5" strokeWidth="2" />
      <circle cx="16" cy="31" r="1.3" fill="#FAF9F5" />
      <rect x="26" y="28" width="10" height="3" rx="1.5" fill="#FAF9F5" opacity="0.85" />
      <rect x="26" y="34" width="6" height="3" rx="1.5" fill="#FAF9F5" opacity="0.5" />
      <path d="M24 22V12" stroke="#1A1712" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 12a8 8 0 0112 0" fill="none" stroke="#1A1712" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 12a14 14 0 0120 0" fill="none" stroke="#1A1712" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
