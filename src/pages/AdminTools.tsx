import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import Seo from "../components/Seo";
import SetupNotice from "../components/SetupNotice";
import { SkeletonRows } from "../components/Skeleton";
import Button from "../components/Button";
import {
  TOOL_CATEGORIES,
  TOOL_STATUSES,
  TOOL_STATUS_LABEL,
  TOOL_TYPES,
  TOOL_TYPE_LABEL,
  TOOL_PRICING_MODELS,
  TOOL_PRICING_LABEL,
  defaultToolCtaLabel,
} from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import type { Tool, ToolCategory, ToolType, ToolStatus, ToolPricingModel } from "../lib/types";

/**
 * Standalone admin CRUD for the ChatSched Tools catalogue
 * (schema_phase100_chatsched_tools.sql). Its own route (/admin/tools), not
 * a tab inside Admin.tsx — same reasoning as AdminCareers.tsx: this is a
 * separate workflow (author/publish a catalogue) with its own multi-field
 * create/edit form, not a status-transition queue like most of the tabs
 * in Admin.tsx's Tab union. See PHASE100_CHATSCHED_TOOLS_DELIVERY.md.
 *
 * "Preview" (Section 22 of the ChatSched Tools brief) doesn't need special
 * plumbing here: RLS's tools_admin_all policy already lets an
 * authenticated admin read a tool at any status, so linking straight to
 * the real public /tools/:slug route previews it exactly as it will look
 * once published — including draft/paused/archived rows nobody else can
 * see.
 */

async function logAdminAction(action: string, targetTable: string, targetId: string | null, detail?: Record<string, unknown>) {
  try {
    await supabase.rpc("log_admin_action", { p_action: action, p_target_table: targetTable, p_target_id: targetId, p_detail: detail ?? null });
  } catch (err) {
    console.warn("Audit log write failed (non-fatal)", err);
  }
}

type Bullet = { title: string; description: string };
type Faq = { question: string; answer: string };

interface ToolFormState {
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category: ToolCategory;
  tool_type: ToolType;
  icon: string;
  image_url: string;
  badge: string;
  status: ToolStatus;
  featured: boolean;
  sort_order: number;
  cta_label: string;
  cta_url: string;
  requires_auth: boolean;
  pricing_model: ToolPricingModel;
  setup_price: string;
  monthly_price: string;
  annual_price: string;
  target_customer: string;
  provider_name: string;
}

const BLANK_FORM: ToolFormState = {
  slug: "",
  name: "",
  short_description: "",
  description: "",
  category: "get_customers",
  tool_type: "native",
  icon: "",
  image_url: "",
  badge: "",
  status: "draft",
  featured: false,
  sort_order: 0,
  cta_label: "View Tool",
  cta_url: "",
  requires_auth: false,
  pricing_model: "tbd",
  setup_price: "",
  monthly_price: "",
  annual_price: "",
  target_customer: "",
  provider_name: "",
};

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toFormState(tool: Tool): ToolFormState {
  return {
    slug: tool.slug,
    name: tool.name,
    short_description: tool.short_description,
    description: tool.description,
    category: tool.category,
    tool_type: tool.tool_type,
    icon: tool.icon ?? "",
    image_url: tool.image_url ?? "",
    badge: tool.badge ?? "",
    status: tool.status,
    featured: tool.featured,
    sort_order: tool.sort_order,
    cta_label: tool.cta_label,
    cta_url: tool.cta_url ?? "",
    requires_auth: tool.requires_auth,
    pricing_model: tool.pricing_model,
    setup_price: tool.setup_price != null ? String(tool.setup_price) : "",
    monthly_price: tool.monthly_price != null ? String(tool.monthly_price) : "",
    annual_price: tool.annual_price != null ? String(tool.annual_price) : "",
    target_customer: tool.target_customer ?? "",
    provider_name: tool.provider_name ?? "",
  };
}

