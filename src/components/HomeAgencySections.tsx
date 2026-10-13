import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * Two additive homepage sections used by the "agency" layout (HOME_LAYOUT in
 * src/lib/constants). Homepage-only. All copy lives in the "home" namespace
 * under agency.*; the defaultValues are the English copy. No prices, numbers,
 * client names, results or guarantees appear here, and no partner or venue
 * is named. The mascot is deliberately not used in these sections.
 */

const CARD_KEYS = ["plan", "match", "approve"] as const;
const CARD_DEFAULTS: Record<(typeof CARD_KEYS)[number], { title: string; body: string }> = {
  plan: {
    title: "We plan it",
    body: "Tell us your goal, your audience and your budget. We shape a campaign that fits a small business.",
  },
  match: {
    title: "We match it with local pages and spaces",
    body: "We line your campaign up with local creators, podcasts, radio, websites and community spaces that reach your neighbourhood.",
  },
  approve: {
    title: "You approve and we track it",
    body: "You see the plan and say yes. Requests, payment and proof of delivery stay together in one place.",
  },
};

export function WhatWeDoSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 md:py-24 bg-white border-b-[3px] border-billboard-ink" aria-labelledby="what-we-do-title">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-8 md:mb-10">
          <span className="eyebrow">{t("agency.whatWeDo.badge", { defaultValue: "WHAT WE DO" })}</span>
          <h2 id="what-we-do-title" className="text-3xl md:text-5xl mb-3">
            {t("agency.whatWeDo.title", { defaultValue: "Your local advertising team, without the agency price tag." })}
          </h2>
          <p className="text-billboard-inkSoft max-w-prose">
            {t("agency.whatWeDo.subtitle", { defaultValue: "You run the business. We handle the advertising, from the first idea to the proof that it ran." })}
          </p>
        </div>

        <ol className="grid md:grid-cols-3 gap-4 list-none p-0 m-0">
          {CARD_KEYS.map((key, i) => (
            <li key={key} className="border-2 border-billboard-ink rounded-xl p-6 bg-billboard-paperDim shadow-blockSm flex flex-col">
              <span
                className="inline-flex w-10 h-10 items-center justify-center rounded-md bg-billboard-yellow border-2 border-billboard-ink font-display text-lg mb-4 self-start"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="font-display text-xl mb-2">
                {t(`agency.whatWeDo.cards.${key}.title`, { defaultValue: CARD_DEFAULTS[key].title })}
              </h3>
              <p className="text-sm text-billboard-inkSoft leading-relaxed">
                {t(`agency.whatWeDo.cards.${key}.body`, { defaultValue: CARD_DEFAULTS[key].body })}
              </p>
            </li>
          ))}
        </ol>

        <Link to="/build-my-campaign" data-cta="what-we-do-plan" className="brand-button mt-8">
          {t("agency.whatWeDo.cta", { defaultValue: "Get my campaign plan →" })}
        </Link>
      </div>
    </section>
  );
}

export function CrossBrandingSection() {
  const { t } = useTranslation("home");
  const chips = [
    t("agency.crossBrand.chipYou", { defaultValue: "Your business" }),
    t("agency.crossBrand.chipUs", { defaultValue: "Matched by ChatSched" }),
    t("agency.crossBrand.chipThem", { defaultValue: "A neighbouring business" }),
  ];
  return (
    <section className="py-16 md:py-24 bg-billboard-yellow text-billboard-ink border-b-[3px] border-billboard-ink" aria-labelledby="cross-branding-title">
      <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-[1.2fr_1fr] gap-8 md:gap-12 items-center">
        <div>
          <span className="eyebrow">{t("agency.crossBrand.badge", { defaultValue: "CROSS-BRANDING" })}</span>
          <h2 id="cross-branding-title" className="text-3xl md:text-5xl mb-3">
            {t("agency.crossBrand.title", { defaultValue: "Local businesses, advertising each other." })}
          </h2>
          <p className="text-billboard-inkSoft max-w-prose mb-3 leading-relaxed">
            {t("agency.crossBrand.body", {
              defaultValue:
                "Businesses that share the same customers can feature on each other's pages and spaces. We do the matching, so you reach new people through places they already trust.",
            })}
          </p>
          <p className="text-sm text-billboard-inkSoft max-w-prose mb-6">
            {t("agency.crossBrand.example", { defaultValue: "For example, a café could feature on a nearby gym's page, and the gym on the café's." })}
          </p>
          <Link to="/build-my-campaign" data-cta="cross-branding-plan" className="brand-button dark">
            {t("agency.crossBrand.cta", { defaultValue: "Tell us about your business →" })}
          </Link>
        </div>

        {/* Decorative: the idea in one picture. No names, logos or places. */}
        <div className="flex md:flex-col items-center justify-center gap-3" aria-hidden="true">
          {chips.map((label, i) => (
            <div key={label} className="flex md:flex-col items-center gap-3">
              <span
                className={`inline-block font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wide border-[3px] border-billboard-ink rounded-lg px-3 py-2 text-center ${
                  i === 1 ? "bg-billboard-ink text-billboard-yellow" : "bg-billboard-paper shadow-blockSm"
                }`}
              >
                {label}
              </span>
              {i < chips.length - 1 && <span className="font-display text-xl md:rotate-90">↔</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
