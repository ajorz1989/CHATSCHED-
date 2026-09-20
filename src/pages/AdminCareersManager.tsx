import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, Plus, Save, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import type { Career, CareerEmploymentType, CareerRemoteType, CareerSalaryPeriod, CareerStatus } from "../lib/types";
import SetupNotice from "../components/SetupNotice";
import { SkeletonRows } from "../components/Skeleton";
import Button from "../components/Button";

type FormState = {
  slug: string;
  job_title: string;
  department: string;
  location: string;
  remote_type: CareerRemoteType;
  employment_type: CareerEmploymentType;
  salary_min: string;
  salary_max: string;
  salary_period: CareerSalaryPeriod;
  short_summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  nice_to_have: string;
  status: CareerStatus;
  application_deadline: string;
  sort_order: string;
};

const EMPTY_FORM: FormState = {
  slug: "",
  job_title: "",
  department: "",
  location: "South Africa",
  remote_type: "remote",
  employment_type: "full_time",
  salary_min: "",
  salary_max: "",
  salary_period: "unspecified",
  short_summary: "",
  description: "",
  responsibilities: "",
  requirements: "",
  nice_to_have: "",
  status: "draft",
  application_deadline: "",
  sort_order: "0",
};

const STATUS_LABEL: Record<CareerStatus, string> = {
  draft: "Draft",
  active: "Live",
  paused: "Paused",
  closed: "Closed",
};

const STATUS_CLASS: Record<CareerStatus, string> = {
  draft: "border-white/20 text-white/55 bg-white/[0.03]",
  active: "border-billboard-green/50 text-billboard-green bg-billboard-green/10",
  paused: "border-billboard-yellow/50 text-billboard-yellow bg-billboard-yellow/10",
  closed: "border-billboard-red/50 text-billboard-red bg-billboard-red/10",
};

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function lines(value: string): string[] {
  return value.split("\n").map((v) => v.trim()).filter(Boolean);
}

function formFromCareer(c: Career): FormState {
  return {
    slug: c.slug,
    job_title: c.job_title,
    department: c.department,
    location: c.location,
    remote_type: c.remote_type,
    employment_type: c.employment_type,
    salary_min: c.salary_min != null ? String(c.salary_min) : "",
    salary_max: c.salary_max != null ? String(c.salary_max) : "",
    salary_period: c.salary_period,
    short_summary: c.short_summary,
    description: c.description,
    responsibilities: c.responsibilities.join("\n"),
    requirements: c.requirements.join("\n"),
    nice_to_have: c.nice_to_have.join("\n"),
    status: c.status,
    application_deadline: c.application_deadline ?? "",
    sort_order: String(c.sort_order),
  };
}

