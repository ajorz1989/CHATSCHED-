import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePublishers } from "../hooks/usePublishers";
import PublisherCard from "./PublisherCard";
import { PublisherCardSkeleton } from "./Skeleton";
import EmptyState from "./EmptyState";
import ChannelIcon from "./ChannelIcon";
import { getEnabledChannels } from "../lib/channelRegistry";
import { makeDefaults } from "../lib/browseFilters";
import { filtersToSearchParams } from "../lib/searchParamsCodec";
import { formatCurrency } from "../lib/currency";
import { PROVINCES } from "../lib/constants";
import type { ChannelSlug } from "../lib/channelTypes";

/**
 * Marketplace "Inventory Wall" — the first block on the homepage.
 *
 * Every number on this section is derived from the live, approved listings
 * (publishers_public via usePublishers, the same cached query the rest of the
 * homepage and /browse already use), so it can't drift or be invented. A
 * counter that would read zero is simply not rendered.
 *
 * Search hands off to /browse through the existing filter codec
 * (filtersToSearchParams), so What / Where / Budget land as real, editable
 * Browse filters. Copy uses t(key, { defaultValue }) like HomeHeroBands, so
 * English renders today and translations can be added without code changes.
 */

const BUDGET_STEPS = [500, 1000, 2500];
const WALL_CARD_LIMIT = 8;

const labelCls = "block font-mono text-[10px] uppercase tracking-wider font-bold text-billboard-inkSoft mb-1";
const fieldCls =
  "w-full bg-transparent text-sm font-semibold text-billboard-ink focus:outline-none appearance-none cursor-pointer";

