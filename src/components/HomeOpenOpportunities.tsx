import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ChannelIcon from "./ChannelIcon";
import { getEnabledChannels } from "../lib/channelRegistry";
import type { ChannelSlug } from "../lib/channelTypes";
import { useReveal } from "../hooks/useReveal";

/**
 * "Open opportunities" band on the homepage.
 *
 * Deliberately lean: headline, one paragraph, two CTAs, one animated
 * brief -> proposals illustration, and a slim strip of four animated benefits.
 * Same i18n keys and English defaults as the previous HeroBottomBand. All motion is CSS (keyframes live in
 * tailwind.config.js as `animate-op-*`) and switches off under
 * prefers-reduced-motion.
 */

/** Brief fields mirror the sentence "Set the channel, location, audience, budget and deadline." */
const BRIEF_FIELDS: { key: string; label: string }[] = [
  { key: "channel", label: "Channel" },
  { key: "location", label: "Location" },
  { key: "audience", label: "Audience" },
  { key: "budget", label: "Budget" },
  { key: "deadline", label: "Deadline" },
];

/** Channels shown as incoming proposals — only ones that are actually live. */
const PROPOSAL_SLUGS: ChannelSlug[] = ["influencer", "podcast", "radio", "website", "social-media"];

const still = "motion-reduce:animate-none";

/* ------------------------------ illustration ------------------------------ */

