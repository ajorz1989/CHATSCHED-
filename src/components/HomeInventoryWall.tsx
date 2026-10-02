import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePublishers } from "../hooks/usePublishers";
import { usePostOpportunityHref } from "../hooks/usePostOpportunityHref";
import PublisherCard from "./PublisherCard";
import RecentlyViewedStrip from "./RecentlyViewedStrip";
import PublisherAvatar from "./PublisherAvatar";
import { PublisherCardSkeleton } from "./Skeleton";
import EmptyState from "./EmptyState";
import ChannelIcon from "./ChannelIcon";
import { getEnabledChannels, getChannelBySlug } from "../lib/channelRegistry";
import { makeDefaults } from "../lib/browseFilters";
import { filtersToSearchParams } from "../lib/searchParamsCodec";
import { formatCurrency } from "../lib/currency";
import { PROVINCES } from "../lib/constants";
import type { ChannelSlug } from "../lib/channelTypes";

/**
 * First section on the homepage: ChatSched's three branches — Marketplace,
 * Agency and Publisher Network — in one place.
 *
 * Built from ChatSched's own identity rather than a generic tab UI: the whole
 * section is the logo's billboard (a face on two posts standing on the page
 * baseline), each branch icon is a variant of the logo mark (same 26x22 grid,
 * same square-cut 2.4 stroke, same yellow tile with hard offset shadow), the
 * rail buttons "press in" like the brand buttons.
 *
 * Every number shown comes from approved listings (usePublishers — the same
 * cached query Browse and the rest of the homepage use) or the channel
 * registry; a figure that would be zero is not rendered. Copy uses
 * t(key, { defaultValue }) like HomeHeroBands, so English renders today and
 * translations can be added later without code changes.
 */

type Branch = "marketplace" | "agency" | "network";
const BRANCHES: Branch[] = ["marketplace", "agency", "network"];

const BUDGET_STEPS = [500, 1000, 2500];
const MARKETPLACE_CARDS = 6;
const NETWORK_SHOWCASE = 6;

const labelCls = "block font-mono text-[10px] uppercase tracking-wider font-bold text-billboard-inkSoft mb-1";
const fieldCls = "w-full bg-transparent text-sm font-semibold text-billboard-ink focus:outline-none appearance-none cursor-pointer";

/**
 * Branch icons — variants of the ChatSched billboard mark. Same viewBox and
 * stroke as public/brand/mark-ink.svg, square joins, no rounded caps:
 *  - marketplace: the face is split into inventory slots, one slot booked
 *  - agency: the face carries chat "typing" dots — you brief us in conversation
 *  - network: a billboard fed by three publisher nodes on the brand's dotted line
 */
