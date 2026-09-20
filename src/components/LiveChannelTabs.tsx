import { useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../hooks/useReveal";
import { getAllChannels } from "../lib/channelRegistry";
import ChannelIcon from "./ChannelIcon";
import { isChannelEnabled } from "../lib/featureFlags";
import type { ChannelSlug } from "../lib/channelTypes";

/**
 * The live tab strip shown on Home and Categories.
 *
 * Rebuilt in this pass for two reasons:
 *
 * 1. social-media was missing. It is the core, always-on channel — the one
 *    with real inventory behind it today — and it was the only live channel
 *    with no tab here, so the homepage's "ways to reach customers" strip
 *    showed four newer channels and hid the one that actually works.
 *
 * 2. Everything that ISN'T live was invisible. The strip used to imply the
 *    four tabs were the whole marketplace; registering a channel module
 *    (src/channels/<slug>/index.ts) made it appear on /channels but nowhere
 *    on the homepage. The roadmap row below is registry-driven, so a channel
 *    that gets switched on moves up into the tabs automatically, and one
 *    that's registered-but-off shows here as "opening soon" instead of
 *    being sold as available.
 *
 * Hero copy stays hand-written per channel (the channel's own tagline is
 * reused on its hub card and detail page, so nothing repeats), keyed by
 * slug. A new channel without an entry here still renders — it just falls
 * back to its registry tagline.
 */
const CHANNEL_HEROES: Partial<Record<ChannelSlug, string>> = {
  "social-media": "The local pages your customers already follow — pick one and book a post this week.",
  influencer: "Get real creators talking about your brand — to audiences who already trust them.",
  website: "Put your business in front of readers already looking for what you sell.",
  podcast: "Sponsor the shows your customers already choose to listen to.",
  radio: "Reach local audiences through stations they already tune into.",
};

export default function LiveChannelTabs() {
  const [active, setActive] = useState(0);
  const reveal = useReveal<HTMLDivElement>();

  const tabs = getAllChannels()
    .filter((m) => isChannelEnabled(m.definition.slug))
    .map((m) => ({
      slug: m.definition.slug,
      module: m,
      hero: CHANNEL_HEROES[m.definition.slug] ?? m.definition.tagline,
    }));

  const openingSoon = getAllChannels().filter((m) => !isChannelEnabled(m.definition.slug));

  if (tabs.length === 0 && openingSoon.length === 0) return null;
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <div ref={reveal.ref} className={reveal.className}>
      {tabs.length > 0 && (
        <>
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
                <ChannelIcon slug={t.slug} size="sm" /> {t.module.definition.name}
              </button>
            ))}
          </div>

          {/* Active pane */}
          <div
            id={`channel-panel-${current.slug}`}
            role="tabpanel"
            aria-labelledby={`channel-tab-${current.slug}`}
            className="border-[3px] border-billboard-ink rounded p-6 md:p-8 bg-billboard-paper grid md:grid-cols-[auto_1fr] gap-6 items-start"
          >
            <ChannelIcon slug={current.slug} size="lg" />
            <div>
              <p className="text-xl md:text-2xl font-display leading-snug mb-4">{current.hero}</p>
              <ul className="grid sm:grid-cols-2 gap-2 mb-5">
                {current.module.definition.advertiserBenefits.slice(0, 4).map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm text-billboard-inkSoft">
                    <span className="text-billboard-green mt-0.5 shrink-0">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={current.slug === "social-media" ? "/browse" : `/channels/${current.slug}`}
                  className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-5 py-2.5 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5"
                >
                  {current.slug === "social-media" ? "Browse ad space →" : `Explore ${current.module.definition.name} →`}
                </Link>
                <Link
                  to="/channels/compare"
                  className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:bg-billboard-paperDim transition"
                >
                  Compare channels →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Roadmap row — every registered channel that isn't bookable yet.
          Registry-driven: flipping its flag moves it up into the tabs. */}
      {openingSoon.length > 0 && (
        <div className={`${tabs.length > 0 ? "mt-8" : ""} border-t-2 border-billboard-ink/15 pt-6`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wide text-billboard-inkSoft">
              Opening soon
            </span>
            <span className="text-xs text-billboard-inkSoft">
              {openingSoon.length} more channels are registered and being onboarded — we only open one once the supply is real.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {openingSoon.map((m) => (
              <Link
                key={m.definition.slug}
                to={`/channels/${m.definition.slug}`}
                className="inline-flex items-center gap-1.5 border-2 border-billboard-inkSoft/40 text-billboard-inkSoft text-xs font-semibold px-3 py-1.5 rounded hover:border-billboard-inkSoft transition"
              >
                <ChannelIcon slug={m.definition.slug} size="sm" /> {m.definition.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
