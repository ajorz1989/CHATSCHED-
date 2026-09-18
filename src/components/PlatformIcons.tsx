/**
 * Small platform icons for Browse's Platform filter. Deliberately original
 * artwork — not reproductions of Facebook/Instagram/TikTok/etc.'s actual
 * trademarked logos, which aren't ours to use. Each gets a simple original
 * glyph plus a brand-adjacent accent color, which is enough for quick
 * recognition without borrowing anyone's IP. The platform name is always
 * shown as text right next to these too, so nothing depends on the icon
 * alone for identification.
 */
import type { ComponentType, ReactNode } from "react";

function Badge({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0" style={{ backgroundColor: bg }}>
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

export function FacebookPageIcon() {
  return (
    <Badge bg="#3B5A8E">
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="#FAF9F5" strokeWidth="1.4" />
      <path d="M6 6.5h4M6 9h4M6 11.5h2.5" stroke="#FAF9F5" strokeWidth="1.4" strokeLinecap="round" />
    </Badge>
  );
}

export function FacebookGroupIcon() {
  return (
    <Badge bg="#3B5A8E">
      <circle cx="6" cy="6" r="2.2" stroke="#FAF9F5" strokeWidth="1.3" />
      <circle cx="10.5" cy="7" r="1.8" stroke="#FAF9F5" strokeWidth="1.3" />
      <path d="M2.5 13c.6-2.6 2-3.8 3.5-3.8s2.9 1.2 3.5 3.8" fill="none" stroke="#FAF9F5" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9.5 13c.4-1.8 1.3-2.7 2.3-2.7s1.9.9 2.3 2.7" fill="none" stroke="#FAF9F5" strokeWidth="1.2" strokeLinecap="round" />
    </Badge>
  );
}

export function InstagramIcon() {
  return (
    <Badge bg="#B23A6B">
      <rect x="2.5" y="2.5" width="11" height="11" rx="3.5" stroke="#FAF9F5" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.6" stroke="#FAF9F5" strokeWidth="1.4" />
      <circle cx="11.2" cy="4.8" r="0.8" fill="#FAF9F5" />
    </Badge>
  );
}

export function TikTokIcon() {
  return (
    <Badge bg="#1A1712">
      <path d="M9 2.5v7a2.3 2.3 0 11-2.3-2.3" fill="none" stroke="#FAF9F5" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 2.5c.3 1.6 1.4 2.6 3 2.8" fill="none" stroke="#F5B700" strokeWidth="1.4" strokeLinecap="round" />
    </Badge>
  );
}

export function WhatsAppChannelIcon() {
  return (
    <Badge bg="#3F9142">
      <path d="M8 2.5a5.3 5.3 0 00-4.6 7.9L2.5 13.5l3.2-.9A5.3 5.3 0 108 2.5z" fill="none" stroke="#FAF9F5" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.7 6.8c.2 1.6 1.3 2.7 2.9 2.9" stroke="#FAF9F5" strokeWidth="1.3" strokeLinecap="round" />
    </Badge>
  );
}

export function XPlatformIcon() {
  return (
    <Badge bg="#1A1712">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="#FAF9F5" strokeWidth="1.6" strokeLinecap="round" />
    </Badge>
  );
}

export function LinkedInIcon() {
  return (
    <Badge bg="#2B6CA3">
      <rect x="2.5" y="6" width="11" height="7.5" rx="1.5" fill="none" stroke="#FAF9F5" strokeWidth="1.4" />
      <path d="M6 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6" fill="none" stroke="#FAF9F5" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 9.3h11" stroke="#FAF9F5" strokeWidth="1.2" />
    </Badge>
  );
}

export function YouTubeIcon() {
  return (
    <Badge bg="#C4342A">
      <rect x="2" y="4" width="12" height="8" rx="2.5" fill="none" stroke="#FAF9F5" strokeWidth="1.3" />
      <path d="M7 6.8l3 1.2-3 1.2z" fill="#FAF9F5" />
    </Badge>
  );
}

export const PLATFORM_ICONS: Record<string, ComponentType> = {
  "Facebook Page": FacebookPageIcon,
  "Facebook Group": FacebookGroupIcon,
  "Instagram": InstagramIcon,
  "TikTok": TikTokIcon,
  "WhatsApp Channel": WhatsAppChannelIcon,
  "X": XPlatformIcon,
  "LinkedIn": LinkedInIcon,
  "YouTube": YouTubeIcon,
};
