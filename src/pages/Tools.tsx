import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Seo from "../components/Seo";
import SetupNotice from "../components/SetupNotice";
import { SkeletonRows } from "../components/Skeleton";
import ToolIcon from "../components/ToolIcon";
import { TOOL_CATEGORIES } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import { formatSupabaseError } from "../lib/supabaseErrors";
import type { Tool, ToolCategory } from "../lib/types";

/**
 * The database is the only catalogue — this page renders whatever
 * `tools` (schema_phase100_chatsched_tools.sql) hands back, nothing
 * hardcoded here duplicates or overrides it. RLS already limits an
 * anonymous/business read to status in (active, coming_soon), so a
 * plain `select *` is safe; this component still never renders a
 * coming_soon row inside the main grid, keeping that separation even if
 * RLS or a future admin change ever widened what the query returns.
 */

function priceLabel(tool: Tool): string {
  if (tool.status === "coming_soon") return "";
  if (tool.pricing_model === "free") return "Free";
  if (tool.pricing_model === "included") return "Included with your plan";
  if (tool.pricing_model === "paid_monthly" && tool.monthly_price != null) return `From ${formatCurrency(tool.monthly_price)}/month`;
  if (tool.pricing_model === "paid_annual" && tool.annual_price != null) return `From ${formatCurrency(tool.annual_price)}/year`;
  if (tool.pricing_model === "paid_once" && tool.setup_price != null) return `From ${formatCurrency(tool.setup_price)}`;
  if (tool.pricing_model === "custom") return "Custom pricing";
  return "";
}

function ToolCard({ tool }: { tool: Tool }) {
  const comingSoon = tool.status === "coming_soon";
  return (
    <div
      className={`relative border-[3px] rounded overflow-hidden flex flex-col transition-shadow ${
        comingSoon
          ? "border-billboard-inkSoft/40 bg-billboard-paperDim opacity-80"
          : "border-billboard-ink bg-billboard-paper hover:shadow-[4px_4px_0_0_#1a1a1a] hover:-translate-y-0.5"
      }`}
    >
      {comingSoon && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 border border-billboard-inkSoft/50 text-billboard-inkSoft font-mono text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-white/60">
            Coming soon
          </span>
        </div>
      )}
      {!comingSoon && tool.featured && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 border border-billboard-yellowDeep text-billboard-yellowDeep font-mono text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-white/80">
            Featured
          </span>
        </div>
      )}

      <div className="p-5 pb-4 border-b border-billboard-ink/10">
        <div className="mb-3"><ToolIcon name={tool.icon} /></div>
        <h3 className="font-display text-lg leading-tight mb-1">{tool.name}</h3>
        <p className="text-billboard-inkSoft text-sm leading-snug">{tool.short_description}</p>
      </div>

      <div className="px-5 pt-4 pb-2 flex-1">
        {priceLabel(tool) && <p className="text-sm font-semibold">{priceLabel(tool)}</p>}
      </div>

      <div className="px-5 pb-5">
        <Link
          to={`/tools/${tool.slug}`}
          className={`block w-full text-center border-[3px] font-bold text-sm px-4 py-2.5 rounded transition hover:-translate-y-0.5 ${
            comingSoon
              ? "border-billboard-inkSoft/40 text-billboard-inkSoft hover:border-billboard-inkSoft"
              : "border-billboard-ink bg-billboard-yellow text-billboard-ink hover:bg-billboard-yellowDeep"
          }`}
        >
          {comingSoon ? "Learn more →" : `${tool.cta_label} →`}
        </Link>
      </div>
    </div>
  );
}

