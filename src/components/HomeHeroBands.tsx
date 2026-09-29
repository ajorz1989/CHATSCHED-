import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ChannelIcon from "./ChannelIcon";
import { getEnabledChannels } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";

/**
 * Conversion band above the hero video on the homepage:
 *   <HeroTopBand />   — headline, offer, CTAs and a channel "network" that
 *                       funnels down into the video
 *   (video lives in Home.tsx, untouched)
 *   The closing "Open opportunities" band now lives in HomeOpenOpportunities.tsx
 *
 * The channel count comes from the channel registry, so it can't drift out
 * of date. No pricing or fees appear in either band — these sections sell
 * the outcome; costs live on /pricing and /fees.
 * Copy uses t(key, { defaultValue }) — English renders today, and translated
 * strings can be added to the "home" namespace later without code changes
 * (missing keys already fall back to English, see src/i18n/index.ts).
 */

/** Channels shown as nodes in the network illustration, left to right. */
const NETWORK_NODES: { slug: ChannelSlug; x: number; y: number; label: string }[] = [
  { slug: "social-media", x: 70, y: 100, label: "Social" },
  { slug: "influencer", x: 190, y: 72, label: "Creators" },
  { slug: "podcast", x: 340, y: 52, label: "Podcasts" },
  { slug: "website", x: 500, y: 44, label: "Websites" },
  { slug: "radio", x: 660, y: 52, label: "Radio" },
  { slug: "events", x: 810, y: 72, label: "Events" },
  { slug: "sports", x: 930, y: 100, label: "Sports" },
];

const VIEW_W = 1000;
const VIEW_H = 300;
const HUB_Y = 262;

function ChannelNetwork({ liveCount }: { liveCount: number }) {
  const { t } = useTranslation("home");
  const enabled = new Set<string>(getEnabledChannels().map((c) => c.definition.slug));
  const nodes = NETWORK_NODES.filter((n) => enabled.has(n.slug));

  return (
    <div className="relative w-full max-w-4xl mx-auto mt-10" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }} aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none">
        {nodes.map((n) => (
          <path
            key={n.slug}
            d={`M ${n.x} ${n.y + 60} C ${n.x} 200, ${VIEW_W / 2} 170, ${VIEW_W / 2} ${HUB_Y}`}
            stroke="#1A1712"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1 11"
          />
        ))}
        <circle cx={VIEW_W / 2} cy={HUB_Y} r="9" fill="#1A1712" />
        <circle cx={VIEW_W / 2} cy={HUB_Y} r="3.5" fill="#F5B700" />
      </svg>

      {nodes.map((n) => (
        <div
          key={n.slug}
          className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${(n.x / VIEW_W) * 100}%`, top: `${(n.y / VIEW_H) * 100}%` }}
        >
          <span className="sm:hidden"><ChannelIcon slug={n.slug} size="sm" /></span>
          <span className="hidden sm:inline-flex"><ChannelIcon slug={n.slug} size="md" /></span>
          <span className="hidden sm:block font-mono text-[11px] font-bold uppercase tracking-wide text-billboard-ink mt-2">{n.label}</span>
        </div>
      ))}

      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-wider bg-billboard-ink text-billboard-paper rounded-full px-3 sm:px-4 py-1.5">
        {t("heroBands.network.hub", { defaultValue: "{{channels}} live channels · one workflow", channels: liveCount })}
      </div>
    </div>
  );
}

export function HeroTopBand({ loaded = true, children }: { loaded?: boolean; children?: ReactNode }) {
  const { t } = useTranslation("home");
  const liveCount = getEnabledChannels().length;
  return (
    <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink overflow-hidden pt-12 sm:pt-16 md:pt-20 pb-12 sm:pb-16 md:pb-20" aria-labelledby="hero-top-title">
      <div className="max-w-4xl mx-auto px-4 sm:px-5 text-center">
        <h1
          id="hero-top-title"
          className={`text-4xl sm:text-5xl md:text-7xl leading-[.98] mb-5 transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          {t("heroBands.top.title1", { defaultValue: "Buy local attention." })}
          <br />
          <span className="inline-block bg-billboard-ink text-billboard-yellow px-3 sm:px-4 pb-1 mt-2 -rotate-1 box-decoration-clone">
            {t("heroBands.top.title2", { defaultValue: "Or get paid for yours." })}
          </span>
        </h1>

        <p className="text-lg md:text-xl text-billboard-inkSoft max-w-2xl mx-auto mb-7 leading-relaxed">
          {t("heroBands.top.subtitle", {
            defaultValue:
              "Businesses post advertising opportunities. Verified creators, podcasts, radio stations, websites, events and communities send proposals to win them — with the request, payment and proof handled in one place.",
          })}
        </p>

        {/* One primary action for businesses; publishers get a quiet text link. */}
        <div className="flex justify-center">
          <Link to="/build-my-campaign" data-cta="hero-build" className="brand-button dark w-full sm:w-auto">
            {t("heroBands.top.ctaBuild", { defaultValue: "Build my campaign →" })}
          </Link>
        </div>

        <Link to="/for-publishers" data-cta="hero-publisher" className="inline-flex font-bold text-sm sm:text-base mt-5 underline underline-offset-4 decoration-2 hover:decoration-4 transition-all">
          {t("heroBands.top.ctaTertiary", { defaultValue: "Own an audience? Start earning as a publisher →" })}
        </Link>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-5 font-mono text-[11px] font-bold uppercase">
          <span>✓ {t("hero.noAccount")}</span>
          <span>✓ {t("hero.secure")}</span>
          <span>✓ {t("hero.tracked")}</span>
        </div>

        <ChannelNetwork liveCount={liveCount} />
      </div>
      {children}
    </section>
  );
}
