/**
 * Platform icons for the Browse filter, the publisher card, the publisher
 * profile ("Where your ad runs"), the request forms and the site footer.
 *
 * Vector artwork from the Vecteezy "20 most famous social media icon set"
 * (resource 34880961). Their free licence asks for attribution to
 * "Vecteezy.com" (link to vecteezy.com) where possible — see the licence file
 * that came with the download. The marks are the platforms' own logos, used
 * here only to identify the platform a publisher sells ads on.
 *
 * The path data lives in lib/platformIconPaths.ts so the PDF media kit draws
 * exactly the same artwork. Every icon is a single-colour glyph drawn in
 * `currentColor`, in a fixed 20x20 box, so they inherit the surrounding ink
 * colour and line up with text at any size. Facebook Page and Facebook Group
 * share the Facebook mark; the name written next to the icon is what tells
 * them apart, so no caller relies on the icon alone.
 */
import type { ComponentType } from "react";
import { ICON_PATHS, type IconKey } from "../lib/platformIconPaths";

function makeIcon(key: IconKey): ComponentType {
  const { viewBox, paths } = ICON_PATHS[key];
  function Icon() {
    return (
      <svg
        viewBox={viewBox}
        width="20"
        height="20"
        fill="currentColor"
        role="img"
        aria-label={key}
        className="inline-block w-5 h-5 shrink-0 align-middle"
      >
        {paths.map((path) => (
          <path key={path.d} fillRule={path.evenodd ? "evenodd" : "nonzero"} d={path.d} />
        ))}
      </svg>
    );
  }
  Icon.displayName = `${key}Icon`;
  return Icon;
}

export const FacebookPageIcon = makeIcon("Facebook");
export const FacebookGroupIcon = makeIcon("Facebook");
export const InstagramIcon = makeIcon("Instagram");
export const TikTokIcon = makeIcon("TikTok");
export const WhatsAppChannelIcon = makeIcon("WhatsApp");
export const XPlatformIcon = makeIcon("X");
export const LinkedInIcon = makeIcon("LinkedIn");
export const YouTubeIcon = makeIcon("YouTube");
// Not an ad platform publishers sell on, so it is not in PLATFORM_ICONS — used by the site footer only.
export const PinterestIcon = makeIcon("Pinterest");

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
