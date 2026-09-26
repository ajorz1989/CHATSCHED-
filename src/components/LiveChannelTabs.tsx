import { useState } from "react";
import { Link } from "react-router-dom";
import { getEnabledChannels } from "../lib/channelRegistry";
import ChannelIcon from "./ChannelIcon";

export default function LiveChannelTabs() {
  const [active, setActive] = useState(0);
  const tabs = getEnabledChannels();

  if (tabs.length === 0) return null;

  const activeIndex = Math.min(active, tabs.length - 1);
  const current = tabs[activeIndex];
  const ch = current.definition;

  return (
    <div>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
        role="tablist"
        aria-label="Live advertising channels"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.definition.slug}
            id={`channel-tab-${tab.definition.slug}`}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls={`channel-panel-${tab.definition.slug}`}
            onClick={() => setActive(i)}
            className={`group min-w-0 text-left border-2 border-billboard-ink rounded-lg p-3.5 bg-billboard-paper transition hover:-translate-y-0.5 hover:shadow-blockSm ${i === activeIndex ? "ring-2 ring-billboard-greenDeep bg-billboard-paperDim" : ""}`}
          >
            <div className="flex items-center gap-2">
              <ChannelIcon slug={tab.definition.slug} size="sm" />
              <span className="font-bold text-sm leading-tight min-w-0">{tab.definition.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 font-mono text-[9px] uppercase tracking-wide text-billboard-greenDeep">
              <span className="h-1.5 w-1.5 rounded-full bg-billboard-green" aria-hidden="true" />
              Live
            </div>
          </button>
        ))}
      </div>

      <div
        id={`channel-panel-${ch.slug}`}
        role="tabpanel"
        aria-labelledby={`channel-tab-${ch.slug}`}
        className="mt-3 border-[3px] border-billboard-ink rounded-xl bg-billboard-ink text-billboard-paper p-5 md:p-7"
      >
        <div className="grid md:grid-cols-[auto_1fr_auto] gap-5 items-start">
          <div className="rounded-lg bg-billboard-paper text-billboard-ink p-3 border-2 border-billboard-paper">
            <ChannelIcon slug={ch.slug} size="lg" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-billboard-yellow mb-2">
              Live advertising channel
            </div>
            <p className="font-display text-xl md:text-2xl leading-snug mb-3">{ch.tagline}</p>
            <p className="text-sm text-billboard-paperDim leading-relaxed mb-4 max-w-3xl">{ch.description}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {ch.advertiserBenefits.slice(0, 4).map((benefit, i) => (
                <div key={i} className="flex gap-2 text-sm text-billboard-paperDim">
                  <span className="text-billboard-yellow shrink-0">✓</span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          <Link
            to={`/channels/${ch.slug}`}
            className="brand-button yellow shrink-0"
          >
            Explore →
          </Link>
        </div>
      </div>
    </div>
  );
}
