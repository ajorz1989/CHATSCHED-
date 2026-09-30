import { useEffect, useRef, useState } from "react";
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
import { HeroTopBand } from "../components/HomeHeroBands";
import HomeOpenOpportunities from "../components/HomeOpenOpportunities";
import type { Tool } from "../lib/types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

function HomeMetrics() {
  const values = [
    { value: "11", label: "Advertising channels" },
    { value: "1", label: "Managed campaign workflow" },
    { value: "100%", label: "Payment-protected bookings" },
  ];

  return (
    <section className="bg-white border-b-[3px] border-billboard-ink" aria-label="ChatSched advertising value">
      <div className="max-w-6xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 border-[3px] border-billboard-ink rounded-lg bg-billboard-paper shadow-blockSm overflow-hidden">
          {values.map((item, index) => (
            <div
              key={item.label}
              className={`p-4 sm:p-5 text-center ${index < values.length - 1 ? "border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-billboard-ink" : ""}`}
            >
              <div className="font-display text-2xl md:text-3xl">{item.value}</div>
              <div className="font-mono text-[11px] uppercase tracking-wide text-billboard-inkSoft mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  // 15 s loop, 1920x1080 (16:9), silent: every beat is carried by on-screen
  // text, so it autoplays muted. The frame is a plain 16:9 box, so nothing is
  // cropped; the video's own safe zone is the central 70%.
  //
  // Loading: only the poster downloads up front. Playback starts when the
  // video nears the viewport and pauses when it leaves. Visitors who prefer
  // reduced motion stay on the poster. Phones get the 720p file.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [small] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => undefined);
        else video.pause();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative w-full">
      <div
        className="relative w-full overflow-hidden rounded-xl border-[3px] border-billboard-ink bg-billboard-paper shadow-block"
        style={{ aspectRatio: "16 / 9" }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 block w-full h-full object-cover pointer-events-none"
          width={1920}
          height={1080}
          poster="/media/chatsched-homepage-hero-poster.jpg"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        >
          {small ? (
            <source src="/media/chatsched-homepage-hero-720p.mp4" type="video/mp4" />
          ) : (
            <>
              <source src="/media/chatsched-homepage-hero-1080p.webm" type="video/webm" />
              <source src="/media/chatsched-homepage-hero-1080p.mp4" type="video/mp4" />
            </>
          )}
        </video>
      </div>
    </div>
  );
}

function ChannelsMarketplaceSection({ publishers, loading }: { publishers: ReturnType<typeof usePublishers>["publishers"]; loading: boolean }) {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 md:py-24 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mb-8">
          <span className="eyebrow">{t("channels.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3">{t("channels.title")}</h2>
          <p className="text-billboard-inkSoft max-w-prose">{t("channels.subtitle")}</p>
        </div>
        <LiveChannelTabs />

        <div className="mt-14">
          <RecentlyViewedStrip />
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div className="max-w-2xl">
              <span className="eyebrow">{t("marketplace.badge")}</span>
              <h3 className="font-display text-2xl md:text-3xl leading-tight mb-2">{t("marketplace.title")}</h3>
              <p className="text-billboard-inkSoft max-w-prose">{t("marketplace.subtitle")}</p>
            </div>
            <Link to="/browse" data-cta="channels-browse" className="font-bold text-sm underline underline-offset-4 shrink-0">{t("marketplace.cta")}</Link>
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <PublisherCardSkeleton key={i} />)}</div>
          ) : publishers.length === 0 ? (
            <div className="border-2 border-dashed border-billboard-ink rounded-xl bg-white"><EmptyState kind="list" title={t("marketplace.emptyTitle")} description={t("marketplace.emptyDescription")} compact /></div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{publishers.slice(0, 4).map((p) => <PublisherCard key={p.id} publisher={p} />)}</div>
          )}
        </div>

        <div className="mt-12 flex flex-col md:flex-row md:items-center md:justify-between gap-5 border-[3px] border-billboard-ink rounded-xl bg-white p-6 shadow-blockSm">
          <div className="max-w-2xl">
            <h3 className="font-display text-xl md:text-2xl leading-tight mb-2">{t("local.title")}</h3>
            <p className="text-sm text-billboard-inkSoft max-w-prose">{t("local.subtitle")}</p>
          </div>
          <Link to="/audience-finder" data-cta="channels-audience-finder" className="brand-button dark shrink-0">{t("local.cta")}</Link>
        </div>
      </div>
    </section>
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
            <div className="font-display text-4xl mt-2">R399</div>
            <p className="font-bold mb-2">{t("pricing.onceOff")}</p>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.businessBody")}</p>
            <Link to="/register?role=business" data-cta="pricing-business" className="brand-button dark">{t("pricing.businessCta")}</Link>
          </div>
          <div className="border-2 border-billboard-ink rounded-xl p-6 bg-billboard-yellow shadow-blockSm">
            <div className="font-mono text-[11px] font-bold uppercase">{t("pricing.publisherLabel")}</div>
            <div className="font-display text-4xl mt-2">R199</div>
            <p className="font-bold mb-2">{t("pricing.onceOff")}</p>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.publisherBody")}</p>
            <Link to="/register?role=publisher" data-cta="pricing-publisher" className="brand-button dark">{t("pricing.publisherCta")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublisherCta() {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 md:py-24 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-5xl mx-auto px-5 text-center">
        <span className="eyebrow">{t("publisherCta.badge")}</span>
        <h2 className="font-display text-3xl md:text-5xl mb-4">{t("publisherCta.title")}</h2>
        <p className="text-billboard-inkSoft max-w-prose mx-auto mb-7">{t("publisherCta.subtitle")}</p>
        <Link to="/register?role=publisher" data-cta="publisher-band" className="brand-button dark">{t("publisherCta.cta")}</Link>
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
      {/* Hero and video are one continuous yellow section. */}
      <HeroTopBand loaded={loaded}>
        <div className={`max-w-3xl mx-auto px-4 sm:px-5 flex justify-center transition-all duration-700 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <HeroMockup />
        </div>
      </HeroTopBand>
      <HomeMetrics />
      <HomeOpenOpportunities />
      <ChannelsMarketplaceSection publishers={publishers} loading={loading} />
      <ProofSection />
      <ToolsSection />
      <PricingSection />
      <PublisherCta />
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
