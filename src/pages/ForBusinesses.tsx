import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";
import { getAllChannels } from "../lib/channelRegistry";
import { isChannelEnabled } from "../lib/featureFlags";
import {
  CREATOR_APPROVAL_WINDOW_DAYS,
  BUSINESS_PAYMENT_WINDOW_DAYS,
  CREATOR_PAYOUT_WINDOW_HOURS,
} from "../lib/constants";

// Step numbers are cosmetic (a "01 \u2192 04" mini-display, not natural
// language) so they stay in code rather than in forBusinesses.json \u2014
// the step title/body text is what's translated.
const STEP_NUMBERS = ["01", "02", "03", "04"];

interface Step { title: string; body: string }
interface ToolItem { name: string; body: string }
interface ComparisonRow { us: string; them: string }
interface FaqItem { q: string; a: string }

export default function ForBusinesses() {
  const { t } = useTranslation("forBusinesses");
  const steps = t("howItWorks.steps", { returnObjects: true }) as Step[];
  const tools = t("tools.items", { returnObjects: true }) as ToolItem[];
  const comparisonRows = t("comparison.rows", { returnObjects: true }) as ComparisonRow[];
  const faqs = t("faq.items", { returnObjects: true }) as FaqItem[];

  return (
    <div>
      <Seo
        title={t("seo.title")}
        description={t("seo.description")}
      />

      {/* HERO */}
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-billboard-ink" />
            {t("hero.badge")}
          </span>
          <h1 className="text-4xl md:text-6xl leading-[1.05] mb-5 max-w-3xl">
            {t("hero.title")}
          </h1>
          <p className="text-lg text-billboard-inkSoft max-w-[56ch] mb-8">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-wrap gap-3.5">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition"
            >
              {t("hero.ctaBrowse")}
            </Link>
            <Link
              to="/register?role=business"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-paper font-bold px-5 py-3 rounded hover:-translate-x-0.5 hover:-translate-y-0.5 transition"
            >
              {t("hero.ctaRegister")}
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-5">
          {/* Bug fix: was border-billboard-red text-billboard-red */}
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-3">
            {t("howItWorks.badge")}
          </span>
          <h2 className="text-3xl md:text-4xl mb-10 max-w-xl">{t("howItWorks.title")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((s, i) => (
              <div
                key={STEP_NUMBERS[i]}
                className="border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-blockSm"
              >
                <div
                  className="font-display text-2xl text-billboard-yellowDeep mb-2"
                  style={{ WebkitTextStroke: "1.5px #1A1712" }}
                >
                  {STEP_NUMBERS[i]}
                </div>
                <h3 className="font-bold mb-1.5">{s.title}</h3>
                <p className="text-sm text-billboard-inkSoft">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link
              to="/how-payment-works"
              className="inline-flex items-center gap-2 font-semibold underline text-billboard-inkSoft hover:text-billboard-ink"
            >
              {t("howItWorks.escrowLink")}
            </Link>
          </div>
        </div>
      </section>

      {/* CHANNELS */}
      <section className="py-16 bg-billboard-paperDim border-y-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          {/* Bug fix: was border-billboard-red text-billboard-red */}
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-3">
            {t("channels.badge")}
          </span>
          <h2 className="text-3xl md:text-4xl mb-3 max-w-xl">{t("channels.title")}</h2>
          <p className="text-billboard-inkSoft max-w-xl mb-10">{t("channels.subtitle")}</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {getAllChannels().map((m) => (
              <Link
                key={m.definition.slug}
                to={`/channels/${m.definition.slug}`}
                className="block border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-blockSm"
              >
                <div className="mb-3"><ChannelIcon slug={m.definition.slug} /></div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm mb-1">{m.definition.name}</h3>
                  <span className={`shrink-0 border px-1.5 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide ${
                    isChannelEnabled(m.definition.slug)
                      ? "border-billboard-greenDeep/40 text-billboard-greenDeep bg-billboard-green/10"
                      : "border-billboard-inkSoft/40 text-billboard-inkSoft bg-billboard-paperDim"
                  }`}>
                    {isChannelEnabled(m.definition.slug) ? "Live" : "Coming soon"}
                  </span>
                </div>
                <p className="text-xs text-billboard-inkSoft">{m.definition.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDIES */}
      {/* Bug fix: raw \\n escape characters were present in this section from a template paste */}
      <section className="py-16 bg-white border-t-[3px] border-billboard-ink">
        <div className="max-w-5xl mx-auto px-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              {/* Bug fix: was border-billboard-red text-billboard-red */}
              <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-3">
                Case studies
              </span>
              <h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">
                See how multi-channel campaigns are structured.
              </h2>
              <p className="text-billboard-inkSoft max-w-2xl">
                Explore operational walkthroughs covering product launches, retail promotions,
                events, lead generation, community reach and sports sponsorships.
              </p>
            </div>
            <Link
              to="/case-studies"
              className="inline-flex items-center gap-2 shrink-0 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
            >
              Read case studies \u2192
            </Link>
          </div>
        </div>
      </section>

      {/* MARKETING SUITE TEASER */}
      {/* Bug fix: was border-b-[3px] border-billboard-ink on a bg-billboard-ink section \u2014 border was invisible */}
      <section className="py-16 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-yellow">
        <div className="max-w-5xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-yellow text-billboard-yellow px-3 py-1.5 rounded mb-3">
            {t("tools.badge")}
          </span>
          <h2 className="text-3xl md:text-4xl mb-3 max-w-xl">{t("tools.title")}</h2>
          <p className="text-billboard-paperDim max-w-xl mb-10">{t("tools.subtitle")}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool, i) => (
              <div key={i} className="border-2 border-[#3A342B] rounded p-4 bg-[#211D17]">
                <h3 className="font-bold text-sm mb-1 text-billboard-paper">{tool.name}</h3>
                <p className="text-xs text-billboard-paperDim">{tool.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-5">
          {/* Bug fix: was border-billboard-red text-billboard-red */}
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-3">
            {t("comparison.badge")}
          </span>
          <h2 className="text-3xl md:text-4xl mb-8 max-w-xl">{t("comparison.title")}</h2>
          <div className="border-[3px] border-billboard-ink rounded-lg overflow-hidden">
            <div className="grid grid-cols-2">
              <div className="bg-billboard-green text-white font-display text-sm md:text-base px-4 py-3 text-center">
                {t("comparison.colUs")}
              </div>
              <div className="bg-billboard-inkSoft text-white font-display text-sm md:text-base px-4 py-3 text-center border-l-[3px] border-billboard-ink">
                {t("comparison.colThem")}
              </div>
            </div>
            {comparisonRows.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-2 ${
                  i !== comparisonRows.length - 1 ? "border-b-2 border-billboard-ink/15" : ""
                }`}
              >
                <div className="p-4 md:p-5 text-sm flex items-start gap-2.5 transition-colors hover:bg-billboard-green/5">
                  <span aria-hidden="true" className="text-billboard-green mt-0.5 shrink-0">{String.fromCharCode(0x2713)}</span>
                  <span>{row.us}</span>
                </div>
                <div className="p-4 md:p-5 text-sm flex items-start gap-2.5 border-l-2 border-billboard-ink/15 text-billboard-inkSoft transition-colors hover:bg-billboard-red/5">
                  <span aria-hidden="true" className="text-billboard-red mt-0.5 shrink-0">{String.fromCharCode(0x2715)}</span>
                  <span>{row.them}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAYMENT FLOW STRIP */}
      <section className="py-16 bg-billboard-paperDim border-y-[3px] border-billboard-ink">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="text-sm font-semibold mb-1">{t("escrowStrip.title")}</p>
          <p className="text-billboard-inkSoft max-w-2xl mx-auto text-sm">
            {t("escrowStrip.body", { hours: CREATOR_PAYOUT_WINDOW_HOURS })}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="font-display text-xl mb-8 text-center">{t("faq.title")}</h2>
        <div className="border-[3px] border-billboard-ink rounded-lg bg-white overflow-hidden">
          {faqs.map((f, i) => (
            <div key={i} className={i !== faqs.length - 1 ? "border-b-2 border-billboard-ink" : ""}>
              <details className="group">
                <summary className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-billboard-paperDim transition-colors cursor-pointer list-none font-bold text-sm">
                  {f.q}
                  <span className="font-display text-lg shrink-0 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-4 text-sm text-billboard-inkSoft">
                  {i === 2
                    ? t("faq.items.2.a", { days: BUSINESS_PAYMENT_WINDOW_DAYS })
                    : i === 3
                      ? t("faq.items.3.a", { days: CREATOR_APPROVAL_WINDOW_DAYS })
                      : f.a}
                </p>
              </details>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 bg-billboard-green border-t-[3px] border-billboard-ink text-center">
        <div className="max-w-2xl mx-auto px-5">
          <h2 className="font-display text-2xl md:text-3xl text-white mb-4">
            {t("finalCta.title")}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-white font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
            >
              {t("finalCta.ctaBrowse")}
            </Link>
            <Link
              to="/register?role=business"
              className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
            >
              {t("finalCta.ctaRegister")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
