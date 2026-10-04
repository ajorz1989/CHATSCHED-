import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, CheckCircle2, ChevronDown, Copy, KeyRound, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { PROVINCES, PREMIUM_ACCESS_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";
import { computeVerificationLevel } from "../lib/businessVerification";
import TrustBadge from "./TrustBadge";
import type { Profile } from "../lib/types";

// Business Onboarding — admin-only workspace to create, verify and activate
// businesses. Self-contained on purpose: it reads profiles/business_subscriptions
// through the admin's own session (RLS already allows admin SELECT), writes the
// two admin-editable verification flags exactly like the existing Businesses tab
// does, and routes everything that needs the service role (creating a login,
// activating a membership) through the admin-only `admin-onboard-business`
// edge function. Revoking goes through the existing `cancel-subscription`.

const BUSINESS_TYPES = [
  "Educational Institution / School",
  "Retail / SMME",
  "Event Organizer",
  "Corporate Brand",
  "Venue Owner",
  "Non-profit / Community Organisation",
  "Sports Club / Organisation",
  "Media / Publisher",
  "Other",
];

type SubStatus = "pending" | "active" | "failed" | "cancelled";

interface SubRow {
  business_id: string;
  status: SubStatus;
  paid_at: string | null;
  launch_credit_granted: boolean;
}

type Filter = "all" | "needs_verification" | "not_activated" | "activated";

const EMPTY_FORM = {
  full_name: "",
  company_name: "",
  email: "",
  phone: "",
  business_type: "",
  industry: "",
  province: "",
  city: "",
  website: "",
  facebook_url: "",
  instagram_url: "",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  vat_number: "",
  email_confirmed: true,
  phone_verified: false,
  business_verified: false,
  activate: false,
};

type FormState = typeof EMPTY_FORM;

async function logAdminAction(action: string, targetId: string | null, detail?: Record<string, unknown>) {
  try {
    await supabase.rpc("log_admin_action", { p_action: action, p_target_table: "profiles", p_target_id: targetId, p_detail: detail ?? null });
  } catch (err) {
    console.warn("Audit log write failed (non-fatal)", err);
  }
}

// functions.invoke() hides the JSON body of a non-2xx response inside
// error.context — pull the function's own message out so the admin sees
// "An account with that email already exists" rather than a generic failure.
async function invokeAdminFn<T = Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      let message = "Something went wrong — try again.";
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const parsed = await ctx.json();
          if (parsed?.error) message = String(parsed.error);
        } catch { /* keep generic message */ }
      }
      return { data: null, error: message };
    }
    if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
      return { data: null, error: String((data as { error?: string }).error) };
    }
    return { data: data as T, error: null };
  } catch {
    return { data: null, error: "Network problem — check your connection and try again." };
  }
}

const inputCls = "w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm";
const labelCls = "block font-mono text-[10px] uppercase tracking-wider font-semibold mb-1";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}{required && <span className="text-billboard-red"> *</span>}</span>
      {children}
    </label>
  );
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={"inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded border " + (ok ? "border-billboard-greenDeep bg-billboard-green/15 text-billboard-greenDeep" : "border-billboard-ink/25 text-billboard-inkSoft")}>
      {ok ? "✓" : "○"} {children}
    </span>
  );
}