export default function HomeInventoryWall() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const { publishers, loading } = usePublishers();

  const [selected, setSelected] = useState<ChannelSlug | "all">("all");
  const [what, setWhat] = useState<ChannelSlug | "">("");
  const [where, setWhere] = useState("");
  const [budget, setBudget] = useState("");

  const enabledChannels = useMemo(() => getEnabledChannels(), []);

  // Live listing count per enabled channel — only channels with inventory get a tile.
  const channelTiles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of publishers) counts.set(p.channel_slug, (counts.get(p.channel_slug) ?? 0) + 1);
    return enabledChannels
      .map((c) => ({ slug: c.definition.slug, name: c.definition.name, count: counts.get(c.definition.slug) ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [publishers, enabledChannels]);

  const lowestPrice = useMemo(() => {
    const prices = publishers.map((p) => p.price_per_post).filter((n) => Number.isFinite(n) && n > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [publishers]);

  const visible = useMemo(
    () => (selected === "all" ? publishers : publishers.filter((p) => p.channel_slug === selected)),
    [publishers, selected]
  );
  const cards = visible.slice(0, WALL_CARD_LIMIT);

  const browseHref = selected === "all" ? "/browse" : `/browse?channel=${encodeURIComponent(selected)}`;
  const selectedName = channelTiles.find((c) => c.slug === selected)?.name;

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const params = filtersToSearchParams(
      makeDefaults({
        channel: what,
        province: where,
        ...(budget ? { maxPrice: Number(budget) } : {}),
      })
    );
    const qs = params.toString();
    navigate(qs ? `/browse?${qs}` : "/browse");
  }

  const stats: { value: string; label: string }[] = [];
  if (publishers.length > 0) {
    stats.push({
      value: String(publishers.length),
      label: t("inventoryWall.stats.listings", { defaultValue: "Verified listings" }),
    });
  }
  if (channelTiles.length > 0) {
    stats.push({
      value: String(channelTiles.length),
      label: t("inventoryWall.stats.channels", { defaultValue: "Channels with inventory" }),
    });
  }
  if (lowestPrice !== null) {
    stats.push({
      value: formatCurrency(lowestPrice),
      label: t("inventoryWall.stats.from", { defaultValue: "Prices from" }),
    });
  }

  return (
    <section className="bg-billboard-ink text-billboard-paper border-b-[3px] border-billboard-ink" aria-labelledby="inventory-wall-title">
      <div className="bg-billboard-ink border-b-[3px] border-billboard-yellow">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 pt-10 md:pt-14 pb-8 md:pb-10">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-billboard-yellow border-2 border-billboard-yellow rounded-md px-2.5 py-1.5 mb-4">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-billboard-green opacity-75 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-billboard-green ring-2 ring-billboard-paper" />
            </span>
            {t("inventoryWall.badge", { defaultValue: "Live marketplace inventory" })}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl">
              <h1 id="inventory-wall-title" className="text-4xl sm:text-5xl md:text-6xl leading-[1.02] mb-3">
                {t("inventoryWall.title1", { defaultValue: "Browse live ad inventory." })}
                <br />
                <span className="inline-block bg-billboard-yellow text-billboard-ink px-3 pb-1 mt-2 box-decoration-clone">
                  {t("inventoryWall.title2", { defaultValue: "Book it in minutes." })}
                </span>
              </h1>
              <p className="text-base md:text-lg text-billboard-paperDim max-w-xl leading-relaxed">
                {t("inventoryWall.subtitle", {
                  defaultValue: "Verified South African publishers across every channel. Payment-protected, tracked, and no phone calls needed.",
                })}
              </p>
            </div>

            {stats.length > 0 && (
              <dl className="flex flex-wrap gap-2.5 shrink-0">
                {stats.map((s) => (
                  <div key={s.label} className="border-2 border-billboard-paper bg-billboard-paper text-billboard-ink rounded-lg px-4 py-2.5 min-w-[7.5rem]">
                    <dd className="font-display text-2xl leading-none">{s.value}</dd>
                    <dt className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft mt-1">{s.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <form
            onSubmit={handleSearch}
            role="search"
            aria-label={t("inventoryWall.searchLabel", { defaultValue: "Search marketplace inventory" })}
            className="mt-7 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] bg-billboard-paper text-billboard-ink border-[3px] border-billboard-yellow rounded-lg overflow-hidden"
          >
            <label className="block px-4 py-3 border-b-2 sm:border-b-0 sm:border-r-2 border-billboard-ink">
              <span className={labelCls}>{t("inventoryWall.what", { defaultValue: "What" })}</span>
              <select value={what} onChange={(e) => setWhat(e.target.value as ChannelSlug | "")} className={fieldCls}>
                <option value="">{t("inventoryWall.whatAny", { defaultValue: "Any channel" })}</option>
                {enabledChannels.map((c) => (
                  <option key={c.definition.slug} value={c.definition.slug}>{c.definition.name}</option>
                ))}
              </select>
            </label>
            <label className="block px-4 py-3 border-b-2 sm:border-b-0 sm:border-r-2 border-billboard-ink">
              <span className={labelCls}>{t("inventoryWall.where", { defaultValue: "Where" })}</span>
              <select value={where} onChange={(e) => setWhere(e.target.value)} className={fieldCls}>
                <option value="">{t("inventoryWall.whereAny", { defaultValue: "Any province" })}</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block px-4 py-3 border-b-2 sm:border-b-0 lg:border-r-2 border-billboard-ink">
              <span className={labelCls}>{t("inventoryWall.budget", { defaultValue: "Budget per placement" })}</span>
              <select value={budget} onChange={(e) => setBudget(e.target.value)} className={fieldCls}>
                <option value="">{t("inventoryWall.budgetAny", { defaultValue: "Any budget" })}</option>
                {BUDGET_STEPS.map((n) => (
                  <option key={n} value={n}>{t("inventoryWall.budgetUpTo", { defaultValue: "Up to {{amount}}", amount: formatCurrency(n) })}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              data-cta="inventory-wall-search"
              className="bg-billboard-yellow text-billboard-ink font-bold px-6 py-4 sm:col-span-3 lg:col-span-1 hover:bg-billboard-yellowDeep transition focus-visible:outline-offset-[-4px]"
            >
              {t("inventoryWall.search", { defaultValue: "Search inventory →" })}
            </button>
          </form>

          {channelTiles.length > 0 && (
            <div className="mt-5">
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label={t("inventoryWall.filterLabel", { defaultValue: "Filter inventory by channel" })}>
                <button
                  type="button"
                  aria-pressed={selected === "all"}
                  onClick={() => setSelected("all")}
                  className={`shrink-0 text-left rounded-lg border-2 px-3.5 py-2.5 min-w-[6.5rem] transition ${selected === "all" ? "bg-billboard-yellow text-billboard-ink border-billboard-yellow" : "bg-billboard-ink text-billboard-paper border-billboard-inkSoft hover:border-billboard-yellow"}`}
                >
                  <div className="font-bold text-sm">{t("inventoryWall.all", { defaultValue: "All" })}</div>
                  <div className={`font-mono text-[10px] uppercase tracking-wide mt-0.5 ${selected === "all" ? "text-billboard-ink" : "text-billboard-yellow"}`}>
                    {publishers.length} {t("inventoryWall.live", { defaultValue: "live" })}
                  </div>
                </button>
                {channelTiles.map((c) => {
                  const active = selected === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(c.slug)}
                      className={`shrink-0 text-left rounded-lg border-2 px-3.5 py-2.5 min-w-[8rem] transition ${active ? "bg-billboard-yellow text-billboard-ink border-billboard-yellow" : "bg-billboard-ink text-billboard-paper border-billboard-inkSoft hover:border-billboard-yellow"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded bg-billboard-paper text-billboard-ink p-0.5 ${active ? "" : "opacity-95"}`}>
                          <ChannelIcon slug={c.slug} size="sm" />
                        </span>
                        <span className="font-bold text-sm leading-tight whitespace-nowrap">{c.name}</span>
                      </div>
                      <div className={`font-mono text-[10px] uppercase tracking-wide mt-1.5 ${active ? "text-billboard-ink" : "text-billboard-yellow"}`}>
                        {c.count} {t("inventoryWall.live", { defaultValue: "live" })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-billboard-paperDim text-billboard-ink">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 py-8 md:py-10">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => <PublisherCardSkeleton key={i} />)}
            </div>
          ) : cards.length === 0 ? (
            <div className="border-2 border-dashed border-billboard-ink rounded-xl bg-white">
              <EmptyState
                kind="list"
                title={t("marketplace.emptyTitle", { defaultValue: "Listings are on the way" })}
                description={t("marketplace.emptyDescription", { defaultValue: "New verified publishers are joining. Check back soon, or tell us what you need." })}
                compact
              />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
              {cards.map((p) => <PublisherCard key={p.id} publisher={p} />)}
            </div>
          )}

          <div className="mt-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to={browseHref} data-cta="inventory-wall-browse" className="brand-button yellow">
                {selected === "all" || !selectedName
                  ? t("inventoryWall.viewAll", { defaultValue: "View all {{count}} listings →", count: publishers.length })
                  : t("inventoryWall.viewChannel", { defaultValue: "View all {{name}} listings →", name: selectedName })}
              </Link>
              <Link to="/build-my-campaign" data-cta="inventory-wall-build" className="brand-button light">
                {t("inventoryWall.build", { defaultValue: "Build my campaign for me" })}
              </Link>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-billboard-inkSoft">
              {t("inventoryWall.trust", { defaultValue: "Payment-protected · Verified · Tracked" })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
