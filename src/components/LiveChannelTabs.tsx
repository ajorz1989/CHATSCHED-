import { useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../hooks/useReveal";
import { getEnabledChannels } from "../lib/channelRegistry";
import ChannelIcon from "./ChannelIcon";

/**
 * Live channel switcher shared by Home and Categories.
 * The registry is the source of truth, so every live channel appears here
 * automatically while development channels stay out of the live experience.
 */
export default function LiveChannelTabs() {
  const [active, setActive] = useState(0);
  const reveal = useReveal<HTMLDivElement>();
  const tabs = getEnabledChannels();

  if (tabs.length === 0) return null;

  const activeIndex = Math.min(active, tabs.length - 1);
  const current = tabs[activeIndex];
  const ch = current.definition;

  return (
    <div ref={reveal.ref} className={reveal.className}>
      <div className="flex flex-wrap gap-2.5 mb-8" role="tablist" aria-label="Live advertising channels">
        {tabs.map((t, i) => (
          <button
            key={t.definition.slug}
            id={`channel-tab-${t.definition.slug}`}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls={`channel-panel-${t.definition.slug}`}
            onClick={() => setActive(i)}
            className={`inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold text-sm px-4 py-2.5 rounded transition ${
              i === activeIndex
                ? "bg-billboard-ink text-billboard-paper"
                : "bg-billboard-paper hover:-translate-y-0.5"
            }`}
          >
            <ChannelIcon slug={t.definition.slug} size="sm" />
            {t.definition.name}
          </button>
        ))}
      </div>

      <div
        id={`channel-panel-${ch.slug}`}
        role="tabpanel"
        aria-labelledby={`channel-tab-${ch.slug}`}
        className="border-[3px] border-billboard-ink rounded p-6 md:p-8 bg-billboard-paper grid md:grid-cols-[auto_1fr] gap-6 items-start"
      >
        <ChannelIcon slug={ch.slug} size="lg" />
        <div>
          <div className="inline-flex items-center gap-1.5 border border-billboard-greenDeep/40 bg-billboard-green/10 text-billboard-greenDeep font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded mb-3">
            Live now
          </div>
          <p className="text-xl md:text-2xl font-display leading-snug mb-4">{ch.tagline}</p>
          <p className="text-sm text-billboard-inkSoft leading-relaxed mb-5">{ch.description}</p>
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