export default function AdminBusinessOnboarding() {
  const [businesses, setBusinesses] = useState<Profile[]>([]);
  const [subs, setSubs] = useState<Map<string, SubRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ company: string; email: string; link: string | null; activated: boolean; warnings: string[] } | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string; tone: "ok" | "error"; link?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [bizRes, subRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "business").order("created_at", { ascending: false }),
      supabase.from("business_subscriptions").select("business_id, status, paid_at, launch_credit_granted"),
    ]);
    if (bizRes.error || subRes.error) {
      setLoadError(bizRes.error?.message ?? subRes.error?.message ?? "Could not load businesses");
    } else {
      setLoadError(null);
    }
    if (!bizRes.error) setBusinesses((bizRes.data ?? []) as Profile[]);
    if (!subRes.error) setSubs(new Map(((subRes.data ?? []) as SubRow[]).map((s) => [s.business_id, s])));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);
    const { data, error } = await invokeAdminFn<{
      business_id: string; activated: boolean; setup_link: string | null; warnings: string[];
    }>("admin-onboard-business", { action: "create", ...form });
    setSubmitting(false);
    if (error || !data) {
      setFormError(error ?? "Could not create the business.");
      return;
    }
    void logAdminAction("business_onboarded", data.business_id, {
      company_name: form.company_name,
      activated: data.activated,
      phone_verified: form.phone_verified,
      business_verified: form.business_verified,
    });
    setCreated({ company: form.company_name, email: form.email, link: data.setup_link, activated: data.activated, warnings: data.warnings ?? [] });
    setForm(EMPTY_FORM);
    setShowMore(false);
    setCopied(false);
    void load();
  }

  async function toggleFlag(b: Profile, field: "phone_verified" | "business_verified") {
    const value = !b[field];
    setBusyId(b.id);
    setBusinesses((prev) => prev.map((x) => (x.id === b.id ? { ...x, [field]: value } : x)));
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", b.id);
    setBusyId(null);
    if (error) {
      setBusinesses((prev) => prev.map((x) => (x.id === b.id ? { ...x, [field]: !value } : x)));
      setRowMessage({ id: b.id, text: "Could not update verification — " + error.message, tone: "error" });
      return;
    }
    void logAdminAction(value ? `${field}_granted` : `${field}_revoked`, b.id);
  }

  async function activate(b: Profile) {
    setBusyId(b.id);
    setRowMessage(null);
    const { data, error } = await invokeAdminFn<{ launch_credit_granted: boolean }>("admin-onboard-business", { action: "activate", business_id: b.id });
    setBusyId(null);
    if (error || !data) {
      setRowMessage({ id: b.id, text: error ?? "Could not activate.", tone: "error" });
      return;
    }
    void logAdminAction("business_membership_activated", b.id, { launch_credit_granted: data.launch_credit_granted });
    setRowMessage({ id: b.id, text: "Premium access granted for a month.", tone: "ok" });
    void load();
  }

  async function revoke(b: Profile) {
    const name = b.company_name || b.full_name || "this business";
    if (!window.confirm(`Revoke ${name}'s Premium access?`)) return;
    setBusyId(b.id);
    setRowMessage(null);
    const { data, error } = await invokeAdminFn("cancel-subscription", { role: "business", subject_id: b.id });
    setBusyId(null);
    if (error || !data) {
      setRowMessage({ id: b.id, text: error ?? "Could not revoke.", tone: "error" });
      return;
    }
    void logAdminAction("business_membership_revoked", b.id);
    setRowMessage({ id: b.id, text: "Membership revoked.", tone: "ok" });
    void load();
  }

  async function issueSetupLink(b: Profile) {
    setBusyId(b.id);
    setRowMessage(null);
    const { data, error } = await invokeAdminFn<{ setup_link: string; email: string }>("admin-onboard-business", { action: "setup_link", business_id: b.id });
    setBusyId(null);
    if (error || !data) {
      setRowMessage({ id: b.id, text: error ?? "Could not create a link.", tone: "error" });
      return;
    }
    void logAdminAction("business_setup_link_issued", b.id);
    setRowMessage({ id: b.id, text: `Password link for ${data.email} (single use):`, tone: "ok", link: data.setup_link });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }

  const stats = useMemo(() => {
    const activated = businesses.filter((b) => subs.get(b.id)?.status === "active").length;
    const needsVerification = businesses.filter((b) => !b.phone_verified || !b.business_verified).length;
    return { total: businesses.length, activated, notActivated: businesses.length - activated, needsVerification };
  }, [businesses, subs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return businesses.filter((b) => {
      const active = subs.get(b.id)?.status === "active";
      if (filter === "activated" && !active) return false;
      if (filter === "not_activated" && active) return false;
      if (filter === "needs_verification" && b.phone_verified && b.business_verified) return false;
      if (!q) return true;
      return [b.company_name, b.full_name, b.phone, b.city, b.industry].some((v) => v?.toLowerCase().includes(q));
    });
  }, [businesses, subs, filter, query]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "needs_verification", label: "Needs verification", count: stats.needsVerification },
    { key: "not_activated", label: "Not activated", count: stats.notActivated },
    { key: "activated", label: "Activated", count: stats.activated },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-billboard-ink text-white overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
        <div className="p-5 md:p-7 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider font-bold text-billboard-yellow border border-billboard-yellow/30 bg-billboard-yellow/10 rounded-full px-2.5 py-1 mb-3">
              <UserPlus size={12} /> Super Tool
            </div>
            <h1 className="font-display text-3xl md:text-4xl">Business Onboarding</h1>
            <p className="text-sm md:text-base text-white/55 mt-2 leading-relaxed">
              Create a business account, verify it and optionally grant {formatCurrency(PREMIUM_ACCESS_PRICE)}/month Premium access for the first month from one place. This is the business-side counterpart to AJ: Creations — it doesn't change how public signup or PayFast activation work.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            {[
              { n: stats.total, l: "Businesses" },
              { n: stats.needsVerification, l: "Need verification" },
              { n: stats.notActivated, l: "Not activated" },
              { n: stats.activated, l: "Activated" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="font-display text-2xl">{s.n}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-billboard-yellow/30 bg-billboard-ink text-white overflow-hidden">
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          aria-expanded={formOpen}
          className="w-full p-5 md:p-6 flex items-center justify-between gap-4 text-left hover:bg-white/[0.03] transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex w-10 h-10 rounded-lg bg-billboard-yellow text-billboard-ink items-center justify-center shrink-0">
              <Plus size={19} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-yellow">Step 1</p>
              <h2 className="font-display text-xl truncate">Create a business</h2>
              <p className="text-xs text-white/40 mt-1">Creates the login + profile · you choose verification and activation</p>
            </div>
          </div>
          <ChevronDown className={`shrink-0 transition-transform ${formOpen ? "rotate-180" : ""}`} size={18} />
        </button>

        <div hidden={!formOpen} className="border-t border-white/10 bg-white text-billboard-ink p-5 md:p-7">
          {created ? (
            <div role="status" className="rounded-lg border-2 border-billboard-greenDeep bg-billboard-green/10 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-billboard-greenDeep shrink-0 mt-0.5" size={22} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl">{created.company} is onboarded</h3>
                  <p className="text-sm text-billboard-inkSoft mt-1.5 leading-relaxed">
                    Account created for {created.email}.{created.activated ? " Membership is active." : " Membership not activated yet — use Activate below when ready."}
                  </p>
                  {created.link ? (
                    <div className="mt-3">
                      <p className={labelCls}>One-time password setup link — send it to the business</p>
                      <div className="flex gap-2">
                        <input readOnly value={created.link} onFocus={(e) => e.currentTarget.select()} className={inputCls + " font-mono text-xs"} />
                        <button type="button" onClick={() => copy(created.link!)} className="inline-flex items-center gap-1.5 border-2 border-billboard-ink rounded px-3 font-mono text-xs font-semibold uppercase shrink-0 hover:bg-billboard-paperDim">
                          <Copy size={13} /> {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-[11px] text-billboard-inkSoft mt-1.5">Treat this like a password: anyone with the link can set the account's password. It works once and expires.</p>
                    </div>
                  ) : null}
                  {created.warnings.map((w) => (
                    <p key={w} className="text-xs mt-2 text-billboard-ink bg-billboard-yellow/20 border border-billboard-yellowDeep rounded px-2.5 py-1.5">{w}</p>
                  ))}
                  <button type="button" onClick={() => setCreated(null)} className="mt-4 inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded text-sm hover:-translate-y-0.5 transition">
                    <Plus size={15} /> Onboard another business
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Business name" required>
                  <input required maxLength={160} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} className={inputCls} autoComplete="off" />
                </Field>
                <Field label="Contact person" required>
                  <input required maxLength={120} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inputCls} autoComplete="off" />
                </Field>
                <Field label="Login email" required>
                  <input required type="email" maxLength={254} value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} autoComplete="off" />
                </Field>
                <Field label="Mobile number">
                  <input type="tel" maxLength={40} value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} autoComplete="off" />
                </Field>
                <Field label="Business type">
                  <select value={form.business_type} onChange={(e) => set("business_type", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Industry">
                  <input maxLength={100} value={form.industry} onChange={(e) => set("industry", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Province">
                  <select value={form.province} onChange={(e) => set("province", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="City / town">
                  <input maxLength={100} value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                </Field>
              </div>

              <button type="button" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase font-semibold text-billboard-inkSoft hover:text-billboard-ink">
                <ChevronDown size={13} className={showMore ? "rotate-180 transition-transform" : "transition-transform"} /> Online presence, address &amp; VAT (optional)
              </button>
              {showMore && (
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Website"><input type="url" maxLength={300} value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} placeholder="https://" /></Field>
                  <Field label="Facebook page"><input type="url" maxLength={300} value={form.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} className={inputCls} placeholder="https://" /></Field>
                  <Field label="Instagram"><input type="url" maxLength={300} value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} className={inputCls} placeholder="https://" /></Field>
                  <Field label="VAT number"><input maxLength={40} value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} className={inputCls} /></Field>
                  <Field label="Address line 1"><input maxLength={200} value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} className={inputCls} /></Field>
                  <Field label="Address line 2"><input maxLength={200} value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} className={inputCls} /></Field>
                  <Field label="Postal code"><input maxLength={20} value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} className={inputCls} /></Field>
                </div>
              )}

              <fieldset className="rounded-lg border-2 border-billboard-ink/15 p-4">
                <legend className="px-2 font-mono text-[10px] uppercase tracking-wider font-semibold">Verification &amp; membership</legend>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.email_confirmed} onChange={(e) => set("email_confirmed", e.target.checked)} /><span><strong>Email confirmed</strong><span className="block text-xs text-billboard-inkSoft">You've confirmed this address belongs to them.</span></span></label>
                  <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.phone_verified} onChange={(e) => set("phone_verified", e.target.checked)} /><span><strong>Phone verified</strong><span className="block text-xs text-billboard-inkSoft">Silver level needs email + phone.</span></span></label>
                  <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.business_verified} onChange={(e) => set("business_verified", e.target.checked)} /><span><strong>Gold business verified</strong><span className="block text-xs text-billboard-inkSoft">You've checked the business is real.</span></span></label>
                  <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.activate} onChange={(e) => set("activate", e.target.checked)} /><span><strong>Grant Premium access now</strong><span className="block text-xs text-billboard-inkSoft">Skips PayFast. Gives a month of Premium access (Opportunities and Marketing Suite) as a comp.</span></span></label>
                </div>
              </fieldset>

              {formError && <p role="alert" className="text-sm font-semibold text-billboard-red border-2 border-billboard-red rounded px-3 py-2">{formError}</p>}

              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60 disabled:hover:translate-y-0">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {submitting ? "Creating…" : "Create business"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-xl border-2 border-billboard-ink bg-white text-billboard-ink overflow-hidden">
        <div className="p-5 md:p-6 border-b-2 border-billboard-ink/10">
          <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Step 2</p>
          <h2 className="font-display text-xl">Verify &amp; activate</h2>
          <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative md:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-billboard-inkSoft" aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, city…" aria-label="Search businesses" className={inputCls + " pl-8"} />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter businesses">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={"font-mono text-[11px] uppercase font-semibold border-2 border-billboard-ink rounded px-3 py-1.5 transition " + (filter === f.key ? "bg-billboard-ink text-white" : "hover:bg-billboard-paperDim")}
                >
                  {f.label} · {f.count}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-3">
          {loadError && <p role="alert" className="text-sm border-2 border-billboard-yellowDeep bg-billboard-yellow/10 rounded px-3 py-2">{loadError}</p>}
          {loading ? (
            <p className="text-sm text-billboard-inkSoft py-6 text-center">Loading businesses…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-billboard-inkSoft border-2 border-dashed border-billboard-ink/30 rounded p-8 text-center">
              {businesses.length === 0 ? "No businesses yet — create the first one above." : "No businesses match this filter."}
            </p>
          ) : (
            visible.map((b) => {
              const sub = subs.get(b.id);
              const active = sub?.status === "active";
              const level = computeVerificationLevel(b);
              const busy = busyId === b.id;
              const detail = [b.company_name && b.full_name ? b.full_name : null, b.phone, b.industry, b.city ? `${b.city}${b.province ? ", " + b.province : ""}` : null].filter(Boolean).join(" · ");
              const msg = rowMessage?.id === b.id ? rowMessage : null;
              return (
                <div key={b.id} className="border-2 border-billboard-ink rounded p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm">
                        {b.company_name || b.full_name || "Unnamed business"}
                        {level && <span className="ml-2 align-middle"><TrustBadge kind="business" level={level} /></span>}
                      </p>
                      {detail && <p className="text-xs text-billboard-inkSoft mt-0.5">{detail}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Pill ok={b.email_verified}>Email</Pill>
                        <Pill ok={b.phone_verified}>Phone</Pill>
                        <Pill ok={b.business_verified}>Gold</Pill>
                        <Pill ok={active}>{active ? "Membership active" : sub?.status === "cancelled" ? "Membership revoked" : sub?.status === "pending" ? "Payment pending" : "Not activated"}</Pill>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button disabled={busy} onClick={() => toggleFlag(b, "phone_verified")} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-50">
                        {b.phone_verified ? "Unverify phone" : "Verify phone"}
                      </button>
                      <button disabled={busy} onClick={() => toggleFlag(b, "business_verified")} className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-50">
                        <BadgeCheck size={13} /> {b.business_verified ? "Revoke Gold" : "Mark Gold"}
                      </button>
                      {active ? (
                        <button disabled={busy} onClick={() => revoke(b)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-50">
                          Revoke membership
                        </button>
                      ) : (
                        <button disabled={busy} onClick={() => activate(b)} className="font-mono text-xs font-semibold uppercase bg-billboard-yellow border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-50">
                          Activate membership
                        </button>
                      )}
                      <button disabled={busy} onClick={() => issueSetupLink(b)} title="Create a one-time password link" className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-50">
                        <KeyRound size={13} /> Password link
                      </button>
                    </div>
                  </div>
                  {msg && (
                    <div role={msg.tone === "error" ? "alert" : "status"} className={"mt-3 text-xs rounded px-3 py-2 border " + (msg.tone === "error" ? "border-billboard-red text-billboard-red" : "border-billboard-greenDeep bg-billboard-green/10")}>
                      <p>{msg.text}</p>
                      {msg.link && (
                        <div className="flex gap-2 mt-2">
                          <input readOnly value={msg.link} onFocus={(e) => e.currentTarget.select()} className={inputCls + " font-mono text-xs"} />
                          <button type="button" onClick={() => copy(msg.link!)} className="inline-flex items-center gap-1.5 border-2 border-billboard-ink rounded px-3 font-mono text-xs font-semibold uppercase shrink-0 hover:bg-billboard-paperDim">
                            <Copy size={13} /> {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