function priceSummary(tool: Tool): string {
  if (tool.pricing_model === "free") return "Free";
  if (tool.pricing_model === "included") return "Included";
  if (tool.pricing_model === "tbd") return "TBD";
  if (tool.pricing_model === "custom") return "Custom";
  const parts: string[] = [];
  if (tool.setup_price != null) parts.push(`${formatCurrency(tool.setup_price)} setup`);
  if (tool.pricing_model === "paid_monthly" && tool.monthly_price != null) parts.push(`${formatCurrency(tool.monthly_price)}/mo`);
  if (tool.pricing_model === "paid_annual" && tool.annual_price != null) parts.push(`${formatCurrency(tool.annual_price)}/yr`);
  return parts.length ? parts.join(" + ") : TOOL_PRICING_LABEL[tool.pricing_model];
}

export default function AdminTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ToolStatus>("all");

  const [editingSlug, setEditingSlug] = useState<string | null>(null); // null = closed, "__new__" = creating
  const [form, setForm] = useState<ToolFormState>(BLANK_FORM);
  const [features, setFeatures] = useState<Bullet[]>([]);
  const [benefits, setBenefits] = useState<Bullet[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [childContentReady, setChildContentReady] = useState(true);
  const [actingSlug, setActingSlug] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from("tools").select("*").order("sort_order", { ascending: true });
    if (error) {
      setLoadError(formatSupabaseError(error, "Couldn't load tools"));
    } else {
      setTools((data ?? []) as Tool[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isSupabaseConfigured) load();
  }, []);

  if (!isSupabaseConfigured) return <SetupNotice />;

  function openCreate() {
    setForm({ ...BLANK_FORM });
    setFeatures([]);
    setBenefits([]);
    setFaqs([]);
    setSaveError(null);
    setActionError(null);
    setChildContentReady(true);
    setEditingSlug("__new__");
  }

  async function openEdit(tool: Tool) {
    setForm(toFormState(tool));
    setSaveError(null);
    setActionError(null);
    setChildContentReady(false);
    setEditingSlug(tool.slug);
    const [f, b, q] = await Promise.all([
      supabase.from("tool_features").select("title, description").eq("tool_slug", tool.slug).order("sort_order", { ascending: true }),
      supabase.from("tool_benefits").select("title, description").eq("tool_slug", tool.slug).order("sort_order", { ascending: true }),
      supabase.from("tool_faqs").select("question, answer").eq("tool_slug", tool.slug).order("sort_order", { ascending: true }),
    ]);
    const childErrors = [f.error, b.error, q.error].filter(Boolean);
    if (childErrors.length > 0) {
      setSaveError("Could not load this tool’s supporting content. Close and reopen the editor before saving.");
      setFeatures([]);
      setBenefits([]);
      setFaqs([]);
      setChildContentReady(false);
      return;
    }
    setFeatures((f.data ?? []) as Bullet[]);
    setBenefits((b.data ?? []) as Bullet[]);
    setFaqs((q.data ?? []) as Faq[]);
    setChildContentReady(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditingSlug(null);
    setSaveError(null);
    setActionError(null);
    setChildContentReady(true);
  }

  function updateField<K extends keyof ToolFormState>(key: K, value: ToolFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function replaceChildRows(slug: string): Promise<string | null> {
    // The child lists are small, so replacement is intentionally simple, but
    // every mutation is checked so a rejected write is visible to the admin.
    const featureDelete = await supabase.from("tool_features").delete().eq("tool_slug", slug);
    if (featureDelete.error) return formatSupabaseError(featureDelete.error, "Could not replace tool features");
    const benefitDelete = await supabase.from("tool_benefits").delete().eq("tool_slug", slug);
    if (benefitDelete.error) return formatSupabaseError(benefitDelete.error, "Could not replace tool benefits");
    const faqDelete = await supabase.from("tool_faqs").delete().eq("tool_slug", slug);
    if (faqDelete.error) return formatSupabaseError(faqDelete.error, "Could not replace tool FAQs");

    const featureRows = features.filter((f) => f.title.trim()).map((f, i) => ({ tool_slug: slug, title: f.title.trim(), description: f.description.trim(), sort_order: i }));
    const benefitRows = benefits.filter((b) => b.title.trim()).map((b, i) => ({ tool_slug: slug, title: b.title.trim(), description: b.description.trim(), sort_order: i }));
    const faqRows = faqs.filter((q) => q.question.trim()).map((q, i) => ({ tool_slug: slug, question: q.question.trim(), answer: q.answer.trim(), sort_order: i }));

    if (featureRows.length) {
      const result = await supabase.from("tool_features").insert(featureRows);
      if (result.error) return formatSupabaseError(result.error, "Could not save tool features");
    }
    if (benefitRows.length) {
      const result = await supabase.from("tool_benefits").insert(benefitRows);
      if (result.error) return formatSupabaseError(result.error, "Could not save tool benefits");
    }
    if (faqRows.length) {
      const result = await supabase.from("tool_faqs").insert(faqRows);
      if (result.error) return formatSupabaseError(result.error, "Could not save tool FAQs");
    }
    return null;
  }

  async function save() {
    const slug = editingSlug === "__new__" ? slugify(form.slug || form.name) : editingSlug!;
    if (!slug) {
      setSaveError("Name or slug is required.");
      return;
    }
    if (!form.name.trim() || !form.short_description.trim()) {
      setSaveError("Name and short description are required.");
      return;
    }

    if (!childContentReady) {
      setSaveError("Supporting content has not finished loading. Close and reopen the editor, then try again.");
      return;
    }

    for (const [label, value] of [
      ["Setup price", form.setup_price],
      ["Monthly price", form.monthly_price],
      ["Annual price", form.annual_price],
    ] as const) {
      if (value.trim() === "") continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setSaveError(label + " must be a valid non-negative number.");
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    setActionError(null);

    const isNew = editingSlug === "__new__";
    const row = {
      slug,
      name: form.name.trim(),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      category: form.category,
      tool_type: form.tool_type,
      icon: form.icon.trim() || null,
      image_url: form.image_url.trim() || null,
      badge: form.badge.trim() || null,
      status: form.status,
      featured: form.featured,
      sort_order: form.sort_order,
      cta_label: form.cta_label.trim() || defaultToolCtaLabel(form.status, form.pricing_model),
      cta_url: form.cta_url.trim() || null,
      requires_auth: form.requires_auth,
      pricing_model: form.pricing_model,
      setup_price: form.setup_price.trim() ? Number(form.setup_price) : null,
      monthly_price: form.monthly_price.trim() ? Number(form.monthly_price) : null,
      annual_price: form.annual_price.trim() ? Number(form.annual_price) : null,
      target_customer: form.target_customer.trim() || null,
      provider_name: form.provider_name.trim() || null,
      updated_at: new Date().toISOString(),
      published_at: form.status === "active"
        ? (isNew ? new Date().toISOString() : (tools.find((t) => t.slug === slug)?.published_at ?? new Date().toISOString()))
        : null,
    };

    const { error } = isNew
      ? await supabase.from("tools").insert(row)
      : await supabase.from("tools").update(row).eq("slug", slug);

    if (error) {
      setSaveError(formatSupabaseError(error, "Couldn't save tool"));
      setSaving(false);
      return;
    }

    const childError = await replaceChildRows(slug);
    if (childError) {
      setSaving(false);
      setSaveError(childError);
      return;
    }
    await logAdminAction(isNew ? "tool_create" : "tool_update", "tools", slug, { status: form.status });
    setSaving(false);
    closeEditor();
    load();
  }

  async function quickSetStatus(tool: Tool, status: ToolStatus) {
    setActingSlug(tool.slug);
    setActionError(null);
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "active" && !tool.published_at) patch.published_at = new Date().toISOString();
    const { error } = await supabase.from("tools").update(patch).eq("slug", tool.slug);
    if (error) {
      setActionError(formatSupabaseError(error, "Could not change " + tool.name + " status"));
      setActingSlug(null);
      return;
    }
    await logAdminAction("tool_status_change", "tools", tool.slug, { from: tool.status, to: status });
    setActingSlug(null);
    load();
  }

  async function duplicateTool(tool: Tool) {
    setActingSlug(tool.slug);
    let newSlug = `${tool.slug}-copy`;
    let n = 2;
    const existing = new Set(tools.map((t) => t.slug));
    while (existing.has(newSlug)) {
      newSlug = `${tool.slug}-copy-${n}`;
      n += 1;
    }
    const { published_at: _publishedAt, created_at: _createdAt, updated_at: _updatedAt, ...rest } = tool;
    void _publishedAt; void _createdAt; void _updatedAt;
    const { error } = await supabase.from("tools").insert({ ...rest, slug: newSlug, name: `${tool.name} (Copy)`, status: "draft", featured: false, published_at: null });
    if (error) {
      setActionError(formatSupabaseError(error, "Could not duplicate " + tool.name));
      setActingSlug(null);
      return;
    }
    {
      const [f, b, q] = await Promise.all([
        supabase.from("tool_features").select("title, description, sort_order").eq("tool_slug", tool.slug),
        supabase.from("tool_benefits").select("title, description, sort_order").eq("tool_slug", tool.slug),
        supabase.from("tool_faqs").select("question, answer, sort_order").eq("tool_slug", tool.slug),
      ]);
      if (f.error || b.error || q.error) {
        setActionError("Could not load all supporting content for " + tool.name + ". The duplicate was created without copying every child row.");
      } else {
        if (f.data?.length) {
          const result = await supabase.from("tool_features").insert(f.data.map((r) => ({ ...r, tool_slug: newSlug })));
          if (result.error) setActionError(formatSupabaseError(result.error, "Could not copy tool features"));
        }
        if (b.data?.length) {
          const result = await supabase.from("tool_benefits").insert(b.data.map((r) => ({ ...r, tool_slug: newSlug })));
          if (result.error) setActionError(formatSupabaseError(result.error, "Could not copy tool benefits"));
        }
        if (q.data?.length) {
          const result = await supabase.from("tool_faqs").insert(q.data.map((r) => ({ ...r, tool_slug: newSlug })));
          if (result.error) setActionError(formatSupabaseError(result.error, "Could not copy tool FAQs"));
        }
        await logAdminAction("tool_duplicate", "tools", newSlug, { from: tool.slug });
      }
    }
    setActingSlug(null);
    load();
  }

  const visible = statusFilter === "all" ? tools : tools.filter((t) => t.status === statusFilter);
  const stats = {
    total: tools.length,
    active: tools.filter((t) => t.status === "active").length,
    draft: tools.filter((t) => t.status === "draft").length,
    coming_soon: tools.filter((t) => t.status === "coming_soon").length,
    featured: tools.filter((t) => t.featured).length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-5 py-12 sm:py-16 min-w-0">
      <Seo title="Tools Admin · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Admin</span>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <h1 className="text-3xl md:text-4xl">ChatSched Tools.</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin" className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition shrink-0">
            ← Main admin
          </Link>
          <Button variant="primary" size="sm" onClick={openCreate}>+ New Tool</Button>
        </div>
      </div>
      <p className="text-billboard-inkSoft mb-8">Only Active tools appear on the public /tools page. Coming Soon can show in a separate section. Draft and Archived are never public — enforced by RLS, not just this UI.</p>

      {loadError && <div className="border-2 border-billboard-red text-billboard-red rounded p-4 mb-6 text-sm">{loadError}</div>}
      {actionError && <div className="border-2 border-billboard-red text-billboard-red rounded p-4 mb-6 text-sm">{actionError}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([["total", "Total"], ["active", "Active"], ["draft", "Draft"], ["coming_soon", "Coming Soon"], ["featured", "Featured"]] as const).map(([key, label]) => (
          <div key={key} className="border-2 border-billboard-ink rounded p-3">
            <div className="font-display text-xl">{stats[key]}</div>
            <div className="text-[11px] font-mono uppercase text-billboard-inkSoft">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["all", ...TOOL_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 border-billboard-ink whitespace-nowrap transition ${statusFilter === s ? "bg-billboard-ink text-white" : "bg-white"}`}
          >
            {s === "all" ? `All (${tools.length})` : `${TOOL_STATUS_LABEL[s]} (${tools.filter((t) => t.status === s).length})`}
          </button>
        ))}
      </div>

      {editingSlug !== null && (
        <ToolEditor
          isNew={editingSlug === "__new__"}
          form={form}
          features={features}
          benefits={benefits}
          faqs={faqs}
          saving={saving}
          error={saveError}
          onChange={updateField}
          onFeaturesChange={setFeatures}
          onBenefitsChange={setBenefits}
          onFaqsChange={setFaqs}
          onCancel={closeEditor}
          onSave={save}
        />
      )}

      {loading ? (
        <SkeletonRows count={4} />
      ) : visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft text-sm">Nothing here yet.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((tool) => (
            <div key={tool.slug} className="border-2 border-billboard-ink rounded p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                    {tool.name}
                    {tool.featured && <span className="text-[10px] font-mono uppercase border border-billboard-yellowDeep text-billboard-yellowDeep px-1.5 py-0.5 rounded">Featured</span>}
                    <span className="text-[10px] font-mono uppercase border border-billboard-ink text-billboard-inkSoft px-1.5 py-0.5 rounded">{TOOL_STATUS_LABEL[tool.status]}</span>
                  </p>
                  <p className="text-xs text-billboard-inkSoft mt-1">
                    /{tool.slug} · {TOOL_CATEGORIES.find((c) => c.value === tool.category)?.label ?? tool.category} · {TOOL_TYPE_LABEL[tool.tool_type]} · {priceSummary(tool)}
                  </p>
                  <p className="text-sm mt-1 max-w-xl">{tool.short_description}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(tool)}>Edit</Button>
                  <Button variant="outline" size="sm" to={`/tools/${tool.slug}`}>Preview</Button>
                  {tool.status !== "active" && (
                    <Button variant="dark" size="sm" disabled={actingSlug === tool.slug} onClick={() => quickSetStatus(tool, "active")}>Publish</Button>
                  )}
                  {tool.status === "active" && (
                    <Button variant="outline" size="sm" disabled={actingSlug === tool.slug} onClick={() => quickSetStatus(tool, "draft")}>Unpublish</Button>
                  )}
                  <Button variant="outline" size="sm" disabled={actingSlug === tool.slug} onClick={() => duplicateTool(tool)}>Duplicate</Button>
                  {tool.status !== "archived" && (
                    <Button variant="outline" size="sm" disabled={actingSlug === tool.slug} onClick={() => quickSetStatus(tool, "archived")}>Archive</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolEditor({
  isNew,
  form,
  features,
  benefits,
  faqs,
  saving,
  error,
  onChange,
  onFeaturesChange,
  onBenefitsChange,
  onFaqsChange,
  onCancel,
  onSave,
}: {
  isNew: boolean;
  form: ToolFormState;
  features: Bullet[];
  benefits: Bullet[];
  faqs: Faq[];
  saving: boolean;
  error: string | null;
  onChange: <K extends keyof ToolFormState>(key: K, value: ToolFormState[K]) => void;
  onFeaturesChange: (v: Bullet[]) => void;
  onBenefitsChange: (v: Bullet[]) => void;
  onFaqsChange: (v: Faq[]) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const inputClass = "w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm";
  const labelClass = "text-[11px] font-mono uppercase text-billboard-inkSoft block mb-1";

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 mb-8 bg-billboard-paperDim">
      <h2 className="font-display text-lg mb-4">{isNew ? "New tool" : `Editing: ${form.name || form.slug}`}</h2>
      {error && <div className="border-2 border-billboard-red text-billboard-red rounded p-3 mb-4 text-sm">{error}</div>}

      {/* Basic information */}
      <fieldset className="mb-5 min-w-0">
        <legend className="font-mono text-xs font-bold uppercase tracking-wide mb-2">Basic information</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Name</label>
            <input className={inputClass} value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="ROI Calculator" />
          </div>
          <div>
            <label className={labelClass}>Slug {!isNew && "(locked after creation)"}</label>
            <input className={inputClass} value={form.slug} disabled={!isNew} onChange={(e) => onChange("slug", slugify(e.target.value))} placeholder="auto-generated from name if left blank" />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Short description (card/list copy)</label>
          <input className={inputClass} value={form.short_description} onChange={(e) => onChange("short_description", e.target.value)} maxLength={140} placeholder="One outcome-focused line" />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Full description (detail page)</label>
          <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => onChange("description", e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className={labelClass}>Category</label>
            <select className={inputClass} value={form.category} onChange={(e) => onChange("category", e.target.value as ToolCategory)}>
              {TOOL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tool type</label>
            <select className={inputClass} value={form.tool_type} onChange={(e) => onChange("tool_type", e.target.value as ToolType)}>
              {TOOL_TYPES.map((t) => <option key={t} value={t}>{TOOL_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Target customer</label>
          <input className={inputClass} value={form.target_customer} onChange={(e) => onChange("target_customer", e.target.value)} placeholder="e.g. Businesses sizing a campaign budget" />
        </div>
      </fieldset>

      {/* Presentation */}
      <fieldset className="mb-5">
        <legend className="font-mono text-xs font-bold uppercase tracking-wide mb-2">Presentation</legend>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Icon (lucide-react name)</label>
            <input className={inputClass} value={form.icon} onChange={(e) => onChange("icon", e.target.value)} placeholder="Calculator" />
          </div>
          <div>
            <label className={labelClass}>Cover image URL</label>
            <input className={inputClass} value={form.image_url} onChange={(e) => onChange("image_url", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Badge</label>
            <input className={inputClass} value={form.badge} onChange={(e) => onChange("badge", e.target.value)} placeholder="e.g. New" />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => onChange("featured", e.target.checked)} />
          Featured on /tools
        </label>
        <div className="mt-3 max-w-[160px]">
          <label className={labelClass}>Sort order</label>
          <input type="number" className={inputClass} value={form.sort_order} onChange={(e) => onChange("sort_order", Number(e.target.value))} />
        </div>
      </fieldset>

      {/* Pricing */}
      <fieldset className="mb-5">
        <legend className="font-mono text-xs font-bold uppercase tracking-wide mb-2">Pricing</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Pricing model</label>
            <select className={inputClass} value={form.pricing_model} onChange={(e) => onChange("pricing_model", e.target.value as ToolPricingModel)}>
              {TOOL_PRICING_MODELS.map((p) => <option key={p} value={p}>{TOOL_PRICING_LABEL[p]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Provider (if not native ChatSched)</label>
            <input className={inputClass} value={form.provider_name} onChange={(e) => onChange("provider_name", e.target.value)} />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label className={labelClass}>Setup price (R)</label>
            <input type="number" className={inputClass} value={form.setup_price} onChange={(e) => onChange("setup_price", e.target.value)} disabled={form.pricing_model !== "paid_once" && form.pricing_model !== "custom"} />
          </div>
          <div>
            <label className={labelClass}>Monthly price (R)</label>
            <input type="number" className={inputClass} value={form.monthly_price} onChange={(e) => onChange("monthly_price", e.target.value)} disabled={form.pricing_model !== "paid_monthly"} />
          </div>
          <div>
            <label className={labelClass}>Annual price (R)</label>
            <input type="number" className={inputClass} value={form.annual_price} onChange={(e) => onChange("annual_price", e.target.value)} disabled={form.pricing_model !== "paid_annual"} />
          </div>
        </div>
      </fieldset>

      {/* Content: features / benefits / faqs */}
      <fieldset className="mb-5">
        <legend className="font-mono text-xs font-bold uppercase tracking-wide mb-2">Content</legend>
        <BulletEditor label={'Benefits ("What it does")'} items={benefits} onChange={onBenefitsChange} />
        <BulletEditor label="Features" items={features} onChange={onFeaturesChange} />
        <FaqEditor items={faqs} onChange={onFaqsChange} />
      </fieldset>

      {/* Availability */}
      <fieldset className="mb-5">
        <legend className="font-mono text-xs font-bold uppercase tracking-wide mb-2">Availability</legend>
        <select className={inputClass + " max-w-xs"} value={form.status} onChange={(e) => onChange("status", e.target.value as ToolStatus)}>
          {TOOL_STATUSES.map((s) => <option key={s} value={s}>{TOOL_STATUS_LABEL[s]}</option>)}
        </select>
      </fieldset>

      {/* CTA */}
      <fieldset className="mb-6 min-w-0">
        <legend className="font-mono text-xs font-bold uppercase tracking-wide mb-2">Call to action</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Button label (blank = auto from status/pricing)</label>
            <input className={inputClass} value={form.cta_label} onChange={(e) => onChange("cta_label", e.target.value)} placeholder={defaultToolCtaLabel(form.status, form.pricing_model)} />
          </div>
          <div>
            <label className={labelClass}>Destination (internal path or external URL)</label>
            <input className={inputClass} value={form.cta_url} onChange={(e) => onChange("cta_url", e.target.value)} placeholder="/dashboard?tool=roi" />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={form.requires_auth} onChange={(e) => onChange("requires_auth", e.target.checked)} />
          Requires login (route through /login before the destination above)
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving || !childContentReady}>{saving ? "Saving…" : "Save tool"}</Button>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

function BulletEditor({ label, items, onChange }: { label: string; items: Bullet[]; onChange: (v: Bullet[]) => void }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-mono uppercase text-billboard-inkSoft mb-2">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 mb-2">
          <input className="w-full min-w-0 border-2 border-billboard-ink rounded px-2 py-1.5 text-sm" placeholder="Title" value={item.title} onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, title: e.target.value } : it)))} />
          <input className="w-full min-w-0 border-2 border-billboard-ink rounded px-2 py-1.5 text-sm" placeholder="Description (optional)" value={item.description} onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, description: e.target.value } : it)))} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-billboard-red text-xs font-mono px-2">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { title: "", description: "" }])} className="text-xs font-mono uppercase border-2 border-billboard-ink rounded px-2 py-1 hover:-translate-y-0.5 transition">
        + Add
      </button>
    </div>
  );
}

function FaqEditor({ items, onChange }: { items: Faq[]; onChange: (v: Faq[]) => void }) {
  return (
    <div>
      <p className="text-[11px] font-mono uppercase text-billboard-inkSoft mb-2">FAQ</p>
      {items.map((item, i) => (
        <div key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 mb-2">
          <input className="w-full min-w-0 border-2 border-billboard-ink rounded px-2 py-1.5 text-sm" placeholder="Question" value={item.question} onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, question: e.target.value } : it)))} />
          <input className="w-full min-w-0 border-2 border-billboard-ink rounded px-2 py-1.5 text-sm" placeholder="Answer" value={item.answer} onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, answer: e.target.value } : it)))} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-billboard-red text-xs font-mono px-2">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { question: "", answer: "" }])} className="text-xs font-mono uppercase border-2 border-billboard-ink rounded px-2 py-1 hover:-translate-y-0.5 transition">
        + Add
      </button>
    </div>
  );
}
