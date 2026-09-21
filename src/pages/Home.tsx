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
import { PLATFORM_COMMISSION_RATE, PUBLISHER_SHARE, ACTIVE_PROVINCES } from "../lib/constants";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import ToolIcon from "../components/ToolIcon";
import type { Tool } from "../lib/types";

// ── HomeMetrics ─────────────────────────────────────────────────────────────
// P1 fixes:
// 1. Hardcoded "9" replaced with ACTIVE_PROVINCES from constants.ts
// 2. Publisher count now shown in stat 1 (was fetched but never displayed)
// 3. Supabase error now destructured — was swallowed silently before
function HomeMetrics() {
  const { t } = useTranslation("home");
  const [metrics, setMetrics] = useState<{ businesses: number; publishers: number; paid_out_zar: number } | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.rpc("get_home_public_metrics").then(({ data, error }) => {
      if (error) { console.error("HomeMetrics RPC error:", error); return; }
      if (data?.[0]) setMetrics(data[0]);
    });
  }, []);
  const money = metrics
    ? new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(metrics.paid_out_zar)
    : "—";
  return (
    <section className="bg-white border-b-[3px] border-billboard-ink" aria-label={t("metrics.ariaLabel")}>
      <div className="max-w-6xl mx-auto px-5 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 border-[3px] border-billboard-ink rounded bg-billboard-paper shadow-blockSm overflow-hidden">
          <div className="p-4 text-center border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-billboard-ink">
            <div className="font-display text-2xl">{metrics?.publishers ?? "—"}</div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">Verified publishers</div>
          </div>
          <div className="p-4 text-center border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-billboard-ink">
            <div className="font-display text-2xl">{money}</div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">{t("metrics.paidOut")}</div>
          </div>
          <div className="p-4 text-center">
            <div className="font-display text-2xl">{ACTIVE_PROVINCES}</div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft">{t("metrics.provinces")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── HeroMockup ─────────────────────────────────────────────────────────────
function HeroMockup() {
  const { t } = useTranslation("home");
  return (
    <div className="relative w-full max-w-[430px]">
      <div className="relative aspect-[16/12] bg-billboard-paper border-[3px] border-billboard-ink rounded shadow-block -rotate-[1deg] overflow-hidden p-5">
        <span className="absolute top-3 right-3 bg-billboard-red text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded border-2 border-billboard-ink rotate-2">{t("heroMockup.liveNow")}</span>
        <div className="h-full flex flex-col justify-center gap-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">{t("heroMockup.marketplaceLabel")}</div>
          <div className="border-2 border-billboard-ink rounded p-3 bg-white">
            <div className="flex items-center justify-between gap-3 mb-2">
              <strong>{t("heroMockup.placementTitle")}</strong>
              <span className="font-mono text-[10px] font-bold bg-billboard-yellow border-2 border-billboard-ink rounded-full px-2 py-0.5">{t("heroMockup.verified")}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px] text-billboard-inkSoft">
              <span>Instagram</span><span>•</span><span>42K audience</span><span>•</span><span>Cape Town</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border-2 border-billboard-ink rounded p-2.5 bg-billboard-yellow">
              <div className="font-mono text-[9px] uppercase">{t("heroMockup.price")}</div>
              <div className="font-display text-xl">R1,250</div>
            </div>
            <div className="border-2 border-billboard-ink rounded p-2.5 bg-billboard-green text-white">
              <div className="font-mono text-[9px] uppercase">{t("heroMockup.status")}</div>
              <div className="font-display text-xl">{t("heroMockup.ready")}</div>
            </div>
          </div>
          <div className="border-2 border-billboard-ink rounded p-2.5 bg-white font-mono text-[10px]">{t("heroMockup.footer")}</div>
        </div>
      </div>
    </div>
  );
}

