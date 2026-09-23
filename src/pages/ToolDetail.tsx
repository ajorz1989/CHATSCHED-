import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Seo from "../components/Seo";
import SetupNotice from "../components/SetupNotice";
import { SkeletonBlock, SkeletonLine } from "../components/Skeleton";
import ToolIcon from "../components/ToolIcon";
import NotFound from "./NotFound";
import { TOOL_CATEGORIES } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import { formatSupabaseError } from "../lib/supabaseErrors";
import type { Tool, ToolFeature, ToolBenefit, ToolFaq } from "../lib/types";

const HOW_IT_WORKS = [
  { step: "Set up", copy: "Open the tool from your Dashboard or the public page — no separate account to create." },
  { step: "Connect", copy: "Tell it about your business or campaign in plain language; it uses what ChatSched already knows about your account where relevant." },
  { step: "Use", copy: "Get a result you can act on immediately — no manual is required to see value the first time." },
  { step: "Get results", copy: "Carry what it gives you straight into a campaign, a publisher conversation, or your next post." },
];

function priceLabel(tool: Tool): string {
  if (tool.pricing_model === "free") return "Free";
  if (tool.pricing_model === "included") return "Included with your ChatSched Business account";
  if (tool.pricing_model === "paid_monthly" && tool.monthly_price != null) return `${formatCurrency(tool.monthly_price)}/month`;
  if (tool.pricing_model === "paid_annual" && tool.annual_price != null) return `${formatCurrency(tool.annual_price)}/year`;
  if (tool.pricing_model === "paid_once" && tool.setup_price != null) return `${formatCurrency(tool.setup_price)} once-off`;
  if (tool.pricing_model === "custom") return "Custom pricing — get in touch";
  return "Pricing to be announced";
}

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [tool, setTool] = useState<Tool | null | undefined>(undefined); // undefined = loading, null = not found
  const [features, setFeatures] = useState<ToolFeature[]>([]);
  const [benefits, setBenefits] = useState<ToolBenefit[]>([]);
  const [faqs, setFaqs] = useState<ToolFaq[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !slug) return;
    setTool(undefined);
    setLoadError(null);
    (async () => {
      const { data, error } = await supabase.from("tools").select("*").eq("slug", slug).maybeSingle();
      if (error) {
        setLoadError(formatSupabaseError(error, "Couldn’t load this tool"));
        setTool(null);
        return;
      }
      setTool((data as Tool) ?? null);
      if (data) {
        const [f, b, q] = await Promise.all([
          supabase.from("tool_features").select("*").eq("tool_slug", slug).order("sort_order", { ascending: true }),
          supabase.from("tool_benefits").select("*").eq("tool_slug", slug).order("sort_order", { ascending: true }),
          supabase.from("tool_faqs").select("*").eq("tool_slug", slug).order("sort_order", { ascending: true }),
        ]);
        setFeatures((f.data ?? []) as ToolFeature[]);
        setBenefits((b.data ?? []) as ToolBenefit[]);
        setFaqs((q.data ?? []) as ToolFaq[]);
      }
    })();
  }, [slug]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  if (tool === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16" aria-busy="true" aria-label="Loading tool">
        <SkeletonLine className="w-1/3 h-5 mb-4" />
        <SkeletonBlock className="h-40" />
      </div>
    );
  }

  if (tool === null) {
    if (loadError) {
      return (
        <div className="max-w-3xl mx-auto px-4 sm:px-5 py-16">
          <div className="border-[3px] border-billboard-red text-billboard-red rounded p-6 text-sm">{loadError}</div>
          <Link to="/tools" className="inline-block mt-5 font-semibold underline">← Back to ChatSched Tools</Link>
        </div>
      );
    }
    return <NotFound />;
  }

  const comingSoon = tool.status === "coming_soon";
  const ctaPath = tool.requires_auth && tool.cta_url?.startsWith("/")
    ? "/login?next=" + encodeURIComponent(tool.cta_url)
    : tool.cta_url ?? undefined;
  const categoryLabel = TOOL_CATEGORIES.find((c) => c.value === tool.category)?.label ?? tool.category;

  return (
    <>
      <Seo title={`${tool.name} · ChatSched Tools`} description={tool.short_description} />

      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-12 sm:py-16 min-w-0">
        <Link to="/tools" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink transition inline-block mb-6">
          ← All tools
        </Link>

        {/* Hero */}
        <div className="flex items-start gap-3 sm:gap-4 mb-4 min-w-0">
          <ToolIcon name={tool.icon} size="lg" />
          <div className="min-w-0">
            <span className="inline-block font-mono text-[11px] font-semibold uppercase border border-billboard-ink/30 text-billboard-inkSoft px-2 py-0.5 rounded mb-2">
              {categoryLabel}{tool.badge ? ` · ${tool.badge}` : ""}
            </span>
            <h1 className="text-3xl md:text-4xl leading-tight">{tool.name}</h1>
          </div>
        </div>
        <p className="text-billboard-inkSoft text-lg mb-6 max-w-xl">{tool.short_description}</p>
        {tool.description && <p className="text-billboard-ink mb-8 max-w-xl">{tool.description}</p>}

        <div className="flex flex-wrap items-center gap-4 mb-12">
          {comingSoon ? (
            <span className="inline-flex items-center gap-2 border-[3px] border-billboard-inkSoft/40 text-billboard-inkSoft font-bold px-6 py-3 rounded">
              Coming soon
            </span>
          ) : ctaPath ? (
            ctaPath.startsWith("http") ? (
              <a href={ctaPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellow/80 transition">
                {tool.cta_label} →
              </a>
            ) : (
              <Link to={ctaPath} className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellow/80 transition">
                {tool.cta_label} →
              </Link>
            )
          ) : null}
          <span className="text-sm font-semibold text-billboard-inkSoft">{priceLabel(tool)}</span>
        </div>

        {comingSoon && (
          <div className="border-[3px] border-billboard-yellow bg-billboard-yellow/10 rounded p-5 mb-12">
            <p className="text-sm text-billboard-ink">
              This tool isn't live yet. Tell us you're interested and we'll let you know the moment it opens —
              use the <Link to="/contact" className="underline font-semibold">contact page</Link> or your account manager.
            </p>
          </div>
        )}

        {/* What it does */}
        {benefits.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-xl mb-5">What it does</h2>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b.id} className="flex gap-3">
                  <span className="text-billboard-green mt-0.5 shrink-0">✓</span>
                  <div>
                    <span className="font-semibold text-sm">{b.title}</span>
                    {b.description && <span className="text-billboard-inkSoft text-sm"> — {b.description}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* How it works */}
        {!comingSoon && (
          <section className="mb-12">
            <h2 className="font-display text-xl mb-5">How it works</h2>
            <ol className="grid sm:grid-cols-2 gap-4">
              {HOW_IT_WORKS.map((s, i) => (
                <li key={s.step} className="border-2 border-billboard-ink rounded p-4">
                  <span className="font-mono text-xs text-billboard-inkSoft">{String(i + 1).padStart(2, "0")}</span>
                  <p className="font-semibold text-sm mt-1">{s.step}</p>
                  <p className="text-billboard-inkSoft text-sm mt-1">{s.copy}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Features */}
        {features.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-xl mb-5">Features</h2>
            <ul className="space-y-3">
              {features.map((f) => (
                <li key={f.id} className="border-b border-billboard-ink/10 pb-3 last:border-0">
                  <p className="font-semibold text-sm">{f.title}</p>
                  {f.description && <p className="text-billboard-inkSoft text-sm mt-0.5">{f.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Who it's for */}
        {tool.target_customer && (
          <section className="mb-12">
            <h2 className="font-display text-xl mb-3">Who it's for</h2>
            <p className="text-billboard-ink">{tool.target_customer}</p>
          </section>
        )}

        {/* Pricing */}
        <section className="mb-12 border-[3px] border-billboard-ink rounded p-6 bg-billboard-paperDim">
          <h2 className="font-display text-xl mb-2">Pricing</h2>
          <p className="text-billboard-ink font-semibold">{priceLabel(tool)}</p>
          {tool.provider_name && tool.provider_name !== "ChatSched" && (
            <p className="text-billboard-inkSoft text-sm mt-2">Delivered with {tool.provider_name}.</p>
          )}
        </section>

        {/* FAQ */}
        {faqs.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-xl mb-5">FAQ</h2>
            <div className="space-y-4">
              {faqs.map((f) => (
                <div key={f.id}>
                  <p className="font-semibold text-sm">{f.question}</p>
                  <p className="text-billboard-inkSoft text-sm mt-1">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Final CTA */}
        {!comingSoon && ctaPath && (
          <div className="border-[3px] border-billboard-ink rounded p-6 sm:p-8 text-center">
            <h2 className="font-display text-2xl mb-4">Get started with {tool.name}.</h2>
            {ctaPath.startsWith("http") ? (
              <a href={ctaPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellow/80 transition">
                {tool.cta_label} →
              </a>
            ) : (
              <Link to={ctaPath} className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-6 py-3 rounded hover:bg-billboard-yellow/80 transition">
                {tool.cta_label} →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
