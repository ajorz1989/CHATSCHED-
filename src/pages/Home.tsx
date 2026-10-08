import { useEffect, useState } from "react";
import { PREMIUM_ACCESS_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import ToolIcon from "../components/ToolIcon";
import { HeroTopBand } from "../components/HomeHeroBands";
import HomeOpenOpportunities from "../components/HomeOpenOpportunities";
import HomeInventoryWall from "../components/HomeInventoryWall";
import LazyLoopVideo from "../components/LazyLoopVideo";
import type { Tool } from "../lib/types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

function HeroMockup() {
  // 15 s loop, 1920x1080 (16:9), silent: every beat is carried by on-screen
  // text. The frame is a plain 16:9 box, so nothing is cropped; the video's
  // own safe zone is the central 70%.
  return (
    <div className="relative w-full">
      <div
        className="relative w-full overflow-hidden rounded-xl border-[3px] border-billboard-paper bg-billboard-paper shadow-[8px_8px_0_#F5B700]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <LazyLoopVideo
          webm="/media/chatsched-homepage-hero-1080p.webm"
          mp4="/media/chatsched-homepage-hero-1080p.mp4"
          mp4Small="/media/chatsched-homepage-hero-720p.mp4"
          poster="/media/chatsched-homepage-hero-poster.jpg"
        />
      </div>
    </div>
  );
}

function ProofSection() {
  const { t } = useTranslation("home");
  const steps = [1, 2, 3, 4, 5, 6] as const;
  const trust = ["payment", "verified", "tracked"] as const;
  return (
    <section className="py-16 md:py-24 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-9">
          <span className="eyebrow light">{t("how.badge")}</span>
          <h2 className="font-display text-3xl md:text-5xl leading-tight mb-3">{t("how.title")}</h2>
          <p className="text-billboard-paperDim max-w-prose">{t("trust.subtitle")}</p>
        </div>

        {/* Animated walkthrough: the six steps and three trust points, in motion. */}
        <div className="max-w-5xl mx-auto">
          <div
            className="relative w-full overflow-hidden rounded-xl border-[3px] border-billboard-paper bg-billboard-ink shadow-[8px_8px_0_#F5B700]"
            style={{ aspectRatio: "16 / 9" }}
          >
            <LazyLoopVideo
              webm="/media/chatsched-proof-workflow-1080p.webm"
              mp4="/media/chatsched-proof-workflow-1080p.mp4"
              mp4Small="/media/chatsched-proof-workflow-720p.mp4"
              poster="/media/chatsched-proof-workflow-poster.jpg"
            />
          </div>
        </div>

        {/* The video is decorative, so the same content stays available as text
            for screen readers and search engines. */}
        <div className="sr-only">
          <ol>
            {steps.map((step) => (
              <li key={step}>
                <h3>{t(`how.steps.${step}.title`)}</h3>
                <p>{t(`how.steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
          <ul>
            {trust.map((item) => (
              <li key={item}>
                <h3>{t(`trust.${item}.title`)}</h3>
                <p>{t(`trust.${item}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 mt-10 max-w-5xl mx-auto">
          <Link to="/how-it-works" data-cta="how-it-works" className="brand-button light">{t("how.cta")}</Link>
          <Link to="/trust" data-cta="how-trust" className="font-bold text-sm text-billboard-yellow underline underline-offset-4 self-center">{t("trust.cta")}</Link>
        </div>
      </div>
    </section>
  );
}

function ToolsSection() {
  const { t } = useTranslation("home");
  const [tools, setTools] = useState<Tool[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from("tools").select("*").eq("status", "active").order("featured", { ascending: false }).order("sort_order", { ascending: true }).limit(3)
      .then(({ data }) => setTools((data ?? []) as Tool[]));
  }, []);
  if (!isSupabaseConfigured || tools.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <span className="eyebrow">{t("tools.badge")}</span>
        <h2 className="text-3xl md:text-5xl mb-3 max-w-2xl">{t("tools.title")}</h2>
        <p className="text-billboard-inkSoft max-w-prose mb-8">{t("tools.subtitle")}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Link key={tool.slug} to={`/tools/${tool.slug}`} className="group border-2 border-billboard-ink rounded-lg p-5 bg-billboard-paperDim flex flex-col hover:-translate-y-1 hover:shadow-blockSm transition">
              <div className="mb-4"><ToolIcon name={tool.icon} size="sm" /></div>
              <h3 className="font-display text-lg mb-2">{tool.name}</h3>
              <p className="text-sm text-billboard-inkSoft mb-4 flex-1">{tool.short_description}</p>
              <span className="font-bold text-sm">{tool.cta_label} →</span>
            </Link>
          ))}
        </div>
        <Link to="/tools" data-cta="tools-all" className="brand-button mt-7">{t("tools.cta")}</Link>
      </div>
    </section>
  );
}

function PricingSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 md:py-24 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-8">
          <span className="eyebrow">{t("pricing.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3">{t("pricing.title")}</h2>
          <p className="text-billboard-inkSoft max-w-prose">{t("pricing.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border-2 border-billboard-ink rounded-xl p-6 bg-white shadow-blockSm">
            <div className="font-mono text-[11px] font-bold uppercase">{t("pricing.businessLabel")}</div>
            <div className="font-display text-4xl mt-2 mb-2">{formatCurrency(0)}</div>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.businessBody")}</p>
            <Link to="/register?role=business" data-cta="pricing-business" className="brand-button dark">{t("pricing.businessCta")}</Link>
          </div>
          <div className="border-2 border-billboard-ink rounded-xl p-6 bg-billboard-yellow shadow-blockSm">
            <div className="font-mono text-[11px] font-bold uppercase">{t("pricing.publisherLabel")}</div>
            <div className="font-display text-4xl mt-2">{formatCurrency(PREMIUM_ACCESS_PRICE)}</div>
            <p className="font-bold mb-2">{t("pricing.onceOff")}</p>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.publisherBody")}</p>
            <Link to="/register" data-cta="pricing-publisher" className="brand-button dark">{t("pricing.publisherCta")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation(["home", "common"]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setLoaded(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <Seo title={t("seo.title")} description={t("seo.description")} />
      {/* Marketplace inventory leads the page; the hero and everything below are unchanged. */}
      <HomeInventoryWall />
      {/* Hero and video are one continuous black section. Section order alternates yellow / black / white / black / grey / black / green. */}
      <HeroTopBand loaded={loaded}>
        <div className={`max-w-3xl mx-auto px-4 sm:px-5 flex justify-center transition-all duration-700 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <HeroMockup />
        </div>
      </HeroTopBand>
      <ToolsSection />
      <ProofSection />
      <PricingSection />
      <HomeOpenOpportunities />
      <section className="py-16 md:py-24 bg-billboard-green text-white border-b-[3px] border-billboard-ink">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h2 className="font-display text-4xl md:text-6xl leading-tight mb-5">{t("final.title")}</h2>
          <p className="text-white/90 max-w-prose mx-auto mb-8">{t("final.subtitle")}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/build-my-campaign" data-cta="final-build" className="brand-button yellow">{t("final.build")}</Link>
            <Link to="/browse" data-cta="final-browse" className="brand-button light">{t("final.browse")}</Link>
          </div>
          <p className="font-mono text-[11px] uppercase mt-5 text-white/90">{t("final.closer")}</p>
        </div>
      </section>
    </>
  );
}
