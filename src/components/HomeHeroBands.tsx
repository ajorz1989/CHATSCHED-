import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ChannelIcon from "./ChannelIcon";
import { getEnabledChannels } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";

/**
 * Two conversion bands that wrap the hero video on the homepage:
 *   <HeroTopBand />   — headline, offer, CTAs and a channel "network" that
 *                       funnels down into the video
 *   (video lives in Home.tsx, untouched)
 *   <HeroBottomBand /> — closing pitch + trust facts + quick-feature pills
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
          <span className="hidden sm:block font-mono text-[9px] font-bold uppercase tracking-wide text-billboard-ink mt-2">{n.label}</span>
        </div>
      ))}

      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-billboard-ink text-billboard-paper rounded-full px-3 sm:px-4 py-1.5">
        {t("heroBands.network.hub", { defaultValue: "{{channels}} live channels · one workflow", channels: liveCount })}
      </div>
    </div>
  );
}

export function HeroTopBand({ loaded = true }: { loaded?: boolean }) {
  const { t } = useTranslation("home");
  const liveCount = getEnabledChannels().length;
  return (
    <section className="bg-billboard-yellow overflow-hidden pt-12 sm:pt-16 md:pt-20 pb-4 sm:pb-6" aria-labelledby="hero-top-title">
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

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link to="/opportunities" className="brand-button dark">
            {t("heroBands.top.ctaPrimary", { defaultValue: "Post an opportunity →" })}
          </Link>
          <Link to="/browse" className="brand-button">
            {t("heroBands.top.ctaSecondary", { defaultValue: "Browse the marketplace →" })}
          </Link>
        </div>

        <Link to="/for-publishers" className="inline-flex font-bold text-sm mt-4 underline underline-offset-4">
          {t("heroBands.top.ctaTertiary", { defaultValue: "Own an audience? Start earning as a publisher →" })}
        </Link>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-5 font-mono text-[10px] font-bold uppercase">
          <span>✓ {t("hero.noAccount")}</span>
          <span>✓ {t("hero.secure")}</span>
          <span>✓ {t("hero.tracked")}</span>
        </div>

        <ChannelNetwork liveCount={liveCount} />
      </div>
    </section>
  );
}

/** Feature pills — mirror the real steps on /opportunities. */
const FEATURE_PILLS: { key: string; label: string }[] = [
  { key: "briefs", label: "Structured briefs" },
  { key: "matching", label: "Smart matching" },
  { key: "proposals", label: "Tracked proposals" },
  { key: "deadlines", label: "Deadline-aware" },
  { key: "private", label: "Contact details stay private" },
  { key: "proof", label: "Proof of delivery" },
];

function BenefitCard({ icon, tag, title, note }: { icon: ReactNode; tag: string; title: string; note: string }) {
  return (
    <div className="border-[3px] border-billboard-ink rounded-lg bg-billboard-paper text-billboard-ink p-5 shadow-[6px_6px_0_#F5B700]">
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex w-10 h-10 items-center justify-center rounded-md border-[3px] border-billboard-ink bg-billboard-yellow">{icon}</span>
        <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-billboard-inkSoft">{tag}</span>
      </div>
      <h3 className="font-display text-xl leading-tight mb-2">{title}</h3>
      <p className="text-sm text-billboard-inkSoft leading-snug">{note}</p>
    </div>
  );
}

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function HeroBottomBand() {
  const { t } = useTranslation("home");
  const liveCount = getEnabledChannels().length;

  return (
    <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-14 md:py-20" aria-labelledby="hero-bottom-title">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-10 lg:gap-14 items-center">
        <div className="min-w-0">
          <span className="eyebrow light">{t("heroBands.bottom.eyebrow", { defaultValue: "Open opportunities" })}</span>
          <h2 id="hero-bottom-title" className="text-3xl sm:text-4xl md:text-6xl leading-[.98] mb-5">
            {t("heroBands.bottom.title", { defaultValue: "Your next booking is one brief away." })}
          </h2>
          <p className="text-lg text-billboard-paper/75 max-w-xl mb-6 leading-relaxed">
            {t("heroBands.bottom.subtitle", {
              defaultValue:
                "Set the channel, location, audience, budget and deadline. Matched, verified publishers send proposals inside ChatSched — you choose, pay and get proof without private contact details changing hands.",
            })}
          </p>

          <ul className="flex flex-wrap gap-2 mb-7">
            {FEATURE_PILLS.map((p) => (
              <li key={p.key} className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide border-2 border-billboard-yellow text-billboard-yellow rounded-full px-3 py-1.5">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6.5 5 9.5 10 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {t(`heroBands.bottom.pills.${p.key}`, { defaultValue: p.label })}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/opportunities" className="brand-button yellow">
              {t("heroBands.bottom.ctaPrimary", { defaultValue: "Post an opportunity →" })}
            </Link>
            <Link to="/register?role=publisher" className="brand-button light">
              {t("heroBands.bottom.ctaSecondary", { defaultValue: "Join as a publisher →" })}
            </Link>
          </div>

          <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-paper/60 mt-5">
            {t("heroBands.bottom.reassurance", { defaultValue: "Verified publishers · Protected payment · Proof of delivery" })}
          </p>
        </div>

        <div className="min-w-0 grid gap-5 sm:grid-cols-2">
          <BenefitCard
            icon={<svg {...iconProps}><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" /></svg>}
            tag={t("heroBands.bottom.reachTag", { defaultValue: "For businesses" })}
            title={t("heroBands.bottom.reachTitle", { defaultValue: "Reach the right local audience, fast" })}
            note={t("heroBands.bottom.reachNote", { defaultValue: "{{channels}} live channels — creators, podcasts, radio, websites, events and sports — matched to your location, audience and budget.", channels: liveCount })}
          />
          <BenefitCard
            icon={<svg {...iconProps}><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m8.8 12 2.4 2.4 4.2-4.6" /></svg>}
            tag={t("heroBands.bottom.verifiedTag", { defaultValue: "Trust" })}
            title={t("heroBands.bottom.verifiedTitle", { defaultValue: "Every publisher is reviewed before they go live" })}
            note={t("heroBands.bottom.verifiedNote", { defaultValue: "Visible trust scores built from real campaign history — not just follower counts." })}
          />
          <BenefitCard
            icon={<svg {...iconProps}><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" /></svg>}
            tag={t("heroBands.bottom.protectedTag", { defaultValue: "Peace of mind" })}
            title={t("heroBands.bottom.protectedTitle", { defaultValue: "Payment protected until your placement goes live" })}
            note={t("heroBands.bottom.protectedNote", { defaultValue: "Request, payment and proof of delivery stay in one workflow — no chasing, no guesswork." })}
          />
          <BenefitCard
            icon={<svg {...iconProps}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m14 6 3-3 3 3" /></svg>}
            tag={t("heroBands.bottom.growTag", { defaultValue: "For publishers" })}
            title={t("heroBands.bottom.growTitle", { defaultValue: "Turn your audience into bookings" })}
            note={t("heroBands.bottom.growNote", { defaultValue: "Get found by verified businesses already looking to book — and win the briefs that fit your channel." })}
          />
        </div>
      </div>
    </section>
  );
}
