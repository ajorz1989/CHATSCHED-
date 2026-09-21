/**
 * Browse — the unified publisher/creator search page.
 *
 * Formerly two pages (a simple Browse grid and a separate Advanced Search).
 * This merges them into one: the old Advanced Search filter engine is now
 * the only search engine, reachable from a single "Browse" tab. `/search`
 * redirects here (see App.tsx) so old links and bookmarks keep working.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { usePublishers } from "../hooks/usePublishers";
import { usePublisherRateCards } from "../hooks/usePublisherRateCards";
import { getEnabledChannels } from "../lib/channelRegistry";
import { formatCurrency } from "../lib/currency";
import { CATEGORIES, PROVINCES, PLATFORMS, LANGUAGES, SA_CITIES_SUBURBS } from "../lib/constants";
import { MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import { makeDefaults, matchesFilters, applySort, activeCount, getMatchReason, type Filters } from "../lib/browseFilters";
import { CHANNEL_METADATA_FILTERS } from "../lib/channelMetadataFilters";
import { filtersToSearchParams, searchParamsToFilters } from "../lib/searchParamsCodec";
import type { Platform } from "../lib/types";
import PublisherCard from "../components/PublisherCard";
import { PublisherGridSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import Seo from "../components/Seo";
import SaveSearchButton from "../components/SaveSearchButton";
import RecentlyViewedStrip from "../components/RecentlyViewedStrip";
import { CloseIcon } from "../components/UiIcons";
import ChannelIcon from "../components/ChannelIcon";
import { PLATFORM_ICONS } from "../components/PlatformIcons";

const AGE_OPTIONS = [
  { value: "", label: "Any age group" },
  { value: "18-24", label: "18–24 (Gen Z / Students)" },
  { value: "25-34", label: "25–34 (Millennials)" },
  { value: "35-44", label: "35–44 (Parents / Professionals)" },
  { value: "45-54", label: "45–54 (Established Adults)" },
  { value: "55+", label: "55+ (Seniors)" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Any gender split" },
  { value: "women", label: "Mostly women" },
  { value: "men", label: "Mostly men" },
  { value: "mixed", label: "Mixed / balanced" },
];

const SORT_OPTIONS = [
  { value: "score", label: "Best match" },
  { value: "featured_desc", label: "Featured first" },
  { value: "response_asc", label: "Fastest to respond" },
  { value: "followers_desc", label: "Most followers" },
  { value: "price_asc", label: "Lowest price" },
  { value: "price_desc", label: "Highest price" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "engagement_desc", label: "Best engagement" },
  { value: "reach_desc", label: "Most reach" },
];

interface FilterChip {
  key: string;
  label: ReactNode;
  onRemove: () => void;
}

function buildFilterChips(f: Filters, channels: ReturnType<typeof getEnabledChannels>, update: (patch: Partial<Filters>) => void): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.query) chips.push({ key: "query", label: `"${f.query}"`, onRemove: () => update({ query: "" }) });
  if (f.channel) {
    const ch = channels.find(c => c.definition.slug === f.channel)?.definition;
    chips.push({ key: "channel", label: ch ? <span className="inline-flex items-center gap-1.5"><ChannelIcon slug={ch.slug} size="sm" />{ch.name}</span> : f.channel, onRemove: () => update({ channel: "", channelFilterValues: {} }) });
  }
  if (f.category) chips.push({ key: "category", label: f.category, onRemove: () => update({ category: "" }) });
  if (f.province) chips.push({ key: "province", label: f.province, onRemove: () => update({ province: "" }) });
  if (f.city) chips.push({ key: "city", label: f.city, onRemove: () => update({ city: "" }) });
  if (f.suburb) chips.push({ key: "suburb", label: f.suburb, onRemove: () => update({ suburb: "" }) });
  f.platforms.forEach(pl => chips.push({ key: `platform-${pl}`, label: pl, onRemove: () => update({ platforms: f.platforms.filter(p => p !== pl) }) }));
  if (f.verifiedOnly) chips.push({ key: "verified", label: "Verified only", onRemove: () => update({ verifiedOnly: false }) });
  if (f.minRating > 0) chips.push({ key: "rating", label: `${f.minRating}+ stars`, onRemove: () => update({ minRating: 0 }) });
  if (f.minFollowers) chips.push({ key: "minFollowers", label: `${Number(f.minFollowers).toLocaleString()}+ followers`, onRemove: () => update({ minFollowers: "" }) });
  if (f.maxFollowers) chips.push({ key: "maxFollowers", label: `Under ${Number(f.maxFollowers).toLocaleString()} followers`, onRemove: () => update({ maxFollowers: "" }) });
  if (f.minMonthlyReach) chips.push({ key: "reach", label: `${Number(f.minMonthlyReach).toLocaleString()}+ monthly reach`, onRemove: () => update({ minMonthlyReach: "" }) });
  if (f.minEngagement) chips.push({ key: "engagement", label: `${f.minEngagement}%+ engagement`, onRemove: () => update({ minEngagement: "" }) });
  if (f.maxPrice < 5000) chips.push({ key: "price", label: `Under ${formatCurrency(f.maxPrice)}`, onRemove: () => update({ maxPrice: 5000 }) });
  f.languages.forEach(lang => chips.push({ key: `lang-${lang}`, label: lang, onRemove: () => update({ languages: f.languages.filter(l => l !== lang) }) }));
  if (f.ageDemographic) {
    const opt = AGE_OPTIONS.find(o => o.value === f.ageDemographic);
    chips.push({ key: "age", label: opt ? opt.label.split(" (")[0] : f.ageDemographic, onRemove: () => update({ ageDemographic: "" }) });
  }
  if (f.gender) {
    const opt = GENDER_OPTIONS.find(o => o.value === f.gender);
    chips.push({ key: "gender", label: opt?.label ?? f.gender, onRemove: () => update({ gender: "" }) });
  }
  if (f.hasRateCard) chips.push({ key: "rateCard", label: "Published rate card", onRemove: () => update({ hasRateCard: false }) });
  // One chip per active channel-specific filter, labelled with the field's
  // own display label (e.g. "Competition level: Professional") so it reads
  // the same as every other chip rather than showing the raw field key.
  if (f.channel) {
    const fields = CHANNEL_METADATA_FILTERS[f.channel] ?? [];
    Object.entries(f.channelFilterValues).forEach(([key, value]) => {
      if (!value) return;
      const field = fields.find(fl => fl.key === key);
      if (!field) return;
      const displayValue = field.kind === "select" ? (field.options?.find(o => o.value === value)?.label ?? value)
        : field.kind === "boolean" ? "Yes"
        : `${value}+`;
      chips.push({
        key: `cf-${key}`,
        label: `${field.label}: ${displayValue}`,
        onRemove: () => update({ channelFilterValues: { ...f.channelFilterValues, [key]: "" } }),
      });
    });
  }
  return chips;
}

function FilterChipRow({ chips }: { chips: FilterChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-5" aria-label="Active filters">
      {chips.map(chip => (
        <button
          key={chip.key}
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1.5 bg-billboard-paperDim border-2 border-billboard-ink rounded-full pl-3 pr-2.5 py-1 text-xs font-semibold hover:bg-white transition"
        >
          {chip.label}
          <CloseIcon className="w-2.5 h-2.5 text-billboard-inkSoft" />
          <span className="sr-only">Remove active filter</span>
        </button>
      ))}
    </div>
  );
}

function SectionToggle({ label, open, onToggle, count }: { label: string; open: boolean; onToggle: () => void; count?: number }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-3.5 bg-billboard-paperDim font-bold text-sm"
    >
      <span className="flex items-center gap-2">
        {label}
        {count ? <span className="bg-billboard-green text-white font-mono text-[10px] px-1.5 py-0.5 rounded">{count}</span> : null}
      </span>
      <span className="font-mono text-billboard-inkSoft text-lg leading-none">{open ? "−" : "+"}</span>
    </button>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <line x1="3" y1="5.5" x2="17" y2="5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3" y1="14.5" x2="17" y2="14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7.5" cy="5.5" r="1.8" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9" cy="14.5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Renders the fields configured for the currently-selected channel (see
 * channelMetadataFilters.ts). Only ever mounted when filters.channel is
 * set to one specific channel — the parent ("Channel details") block
 * below returns null otherwise, so this never has to handle an
 * unconfigured/empty state on its own.
 */