// ── HowSection ─────────────────────────────────────────────────────────────
// P1 fix: trimmed from 6 steps to 3. Full guide at /how-it-works.
// Moved from position 9 to position 3 so visitors understand the product
// before seeing the marketplace, comparison table, or pricing.
function HowSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-paper/60 block mb-3">{t("how.badge")}</span>
        <h2 className="text-3xl md:text-4xl mb-9 max-w-2xl">{t("how.title")}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="border-2 border-white/20 rounded-lg p-5 bg-white/5">
              <span className="font-display text-3xl text-billboard-yellow">0{n}</span>
              <h3 className="font-display text-lg mt-3 mb-1">{t(`how.steps.${n}.title`)}</h3>
              <p className="text-sm text-billboard-paper/70">{t(`how.steps.${n}.body`)}</p>
            </div>
          ))}
        </div>
        <p className="font-display text-xl mt-9 text-billboard-yellow">{t("how.closer")}</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/how-it-works" className="inline-flex items-center gap-2 border-2 border-white text-white font-bold px-5 py-3 rounded hover:bg-white/10 transition">{t("how.cta")}</Link>
          <Link to="/browse" className="inline-flex items-center gap-2 border-2 border-billboard-yellow text-billboard-yellow font-bold px-5 py-3 rounded hover:bg-billboard-yellow/10 transition">{t("hero.ctaBrowseMarketplace")} →</Link>
        </div>
      </div>
    </section>
  );
}

