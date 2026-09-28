import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MarketingIcon from "./MarketingIcon";
import { CAMPAIGN_GOAL_OPTIONS, CAMPAIGN_WIZARD_STEPS } from "../lib/campaignGoals";

/**
 * Compact message band that sits under the "Open opportunities" band and
 * hands visitors to /build-my-campaign. Goals and step labels come from
 * src/lib/campaignGoals.ts (the same source the wizard uses), and each goal
 * deep-links via the wizard's real `?goal=` parameter. No pricing here.
 */
export default function HomeCampaignCta() {
  const { t } = useTranslation("home");

  return (
    <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-10 md:py-14" aria-labelledby="campaign-cta-title">
      <div className="max-w-6xl mx-auto px-4 sm:px-5">
        <div className="border-[3px] border-billboard-ink rounded-2xl bg-billboard-paper shadow-block overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="p-6 sm:p-8 md:p-10 min-w-0 flex flex-col justify-center">
              <h2 id="campaign-cta-title" className="font-display text-3xl sm:text-4xl md:text-5xl leading-[.98] mb-4">
                {t("campaignCta.title1", { defaultValue: "Pick your goal." })}
                <br />
                <span className="inline-block bg-billboard-ink text-billboard-yellow px-3 pb-1 mt-2 -rotate-1 box-decoration-clone">
                  {t("campaignCta.title2", { defaultValue: "We'll build the campaign." })}
                </span>
              </h2>
              <p className="text-billboard-inkSoft text-base md:text-lg leading-relaxed max-w-[46ch] mb-6">
                {t("campaignCta.body", {
                  defaultValue:
                    "Tell us what you want to achieve, who you want to reach, your budget and when to run. ChatSched turns your brief into a schedule for your approval.",
                })}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Link to="/build-my-campaign" className="brand-button dark">
                  {t("campaignCta.cta", { defaultValue: "Build my campaign →" })}
                </Link>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft">
                  {t("campaignCta.note", { defaultValue: "Your progress saves as you go" })}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-white border-t-[3px] lg:border-t-0 lg:border-l-[3px] border-billboard-ink min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft mb-3">
                {t("campaignCta.startWith", { defaultValue: "Start with a goal" })}
              </p>
              <ul className="grid sm:grid-cols-2 gap-3">
                {CAMPAIGN_GOAL_OPTIONS.map((goal) => (
                  <li key={goal.id}>
                    <Link
                      to={`/build-my-campaign?goal=${goal.id}`}
                      className="group h-full flex flex-col gap-2 border-[3px] border-billboard-ink rounded-lg bg-billboard-paper p-4 transition hover:-translate-y-0.5 hover:shadow-blockSm hover:bg-billboard-yellow/25"
                    >
                      <span className="flex items-center justify-between">
                        <span className="inline-flex w-9 h-9 items-center justify-center rounded-md border-[3px] border-billboard-ink bg-billboard-yellow">
                          <MarketingIcon name={goal.icon} className="w-5 h-5" />
                        </span>
                        <span className="font-bold text-billboard-greenDeep transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
                      </span>
                      <strong className="text-sm leading-snug">{goal.title}</strong>
                      <span className="text-xs text-billboard-inkSoft leading-snug">{goal.focus}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ol className="flex items-center gap-x-4 gap-y-2 overflow-x-auto px-6 sm:px-8 py-3 border-t-[3px] border-billboard-ink bg-billboard-paperDim" aria-label={t("campaignCta.stepsLabel", { defaultValue: "Campaign builder steps" })}>
            {CAMPAIGN_WIZARD_STEPS.map((step) => (
              <li key={step.num} className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wide text-billboard-inkSoft">
                <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-billboard-ink text-billboard-yellow text-[10px]">{step.num}</span>
                {step.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