function BriefTick() {
  return (
    <svg className={`w-2.5 h-2.5 animate-op-tick ${still}`} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6.5 5 9.5 10 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OpportunityBoard({ revealed }: { revealed: boolean }) {
  const { t } = useTranslation("home");
  const enabled = new Set<string>(getEnabledChannels().map((c) => c.definition.slug));
  const proposals = PROPOSAL_SLUGS.filter((s) => enabled.has(s)).slice(0, 3);

  return (
    <div className="relative w-full max-w-[540px] mx-auto lg:mx-0 lg:ml-auto" aria-hidden="true">
      {/* pulsing halo behind the board */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[78%] aspect-square pointer-events-none">
        <span className={`absolute inset-0 rounded-full border-[3px] border-billboard-yellow/40 animate-op-ring ${still}`} />
        <span className={`absolute inset-0 rounded-full border-[3px] border-billboard-yellow/30 animate-op-ring ${still}`} style={{ animationDelay: "1s" }} />
        <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(245,183,0,.22),transparent_70%)]" />
      </div>

      <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] sm:gap-y-0">
        {/* Brief card */}
        <div
          className={`sm:col-start-1 sm:self-center transition-all duration-700 ease-out motion-reduce:transition-none ${revealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
        >
          <div className="rounded-xl border-[3px] border-billboard-ink bg-billboard-paper text-billboard-ink p-4 shadow-[6px_6px_0_#F5B700] -rotate-2">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wide">{t("heroBands.bottom.board.brief", { defaultValue: "Brief" })}</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-billboard-red" />
                <span className="w-2 h-2 rounded-full bg-billboard-yellow" />
                <span className="w-2 h-2 rounded-full bg-billboard-green" />
              </span>
            </div>
            <div className="h-2.5 w-4/5 rounded bg-billboard-ink mb-2" />
            <div className="h-2 w-full rounded bg-billboard-ink/15 mb-1.5" />
            <div className="h-2 w-2/3 rounded bg-billboard-ink/15 mb-4" />
            <div className="flex flex-wrap gap-1.5">
              {BRIEF_FIELDS.map((f, i) => (
                <span
                  key={f.key}
                  className={`inline-flex items-center gap-1 rounded-full border-2 border-billboard-ink bg-billboard-paper px-2 py-1 font-mono text-[9px] font-bold uppercase animate-op-chip ${still}`}
                  style={{ animationDelay: `${i * 0.7}s` }}
                >
                  <BriefTick />
                  {t(`heroBands.bottom.board.fields.${f.key}`, { defaultValue: f.label })}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Animated connectors */}
        <svg className="hidden sm:block sm:col-start-2 w-full h-full self-stretch overflow-visible" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
          {[16.7, 50, 83.3].slice(0, Math.max(proposals.length, 1)).map((y, i) => (
            <path
              key={i}
              d={`M0 50 C 22 50, 18 ${y}, 40 ${y}`}
              stroke="#F5B700"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 8"
              vectorEffect="non-scaling-stroke"
              className={`animate-op-dash ${still}`}
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </svg>

        {/* Incoming proposals */}
        <div className="sm:col-start-3 flex flex-col gap-3 sm:py-1">
          {proposals.map((slug, i) => (
            <div
              key={slug}
              className={revealed ? `animate-op-slide-in ${still}` : "opacity-0"}
              style={{ animationDelay: `${0.35 + i * 0.18}s` }}
            >
              <div className={`animate-op-float ${still}`} style={{ animationDelay: `${-i * 1.4}s` }}>
                <div className="flex items-center gap-3 rounded-lg border-[3px] border-billboard-ink bg-billboard-paper text-billboard-ink p-2.5 shadow-[4px_4px_0_#1C6B45]">
                  <ChannelIcon slug={slug} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[9px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-1.5">
                      {t("heroBands.bottom.board.proposal", { defaultValue: "Proposal" })}
                    </div>
                    <div className="h-2 w-4/5 rounded bg-billboard-ink" />
                  </div>
                  <span className="relative grid place-items-center w-6 h-6 shrink-0 rounded-full bg-billboard-green text-billboard-paper text-[11px] font-bold">
                    <span className={`absolute inset-0 rounded-full bg-billboard-green animate-op-ring ${still}`} style={{ animationDelay: `${i * 0.5}s` }} />
                    <span className="relative">✓</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ benefit cards ------------------------------ */

const box = "inline-flex shrink-0 w-11 h-11 items-center justify-center rounded-md border-[3px] border-billboard-ink bg-billboard-yellow transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110";
const svgProps = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function ReachIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" className={`animate-op-wave ${still}`} />
      <path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" className={`animate-op-wave ${still}`} style={{ animationDelay: ".45s" }} />
    </svg>
  );
}

function TrustIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.4 2.4 4.2-4.6" pathLength={10} strokeDasharray={10} className={`animate-op-draw ${still}`} />
    </svg>
  );
}

function ProtectedIcon() {
  return (
    <svg {...svgProps}>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" className={`animate-op-lock ${still}`} />
      <path d="M12 14.5v2.5" />
    </svg>
  );
}

function GrowIcon() {
  const bar = (d: string, delay: string) => (
    <path d={d} className={`animate-op-bars ${still}`} style={{ transformBox: "fill-box", transformOrigin: "bottom", animationDelay: delay } as CSSProperties} />
  );
  return (
    <svg {...svgProps}>
      {bar("M4 19V9", "0s")}
      {bar("M10 19V5", ".25s")}
      {bar("M16 19v-7", ".5s")}
      <path d="M22 19H2" />
      <path d="m14 6 3-3 3 3" className={`animate-op-float ${still}`} />
    </svg>
  );
}

function Benefit({ icon, title, index, revealed }: { icon: ReactNode; title: string; index: number; revealed: boolean }) {
  return (
    <li
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ transitionDelay: revealed ? `${350 + index * 100}ms` : "0ms" }}
    >
      <div className="group h-full flex items-center gap-3 rounded-lg border-[3px] border-billboard-paper/20 bg-billboard-paper/[0.04] p-3 transition-all duration-300 hover:-translate-y-1 hover:border-billboard-yellow hover:bg-billboard-paper/10">
        <span className={box}>{icon}</span>
        <span className="font-display text-sm sm:text-base leading-tight">{title}</span>
      </div>
    </li>
  );
}

/* --------------------------------- section --------------------------------- */

export default function HomeOpenOpportunities() {
  const { t } = useTranslation("home");
  const { ref, revealed } = useReveal<HTMLDivElement>();

  const title = t("heroBands.bottom.title", { defaultValue: "Your next booking is one brief away." });
  const words = title.split(" ");
  const headLead = words.slice(0, -3).join(" ");
  const headHit = words.slice(-3).join(" ");

  const rv = (i: number) => ({
    className: `transition-all duration-700 ease-out motion-reduce:transition-none ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`,
    style: { transitionDelay: revealed ? `${i * 90}ms` : "0ms" } as CSSProperties,
  });

  return (
    <section className="relative overflow-hidden bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink py-12 md:py-16" aria-labelledby="hero-bottom-title">
      {/* decorative backdrop */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(rgba(250,249,245,.09)_1.2px,transparent_1.2px)] [background-size:24px_24px]" />
        <div className={`absolute -top-10 -right-10 w-44 h-44 rounded-full border-[3px] border-billboard-yellow/25 animate-op-drift ${still}`} />
        <div className={`absolute bottom-16 -left-6 w-20 h-20 rotate-12 border-[3px] border-billboard-paper/10 animate-op-drift ${still}`} style={{ animationDelay: "-4s" }} />
        <div className="absolute top-1/3 left-[46%] w-3 h-3 rounded-full bg-billboard-yellow/40 hidden lg:block" />
      </div>

      <div ref={ref} className="relative max-w-6xl mx-auto px-4 sm:px-5">
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] gap-12 lg:gap-14 items-center">
          <div className="min-w-0">
            <div {...rv(0)}>
              <span className="eyebrow light">{t("heroBands.bottom.eyebrow", { defaultValue: "Open opportunities" })}</span>
            </div>
            <h2 id="hero-bottom-title" {...rv(1)} className={`text-4xl sm:text-5xl md:text-6xl leading-[.98] mb-5 ${rv(1).className}`}>
              {headLead}
              <br />
              <span className="inline-block bg-billboard-yellow text-billboard-ink px-3 pb-1 mt-2 -rotate-1 box-decoration-clone">{headHit}</span>
            </h2>
            <p {...rv(2)} className={`text-lg text-billboard-paper/75 max-w-xl mb-6 leading-relaxed ${rv(2).className}`}>
              {t("heroBands.bottom.subtitle", {
                defaultValue:
                  "Set the channel, location, audience, budget and deadline. Matched, verified publishers send proposals inside ChatSched — you choose, pay and get proof without private contact details changing hands.",
              })}
            </p>


            <div {...rv(4)} className={`flex flex-col sm:flex-row gap-3 ${rv(4).className}`}>
              <Link to="/opportunities" className="brand-button yellow">
                {t("heroBands.bottom.ctaPrimary", { defaultValue: "Post an opportunity →" })}
              </Link>
              <Link to="/register?role=publisher" className="brand-button light">
                {t("heroBands.bottom.ctaSecondary", { defaultValue: "Join as a publisher →" })}
              </Link>
            </div>

            <p {...rv(5)} className={`font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-paper/60 mt-5 ${rv(5).className}`}>
              {t("heroBands.bottom.reassurance", { defaultValue: "Verified publishers · Protected payment · Proof of delivery" })}
            </p>
          </div>

          <OpportunityBoard revealed={revealed} />
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-10 md:mt-14">
          <Benefit index={0} revealed={revealed} icon={<ReachIcon />} title={t("heroBands.bottom.reachTitle", { defaultValue: "Reach the right local audience, fast" })} />
          <Benefit index={1} revealed={revealed} icon={<TrustIcon />} title={t("heroBands.bottom.verifiedTitle", { defaultValue: "Every publisher is reviewed before they go live" })} />
          <Benefit index={2} revealed={revealed} icon={<ProtectedIcon />} title={t("heroBands.bottom.protectedTitle", { defaultValue: "Payment protected until your placement goes live" })} />
          <Benefit index={3} revealed={revealed} icon={<GrowIcon />} title={t("heroBands.bottom.growTitle", { defaultValue: "Turn your audience into bookings" })} />
        </ul>
      </div>
    </section>
  );
}