function formatEmploymentType(value: CareerEmploymentType): string {
  return value === "full_time" ? "Full-time"
    : value === "part_time" ? "Part-time"
    : value === "internship" ? "Internship"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateOnly(value: string): string {
  const parts = value.slice(0, 10).split("-");
  return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : value;
}

function formatSalary(c: Career): string | null {
  if (c.salary_min == null && c.salary_max == null) return null;
  const min = c.salary_min != null ? "R" + Number(c.salary_min).toLocaleString("en-ZA") : "";
  const max = c.salary_max != null ? "R" + Number(c.salary_max).toLocaleString("en-ZA") : "";
  const period = c.salary_period === "unspecified" ? "" : " / " + c.salary_period;
  return min && max ? min + " – " + max + period : (min || max) + period;
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={"block " + className}>
      <span className="block text-[10px] font-mono uppercase tracking-wider text-white/45 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-lg border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-billboard-yellow/60 focus:ring-2 focus:ring-billboard-yellow/10 transition";
const textareaClass = inputClass + " resize-y min-h-[110px]";

export default function AdminCareersManager() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("careers")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(formatSupabaseError(error, "Couldn't load career listings"));
      setCareers([]);
    } else {
      setCareers((data ?? []) as Career[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isSupabaseConfigured) void load();
  }, []);

  const stats = useMemo(() => ({
    live: careers.filter((c) => c.status === "active").length,
    draft: careers.filter((c) => c.status === "draft").length,
    paused: careers.filter((c) => c.status === "paused").length,
    closed: careers.filter((c) => c.status === "closed").length,
  }), [careers]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setActionError(null);
    setEditorOpen(true);
  }

  function openEdit(career: Career) {
    setForm(formFromCareer(career));
    setEditingId(career.id);
    setActionError(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setEditingId(null);
    setActionError(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.job_title.trim() || !form.department.trim() || !form.location.trim() || !form.short_summary.trim() || !form.description.trim()) {
      setActionError("Job title, department, location, short summary and description are required.");
      return;
    }

    const slug = slugify(form.slug || form.job_title);
    if (!slug) {
      setActionError("A valid job title or slug is required.");
      return;
    }

    const salaryMin = form.salary_min.trim() ? Number(form.salary_min) : null;
    const salaryMax = form.salary_max.trim() ? Number(form.salary_max) : null;
    if ((salaryMin != null && Number.isNaN(salaryMin)) || (salaryMax != null && Number.isNaN(salaryMax))) {
      setActionError("Salary values must be valid numbers.");
      return;
    }
    if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
      setActionError("Salary maximum cannot be lower than salary minimum.");
      return;
    }
    if (form.status === "active" && form.application_deadline) {
      const today = new Date().toISOString().slice(0, 10);
      if (form.application_deadline < today) {
        setActionError("A live role cannot have an application deadline in the past. Clear the deadline or choose a future date.");
        return;
      }
    }

    setSaving(true);
    setActionError(null);

    const payload = {
      slug,
      job_title: form.job_title.trim(),
      department: form.department.trim(),
      location: form.location.trim(),
      remote_type: form.remote_type,
      employment_type: form.employment_type,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_period: form.salary_period,
      short_summary: form.short_summary.trim(),
      description: form.description.trim(),
      responsibilities: lines(form.responsibilities),
      requirements: lines(form.requirements),
      nice_to_have: lines(form.nice_to_have),
      status: form.status,
      application_deadline: form.application_deadline || null,
      sort_order: Math.max(0, Number(form.sort_order) || 0),
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("careers").update(payload).eq("id", editingId)
      : await supabase.from("careers").insert(payload);

    setSaving(false);

    if (result.error) {
      setActionError(formatSupabaseError(result.error, "Couldn't save this job listing"));
      return;
    }

    await load();
    setEditorOpen(false);
    setEditingId(null);
  }

  async function setStatus(career: Career, status: CareerStatus) {
    if (career.status === status) return;
    setActionId(career.id);
    setActionError(null);

    const { error } = await supabase
      .from("careers")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", career.id);

    setActionId(null);
    if (error) {
      setActionError(formatSupabaseError(error, "Couldn't update the job status"));
      return;
    }

    await load();
  }

  async function deleteCareer(career: Career) {
    if (!window.confirm("Delete “" + career.job_title + "”? Existing applications will be kept, but they will no longer point to this listing.")) return;

    setActionId(career.id);
    setActionError(null);
    const { error } = await supabase.from("careers").delete().eq("id", career.id);
    setActionId(null);

    if (error) {
      setActionError(formatSupabaseError(error, "Couldn't delete this job listing"));
      return;
    }

    await load();
  }

  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-billboard-ink text-white overflow-hidden">
        <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-yellow font-bold mb-1">Platform Content</p>
            <h1 className="font-display text-2xl md:text-3xl">Careers Manager</h1>
            <p className="text-sm text-white/55 mt-2 max-w-2xl leading-relaxed">
              Publish ChatSched job openings directly to the public Careers page. Draft, pause and close roles without touching the codebase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/careers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.04] rounded-lg px-3 py-2 text-xs font-bold hover:bg-white/[0.08] transition">
              View public Careers <ExternalLink size={14} />
            </Link>
            <Link to="/admin/careers" className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.04] rounded-lg px-3 py-2 text-xs font-bold hover:bg-white/[0.08] transition">
              Applications →
            </Link>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 bg-billboard-yellow text-billboard-ink rounded-lg px-3 py-2 text-xs font-bold hover:-translate-y-0.5 transition">
              <Plus size={14} strokeWidth={2.5} /> New job
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 border-t border-white/10">
          {[
            ["Live", stats.live],
            ["Draft", stats.draft],
            ["Paused", stats.paused],
            ["Closed", stats.closed],
          ].map(([label, count]) => (
            <div key={String(label)} className="p-4 border-r border-white/10 last:border-r-0">
              <div className="font-display text-xl">{count}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-billboard-red/40 bg-billboard-red/10 px-4 py-3 text-sm text-billboard-red" role="alert">
          {loadError}
        </div>
      )}

      {editorOpen && (
        <form onSubmit={save} className="rounded-xl border border-billboard-yellow/30 bg-billboard-ink text-white shadow-[0_20px_60px_rgba(0,0,0,0.16)] overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-yellow">Job editor</p>
              <h2 className="font-display text-xl">{editingId ? "Edit listing" : "Create listing"}</h2>
            </div>
            <button type="button" onClick={closeEditor} disabled={saving} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center hover:bg-white/[0.05]" aria-label="Close job editor">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 md:p-6 grid md:grid-cols-2 gap-4">
            <Field label="Job title" className="md:col-span-2"><input required value={form.job_title} onChange={(e) => setField("job_title", e.target.value)} onBlur={() => !form.slug && setField("slug", slugify(form.job_title))} className={inputClass} placeholder="e.g. Full-Stack Engineer" /></Field>
            <Field label="Department"><input required value={form.department} onChange={(e) => setField("department", e.target.value)} className={inputClass} placeholder="Product & Engineering" /></Field>
            <Field label="Location"><input required value={form.location} onChange={(e) => setField("location", e.target.value)} className={inputClass} placeholder="Cape Town, South Africa" /></Field>
            <Field label="Remote model">
              <select value={form.remote_type} onChange={(e) => setField("remote_type", e.target.value as CareerRemoteType)} className={inputClass}>
                <option value="remote">Fully remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
              </select>
            </Field>
            <Field label="Employment type">
              <select value={form.employment_type} onChange={(e) => setField("employment_type", e.target.value as CareerEmploymentType)} className={inputClass}>
                <option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="freelance">Freelance</option><option value="internship">Internship</option>
              </select>
            </Field>
            <Field label="Salary minimum (ZAR)"><input type="number" min={0} value={form.salary_min} onChange={(e) => setField("salary_min", e.target.value)} className={inputClass} placeholder="Optional" /></Field>
            <Field label="Salary maximum (ZAR)"><input type="number" min={0} value={form.salary_max} onChange={(e) => setField("salary_max", e.target.value)} className={inputClass} placeholder="Optional" /></Field>
            <Field label="Pay period">
              <select value={form.salary_period} onChange={(e) => setField("salary_period", e.target.value as CareerSalaryPeriod)} className={inputClass}>
                <option value="unspecified">Not specified</option><option value="hour">Per hour</option><option value="month">Per month</option><option value="year">Per year</option><option value="project">Per project</option>
              </select>
            </Field>
            <Field label="Application deadline"><input type="date" value={form.application_deadline} onChange={(e) => setField("application_deadline", e.target.value)} className={inputClass} /></Field>
            <Field label="Display order"><input type="number" min={0} value={form.sort_order} onChange={(e) => setField("sort_order", e.target.value)} className={inputClass} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setField("status", e.target.value as CareerStatus)} className={inputClass}>
                <option value="draft">Draft</option><option value="active">Live</option><option value="paused">Paused</option><option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Slug"><input value={form.slug} onChange={(e) => setField("slug", slugify(e.target.value))} className={inputClass} placeholder="full-stack-engineer" /></Field>
            <Field label="Short summary" className="md:col-span-2"><textarea required value={form.short_summary} onChange={(e) => setField("short_summary", e.target.value)} className={textareaClass + " min-h-[80px]"} placeholder="One or two sentences that make the role immediately understandable." /></Field>
            <Field label="Job description" className="md:col-span-2"><textarea required value={form.description} onChange={(e) => setField("description", e.target.value)} className={textareaClass} placeholder="What this person will own, build and improve." /></Field>
            <Field label="Responsibilities — one per line"><textarea value={form.responsibilities} onChange={(e) => setField("responsibilities", e.target.value)} className={textareaClass} placeholder={"Own product features\nShip production-quality code\nWork closely with customers"} /></Field>
            <Field label="Requirements — one per line"><textarea value={form.requirements} onChange={(e) => setField("requirements", e.target.value)} className={textareaClass} placeholder={"3+ years experience\nStrong TypeScript skills\nClear communication"} /></Field>
            <Field label="Nice to have — one per line" className="md:col-span-2"><textarea value={form.nice_to_have} onChange={(e) => setField("nice_to_have", e.target.value)} className={textareaClass} placeholder={"Supabase experience\nMarketplace experience\nSouth African SME context"} /></Field>
          </div>

          {actionError && <div className="mx-5 mb-5 rounded-lg border border-billboard-red/40 bg-billboard-red/10 px-4 py-3 text-sm text-billboard-red" role="alert">{actionError}</div>}

          <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-white/10 bg-black/10">
            <button type="button" onClick={closeEditor} disabled={saving} className="inline-flex items-center gap-2 border border-white/15 rounded-lg px-4 py-2.5 text-xs font-bold hover:bg-white/[0.05] transition">
              Cancel
            </button>
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              <Save size={15} /> {saving ? "Saving…" : editingId ? "Save changes" : "Save listing"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-billboard-ink p-5 text-white"><SkeletonRows count={5} /></div>
      ) : careers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-billboard-ink px-6 py-12 text-center text-white/45">
          No career listings yet. Create your first job and publish it to /careers.
        </div>
      ) : (
        <div className="space-y-3">
          {careers.map((career) => {
            const salary = formatSalary(career);
            const busy = actionId === career.id;
            return (
              <div key={career.id} className="rounded-xl border border-white/10 bg-billboard-ink text-white overflow-hidden">
                <div className="p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-display text-xl">{career.job_title}</h3>
                      <span className={"font-mono text-[9px] uppercase tracking-wider border rounded-full px-2 py-1 " + STATUS_CLASS[career.status]}>{STATUS_LABEL[career.status]}</span>
                    </div>
                    <p className="text-xs text-white/45 font-mono">{career.department} · {career.location} · {career.remote_type} · {formatEmploymentType(career.employment_type)}</p>
                    <p className="text-sm text-white/65 mt-2 max-w-3xl leading-relaxed">{career.short_summary}</p>
                    <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-mono uppercase tracking-wide text-white/40">
                      {salary && <span className="border border-white/10 rounded px-2 py-1">{salary}</span>}
                      {career.application_deadline && <span className="border border-white/10 rounded px-2 py-1">Deadline {formatDateOnly(career.application_deadline)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {career.status !== "active" && <button type="button" disabled={busy} onClick={() => void setStatus(career, "active")} className="border border-billboard-green/40 text-billboard-green rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50">Publish</button>}
                    {career.status === "active" && <button type="button" disabled={busy} onClick={() => void setStatus(career, "paused")} className="border border-billboard-yellow/40 text-billboard-yellow rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50">Pause</button>}
                    <button type="button" disabled={busy} onClick={() => openEdit(career)} className="border border-white/15 rounded-lg px-3 py-2 text-xs font-bold hover:bg-white/[0.05] disabled:opacity-50">Edit</button>
                    <button type="button" disabled={busy} onClick={() => void deleteCareer(career)} className="border border-billboard-red/30 text-billboard-red rounded-lg px-3 py-2 text-xs font-bold hover:bg-billboard-red/10 disabled:opacity-50" aria-label={"Delete " + career.job_title}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {actionError && !editorOpen && (
        <div className="rounded-lg border border-billboard-red/40 bg-billboard-red/10 px-4 py-3 text-sm text-billboard-red" role="alert">{actionError}</div>
      )}
    </div>
  );
}
