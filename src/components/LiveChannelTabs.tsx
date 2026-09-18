import { useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../hooks/useReveal";
import { getChannelBySlug } from "../lib/channelRegistry";
import ChannelIcon from "./ChannelIcon";
import { isChannelEnabled } from "../lib/featureFlags";

// The original 4 channels launched alongside social media, plus the 7 added
// since — hero copy written fresh for this placement (each channel's own
// tagline is reused instead on its Channel Hub card and dedicated page, so
// the two never repeat). Shared between Home and Categories so both show
// the exact same hero messages.
export const LIVE_CHANNEL_TABS: { slug: string; hero: string }[] = [
  { slug: "influencer", hero: "Get real creators talking about your brand — to audiences who already trust them." },
  { slug: "website", hero: "Put your business in front of readers already looking for what you sell." },
  { slug: "podcast", hero: "Sponsor the shows your customers already choose to listen to." },
  { slug: "radio", hero: "Reach local audiences through stations they already tune into." },
];

/** Tab switcher + active hero pane for the 4 live request-flow channels. No heading of its own — each page supplies its own framing above it. */
export default function LiveChannelTabs() {
  const [active, setActive] = useState(0);
  const reveal = useReveal<HTMLDivElement>();
  const tabs = LIVE_CHANNEL_TABS
    .map((t) => ({ ...t, module: getChannelBySlug(t.slug) }))
    .filter((t) => t.module && isChannelEnabled(t.module.definition.slug));

  if (tabs.length === 0) return null;
  const current = tabs[active];
  const ch = current.module!.definition;

  return (
    <div ref={reveal.ref} className={reveal.className}>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2.5 mb-8">
        {tabs.map((t, i) => (
          <button
            key={t.slug}
            id={`channel-tab-${t.slug}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`channel-panel-${t.slug}`}
            onClick={() => setActive(i)}
            className={`inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold text-sm px-4 py-2.5 rounded transition ${
              i === active ? "bg-billboard-ink text-billboard-paper" : "bg-billboard-paper hover:-translate-y-0.5"
            }`}
          >
            <ChannelIcon slug={t.module!.definition.slug} size="sm" /> {t.module!.definition.name}
          </button>
        ))}
      </div>

      {/* Active pane */}
      <div
        id={`channel-panel-${ch.slug}`}
        role="tabpanel"
        aria-labelledby={`channel-tab-${ch.slug}`}
        className="border-[3px] border-billboard-ink rounded p-6 md:p-8 bg-billboard-paper grid md:grid-cols-[auto_1fr] gap-6 items-start"
      >
        <ChannelIcon slug={ch.slug} size="lg" />
        <div>
          <p className="text-xl md:text-2xl font-display leading-snug mb-4">{current.hero}</p>
          <ul className="grid sm:grid-cols-2 gap-2 mb-5">
            {ch.advertiserBenefits.slice(0, 4).map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-billboard-inkSoft">
                <span className="text-billboard-green mt-0.5 shrink-0">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            to={`/channels/${ch.slug}`}
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-5 py-2.5 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5"
          >
            Explore {ch.name} →
          </Link>
        </div>
      </div>
    </div>
  );
}
