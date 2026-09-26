import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePublishers } from "../hooks/usePublishers";
import PublisherCard from "../components/PublisherCard";
import { PublisherCardSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import LiveChannelTabs from "../components/LiveChannelTabs";
import RecentlyViewedStrip from "../components/RecentlyViewedStrip";
import Seo from "../components/Seo";
import ToolIcon from "../components/ToolIcon";
import type { Tool } from "../lib/types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

type HomeMetricsData = {
  verified_publishers: number;
  new_publishers_this_month: number;
  completed_bookings: number;
};

function HomeMetrics() {
  const { t } = useTranslation("home");
  const [metrics, setMetrics] = useState<HomeMetricsData | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.rpc("get_home_public_metrics").then(({ data }) => {
      if (data?.[0]) setMetrics(data[0] as HomeMetricsData);
    });
  }, []);

  const values = [
    { value: metrics?.verified_publishers ?? "—", label: t("metrics.verifiedPublishers") },
    { value: metrics?.new_publishers_this_month ?? "—", label: t("metrics.newPublishers") },
    { value: metrics?.completed_bookings ?? "—", label: t("metrics.completedBookings") },
  ];

  return (
    <section className="bg-white border-b-[3px] border-billboard-ink" aria-label={t("metrics.ariaLabel")}>
      <div className="max-w-6xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 border-[3px] border-billboard-ink rounded-lg bg-billboard-paper shadow-blockSm overflow-hidden">
          {values.map((item, index) => (
            <div
              key={item.label}
              className={`p-4 sm:p-5 text-center ${index < values.length - 1 ? "border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-billboard-ink" : ""}`}
            >
              <div className="font-display text-2xl md:text-3xl">{item.value}</div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  const { t } = useTranslation("home");
  const placements = t("heroMockup.placements", { returnObjects: true }) as {
    city: string; platform: string; audience: string; price: string; quote: string;
  }[];

  return (
    <div className="relative w-full max-w-[460px]">
      <div className="relative border-[3px] border-billboard-ink rounded-xl bg-billboard-paper shadow-block -rotate-[1deg] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-[3px] border-billboard-ink bg-white">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-billboard-inkSoft">{t("heroMockup.marketplaceLabel")}</div>
            <div className="font-display text-base mt-0.5">{t("heroMockup.liveNow")}</div>
          </div>
          <span className="font-mono text-[9px] font-bold uppercase bg-billboard-green text-white border-2 border-billboard-ink rounded-full px-2.5 py-1">
            {t("heroMockup.ready")}
          </span>
        </div>
        <div className="p-3 sm:p-4 space-y-2.5">
          {placements.map((p, i) => (
            <div key={i} className="border-2 border-billboard-ink rounded-lg bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block text-sm">{p.city}</strong>
                  <div className="font-mono text-[9px] text-billboard-inkSoft mt-1">{p.platform} · {p.audience}</div>
                </div>
                <span className="shrink-0 font-mono text-[9px] font-bold bg-billboard-yellow border-2 border-billboard-ink rounded-full px-2 py-0.5">
                  {t("heroMockup.verified")}
                </span>
              </div>
              <div className="flex items-end justify-between gap-2 mt-3">
                <div>
                  <div className="font-mono text-[8px] uppercase text-billboard-inkSoft">{t("heroMockup.price")}</div>
                  <div className="font-display text-xl leading-none mt-1">{p.price}</div>
                </div>
                <span className="text-[9px] text-billboard-inkSoft italic max-w-[48%] text-right">{p.quote}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t-2 border-billboard-ink/15 bg-billboard-paperDim flex items-center justify-between gap-3">
          <span className="font-mono text-[9px] uppercase tracking-wide text-billboard-inkSoft">Local inventory · verified supply</span>
          <span className="font-bold text-xs">Live →</span>
        </div>
      </div>
    </div>
  );
}

function PathwaysSection() {
  const { t } = useTranslation("home");
  const cards = [
    { key: "agency", to: "/build-my-campaign", number: "01" },
    { key: "marketplace", to: "/browse", number: "02" },
    { key: "network", to: "/for-publishers", number: "03" },
  ] as const;

  return (
    <section className="py-14 md:py-16 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mb-8">
          <span className="eyebrow">{t("layers.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3">{t("layers.title")}</h2>
          <p className="text-billboard-inkSoft">{t("layers.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Link
              key={card.key}
              to={card.to}
              className="group border-2 border-billboard-ink rounded-xl p-6 bg-billboard-paper hover:-translate-y-1 hover:shadow-blockSm transition flex flex-col min-h-[220px]"
            >
              <div className="flex items-center justify-between gap-3 mb-8">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider">{card.number} · {t(`layers.${card.key}Badge`)}</span>
                <span className="text-billboard-greenDeep font-bold">↗</span>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-2xl mb-2">{t(`layers.${card.key}Title`)}</h3>
                <p className="text-sm text-billboard-inkSoft leading-relaxed">{t(`layers.${card.key}Body`)}</p>
              </div>
              <span className="font-bold text-sm mt-5 group-hover:text-billboard-greenDeep transition-colors">{t(`layers.${card.key}Cta`)} →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketplaceSection({ publishers, loading }: { publishers: ReturnType<typeof usePublishers>["publishers"]; loading: boolean }) {
  const { t } = useTranslation("home");
  return (
    <section className="py-14 md:py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <RecentlyViewedStrip />
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mt-7 mb-8">
          <div className="max-w-2xl">
            <span className="eyebrow">{t("marketplace.badge")}</span>
            <h2 className="text-3xl md:text-5xl mb-3">{t("marketplace.title")}</h2>
            <p className="text-billboard-inkSoft">{t("marketplace.subtitle")}</p>
          </div>
          <Link to="/browse" className="font-bold text-sm underline underline-offset-4 shrink-0">{t("marketplace.cta")}</Link>
        </div>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <PublisherCardSkeleton key={i} />)}</div>
        ) : publishers.length === 0 ? (
          <div className="border-2 border-dashed border-billboard-ink rounded-xl bg-white"><EmptyState kind="list" title={t("marketplace.emptyTitle")} description={t("marketplace.emptyDescription")} compact /></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{publishers.slice(0, 4).map((p) => <PublisherCard key={p.id} publisher={p} />)}</div>
        )}
      </div>
    </section>
  );
}

function ChannelsSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-14 md:py-16 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mb-8">
          <span className="eyebrow">{t("channels.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3">{t("channels.title")}</h2>
          <p className="text-billboard-inkSoft">{t("channels.subtitle")}</p>
        </div>
        <LiveChannelTabs />
      </div>
    </section>
  );
}

function LocalSection() {
  const { t } = useTranslation("home");
  const items = ["associations", "suburbs", "design", "activeChannels"] as const;
  return (
    <section className="py-14 md:py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-8">
          <span className="eyebrow">{t("local.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3 max-w-3xl">{t("local.title")}</h2>
          <p className="text-billboard-inkSoft">{t("local.subtitle")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item} className="border-2 border-billboard-ink rounded-lg p-5 bg-white">
              <h3 className="font-display text-lg mb-2">{t(`local.items.${item}.title`)}</h3>
              <p className="text-sm text-billboard-inkSoft leading-relaxed">{t(`local.items.${item}.body`)}</p>
            </div>
          ))}
        </div>
        <Link to="/audience-finder" className="brand-button dark mt-7">{t("local.cta")}</Link>
      </div>
    </section>
  );
}

function ProofSection() {
  const { t } = useTranslation("home");
  const steps = [1, 2, 3, 4, 5, 6] as const;
  const trust = ["payment", "verified", "tracked"] as const;
  return (
    <section className="py-14 md:py-16 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-9">
          <span className="eyebrow light">{t("how.badge")}</span>
          <h2 className="font-display text-3xl md:text-5xl leading-tight mb-3">{t("how.title")}</h2>
          <p className="text-billboard-paperDim">{t("trust.subtitle")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map((step) => (
            <div key={step} className="border-2 border-white/20 rounded-lg p-5 bg-white/5">
              <span className="font-display text-3xl text-billboard-yellow">0{step}</span>
              <h3 className="font-display text-lg mt-3 mb-1">{t(`how.steps.${step}.title`)}</h3>
              <p className="text-sm text-billboard-paperDim leading-relaxed">{t(`how.steps.${step}.body`)}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-7">
          {trust.map((item) => (
            <div key={item} className="border-2 border-white/20 rounded-lg p-5">
              <h3 className="font-display text-lg mb-2">{t(`trust.${item}.title`)}</h3>
              <p className="text-sm text-billboard-paperDim leading-relaxed">{t(`trust.${item}.body`)}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link to="/how-it-works" className="brand-button light">{t("how.cta")}</Link>
          <Link to="/trust" className="font-bold text-sm text-billboard-yellow underline underline-offset-4 self-center">{t("trust.cta")}</Link>
        </div>
      </div>
    </section>
  );
}

function OpportunitiesSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-12 md:py-14 bg-billboard-yellow border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-3xl">
            <span className="eyebrow dark-bg">{t("opportunities.badge")}</span>
            <h2 className="font-display text-3xl md:text-4xl mb-2">{t("opportunities.title")}</h2>
            <p className="text-billboard-inkSoft">{t("opportunities.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link to="/opportunities" className="brand-button dark">{t("opportunities.primaryCta")}</Link>
            <Link to="/for-publishers" className="font-bold text-sm underline self-center">{t("opportunities.publisherCta")}</Link>
          </div>
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
    <section className="py-14 md:py-16 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <span className="eyebrow">{t("tools.badge")}</span>
        <h2 className="text-3xl md:text-5xl mb-3 max-w-2xl">{t("tools.title")}</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-8">{t("tools.subtitle")}</p>
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
        <Link to="/tools" className="brand-button mt-7">{t("tools.cta")}</Link>
      </div>
    </section>
  );
}

function PricingSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-14 md:py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-8">
          <span className="eyebrow">{t("pricing.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3">{t("pricing.title")}</h2>
          <p className="text-billboard-inkSoft">{t("pricing.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border-2 border-billboard-ink rounded-xl p-6 bg-white shadow-blockSm">
            <div className="font-mono text-[10px] font-bold uppercase">{t("pricing.businessLabel")}</div>
            <div className="font-display text-4xl mt-2">R399</div>
            <p className="font-bold mb-2">{t("pricing.onceOff")}</p>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.businessBody")}</p>
            <Link to="/register?role=business" className="brand-button dark">{t("pricing.businessCta")}</Link>
          </div>
          <div className="border-2 border-billboard-ink rounded-xl p-6 bg-billboard-yellow shadow-blockSm">
            <div className="font-mono text-[10px] font-bold uppercase">{t("pricing.publisherLabel")}</div>
            <div className="font-display text-4xl mt-2">R199</div>
            <p className="font-bold mb-2">{t("pricing.onceOff")}</p>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.publisherBody")}</p>
            <Link to="/register?role=publisher" className="brand-button dark">{t("pricing.publisherCta")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublisherCta() {
  const { t } = useTranslation("home");
  return (
    <section className="py-14 md:py-16 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-5xl mx-auto px-5 text-center">
        <span className="eyebrow">{t("publisherCta.badge")}</span>
        <h2 className="font-display text-3xl md:text-5xl mb-4">{t("publisherCta.title")}</h2>
        <p className="text-billboard-inkSoft max-w-2xl mx-auto mb-7">{t("publisherCta.subtitle")}</p>
        <Link to="/register?role=publisher" className="brand-button dark">{t("publisherCta.cta")}</Link>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation(["home", "common"]);
  const [loaded, setLoaded] = useState(false);
  const { publishers, loading } = usePublishers();

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setLoaded(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <Seo title={t("seo.title")} description={t("seo.description")} />
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink overflow-hidden py-12 sm:py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 grid md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-9 sm:gap-12 items-center">
          <div className="min-w-0">
            <span className={`eyebrow dark-bg transition-all duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}>{t("hero.badge")}</span>
            <h1 className={`text-4xl sm:text-5xl md:text-7xl leading-[.98] mb-5 transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              {t("hero.title1")}<br />{t("hero.title2")}
            </h1>
            <p className="text-lg md:text-xl text-billboard-inkSoft max-w-[50ch] mb-7 leading-relaxed">{t("hero.subtitle")}</p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link to="/build-my-campaign" className="brand-button dark">{t("hero.ctaBuildCampaign")}</Link>
              <Link to="/browse" className="brand-button">{t("hero.ctaBrowseMarketplace")}</Link>
            </div>
            <Link to="/for-publishers" className="inline-flex font-bold text-sm mt-4 underline underline-offset-4">{t("publisherCta.title")} →</Link>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 font-mono text-[10px] font-bold uppercase">
              <span>✓ {t("hero.noAccount")}</span>
              <span>✓ {t("hero.secure")}</span>
              <span>✓ {t("hero.tracked")}</span>
            </div>
          </div>
          <div className={`min-w-0 flex justify-center transition-all duration-700 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
            <HeroMockup />
          </div>
        </div>
      </section>
      <HomeMetrics />
      <PathwaysSection />
      <MarketplaceSection publishers={publishers} loading={loading} />
      <ChannelsSection />
      <LocalSection />
      <ProofSection />
      <OpportunitiesSection />
      <ToolsSection />
      <PricingSection />
      <PublisherCta />
      <section className="py-16 md:py-20 bg-billboard-green text-white border-b-[3px] border-billboard-ink">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h2 className="font-display text-4xl md:text-6xl leading-tight mb-5">{t("final.title")}</h2>
          <p className="text-white/80 max-w-xl mx-auto mb-8">{t("final.subtitle")}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/build-my-campaign" className="brand-button yellow">{t("final.build")}</Link>
            <Link to="/browse" className="brand-button light">{t("final.browse")}</Link>
          </div>
          <p className="font-mono text-[10px] uppercase mt-5 text-white/70">{t("final.closer")}</p>
        </div>
      </section>
    </>
  );
}