function BranchMark({ branch }: { branch: Branch }) {
  const sw = 2.4;
  return (
    <svg viewBox="0 0 26 22" className="w-full h-full" fill="none" aria-hidden="true">
      {branch === "marketplace" && (
        <>
          <rect x="13" y="1" width="12" height="7" fill="currentColor" />
          <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth={sw} />
          <line x1="13" y1="1" x2="13" y2="15" stroke="currentColor" strokeWidth="2" />
          <line x1="1" y1="8" x2="25" y2="8" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth={sw} />
          <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth={sw} />
        </>
      )}
      {branch === "agency" && (
        <>
          <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth={sw} />
          <rect x="5.4" y="6.6" width="3.2" height="3.2" fill="currentColor" />
          <rect x="11.4" y="6.6" width="3.2" height="3.2" fill="currentColor" />
          <rect x="17.4" y="6.6" width="3.2" height="3.2" fill="currentColor" />
          <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth={sw} />
          <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth={sw} />
        </>
      )}
      {branch === "network" && (
        <>
          <rect x="6" y="1" width="14" height="9" stroke="currentColor" strokeWidth={sw} />
          <path d="M13 10.5V16M13 10.5L3.5 16M13 10.5L22.5 16" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeDasharray="0.1 3.4" />
          <rect x="1" y="16.5" width="5" height="4.5" fill="currentColor" />
          <rect x="10.5" y="16.5" width="5" height="4.5" fill="currentColor" />
          <rect x="20" y="16.5" width="5" height="4.5" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** The ChatSched yellow tile: ink border + hard offset shadow, as in brand/tile-yellow.svg. */
function BranchTile({ branch, inverted = false }: { branch: Branch; inverted?: boolean }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center w-12 h-12 lg:w-16 lg:h-16 rounded-lg border-[3px] p-2 lg:p-2.5 text-billboard-ink ${
        inverted ? "bg-billboard-yellow border-billboard-yellow" : "bg-billboard-yellow border-billboard-ink shadow-[3px_3px_0_#1A1712]"
      }`}
    >
      <BranchMark branch={branch} />
    </span>
  );
}

function Panel({ id, active, children }: { id: Branch; active: Branch; children: ReactNode }) {
  return (
    <div id={`wall-panel-${id}`} role="tabpanel" aria-labelledby={`wall-tab-${id}`} hidden={active !== id} tabIndex={0} className="focus-visible:outline-offset-4">
      {active === id ? children : null}
    </div>
  );
}

function initialBranch(): Branch {
  if (typeof window === "undefined") return "marketplace";
  const hash = window.location.hash.replace("#", "");
  return (BRANCHES as string[]).includes(hash) ? (hash as Branch) : "marketplace";
}

export default function HomeInventoryWall() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const postHref = usePostOpportunityHref();
  const { publishers, loading } = usePublishers();

  const [branch, setBranch] = useState<Branch>(initialBranch);
  const [selected, setSelected] = useState<ChannelSlug | "all">("all");
  const [what, setWhat] = useState<ChannelSlug | "">("");
  const [where, setWhere] = useState("");
  const [budget, setBudget] = useState("");
  const tabRefs = useRef<Record<Branch, HTMLButtonElement | null>>({ marketplace: null, agency: null, network: null });

  const enabledChannels = useMemo(() => getEnabledChannels(), []);

  const channelTiles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of publishers) counts.set(p.channel_slug, (counts.get(p.channel_slug) ?? 0) + 1);
    return enabledChannels
      .map((c) => ({ slug: c.definition.slug, name: c.definition.name, count: counts.get(c.definition.slug) ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [publishers, enabledChannels]);

  const verifiedCount = useMemo(() => publishers.filter((p) => p.verified).length, [publishers]);
  const visible = useMemo(
    () => (selected === "all" ? publishers : publishers.filter((p) => p.channel_slug === selected)),
    [publishers, selected]
  );
  const cards = visible.slice(0, MARKETPLACE_CARDS);
  const showcase = useMemo(() => publishers.slice(0, NETWORK_SHOWCASE), [publishers]);

  const browseHref = selected === "all" ? "/browse" : `/browse?channel=${encodeURIComponent(selected)}`;
  const selectedName = channelTiles.find((c) => c.slug === selected)?.name;

  function selectBranch(next: Branch, focus = false) {
    setBranch(next);
    if (focus) tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, current: Branch) {
    const i = BRANCHES.indexOf(current);
    let next: Branch | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = BRANCHES[(i + 1) % BRANCHES.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = BRANCHES[(i + BRANCHES.length - 1) % BRANCHES.length];
    else if (e.key === "Home") next = BRANCHES[0];
    else if (e.key === "End") next = BRANCHES[BRANCHES.length - 1];
    if (next) {
      e.preventDefault();
      selectBranch(next, true);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const params = filtersToSearchParams(
      makeDefaults({ channel: what, province: where, ...(budget ? { maxPrice: Number(budget) } : {}) })
    );
    const qs = params.toString();
    navigate(qs ? `/browse?${qs}` : "/browse");
  }

  const tabs: { id: Branch; num: string; short: string; name: string; line: string; stat: string | null }[] = [
    {
      id: "marketplace",
      num: "01",
      short: t("inventoryWall.tabs.marketplace.short", { defaultValue: "Marketplace" }),
      name: t("inventoryWall.tabs.marketplace.name", { defaultValue: "Marketplace" }),
      line: t("inventoryWall.tabs.marketplace.line", { defaultValue: "Pick placements yourself" }),
      stat: publishers.length > 0 ? t("inventoryWall.tabs.marketplace.stat", { defaultValue: "{{count}} live listings", count: publishers.length }) : null,
    },
    {
      id: "agency",
      num: "02",
      short: t("inventoryWall.tabs.agency.short", { defaultValue: "Agency" }),
      name: t("inventoryWall.tabs.agency.name", { defaultValue: "Agency" }),
      line: t("inventoryWall.tabs.agency.line", { defaultValue: "We run your campaign" }),
      stat: enabledChannels.length > 0 ? t("inventoryWall.tabs.agency.stat", { defaultValue: "{{count}} channels", count: enabledChannels.length }) : null,
    },
    {
      id: "network",
      num: "03",
      short: t("inventoryWall.tabs.network.short", { defaultValue: "Network" }),
      name: t("inventoryWall.tabs.network.name", { defaultValue: "Publisher network" }),
      line: t("inventoryWall.tabs.network.line", { defaultValue: "Get paid for your audience" }),
      stat: verifiedCount > 0 ? t("inventoryWall.tabs.network.stat", { defaultValue: "{{count}} verified publishers", count: verifiedCount }) : null,
    },
  ];
  const activeTab = tabs.find((x) => x.id === branch) ?? tabs[0];

  const steps = [
    {
      title: t("inventoryWall.agency.step1.title", { defaultValue: "Tell us your goal" }),
      body: t("inventoryWall.agency.step1.body", { defaultValue: "Share your goal, audience and budget." }),
    },
    {
      title: t("inventoryWall.agency.step2.title", { defaultValue: "We build the campaign" }),
      body: t("inventoryWall.agency.step2.body", { defaultValue: "Verified creators, podcasts, radio, websites and events send proposals." }),
    },
    {
      title: t("inventoryWall.agency.step3.title", { defaultValue: "Approve, pay and track" }),
      body: t("inventoryWall.agency.step3.body", { defaultValue: "Payment, proof and results stay in one place." }),
    },
  ];

  return (
    <section className="relative bg-billboard-yellow text-billboard-ink border-b-[3px] border-billboard-ink overflow-hidden" aria-labelledby="inventory-wall-title">
      <svg viewBox="0 0 26 22" className="hidden lg:block pointer-events-none absolute -right-16 top-10 w-[34rem] text-billboard-ink opacity-[0.07]" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="1.2" />
        <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="1.2" />
        <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="1.2" />
      </svg>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14 md:pt-20">
        <h1 id="inventory-wall-title" className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl leading-[.98] mb-5">
          {t("inventoryWall.title1", { defaultValue: "Buy local attention." })}
          <br />
          <span className="inline-block bg-billboard-ink text-billboard-yellow px-3 sm:px-4 pb-1 mt-2 -rotate-1 box-decoration-clone">
            {t("inventoryWall.title2", { defaultValue: "Or get paid for yours." })}
          </span>
        </h1>
        <p className="text-lg md:text-xl text-billboard-inkSoft max-w-3xl leading-relaxed mb-9 md:mb-12">
          {t("inventoryWall.subtitle", {
            defaultValue:
              "ChatSched is an advertising agency, a verified publisher network and a live marketplace. Let us run your campaign, pick placements yourself, or earn from your own audience.",
          })}
        </p>

        <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <div className="lg:pt-1">
            <div
              role="tablist"
              aria-label={t("inventoryWall.switcherLabel", { defaultValue: "Choose how you want to use ChatSched" })}
              className="grid grid-cols-3 lg:grid-cols-1 gap-2.5 sm:gap-4"
            >
              {tabs.map((tab) => {
                const active = branch === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[tab.id] = el; }}
                    id={`wall-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`wall-panel-${tab.id}`}
                    tabIndex={active ? 0 : -1}
                    data-cta={`wall-tab-${tab.id}`}
                    onClick={() => selectBranch(tab.id)}
                    onKeyDown={(e) => onTabKeyDown(e, tab.id)}
                    className={`group min-w-0 w-full text-left rounded-xl border-[3px] border-billboard-ink p-2.5 lg:p-4 flex flex-col lg:flex-row lg:items-center gap-2.5 lg:gap-4 transition-all duration-150 motion-reduce:transition-none motion-reduce:transform-none ${
                      active
                        ? "bg-billboard-ink text-billboard-paper translate-x-[5px] translate-y-[5px] shadow-none"
                        : "bg-billboard-paper text-billboard-ink shadow-[5px_5px_0_#1A1712] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#1A1712]"
                    }`}
                  >
                    <BranchTile branch={tab.id} inverted={active} />
                    <span className="min-w-0 flex-1">
                      <span className={`block font-mono text-[10px] font-bold tracking-wider ${active ? "text-billboard-yellow" : "text-billboard-inkSoft"}`}>{tab.num}</span>
                      <span className="block font-display text-sm lg:text-2xl leading-tight">
                        <span className="lg:hidden">{tab.short}</span>
                        <span className="hidden lg:inline">{tab.name}</span>
                      </span>
                      <span className={`hidden lg:block text-sm mt-0.5 ${active ? "text-billboard-paperDim" : "text-billboard-inkSoft"}`}>{tab.line}</span>
                      {tab.stat && (
                        <span className={`hidden lg:flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide font-bold mt-2 ${active ? "text-billboard-yellow" : "text-billboard-greenDeep"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-billboard-yellow" : "bg-billboard-green"}`} aria-hidden="true" />
                          {tab.stat}
                        </span>
                      )}
                    </span>
                    <span className={`hidden lg:block font-display text-2xl transition-transform ${active ? "text-billboard-yellow translate-x-1" : "text-billboard-ink group-hover:translate-x-1"}`} aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>

            <ul className="hidden lg:block mt-7 space-y-2 font-mono text-[11px] font-bold uppercase text-billboard-ink">
              <li>✓ {t("hero.noAccount")}</li>
              <li>✓ {t("hero.secure")}</li>
              <li>✓ {t("hero.tracked")}</li>
            </ul>
          </div>

          <div className="min-w-0">
            <div className="border-[3px] border-billboard-ink rounded-xl bg-billboard-paperDim shadow-block overflow-hidden lg:min-h-[36rem]">
              <div className="flex items-center justify-between gap-3 bg-billboard-ink text-billboard-yellow px-4 sm:px-6 py-2.5 font-mono text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em]">
                <span>{activeTab.num} / {activeTab.name}</span>
                <span className="flex items-center gap-2 text-billboard-paper">
                  <svg viewBox="0 0 26 22" className="w-5 h-4" fill="none" aria-hidden="true">
                    <rect x="1" y="1" width="24" height="14" stroke="currentColor" strokeWidth="2.4" />
                    <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2.4" />
                    <line x1="18" y1="15" x2="18" y2="21" stroke="currentColor" strokeWidth="2.4" />
                  </svg>
                  ChatSched
                </span>
              </div>

              <Panel id="marketplace" active={branch}>
                <div className="p-4 sm:p-6 lg:p-8">
                  <h2 className="font-display text-2xl md:text-3xl leading-tight mb-1">
                    {t("inventoryWall.marketplace.title", { defaultValue: "Find a placement. Book it today." })}
                  </h2>
                  <p className="text-billboard-inkSoft mb-5">
                    {t("inventoryWall.marketplace.body", { defaultValue: "Verified South African publishers, priced up front, with payment protected." })}
                  </p>

                  <form
                    onSubmit={handleSearch}
                    role="search"
                    aria-label={t("inventoryWall.searchLabel", { defaultValue: "Search marketplace inventory" })}
                    className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[1.3fr_1fr_1fr_auto] bg-billboard-paper border-[3px] border-billboard-ink rounded-lg overflow-hidden"
                  >
                    <label className="block px-4 py-3 border-b-2 sm:border-b-0 sm:border-r-2 border-billboard-ink">
                      <span className={labelCls}>{t("inventoryWall.what", { defaultValue: "What" })}</span>
                      <select value={what} onChange={(e) => setWhat(e.target.value as ChannelSlug | "")} className={fieldCls}>
                        <option value="">{t("inventoryWall.whatAny", { defaultValue: "Any channel" })}</option>
                        {enabledChannels.map((c) => <option key={c.definition.slug} value={c.definition.slug}>{c.definition.name}</option>)}
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
                    <button type="submit" data-cta="inventory-wall-search" className="bg-billboard-yellow text-billboard-ink font-bold px-6 py-4 sm:col-span-3 lg:col-span-1 border-t-2 lg:border-t-0 border-billboard-ink hover:bg-billboard-yellowDeep transition">
                      {t("inventoryWall.search", { defaultValue: "Search inventory →" })}
                    </button>
                  </form>

                  {channelTiles.length > 0 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label={t("inventoryWall.filterLabel", { defaultValue: "Filter inventory by channel" })}>
                      <button
                        type="button"
                        aria-pressed={selected === "all"}
                        onClick={() => setSelected("all")}
                        className={`shrink-0 rounded-lg border-2 border-billboard-ink px-3.5 py-2 text-sm font-bold transition ${selected === "all" ? "bg-billboard-ink text-billboard-yellow" : "bg-billboard-paper hover:-translate-y-0.5 hover:shadow-blockSm"}`}
                      >
                        {t("inventoryWall.all", { defaultValue: "All" })} <span className="font-mono text-[10px] ml-1">{publishers.length}</span>
                      </button>
                      {channelTiles.map((c) => {
                        const active = selected === c.slug;
                        return (
                          <button
                            key={c.slug}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSelected(c.slug)}
                            className={`shrink-0 inline-flex items-center gap-2 rounded-lg border-2 border-billboard-ink px-3 py-2 text-sm font-bold whitespace-nowrap transition ${active ? "bg-billboard-ink text-billboard-yellow" : "bg-billboard-paper hover:-translate-y-0.5 hover:shadow-blockSm"}`}
                          >
                            {c.name} <span className="font-mono text-[10px]">{c.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-5">
                    {loading ? (
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <PublisherCardSkeleton key={i} />)}</div>
                    ) : cards.length === 0 ? (
                      <div className="border-2 border-dashed border-billboard-ink rounded-xl bg-white">
                        <EmptyState
                          kind="list"
                          title={t("marketplace.emptyTitle", { defaultValue: "Listings are on the way" })}
                          description={t("marketplace.emptyDescription", { defaultValue: "New verified publishers are joining. Check back soon, or let us build your campaign." })}
                          compact
                        />
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-live="polite">
                        {cards.map((p) => <PublisherCard key={p.id} publisher={p} />)}
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    <RecentlyViewedStrip />
                  </div>

                  <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link to={browseHref} data-cta="inventory-wall-browse" className="brand-button yellow">
                        {selected === "all" || !selectedName
                          ? t("inventoryWall.viewAll", { defaultValue: "View all {{count}} listings →", count: publishers.length })
                          : t("inventoryWall.viewChannel", { defaultValue: "View all {{name}} listings →", name: selectedName })}
                      </Link>
                      <Link to={postHref} data-cta="inventory-wall-post" className="brand-button light">
                        {t("inventoryWall.post", { defaultValue: "Post an opportunity" })}
                      </Link>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <button type="button" onClick={() => selectBranch("agency", true)} className="text-left font-bold text-sm underline underline-offset-4 decoration-2 hover:decoration-4">
                        {t("inventoryWall.preferUs", { defaultValue: "Rather have us handle it? See the agency →" })}
                      </button>
                      <Link to="/audience-finder" data-cta="inventory-wall-audience-finder" className="font-bold text-sm underline underline-offset-4 decoration-2 hover:decoration-4">
                        {t("local.cta", { defaultValue: "Find your local audience →" })}
                      </Link>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel id="agency" active={branch}>
                <div className="p-5 sm:p-7 lg:p-10 grid xl:grid-cols-[1.1fr_1fr] gap-8 xl:gap-10 items-start">
                  <div>
                    <h2 className="font-display text-3xl md:text-4xl leading-tight mb-3">
                      {t("inventoryWall.agency.title", { defaultValue: "Hand us the brief. We do the rest." })}
                    </h2>
                    <p className="text-billboard-inkSoft max-w-prose mb-7 leading-relaxed">
                      {t("inventoryWall.agency.body", {
                        defaultValue: "No media-buying experience needed. ChatSched plans it, sources verified publishers and keeps request, payment and proof in one place.",
                      })}
                    </p>
                    <ol className="space-y-4 mb-8">
                      {steps.map((s, i) => (
                        <li key={s.title} className="flex gap-4 items-start">
                          <span className="shrink-0 w-9 h-9 rounded-md bg-billboard-ink text-billboard-yellow font-display text-lg flex items-center justify-center">{i + 1}</span>
                          <div>
                            <div className="font-bold text-lg leading-tight">{s.title}</div>
                            <div className="text-billboard-inkSoft">{s.body}</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link to="/build-my-campaign" data-cta="inventory-wall-build" className="brand-button dark">
                        {t("inventoryWall.agency.cta", { defaultValue: "Build my campaign →" })}
                      </Link>
                      <Link to="/how-it-works" data-cta="inventory-wall-how" className="brand-button light">
                        {t("inventoryWall.agency.secondary", { defaultValue: "See how it works" })}
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="border-[3px] border-billboard-ink rounded-xl bg-billboard-paper shadow-blockSm -rotate-1 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-billboard-inkSoft">
                          {t("inventoryWall.agency.exampleTag", { defaultValue: "Example brief" })}
                        </span>
                        <span className="w-7 h-5"><BranchMark branch="agency" /></span>
                      </div>
                      {[
                        { k: t("inventoryWall.agency.goal", { defaultValue: "Goal" }), v: t("inventoryWall.agency.goalEx", { defaultValue: "More customers through the door" }) },
                        { k: t("inventoryWall.agency.audience", { defaultValue: "Audience" }), v: t("inventoryWall.agency.audienceEx", { defaultValue: "Locals in my suburb" }) },
                        { k: t("inventoryWall.agency.budgetLabel", { defaultValue: "Budget" }), v: t("inventoryWall.agency.budgetEx", { defaultValue: "You set it" }) },
                      ].map((row) => (
                        <div key={row.k} className="flex items-baseline gap-3 py-2 border-t-2 border-dashed border-billboard-ink/30 first:border-t-0">
                          <span className="w-20 shrink-0 font-mono text-[10px] font-bold uppercase text-billboard-inkSoft">{row.k}</span>
                          <span className="font-semibold">{row.v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-[3px] border-billboard-ink rounded-xl bg-billboard-ink text-billboard-paper p-5">
                      <div className="font-mono text-[11px] uppercase tracking-wider text-billboard-yellow mb-3">
                        {t("inventoryWall.agency.channelsTitle", { defaultValue: "Channels we plan across" })}
                      </div>
                      <ul className="grid grid-cols-2 gap-2.5">
                        {enabledChannels.slice(0, 6).map((c) => (
                          <li key={c.definition.slug} className="flex items-center gap-2 text-sm font-semibold">
                            <ChannelIcon slug={c.definition.slug} size="sm" />
                            <span className="min-w-0 leading-tight">{c.definition.name}</span>
                          </li>
                        ))}
                      </ul>
                      {enabledChannels.length > 6 && (
                        <div className="mt-3 font-mono text-[11px] uppercase text-billboard-yellow">
                          {t("inventoryWall.agency.more", { defaultValue: "+ {{count}} more channels", count: enabledChannels.length - 6 })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel id="network" active={branch}>
                <div className="p-5 sm:p-7 lg:p-10 grid xl:grid-cols-[1fr_1.1fr] gap-8 xl:gap-10 items-start">
                  <div>
                    <h2 className="font-display text-3xl md:text-4xl leading-tight mb-3">
                      {t("inventoryWall.network.title", { defaultValue: "Own an audience? Get paid for it." })}
                    </h2>
                    <p className="text-billboard-inkSoft max-w-prose mb-7 leading-relaxed">
                      {t("inventoryWall.network.body", {
                        defaultValue: "Join ChatSched's verified publisher network. Businesses send you requests, you set your price, and payment is confirmed before you post.",
                      })}
                    </p>
                    <ul className="space-y-3 mb-8">
                      {[
                        t("inventoryWall.network.b1", { defaultValue: "Approve only the requests you want" }),
                        t("inventoryWall.network.b2", { defaultValue: "Set your own price" }),
                        t("inventoryWall.network.b3", { defaultValue: "Payment confirmed before you post" }),
                      ].map((b) => (
                        <li key={b} className="flex items-center gap-3 font-bold text-lg">
                          <span className="shrink-0 w-6 h-6 rounded-sm bg-billboard-green text-white text-sm flex items-center justify-center" aria-hidden="true">✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link to="/register?role=publisher" data-cta="inventory-wall-publisher" className="brand-button yellow">
                        {t("inventoryWall.network.cta", { defaultValue: "Join as a publisher →" })}
                      </Link>
                      <Link to="/for-publishers" data-cta="inventory-wall-publisher-more" className="brand-button light">
                        {t("inventoryWall.network.secondary", { defaultValue: "How earning works" })}
                      </Link>
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-billboard-inkSoft mb-3">
                      {showcase.length > 0
                        ? t("inventoryWall.network.showcase", { defaultValue: "Publishers already in the network" })
                        : t("inventoryWall.network.empty", { defaultValue: "Be one of the first publishers on the network" })}
                    </div>
                    {showcase.length > 0 && (
                      <ul className="grid sm:grid-cols-2 gap-3">
                        {showcase.map((p) => {
                          const channel = getChannelBySlug(p.channel_slug)?.definition.name;
                          return (
                            <li key={p.id}>
                              <Link to={`/browse/${p.id}`} className="flex items-center gap-3 rounded-lg border-[3px] border-billboard-ink bg-billboard-paper p-3 shadow-[4px_4px_0_#1A1712] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#1A1712] transition-all">
                                <PublisherAvatar imageUrl={p.profile_image_url} initials={p.initials} name={p.name} size="sm" />
                                <span className="min-w-0">
                                  <span className="block font-bold truncate">{p.name}</span>
                                  <span className="block font-mono text-[10px] uppercase text-billboard-inkSoft truncate">{[channel, p.city].filter(Boolean).join(" · ")}</span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <Link to="/media-network" data-cta="inventory-wall-network" className="inline-flex mt-5 font-bold underline underline-offset-4 decoration-2 hover:decoration-4">
                      {t("inventoryWall.network.explore", { defaultValue: "Explore the media network →" })}
                    </Link>
                  </div>
                </div>
              </Panel>
            </div>

            <div className="flex justify-between px-[14%] lg:px-[18%]" aria-hidden="true">
              <span className="block w-5 sm:w-7 h-8 sm:h-12 bg-billboard-ink" />
              <span className="block w-5 sm:w-7 h-8 sm:h-12 bg-billboard-ink" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
