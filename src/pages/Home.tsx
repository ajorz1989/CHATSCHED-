import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePublishers } from "../hooks/usePublishers";
import PublisherCard from "../components/PublisherCard";
import { PublisherCardSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { useReveal } from "../hooks/useReveal";
import LiveChannelTabs from "../components/LiveChannelTabs";
import RecentlyViewedStrip from "../components/RecentlyViewedStrip";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import ToolIcon from "../components/ToolIcon";
import type { Tool } from "../lib/types";

function HomeMetrics() {
  const { t } = useTranslation("home");
  const [metrics, setMetrics] = useState<{ businesses: number; publishers: number; paid_out_zar: number } | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.rpc("get_home_public_metrics").then(({ data }) => {
      if (data?.[0]) setMetrics(data[0]);
    });
  }, []);
  const money = metrics ? new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(metrics.paid_out_zar) : "—";
  return (
    <section className="bg-white border-b-[3px] border-billboard-ink" aria-label={t("metrics.ariaLabel")}>
      <div className="max-w-6xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 border-[3px] border-billboard-ink rounded bg-billboard-paper shadow-blockSm overflow-hidden">
          <div className="p-4 text-center border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-billboard-ink"><div className="font-display text-2xl">{metrics?.businesses ?? "—"}</div><div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">{t("metrics.businesses")}</div></div>
          <div className="p-4 text-center border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-billboard-ink"><div className="font-display text-2xl">{money}</div><div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">{t("metrics.paidOut")}</div></div>
          <div className="p-4 text-center"><div className="font-display text-2xl">9</div><div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">{t("metrics.provinces")}</div></div>
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
    <div className="relative w-full max-w-[430px]">
      <div className="relative w-full aspect-[16/12] bg-billboard-paper border-[3px] border-billboard-ink rounded shadow-block -rotate-[1deg] overflow-hidden p-4 sm:p-5">
        <span className="absolute top-3 right-3 bg-billboard-red text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded border-2 border-billboard-ink rotate-2">{t("heroMockup.liveNow")}</span>
        <div className="h-full flex flex-col justify-center gap-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">{t("heroMockup.marketplaceLabel")}</div>
          <div className="flex flex-col gap-2">
            {placements.map((p, i) => (
              <div key={i} className="border-2 border-billboard-ink rounded p-2.5 bg-white">
                <div className="flex items-start justify-between gap-2 mb-1.5 min-w-0"><strong className="min-w-0 break-words text-sm">{p.city}</strong><span className="shrink-0 font-mono text-[9px] font-bold bg-billboard-yellow border-2 border-billboard-ink rounded-full px-2 py-0.5">{t("heroMockup.verified")}</span></div>
                <div className="flex flex-wrap gap-1.5 font-mono text-[9px] text-billboard-inkSoft mb-1.5"><span>{p.platform}</span><span>•</span><span>{p.audience}</span><span>•</span><span>{p.city}</span></div>
                <div className="flex items-end justify-between gap-2">
                  <div><div className="font-mono text-[8px] uppercase text-billboard-inkSoft">{t("heroMockup.price")}</div><div className="font-display text-lg leading-none">{p.price}</div></div>
                  <span className="font-mono text-[8px] font-bold text-billboard-green uppercase">● {t("heroMockup.ready")}</span>
                </div>
                <p className="text-[9px] text-billboard-inkSoft border-l-2 border-billboard-yellow pl-1.5 mt-1.5 italic">{p.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TwoWaysSection() {
  const { t } = useTranslation("home");
  const reveal = useReveal<HTMLDivElement>();
  return <section className="py-16 bg-white border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-4 sm:px-5 min-w-0" ref={reveal.ref}><div className={reveal.className}>
    <span className="eyebrow">{t("twoWays.badge")}</span><h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("twoWays.title")}</h2><p className="text-billboard-inkSoft max-w-2xl mb-9">{t("twoWays.subtitle")}</p>
    <div className="grid md:grid-cols-2 gap-5">
      <div className="border-[3px] border-billboard-ink rounded-lg p-7 bg-billboard-yellow shadow-blockSm"><span className="font-mono text-xs font-bold uppercase">01 · {t("twoWays.agencyBadge")}</span><h3 className="font-display text-2xl mt-3 mb-2">{t("twoWays.agencyTitle")}</h3><p className="text-sm text-billboard-inkSoft mb-5">{t("twoWays.agencyBody")}</p><Link to="/build-my-campaign" className="brand-button dark">{t("twoWays.agencyCta")}</Link></div>
      <div className="border-[3px] border-billboard-ink rounded-lg p-7 bg-billboard-paper shadow-blockSm"><span className="font-mono text-xs font-bold uppercase">02 · {t("twoWays.marketplaceBadge")}</span><h3 className="font-display text-2xl mt-3 mb-2">{t("twoWays.marketplaceTitle")}</h3><p className="text-sm text-billboard-inkSoft mb-5">{t("twoWays.marketplaceBody")}</p><Link to="/browse" className="brand-button">{t("twoWays.marketplaceCta")}</Link></div>
    </div>
  </div></div></section>;
}

function ComparisonSection() {
  const { t } = useTranslation("home");
  const reveal = useReveal<HTMLDivElement>();
  const rows = ["account", "auction", "audience", "workflow", "proof"] as const;
  return <section className="py-16 bg-billboard-green border-b-[3px] border-billboard-ink text-white"><div className="max-w-6xl mx-auto px-5" ref={reveal.ref}><div className={reveal.className}>
    <div className="max-w-3xl mb-9"><span className="eyebrow light">{t("comparison.badge")}</span><h2 className="font-display text-3xl md:text-5xl leading-tight mb-4">{t("comparison.title")}</h2><p className="text-white/80 max-w-2xl">{t("comparison.subtitle")}</p></div>
    <div className="overflow-x-auto border-[3px] border-billboard-ink rounded-lg bg-white text-billboard-ink shadow-block"><div className="min-w-[720px]"><div className="grid grid-cols-[1fr_1fr_1fr] font-mono text-[10px] uppercase font-bold"><div className="p-4 bg-billboard-paperDim border-r-[3px] border-billboard-ink">{t("comparison.platforms")}</div><div className="p-4 bg-billboard-paperDim border-r-[3px] border-billboard-ink">{t("comparison.traditional")}</div><div className="p-4 bg-billboard-yellow border-b-[3px] border-billboard-ink">{t("comparison.chatsched")}</div></div>{rows.map((r) => <div key={r} className="grid grid-cols-[1fr_1fr_1fr] border-b-2 border-billboard-ink/20 last:border-b-0"><div className="p-3.5 font-bold text-sm border-r-2 border-billboard-ink/20">{t(`comparison.rows.${r}.label`)}</div><div className="p-3.5 text-sm border-r-2 border-billboard-ink/20">{t(`comparison.rows.${r}.traditional`)}</div><div className="p-3.5 text-sm font-semibold bg-billboard-yellow/25">{t(`comparison.rows.${r}.chatsched`)}</div></div>)}</div></div>
    <p className="font-display text-xl md:text-2xl mt-8">{t("comparison.closer")}</p>
  </div></div></section>;
}

function MarketplaceSection({ publishers, loading }: { publishers: ReturnType<typeof usePublishers>["publishers"]; loading: boolean }) {
  const { t } = useTranslation("home");
  return <section className="py-16 bg-white border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5"><RecentlyViewedStrip /><div className="mt-8 mb-9"><span className="eyebrow">{t("marketplace.badge")}</span><h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("marketplace.title")}</h2><p className="text-billboard-inkSoft max-w-2xl">{t("marketplace.subtitle")}</p></div>{loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{[0,1,2,3].map(i=><PublisherCardSkeleton key={i}/>)}</div> : publishers.length === 0 ? <div className="border-[3px] border-dashed border-billboard-ink rounded"><EmptyState kind="list" title={t("marketplace.emptyTitle")} description={t("marketplace.emptyDescription")} compact /></div> : <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{publishers.slice(0,4).map(p=><PublisherCard key={p.id} publisher={p}/>)}</div>}<div className="text-center mt-9"><Link to="/browse" className="brand-button">{t("marketplace.cta")}</Link></div></div></section>;
}

function ChannelsSection() {
  const { t } = useTranslation("home");
  return <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5"><span className="eyebrow">{t("channels.badge")}</span><h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("channels.title")}</h2><p className="text-billboard-inkSoft max-w-2xl mb-9">{t("channels.subtitle")}</p><LiveChannelTabs/></div></section>;
}

function OpportunitiesSection() {
  const { t } = useTranslation("home");
  const reveal = useReveal<HTMLDivElement>();
  return (
    <section className="py-16 md:py-20 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-yellow">
      <div className="max-w-6xl mx-auto px-5" ref={reveal.ref}>
        <div className={reveal.className}>
          <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8 sm:gap-10 items-center">
            <div>
              <span className="eyebrow light">{t("opportunities.badge")}</span>
              <h2 className="font-display text-4xl md:text-6xl leading-[1.02] mb-5">{t("opportunities.title")}</h2>
              <p className="text-billboard-paperDim text-lg max-w-2xl leading-relaxed mb-7">{t("opportunities.subtitle")}</p>
              <div className="flex flex-wrap gap-3">
                <Link to="/opportunities" className="brand-button yellow">{t("opportunities.primaryCta")}</Link>
                <Link to="/for-publishers" className="brand-button light">{t("opportunities.publisherCta")}</Link>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border-[3px] border-billboard-yellow rounded-lg p-6 bg-white/5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-yellow mb-2">{t("opportunities.businessBadge")}</div>
                <h3 className="font-display text-xl mb-2">{t("opportunities.businessTitle")}</h3>
                <p className="text-sm text-billboard-paperDim">{t("opportunities.businessBody")}</p>
              </div>
              <div className="border-[3px] border-white/30 rounded-lg p-6 bg-white/5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-yellow mb-2">{t("opportunities.publisherBadge")}</div>
                <h3 className="font-display text-xl mb-2">{t("opportunities.publisherTitle")}</h3>
                <p className="text-sm text-billboard-paperDim">{t("opportunities.publisherBody")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LocalSection() {
  const { t } = useTranslation("home");
  const reveal = useReveal<HTMLDivElement>();
  const items = ["associations", "suburbs", "design", "activeChannels"] as const;
  return <section className="py-16 bg-white border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5" ref={reveal.ref}><div className={reveal.className}><span className="eyebrow">{t("local.badge")}</span><h2 className="text-3xl md:text-5xl mb-3 max-w-3xl">{t("local.title")}</h2><p className="text-billboard-inkSoft max-w-2xl mb-9">{t("local.subtitle")}</p><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{items.map(i=><div key={i} className="border-[3px] border-billboard-ink rounded-lg p-5 bg-billboard-paperDim hover:-translate-y-1 hover:shadow-blockSm transition"><h3 className="font-display text-lg mb-2">{t(`local.items.${i}.title`)}</h3><p className="text-sm text-billboard-inkSoft">{t(`local.items.${i}.body`)}</p></div>)}</div><div className="mt-8"><Link to="/audience-finder" className="brand-button dark">{t("local.cta")}</Link></div></div></div></section>;
}

function LayersSection() {
  const { t } = useTranslation("home");
  const reveal = useReveal<HTMLDivElement>();
  const layers = [["agency","/build-my-campaign"],["marketplace","/browse"],["network","/for-publishers"]] as const;
  return <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5" ref={reveal.ref}><div className={reveal.className}><span className="eyebrow">{t("layers.badge")}</span><h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("layers.title")}</h2><p className="text-billboard-inkSoft max-w-2xl mb-9">{t("layers.subtitle")}</p><div className="grid md:grid-cols-3 gap-5">{layers.map(([key,to],i)=><div key={key} className="border-[3px] border-billboard-ink rounded-lg p-6 bg-white flex flex-col shadow-blockSm"><span className="font-mono text-xs font-bold uppercase mb-4">0{i+1} · {t(`layers.${key}Badge`)}</span><h3 className="font-display text-xl mb-2">{t(`layers.${key}Title`)}</h3><p className="text-sm text-billboard-inkSoft mb-6 flex-1">{t(`layers.${key}Body`)}</p><Link to={to} className="font-bold text-sm">{t(`layers.${key}Cta`)} →</Link></div>)}</div></div></div></section>;
}

function HowSection() {
  const { t } = useTranslation("home");
  return <section className="py-16 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5"><span className="eyebrow light">{t("how.badge")}</span><h2 className="text-3xl md:text-4xl mb-9 max-w-2xl">{t("how.title")}</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(n=><div key={n} className="border-2 border-white/20 rounded-lg p-5 bg-white/5"><span className="font-display text-3xl text-billboard-yellow">0{n}</span><h3 className="font-display text-lg mt-3 mb-1">{t(`how.steps.${n}.title`)}</h3><p className="text-sm text-billboard-paperDim">{t(`how.steps.${n}.body`)}</p></div>)}</div><p className="font-display text-xl mt-9 text-billboard-yellow">{t("how.closer")}</p><Link to="/how-it-works" className="brand-button light mt-6">{t("how.cta")}</Link></div></section>;
}

function TrustSection() {
  const { t } = useTranslation("home");
  return <section className="py-16 bg-white border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5"><div className="max-w-3xl mb-9"><span className="eyebrow">{t("trust.badge")}</span><h2 className="text-3xl md:text-4xl mb-3">{t("trust.title")}</h2><p className="text-billboard-inkSoft">{t("trust.subtitle")}</p></div><div className="grid md:grid-cols-3 gap-5">{["payment","verified","tracked"].map(k=><div key={k} className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-paperDim"><h3 className="font-display text-xl mb-2">{t(`trust.${k}.title`)}</h3><p className="text-sm text-billboard-inkSoft">{t(`trust.${k}.body`)}</p></div>)}</div><div className="mt-8"><Link to="/trust" className="font-bold underline">{t("trust.cta")}</Link></div></div></section>;
}

function ToolsSection() {
  const { t } = useTranslation("home");
  const [tools, setTools] = useState<Tool[]>([]);
  useEffect(() => { if (!isSupabaseConfigured) return; supabase.from("tools").select("*").eq("status","active").order("featured",{ascending:false}).order("sort_order",{ascending:true}).limit(3).then(({data})=>setTools((data??[]) as Tool[])); }, []);
  if (!isSupabaseConfigured || tools.length === 0) return null;
  return <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5"><span className="eyebrow">{t("tools.badge")}</span><h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("tools.title")}</h2><p className="text-billboard-inkSoft max-w-2xl mb-9">{t("tools.subtitle")}</p><div className="grid md:grid-cols-3 gap-5">{tools.map(tool=><Link key={tool.slug} to={`/tools/${tool.slug}`} className="group border-[3px] border-billboard-ink rounded-lg p-6 bg-white flex flex-col hover:-translate-y-1 hover:shadow-block transition"><div className="mb-4"><ToolIcon name={tool.icon} size="sm"/></div><h3 className="font-display text-lg mb-2">{tool.name}</h3><p className="text-sm text-billboard-inkSoft mb-4 flex-1">{tool.short_description}</p><span className="font-bold text-sm">{tool.cta_label} →</span></Link>)}</div><div className="mt-8"><Link to="/tools" className="brand-button">{t("tools.cta")}</Link></div></div></section>;
}

function PricingSection() {
  const { t } = useTranslation("home");
  return <section className="py-16 bg-billboard-yellow border-b-[3px] border-billboard-ink"><div className="max-w-6xl mx-auto px-5"><div className="max-w-3xl mb-9"><span className="eyebrow">{t("pricing.badge")}</span><h2 className="text-3xl md:text-5xl mb-3">{t("pricing.title")}</h2><p className="text-billboard-inkSoft">{t("pricing.subtitle")}</p></div><div className="grid md:grid-cols-2 gap-5"><div className="border-[3px] border-billboard-ink rounded-lg p-7 bg-white shadow-block"><div className="font-mono text-xs font-bold uppercase">{t("pricing.businessLabel")}</div><div className="font-display text-4xl mt-2">R399</div><p className="font-bold mb-2">{t("pricing.onceOff")}</p><p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.businessBody")}</p><Link to="/register?role=business" className="brand-button dark">{t("pricing.businessCta")}</Link></div><div className="border-[3px] border-billboard-ink rounded-lg p-7 bg-billboard-paper shadow-block"><div className="font-mono text-xs font-bold uppercase">{t("pricing.publisherLabel")}</div><div className="font-display text-4xl mt-2">R199</div><p className="font-bold mb-2">{t("pricing.onceOff")}</p><p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.publisherBody")}</p><Link to="/register?role=publisher" className="brand-button">{t("pricing.publisherCta")}</Link></div></div></div></section>;
}

function PublisherCta() {
  const { t } = useTranslation("home");
  return <section className="py-16 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink"><div className="max-w-5xl mx-auto px-5 text-center"><span className="eyebrow light">{t("publisherCta.badge")}</span><h2 className="font-display text-3xl md:text-5xl mb-4">{t("publisherCta.title")}</h2><p className="text-billboard-paperDim max-w-2xl mx-auto mb-7">{t("publisherCta.subtitle")}</p><Link to="/register?role=publisher" className="brand-button yellow">{t("publisherCta.cta")}</Link></div></section>;
}

export default function Home() {
  const { t } = useTranslation(["home", "common"]);
  const [loaded, setLoaded] = useState(false);
  const { publishers, loading } = usePublishers();
  useEffect(() => { const raf=requestAnimationFrame(()=>requestAnimationFrame(()=>setLoaded(true))); return ()=>cancelAnimationFrame(raf); }, []);
  return <>
    <Seo title={t("seo.title")} description={t("seo.description")} />
    <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink overflow-hidden py-12 sm:py-16 md:py-24"><div className="max-w-6xl mx-auto px-4 sm:px-5 grid md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-8 sm:gap-12 items-center"><div className="min-w-0"><span className={`eyebrow dark-bg transition-all duration-500 ${loaded?"opacity-100":"opacity-0"}`}>{t("hero.badge")}</span><h1 className={`text-4xl sm:text-5xl md:text-7xl leading-[.98] mb-5 transition-all duration-700 ${loaded?"opacity-100 translate-y-0":"opacity-0 translate-y-4"}`}>{t("hero.title1")}<br/>{t("hero.title2")}</h1><p className="text-lg md:text-xl text-billboard-inkSoft max-w-[50ch] mb-7">{t("hero.subtitle")}</p><div className="flex flex-col sm:flex-row flex-wrap gap-3"><Link to="/build-my-campaign" className="brand-button dark">{t("hero.ctaBuildCampaign")}</Link><Link to="/browse" className="brand-button">{t("hero.ctaBrowseMarketplace")}</Link></div><div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 font-mono text-[10px] font-bold uppercase"><span>✓ {t("hero.noAccount")}</span><span>✓ {t("hero.secure")}</span><span>✓ {t("hero.tracked")}</span></div></div><div className={`min-w-0 flex justify-center transition-all duration-700 ${loaded?"opacity-100 scale-100":"opacity-0 scale-95"}`}><HeroMockup/></div></div></section>
    <HomeMetrics/>
    <TwoWaysSection/>
    <ComparisonSection/>
    <MarketplaceSection publishers={publishers} loading={loading}/>
    <ChannelsSection/>
    <OpportunitiesSection/>
    <LocalSection/>
    <LayersSection/>
    <HowSection/>
    <TrustSection/>
    <ToolsSection/>
    <PricingSection/>
    <PublisherCta/>
    <section className="py-20 bg-billboard-green text-white border-b-[3px] border-billboard-ink"><div className="max-w-4xl mx-auto px-5 text-center"><h2 className="font-display text-4xl md:text-6xl leading-tight mb-5">{t("final.title")}</h2><p className="text-white/80 max-w-xl mx-auto mb-8">{t("final.subtitle")}</p><div className="flex flex-col sm:flex-row justify-center gap-3"><Link to="/build-my-campaign" className="brand-button yellow">{t("final.build")}</Link><Link to="/browse" className="brand-button light">{t("final.browse")}</Link></div><p className="font-mono text-[10px] uppercase mt-5 text-white/70">{t("final.closer")}</p></div></section>
  </>;
}