function CategorySection({ category, tools }: { category: ToolCategory; tools: Tool[] }) {
  if (tools.length === 0) return null;
  const meta = TOOL_CATEGORIES.find((c) => c.value === category);
  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="font-display text-xl">{meta?.label ?? category}</h2>
        <div className="flex-1 h-[3px] bg-billboard-ink/10 rounded" />
        <span className="font-mono text-xs text-billboard-inkSoft">{tools.length} tool{tools.length !== 1 ? "s" : ""}</span>
      </div>
      {meta?.blurb && <p className="text-billboard-inkSoft text-sm mb-5 max-w-xl">{meta.blurb}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((t) => <ToolCard key={t.slug} tool={t} />)}
      </div>
    </section>
  );
}

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<"all" | ToolCategory>("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const { data, error } = await supabase.from("tools").select("*").order("sort_order", { ascending: true });
      if (error) setLoadError(formatSupabaseError(error, "Couldn’t load ChatSched Tools"));
      else setTools((data ?? []) as Tool[]);
      setLoading(false);
    })();
  }, []);

  if (!isSupabaseConfigured) return <SetupNotice />;

  const active = tools.filter((t) => t.status === "active");
  const comingSoon = tools.filter((t) => t.status === "coming_soon");
  const featured = active.filter((t) => t.featured);
  const visibleActive = categoryFilter === "all" ? active : active.filter((t) => t.category === categoryFilter);

  return (
    <>
      <Seo
        title="ChatSched Tools — Practical tools to get more customers"
        description="Practical tools for getting leads, handling customers, taking bookings, creating campaigns and growing your advertising — all from ChatSched."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-12 sm:py-16 min-w-0">
        <div className="mb-10">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink text-billboard-ink px-3 py-1.5 rounded mb-4">
            ChatSched Tools
          </span>
          <h1 className="text-4xl mb-3">Tools to help your business get more customers.</h1>
          <p className="text-billboard-inkSoft text-lg max-w-2xl mb-6">
            Practical tools for leads, bookings, customer communication, advertising and growth — all from ChatSched.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#catalogue" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellowDeep transition hover:-translate-y-0.5">
              Explore Tools
            </a>
            <Link to="/build-my-campaign" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-paperDim transition">
              Build a Campaign
            </Link>
          </div>
        </div>

        {loading ? (
          <SkeletonRows count={4} />
        ) : loadError ? (
          <div className="border-[3px] border-billboard-red text-billboard-red rounded p-6 text-sm">{loadError}</div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="font-display text-xl">Featured</h2>
                  <div className="flex-1 h-[3px] bg-billboard-ink/10 rounded" />
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featured.map((t) => <ToolCard key={t.slug} tool={t} />)}
                </div>
              </section>
            )}

            <div id="catalogue" className="flex gap-2 mb-8 overflow-x-auto">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 border-billboard-ink whitespace-nowrap transition ${categoryFilter === "all" ? "bg-billboard-ink text-white" : "bg-white"}`}
              >
                All ({active.length})
              </button>
              {TOOL_CATEGORIES.map((c) => {
                const count = active.filter((t) => t.category === c.value).length;
                if (count === 0) return null;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategoryFilter(c.value)}
                    className={`font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 border-billboard-ink whitespace-nowrap transition ${categoryFilter === c.value ? "bg-billboard-ink text-white" : "bg-white"}`}
                  >
                    {c.label} ({count})
                  </button>
                );
              })}
            </div>

            {visibleActive.length === 0 ? (
              <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft text-sm mb-12">
                Nothing in this category yet.
              </div>
            ) : categoryFilter === "all" ? (
              <div className="space-y-12 mb-12">
                {TOOL_CATEGORIES.map((c) => (
                  <CategorySection key={c.value} category={c.value} tools={active.filter((t) => t.category === c.value)} />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                {visibleActive.map((t) => <ToolCard key={t.slug} tool={t} />)}
              </div>
            )}

            {comingSoon.length > 0 && (
              <section className="mb-4">
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="font-display text-xl">On the way</h2>
                  <div className="flex-1 h-[3px] bg-billboard-ink/10 rounded" />
                  <span className="font-mono text-xs text-billboard-inkSoft">{comingSoon.length} tool{comingSoon.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {comingSoon.map((t) => <ToolCard key={t.slug} tool={t} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