// ── ComparisonSection ────────────────────────────────────────────────────
function ComparisonSection() {
  const { t } = useTranslation("home");
  const reveal = useReveal<HTMLDivElement>();
  const rows = ["account", "auction", "audience", "workflow", "proof"] as const;
  return (
    <section className="py-16 bg-billboard-green border-b-[3px] border-billboard-ink text-white">
      <div className="max-w-6xl mx-auto px-5" ref={reveal.ref}>
        <div className={reveal.className}>
          <div className="max-w-3xl mb-9">
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-white/60 block mb-3">{t("comparison.badge")}</span>
            <h2 className="font-display text-3xl md:text-5xl leading-tight mb-4">{t("comparison.title")}</h2>
            <p className="text-white/80 max-w-2xl">{t("comparison.subtitle")}</p>
          </div>
          <div className="overflow-x-auto border-[3px] border-billboard-ink rounded-lg bg-white text-billboard-ink shadow-block">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[1fr_1fr_1fr] font-mono text-[10px] uppercase font-bold">
                <div className="p-4 bg-billboard-paperDim border-r-[3px] border-b-[3px] border-billboard-ink">{t("comparison.platforms")}</div>
                <div className="p-4 bg-billboard-paperDim border-r-[3px] border-b-[3px] border-billboard-ink">{t("comparison.traditional")}</div>
                <div className="p-4 bg-billboard-yellow border-b-[3px] border-billboard-ink">{t("comparison.chatsched")}</div>
              </div>
              {rows.map((r) => (
                <div key={r} className="grid grid-cols-[1fr_1fr_1fr] border-b-2 border-billboard-ink/20 last:border-b-0">
                  <div className="p-3.5 font-bold text-sm border-r-2 border-billboard-ink/20">{t(`comparison.rows.${r}.label`)}</div>
                  <div className="p-3.5 text-sm border-r-2 border-billboard-ink/20 text-billboard-inkSoft">
                    <span className="text-billboard-red mr-1.5">✕</span>{t(`comparison.rows.${r}.traditional`)}
                  </div>
                  <div className="p-3.5 text-sm font-semibold bg-billboard-yellow/20">
                    <span className="text-billboard-green mr-1.5">✓</span>{t(`comparison.rows.${r}.chatsched`)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="font-display text-xl md:text-2xl mt-8 text-white">{t("comparison.closer")}</p>
          <Link to="/browse" className="inline-flex items-center gap-2 border-2 border-billboard-yellow bg-billboard-yellow text-billboard-ink font-bold px-5 py-3 rounded mt-6 hover:bg-billboard-yellowDeep transition">
            {t("hero.ctaBrowseMarketplace")} →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── MarketplaceSection ───────────────────────────────────────────────────
function MarketplaceSection({ publishers, loading }: { publishers: ReturnType<typeof usePublishers>["publishers"]; loading: boolean }) {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <RecentlyViewedStrip />
        <div className="mt-8 mb-9">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft block mb-3">{t("marketplace.badge")}</span>
          <h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("marketplace.title")}</h2>
          <p className="text-billboard-inkSoft max-w-2xl">{t("marketplace.subtitle")}</p>
        </div>
        {loading
          ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{[0,1,2,3].map(i => <PublisherCardSkeleton key={i} />)}</div>
          : publishers.length === 0
            ? <div className="border-[3px] border-dashed border-billboard-ink rounded"><EmptyState kind="list" title={t("marketplace.emptyTitle")} description={t("marketplace.emptyDescription")} compact /></div>
            : <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{publishers.slice(0, 4).map(p => <PublisherCard key={p.id} publisher={p} />)}</div>
        }
        <div className="text-center mt-9">
          <Link to="/browse" className="brand-button">{t("marketplace.cta")}</Link>
        </div>
      </div>
    </section>
  );
}

// ── ChannelsSection ──────────────────────────────────────────────────────
function ChannelsSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft block mb-3">{t("channels.badge")}</span>
        <h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("channels.title")}</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-9">{t("channels.subtitle")}</p>
        <LiveChannelTabs />
      </div>
    </section>
  );
}

// ── LocalSection ──────────────────────────────────────────────────────────
function LocalSection() {
  const { t } = useTranslation("home");
  const reveal = useReveal<HTMLDivElement>();
  const items = ["township", "transport", "associations", "suburbs"] as const;
  return (
    <section className="py-16 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5" ref={reveal.ref}>
        <div className={reveal.className}>
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft block mb-3">{t("local.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3 max-w-3xl">{t("local.title")}</h2>
          <p className="text-billboard-inkSoft max-w-2xl mb-9">{t("local.subtitle")}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map(i => (
              <div key={i} className="border-[3px] border-billboard-ink rounded-lg p-5 bg-billboard-paperDim hover:-translate-y-1 hover:shadow-blockSm transition">
                <h3 className="font-display text-lg mb-2">{t(`local.items.${i}.title`)}</h3>
                <p className="text-sm text-billboard-inkSoft">{t(`local.items.${i}.body`)}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/audience-finder" className="brand-button dark">{t("local.cta")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── TestimonialsSection ─────────────────────────────────────────────────
// P1 addition: social proof section. Only renders when real reviews exist.
// TODO (AJ): Once your first 1-2 campaigns complete, ask those businesses or
// publishers for a short quote and save it as a review (rating >= 4). This
// section then auto-populates from the reviews table. Until then it stays
// hidden (returns null) so there is never an empty testimonials section visible.
function TestimonialsSection() {
  const [reviews, setReviews] = useState<{ rating: number; body: string; reviewer_name?: string; channel_type?: string }[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from("reviews")
      .select("rating, body, reviewer_name, channel_type")
      .gte("rating", 4)
      .not("body", "is", null)
      .order("rating", { ascending: false })
      .limit(2)
      .then(({ data, error }) => {
        if (error) { console.error("TestimonialsSection error:", error); return; }
        if (data && data.length > 0) setReviews(data as typeof reviews);
      });
  }, []);
  if (reviews.length === 0) return null;
  return (
    <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft block mb-3">From the people using it</span>
        <h2 className="text-3xl md:text-4xl mb-9 max-w-2xl">Real results from real campaigns.</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {reviews.map((r, i) => (
            <div key={i} className="border-[3px] border-billboard-ink rounded-lg p-7 bg-white shadow-blockSm">
              <div className="font-display text-4xl text-billboard-yellow mb-3 leading-none">“</div>
              <p className="text-billboard-ink mb-5 text-lg leading-relaxed">{r.body}</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sm">{r.reviewer_name ?? "Verified user"}</div>
                  {r.channel_type && <div className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft mt-0.5">{r.channel_type}</div>}
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, j) => <span key={j} className="text-billboard-yellow text-sm">★</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── TrustSection ──────────────────────────────────────────────────────────
function TrustSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 bg-white border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-9">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft block mb-3">{t("trust.badge")}</span>
          <h2 className="text-3xl md:text-4xl mb-3">{t("trust.title")}</h2>
          <p className="text-billboard-inkSoft">{t("trust.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {["payment", "verified", "tracked"].map(k => (
            <div key={k} className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-paperDim">
              <h3 className="font-display text-xl mb-2">{t(`trust.${k}.title`)}</h3>
              <p className="text-sm text-billboard-inkSoft">{t(`trust.${k}.body`)}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link to="/trust" className="brand-button">{t("trust.cta")}</Link>
        </div>
      </div>
    </section>
  );
}

// ── ToolsSection ──────────────────────────────────────────────────────────
// P1 fix: Supabase error now handled — was swallowed silently before.
function ToolsSection() {
  const { t } = useTranslation("home");
  const [tools, setTools] = useState<Tool[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from("tools")
      .select("*")
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(3)
      .then(({ data, error }) => {
        if (error) { console.error("ToolsSection error:", error); return; }
        setTools((data ?? []) as Tool[]);
      });
  }, []);
  if (!isSupabaseConfigured || tools.length === 0) return null;
  return (
    <section className="py-16 bg-billboard-paperDim border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft block mb-3">{t("tools.badge")}</span>
        <h2 className="text-3xl md:text-4xl mb-3 max-w-2xl">{t("tools.title")}</h2>
        <p className="text-billboard-inkSoft max-w-2xl mb-9">{t("tools.subtitle")}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {tools.map(tool => (
            <Link key={tool.slug} to={`/tools/${tool.slug}`} className="group border-[3px] border-billboard-ink rounded-lg p-6 bg-white flex flex-col hover:-translate-y-1 hover:shadow-block transition">
              <div className="mb-4"><ToolIcon name={tool.icon} size="sm" /></div>
              <h3 className="font-display text-lg mb-2">{tool.name}</h3>
              <p className="text-sm text-billboard-inkSoft mb-4 flex-1">{tool.short_description}</p>
              <span className="font-bold text-sm">{tool.cta_label} →</span>
            </Link>
          ))}
        </div>
        <div className="mt-8"><Link to="/tools" className="brand-button">{t("tools.cta")}</Link></div>
      </div>
    </section>
  );
}

// ── PricingSection ────────────────────────────────────────────────────────
function PricingSection() {
  const { t } = useTranslation("home");
  return (
    <section className="py-16 bg-billboard-yellow border-b-[3px] border-billboard-ink">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-3xl mb-9">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft block mb-3">{t("pricing.badge")}</span>
          <h2 className="text-3xl md:text-5xl mb-3">{t("pricing.title")}</h2>
          <p className="text-billboard-inkSoft">{t("pricing.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="border-[3px] border-billboard-ink rounded-lg p-7 bg-white shadow-block">
            <div className="font-mono text-xs font-bold uppercase">{t("pricing.businessLabel")}</div>
            <div className="font-display text-4xl mt-2">R399</div>
            <p className="font-bold mb-2">{t("pricing.onceOff")}</p>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.businessBody")}</p>
            <Link to="/register?role=business" className="brand-button dark">{t("pricing.businessCta")}</Link>
          </div>
          <div className="border-[3px] border-billboard-ink rounded-lg p-7 bg-billboard-paper shadow-block">
            <div className="font-mono text-xs font-bold uppercase">{t("pricing.publisherLabel")}</div>
            <div className="font-display text-4xl mt-2">R199</div>
            <p className="font-bold mb-2">{t("pricing.onceOff")}</p>
            <p className="text-sm text-billboard-inkSoft mb-5">{t("pricing.publisherBody")}</p>
            <Link to="/register?role=publisher" className="brand-button">{t("pricing.publisherCta")}</Link>
          </div>
        </div>
        <p className="font-mono text-xs font-bold uppercase mt-7 max-w-2xl text-billboard-inkSoft">
          {t("pricing.commission", { commission: Math.round(PLATFORM_COMMISSION_RATE * 100), share: Math.round(PUBLISHER_SHARE * 100) })}
        </p>
      </div>
    </section>
  );
}

// ── Home ───────────────────────────────────────────────────────────────────
// P1 restructuring (14 sections → 10):
//   REMOVED: TwoWaysSection — content duplicated by hero CTAs
//   REMOVED: LayersSection  — content duplicated by TwoWaysSection
//   REMOVED: PublisherCta   — duplicated by Final CTA below
//   MOVED:   HowSection     — position 9 → position 3
//   ADDED:   TestimonialsSection (auto-hides until reviews exist)
//
// New order: Hero → Metrics → How → Channels → Local → Marketplace →
//            Comparison → Testimonials → Trust → Tools* → Pricing → Final CTA
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

      {/* Hero */}
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink overflow-hidden py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-[1.08fr_0.92fr] gap-12 items-center">
          <div>
            <span className={`font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-ink text-billboard-paper px-3 py-1.5 rounded inline-block mb-4 transition-all duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}>{t("hero.badge")}</span>
            <h1 className={`text-5xl md:text-7xl leading-[.98] mb-5 transition-all duration-700 motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              {t("hero.title1")}<br />{t("hero.title2")}
            </h1>
            <p className="text-lg md:text-xl text-billboard-inkSoft max-w-[50ch] mb-7">{t("hero.subtitle")}</p>
            {/* P1 fix: Browse (primary) placed first; Build campaign is secondary.
                Most homepage visitors are researchers, not ready-to-buy buyers.
                The primary action should match the majority intent. */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link to="/browse" className="brand-button">{t("hero.ctaBrowseMarketplace")}</Link>
              <Link to="/build-my-campaign" className="brand-button dark">{t("hero.ctaBuildCampaign")}</Link>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 font-mono text-xs font-bold uppercase">
              <span>✓ {t("hero.noAccount")}</span>
              <span>✓ {t("hero.secure")}</span>
              <span>✓ {t("hero.tracked")}</span>
            </div>
          </div>
          <div className={`flex justify-center transition-all duration-700 motion-reduce:transition-none motion-reduce:scale-100 motion-reduce:opacity-100 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
            <HeroMockup />
          </div>
        </div>
      </section>

      <HomeMetrics />
      <HowSection />
      <ChannelsSection />
      <LocalSection />
      <MarketplaceSection publishers={publishers} loading={loading} />
      <ComparisonSection />
      <TestimonialsSection />
      <TrustSection />
      <ToolsSection />
      <PricingSection />

      {/* Final CTA — single closing section.
          PublisherCta removed; both audiences handled here. */}
      <section className="py-20 bg-billboard-green text-white border-b-[3px] border-billboard-ink">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h2 className="font-display text-4xl md:text-6xl leading-tight mb-5">{t("final.title")}</h2>
          <p className="text-white/80 max-w-xl mx-auto mb-8">{t("final.subtitle")}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-yellow bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellowDeep transition">{t("final.browse")}</Link>
            <Link to="/register?role=publisher" className="inline-flex items-center gap-2 border-[3px] border-white text-white font-bold px-6 py-3 rounded hover:bg-white/10 transition">{t("publisherCta.cta")}</Link>
          </div>
          <p className="font-mono text-[10px] uppercase mt-5 text-white/70">{t("final.closer")}</p>
        </div>
      </section>
    </>
  );
}