function ChannelDetailFilters({ channel, values, update }: {
  channel: NonNullable<Filters["channel"]>;
  values: Record<string, string>;
  update: (patch: Partial<Filters>) => void;
}) {
  const fields = CHANNEL_METADATA_FILTERS[channel];
  if (!fields || fields.length === 0) return null;

  function setField(key: string, value: string) {
    update({ channelFilterValues: { ...values, [key]: value } });
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
      <h3 className="font-bold text-sm mb-1">Channel details</h3>
      <p className="text-xs text-billboard-inkSoft mb-3">Specific to this channel type.</p>
      <div className="space-y-3">
        {fields.map(field => (
          <div key={field.key}>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1">{field.label}</label>
            {field.kind === "select" && (
              <select
                value={values[field.key] ?? ""}
                onChange={e => setField(field.key, e.target.value)}
                className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 bg-white text-sm"
              >
                <option value="">Any</option>
                {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {field.kind === "boolean" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={values[field.key] === "true"}
                  onChange={e => setField(field.key, e.target.checked ? "true" : "")}
                  className="accent-billboard-green w-4 h-4"
                />
                Yes, required
              </label>
            )}
            {field.kind === "min_number" && (
              <input
                type="number"
                min={0}
                value={values[field.key] ?? ""}
                onChange={e => setField(field.key, e.target.value)}
                placeholder={field.unit ? `Min. ${field.unit}` : "Min."}
                className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 bg-white text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The entire filter form — used both in the always-visible desktop sidebar
 * and inside the mobile bottom sheet, so there's exactly one place that
 * knows how to render a filter field. Kept as a real module-level
 * component (not an inline function inside Browse) so it isn't redefined
 * on every keystroke, which would remount it and drop input focus.
 */
function FilterFields({
  filters, update, channels, togglePlatform, toggleLanguage,
  showAudience, onToggleAudience, showQuality, onToggleQuality,
}: {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  channels: ReturnType<typeof getEnabledChannels>;
  togglePlatform: (p: Platform) => void;
  toggleLanguage: (l: string) => void;
  showAudience: boolean;
  onToggleAudience: () => void;
  showQuality: boolean;
  onToggleQuality: () => void;
}) {
  return (
    <>
      <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Keyword</label>
        <input
          type="text"
          value={filters.query}
          onChange={e => update({ query: e.target.value })}
          placeholder="Name, audience, bio…"
          className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 bg-white text-sm"
        />
      </div>

      <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
        <h3 className="font-bold text-sm mb-3">Channel</h3>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            {/* Clearing the channel also clears channelFilterValues — those
                field keys are meaningless once no single channel is
                selected, and leaving them set would silently do nothing
                (matchesFilters only checks them when filters.channel is
                truthy) while still counting toward activeCount, which
                would be a confusing "phantom" active-filter count. */}
            <input type="radio" name="channel" checked={filters.channel === ""} onChange={() => update({ channel: "", channelFilterValues: {} })} className="accent-billboard-green w-4 h-4" />
            All channels
          </label>
          {channels.map(({ definition: ch }) => (
            <label key={ch.slug} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              {/* Switching to a different channel also resets
                  channelFilterValues — field keys are channel-specific
                  ("competitionLevel" only exists for sports), so carrying
                  them across a channel switch would silently apply a
                  filter with no matching field on the new channel. */}
              <input type="radio" name="channel" checked={filters.channel === ch.slug} onChange={() => update({ channel: ch.slug, channelFilterValues: {} })} className="accent-billboard-green w-4 h-4" />
              <ChannelIcon slug={ch.slug} size="sm" /> <span>{ch.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Channel-specific structured filters (channel_metadata, phase 74) —
          only rendered once a single channel is selected, since the fields
          ("competitionLevel", "hasDigitalMenu", etc.) have no meaning across
          channels. Returns null itself if the selected channel has no
          configured fields, so no empty box appears for a channel without
          any. */}
      {filters.channel && (
        <ChannelDetailFilters channel={filters.channel} values={filters.channelFilterValues} update={update} />
      )}

      <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
        <h3 className="font-bold text-sm mb-4">Location &amp; Category</h3>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Category</label>
        <select value={filters.category} onChange={e => update({ category: e.target.value })} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 mb-4 bg-white text-sm">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.slug} value={c.name}>{c.name}</option>)}
        </select>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Province</label>
        <select value={filters.province} onChange={e => update({ province: e.target.value })} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 mb-4 bg-white text-sm">
          <option value="">All provinces</option>
          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">City</label>
        <input
          type="text" value={filters.city}
          onChange={e => update({ city: e.target.value })}
          placeholder="e.g. Johannesburg"
          className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 mb-4 bg-white text-sm"
        />
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Suburb</label>
        <select value={filters.suburb} onChange={e => update({ suburb: e.target.value })} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 bg-white text-sm">
          <option value="">All suburbs</option>
          {SA_CITIES_SUBURBS.map(c => (
            <optgroup key={c.city} label={`${c.city}, ${c.province}`}>
              {c.suburbs.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
        <h3 className="font-bold text-sm mb-3">Platform</h3>
        <div className="space-y-2">
          {PLATFORMS.map(pl => {
            const Icon = PLATFORM_ICONS[pl];
            return (
              <label key={pl} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={filters.platforms.includes(pl)} onChange={() => togglePlatform(pl)} className="accent-billboard-green w-4 h-4" />
                {Icon && <Icon />}
                {pl}
              </label>
            );
          })}
        </div>
      </div>

      <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim">
        <h3 className="font-bold text-sm mb-3">Max price: <span className="font-mono">{formatCurrency(filters.maxPrice)}</span></h3>
        <input type="range" min={MIN_PRICE_PER_POST} max={5000} step={50} value={filters.maxPrice} onChange={e => update({ maxPrice: Number(e.target.value) })} className="w-full accent-billboard-green mb-2" />
        <div className="flex justify-between text-xs text-billboard-inkSoft font-mono"><span>{formatCurrency(MIN_PRICE_PER_POST)}</span><span>{formatCurrency(5000)}</span></div>
      </div>

      <div className="border-[3px] border-billboard-ink rounded overflow-hidden">
        <SectionToggle
          label="Audience &amp; Reach"
          open={showAudience}
          onToggle={onToggleAudience}
          count={[filters.minFollowers, filters.maxFollowers, filters.minMonthlyReach, filters.minEngagement, filters.languages.length, filters.ageDemographic, filters.gender].filter(Boolean).length || undefined}
        />
        {showAudience && (
          <div className="p-5 bg-billboard-paperDim border-t-2 border-billboard-ink space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1">Min followers</label>
                <input type="number" value={filters.minFollowers} onChange={e => update({ minFollowers: e.target.value })} placeholder="0" className="w-full border-2 border-billboard-ink rounded px-2 py-1.5 bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1">Max followers</label>
                <input type="number" value={filters.maxFollowers} onChange={e => update({ maxFollowers: e.target.value })} placeholder="Any" className="w-full border-2 border-billboard-ink rounded px-2 py-1.5 bg-white text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1">Min monthly reach</label>
              <input type="number" value={filters.minMonthlyReach} onChange={e => update({ minMonthlyReach: e.target.value })} placeholder="e.g. 5000" className="w-full border-2 border-billboard-ink rounded px-2 py-1.5 bg-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1">Min engagement rate (%)</label>
              <input type="number" min={0} max={100} step={0.5} value={filters.minEngagement} onChange={e => update({ minEngagement: e.target.value })} placeholder="e.g. 3" className="w-full border-2 border-billboard-ink rounded px-2 py-1.5 bg-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2">Languages</label>
              <div className="grid grid-cols-2 gap-1.5">
                {LANGUAGES.map(lang => (
                  <label key={lang} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={filters.languages.includes(lang)} onChange={() => toggleLanguage(lang)} className="accent-billboard-green" />
                    {lang}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1">
                Age group <span className="font-normal normal-case text-billboard-inkSoft">(from audience description)</span>
              </label>
              <select value={filters.ageDemographic} onChange={e => update({ ageDemographic: e.target.value })} className="w-full border-2 border-billboard-ink rounded px-2 py-1.5 bg-white text-sm">
                {AGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1">
                Gender split <span className="font-normal normal-case text-billboard-inkSoft">(from audience description)</span>
              </label>
              <select value={filters.gender} onChange={e => update({ gender: e.target.value })} className="w-full border-2 border-billboard-ink rounded px-2 py-1.5 bg-white text-sm">
                {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="border-[3px] border-billboard-ink rounded overflow-hidden">
        <SectionToggle
          label="Quality &amp; Trust"
          open={showQuality}
          onToggle={onToggleQuality}
          count={(filters.verifiedOnly ? 1 : 0) + (filters.minRating > 0 ? 1 : 0) + (filters.hasRateCard ? 1 : 0) || undefined}
        />
        {showQuality && (
          <div className="p-5 bg-billboard-paperDim border-t-2 border-billboard-ink space-y-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={filters.verifiedOnly} onChange={e => update({ verifiedOnly: e.target.checked })} className="accent-billboard-green w-4 h-4" />
              <span className="text-sm font-semibold">Verified publishers only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={filters.hasRateCard} onChange={e => update({ hasRateCard: e.target.checked })} className="accent-billboard-green w-4 h-4" />
              <span className="text-sm font-semibold">Published rate card</span>
            </label>
            <p className="text-xs text-billboard-inkSoft -mt-2">
              Shows publishers who've broken pricing down by format (Story, Reel, bundle, etc.) instead of one flat number — a sign of a publisher who's thought through how they'd actually work with you.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2">Minimum rating</label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => update({ minRating: 0 })} className={`text-xs font-mono px-2 py-1 rounded border-2 transition ${filters.minRating === 0 ? "border-billboard-ink bg-billboard-ink text-white" : "border-billboard-inkSoft text-billboard-inkSoft"}`}>Any</button>
                {[1, 2, 3, 4, 5].map(n => (
                  <button type="button" key={n} onClick={() => update({ minRating: n })} className={`text-lg leading-none transition ${n <= filters.minRating ? "text-billboard-yellow" : "text-billboard-paperDim"}`}>★</button>
                ))}
              </div>
              {filters.minRating > 0 && <p className="text-xs text-billboard-inkSoft mt-1">{filters.minRating}+ stars</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const channels = getEnabledChannels();

  const [filters, setFilters] = useState<Filters>(() => searchParamsToFilters(searchParams));
  const [showAudience, setShowAudience] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const { publishers, loading, error } = usePublishers();
  const { rateCardPublisherIds } = usePublisherRateCards();

  const update = (patch: Partial<Filters>) => setFilters(prev => ({ ...prev, ...patch }));

  // Bug fix: previously the cleanup was inside `if (filterSheetOpen)` so
  // overflow:hidden was never cleared if the component unmounted while the
  // sheet was open. Now the effect always returns cleanup.
  useEffect(() => {
    if (!filterSheetOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [filterSheetOpen]);

  useEffect(() => {
    if (!filterSheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFilterSheetOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterSheetOpen]);

  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const togglePlatform = (p: Platform) =>
    update({ platforms: filters.platforms.includes(p) ? filters.platforms.filter(x => x !== p) : [...filters.platforms, p] });

  const toggleLanguage = (l: string) =>
    update({ languages: filters.languages.includes(l) ? filters.languages.filter(x => x !== l) : [...filters.languages, l] });

  const filtered = useMemo(() => {
    const result = publishers.filter(p => matchesFilters(p, filters, rateCardPublisherIds));
    return applySort(result, filters.sortBy);
  }, [publishers, filters, rateCardPublisherIds]);

  const active = activeCount(filters);

  const mapHref = (() => {
    const params = filtersToSearchParams(filters);
    const qs = params.toString();
    return qs ? `/map?${qs}` : "/map";
  })();

  return (
    <>
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo
        title="Browse Publishers · ChatSched"
        description="Search South African publishers and creators by channel, suburb, category, platform, engagement, reach, language, demographics, rate card, channel-specific details and price."
      />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-3">
            Browse
          </span>
          <h1 className="text-3xl md:text-4xl mb-2">Find where your customers already spend their attention.</h1>
          <p className="text-billboard-inkSoft max-w-xl">
            {loading ? "Loading…" : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} match`}
            {active > 0 && <span> — {active} filter{active !== 1 ? "s" : ""} active</span>}
          </p>
        </div>
        {active > 0 && (
          <button type="button" onClick={() => setFilters(makeDefaults({}))} className="text-sm font-semibold text-billboard-inkSoft underline">
            Clear all ({active})
          </button>
        )}
        <SaveSearchButton filters={filters} resultCount={filtered.length} />
        <Link to={mapHref} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:bg-billboard-paperDim transition shrink-0">
          Map view →
        </Link>
      </div>

      {active === 0 && <RecentlyViewedStrip />}

      <section aria-labelledby="browse-live-channels" className="mb-6 border-[3px] border-billboard-ink rounded p-4 md:p-5 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 id="browse-live-channels" className="font-display text-lg">Live advertising channels</h2>
            <p className="text-xs text-billboard-inkSoft mt-0.5">All channels shown here are open for marketplace discovery now.</p>
          </div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-billboard-greenDeep">
            {channels.length} live
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Live advertising channels">
          {channels.map(({ definition: ch }) => {
            const selected = filters.channel === ch.slug;
            return (
              <button
                key={ch.slug}
                type="button"
                onClick={() => update({ channel: selected ? "" : ch.slug, channelFilterValues: {} })}
                aria-pressed={selected}
                className={`inline-flex items-center gap-2 shrink-0 border-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                  selected
                    ? "border-billboard-ink bg-billboard-ink text-billboard-paper"
                    : "border-billboard-ink/30 bg-billboard-paperDim hover:border-billboard-ink hover:bg-white"
                }`}
              >
                <ChannelIcon slug={ch.slug} size="sm" />
                <span>{ch.name}</span>
                <span className={`font-mono text-[10px] ${selected ? "text-billboard-paper/70" : "text-billboard-inkSoft"}`}>
                  LIVE
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mb-6 border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span><strong>{loading ? "—" : publishers.length}</strong> verified publisher{publishers.length === 1 ? "" : "s"} currently visible.</span>
        <Link to="/trust/fraud-prevention" className="font-semibold underline">How verification and fraud checks work →</Link>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-10">
        <aside className="hidden md:block space-y-4 sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
          <FilterFields
            filters={filters}
            update={update}
            channels={channels}
            togglePlatform={togglePlatform}
            toggleLanguage={toggleLanguage}
            showAudience={showAudience}
            onToggleAudience={() => setShowAudience(s => !s)}
            showQuality={showQuality}
            onToggleQuality={() => setShowQuality(s => !s)}
          />
        </aside>

        <div>
          <FilterChipRow chips={buildFilterChips(filters, channels, update)} />
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <p className="text-sm text-billboard-inkSoft">
              {loading ? "Loading…" : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                className="md:hidden inline-flex items-center gap-1.5 border-2 border-billboard-ink rounded px-3 py-1.5 text-sm font-semibold bg-white"
              >
                <FilterIcon />
                Filters
                {active > 0 && <span className="bg-billboard-green text-white font-mono text-[10px] px-1.5 py-0.5 rounded-full">{active}</span>}
              </button>
              <label className="text-xs font-semibold uppercase tracking-wide shrink-0">Sort</label>
              <select value={filters.sortBy} onChange={e => update({ sortBy: e.target.value })} className="border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm bg-white">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {error ? (
            <div className="border-[3px] border-dashed border-billboard-ink rounded">
              <EmptyState
                kind="search"
                title="Couldn’t load publishers"
                description="Something went wrong loading the list. Try refreshing the page."
                action={
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-billboard-yellow"
                  >
                    Refresh page
                  </button>
                }
              />
            </div>
          ) : loading ? (
            <PublisherGridSkeleton count={6} />
          ) : filtered.length === 0 ? (
            <div className="border-[3px] border-dashed border-billboard-ink rounded">
              <EmptyState
                kind="search"
                title="No publishers match those filters"
                description="This list grows every week — try widening your filters or check back soon."
                action={
                  <button type="button" onClick={() => setFilters(makeDefaults({}))} className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
                    Clear all filters
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map(p => (
                <PublisherCard key={p.id} publisher={p} matchReason={filters.sortBy === "score" ? getMatchReason(p) : null} />
              ))}
            </div>
          )}

          <p className="text-xs text-billboard-inkSoft mt-6">
            Looking for a specific advertising channel instead of an individual publisher? See the full{" "}
            <Link to="/channels" className="underline font-semibold">channel directory</Link>.
          </p>
        </div>
      </div>
    </div>

    {filterSheetOpen && (
      <div className="md:hidden fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-heading">
        <div
          className="absolute inset-0 bg-billboard-ink/40"
          onClick={() => setFilterSheetOpen(false)}
          aria-hidden="true"
        />
        <div
          className="relative w-full max-h-[85vh] bg-white border-t-[3px] border-billboard-ink rounded-t-2xl overflow-hidden flex flex-col"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="w-10 h-1 bg-billboard-ink/20 rounded-full mx-auto mt-2.5 mb-1" aria-hidden="true" />
          <div className="flex items-center justify-between px-5 py-3 border-b-2 border-billboard-paperDim shrink-0">
            <h2 id="filter-sheet-heading" className="font-display text-base">Filters</h2>
            <button type="button" onClick={() => setFilterSheetOpen(false)} aria-label="Close filters" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-billboard-paperDim"><CloseIcon className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <FilterFields
              filters={filters}
              update={update}
              channels={channels}
              togglePlatform={togglePlatform}
              toggleLanguage={toggleLanguage}
              showAudience={showAudience}
              onToggleAudience={() => setShowAudience(s => !s)}
              showQuality={showQuality}
              onToggleQuality={() => setShowQuality(s => !s)}
            />
          </div>
          <div className="shrink-0 border-t-2 border-billboard-ink p-4 flex items-center gap-3 bg-white">
            {active > 0 && (
              <button type="button" onClick={() => setFilters(makeDefaults({}))} className="text-sm font-semibold text-billboard-inkSoft underline shrink-0">
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="flex-1 bg-billboard-green border-[3px] border-billboard-greenDeep text-white font-bold py-3 rounded hover:bg-billboard-greenDeep transition"
            >
              Show {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
