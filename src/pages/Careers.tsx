import { useEffect, useRef, useState, type FormEvent } from "react";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import {
  CAREER_CV_MAX_BYTES,
  ALLOWED_CV_MIME_TYPES,
  CAREER_CV_BUCKET,
  CONTACT_EMAIL,
  WORK_WITH_US_CATEGORIES,
  WORK_WITH_US_ATTACHMENT_MAX_BYTES,
  ALLOWED_WORK_WITH_US_ATTACHMENT_MIME_TYPES,
  WORK_WITH_US_ATTACHMENT_BUCKET,
} from "../lib/constants";
import type { Career, WorkWithUsCategory } from "../lib/types";
import Button from "../components/Button";
import { SkeletonRows } from "../components/Skeleton";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const WHY_CHATSCHED = [
  {
    tag: "Impact",
    title: "Your work reaches real South African businesses — fast.",
    body:
      "We’re not building features for a demo environment. Every publisher listing, booking flow, and trust signal you ship is used by an actual business trying to reach an actual audience. The feedback loop is weeks, not quarters.",
  },
  {
    tag: "Ownership",
    title: "No layers. No committees. Just build.",
    body:
      "This is a small, deliberately lean team. You’ll have direct input into architecture, product direction, and priorities — not because we’re informal, but because we’ve chosen to stay close to the work on purpose. What you ship, ships.",
  },
  {
    tag: "Growth",
    title: "Be early to a category that’s still being defined.",
    body:
      "AI-assisted advertising, two-sided marketplace matching, trust scoring for local creators — these are genuinely unsolved problems in the South African context. The decisions being made now will shape how this market works for years. You’d be making some of them.",
  },
  {
    tag: "Culture",
    title: "Built here. For here.",
    body:
      "ChatSched exists because global advertising platforms weren’t designed for how South African SMEs actually work. We take that seriously — in the product, in how we write, and in who we hire. Remote-flexible, South African-rooted, and built on the assumption that good work can come from anywhere.",
  },
];

const HOW_TO_APPLY = [
  {
    step: "01",
    title: "Pick your path",
    body: "Full-time, freelance, intern, or collaborator — choose the tab that fits how you’d want to work with us.",
  },
  {
    step: "02",
    title: "Tell us what you’d bring",
    body: "Choose an active role that fits you, or submit a general application and tell us where you could add value.",
  },
  {
    step: "03",
    title: "We review and reach out",
    body: "Every application is read by a person. If there’s a fit — now or soon — we’ll get in touch.",
  },
];

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = "fulltime" | "workwithus";

export default function Careers() {
  const [activeTab, setActiveTab] = useState<Tab>("fulltime");
  const [careers, setCareers] = useState<Career[]>([]);
  const [careersLoading, setCareersLoading] = useState(true);
  const [careersError, setCareersError] = useState<string | null>(null);
  const [selectedCareerId, setSelectedCareerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCareers() {
      if (!isSupabaseConfigured) {
        setCareersLoading(false);
        return;
      }

      setCareersLoading(true);
      const { data, error } = await supabase
        .from("careers")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setCareers([]);
        setCareersError("We couldn't load the current openings. You can still submit a general application below.");
      } else {
        setCareers((data ?? []) as Career[]);
        setCareersError(null);
      }
      setCareersLoading(false);
    }

    void loadCareers();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Full-time form state
  const [ftName, setFtName] = useState("");
  const [ftEmail, setFtEmail] = useState("");
  const [ftRole, setFtRole] = useState("");
  const [ftPortfolioUrl, setFtPortfolioUrl] = useState("");
  const [ftLinkedinUrl, setFtLinkedinUrl] = useState("");
  const [ftLocation, setFtLocation] = useState("");
  const [ftCoverLetter, setFtCoverLetter] = useState("");
  const [ftWebsite, setFtWebsite] = useState(""); // honeypot
  const [ftCvFile, setFtCvFile] = useState<File | null>(null);
  const [ftFileError, setFtFileError] = useState<string | null>(null);
  const ftFileInputRef = useRef<HTMLInputElement>(null);
  const [ftSubmitting, setFtSubmitting] = useState(false);
  const [ftSubmitError, setFtSubmitError] = useState<string | null>(null);
  const [ftSent, setFtSent] = useState(false);
  const { isLikelyBot: ftIsBot, wrapperProps: ftHoneypot } = useHoneypot();

  // ── Work With Us form state
  const [wwuCategory, setWwuCategory] = useState<WorkWithUsCategory | null>(null);
  const [wwuName, setWwuName] = useState("");
  const [wwuEmail, setWwuEmail] = useState("");
  const [wwuLocation, setWwuLocation] = useState("");
  const [wwuMessage, setWwuMessage] = useState("");
  const [wwuPortfolioUrl, setWwuPortfolioUrl] = useState("");
  const [wwuLinkedinUrl, setWwuLinkedinUrl] = useState("");
  const [wwuWebsite, setWwuWebsite] = useState(""); // honeypot
  const [wwuFile, setWwuFile] = useState<File | null>(null);
  const [wwuFileError, setWwuFileError] = useState<string | null>(null);
  const wwuFileInputRef = useRef<HTMLInputElement>(null);
  const [wwuSubmitting, setWwuSubmitting] = useState(false);
  const [wwuSubmitError, setWwuSubmitError] = useState<string | null>(null);
  const [wwuSent, setWwuSent] = useState(false);
  const { isLikelyBot: wwuIsBot, wrapperProps: wwuHoneypot } = useHoneypot();

  // ── Full-time handlers
  function handleFtFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFtFileError(null);
    if (!file) { setFtCvFile(null); return; }
    if (!ALLOWED_CV_MIME_TYPES.includes(file.type)) {
      setFtFileError("Please upload a PDF or Word document (.pdf, .doc, .docx).");
      if (ftFileInputRef.current) ftFileInputRef.current.value = "";
      setFtCvFile(null);
      return;
    }
    if (file.size > CAREER_CV_MAX_BYTES) {
      setFtFileError(`That file is ${formatMB(file.size)} — the limit is ${formatMB(CAREER_CV_MAX_BYTES)}.`);
      if (ftFileInputRef.current) ftFileInputRef.current.value = "";
      setFtCvFile(null);
      return;
    }
    setFtCvFile(file);
  }

  async function handleFtSubmit(e: FormEvent) {
    e.preventDefault();
    if (ftIsBot(ftWebsite)) {
      setFtSubmitting(true);
      setTimeout(() => { setFtSubmitting(false); setFtSent(true); }, 400);
      return;
    }
    if (!ftCvFile) { setFtFileError("Please attach your CV."); return; }
    setFtSubmitting(true);
    setFtSubmitError(null);

    const ext = ftCvFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `applications/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(CAREER_CV_BUCKET)
      .upload(path, ftCvFile, { cacheControl: "3600", upsert: false });
    if (uploadErr) {
      setFtSubmitting(false);
      setFtSubmitError("Couldn’t upload your CV — it may be too large or an unsupported type. Try again.");
      return;
    }

    const result = await submitPublicForm("careers", {
      name: ftName,
      email: ftEmail,
      role: ftRole,
      cv_path: path,
      cv_filename: ftCvFile.name,
      portfolio_url: ftPortfolioUrl.trim() || null,
      linkedin_url: ftLinkedinUrl.trim() || null,
      location: ftLocation,
      cover_letter: ftCoverLetter,
      career_id: selectedCareerId,
    });

    setFtSubmitting(false);
    if (!result.ok) {
      setFtSubmitError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    setFtSent(true);
  }

  // ── Work With Us handlers
  function handleWwuFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setWwuFileError(null);
    if (!f) { setWwuFile(null); return; }
    if (!ALLOWED_WORK_WITH_US_ATTACHMENT_MIME_TYPES.includes(f.type)) {
      setWwuFileError("Please attach a PDF, Word doc, or image (JPG/PNG/WebP).");
      if (wwuFileInputRef.current) wwuFileInputRef.current.value = "";
      setWwuFile(null);
      return;
    }
    if (f.size > WORK_WITH_US_ATTACHMENT_MAX_BYTES) {
      setWwuFileError(`That file is ${formatMB(f.size)} — the limit is ${formatMB(WORK_WITH_US_ATTACHMENT_MAX_BYTES)}.`);
      if (wwuFileInputRef.current) wwuFileInputRef.current.value = "";
      setWwuFile(null);
      return;
    }
    setWwuFile(f);
  }

  async function handleWwuSubmit(e: FormEvent) {
    e.preventDefault();
    if (wwuIsBot(wwuWebsite)) {
      setWwuSubmitting(true);
      setTimeout(() => { setWwuSubmitting(false); setWwuSent(true); }, 400);
      return;
    }
    if (!wwuCategory) { setWwuSubmitError("Pick a category above."); return; }
    setWwuSubmitting(true);
    setWwuSubmitError(null);

    let attachment_path: string | null = null;
    let attachment_filename: string | null = null;
    if (wwuFile) {
      const ext = wwuFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `applications/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(WORK_WITH_US_ATTACHMENT_BUCKET)
        .upload(path, wwuFile, { cacheControl: "3600", upsert: false });
      if (uploadErr) {
        setWwuSubmitting(false);
        setWwuSubmitError("Couldn’t upload your attachment — it may be too large or an unsupported type. Try again.");
        return;
      }
      attachment_path = path;
      attachment_filename = wwuFile.name;
    }

    const result = await submitPublicForm("work_with_us", {
      name: wwuName,
      email: wwuEmail,
      category: wwuCategory,
      location: wwuLocation,
      message: wwuMessage,
      portfolio_url: wwuPortfolioUrl.trim() || null,
      linkedin_url: wwuLinkedinUrl.trim() || null,
      attachment_path,
      attachment_filename,
    });

    setWwuSubmitting(false);
    if (!result.ok) {
      setWwuSubmitError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    setWwuSent(true);
  }

  // ── Shared field class
  const fieldCls = "w-full border-2 border-billboard-ink rounded px-3 py-2.5 focus:outline-none focus:border-billboard-inkSoft transition text-sm";

  return (
    <div>
      <Seo
        title="Careers · ChatSched"
        description="Join a small South African team building the future of local advertising. Full-time roles, freelance, internships and collaborations — however you work best."
      />

      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-20">
        <div className="max-w-3xl mx-auto px-5">
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-paper px-3 py-1.5 rounded mb-5">
            Careers
          </span>
          <h1 className="text-3xl md:text-5xl font-display mb-5 max-w-2xl leading-tight">
            Help build the advertising infrastructure South Africa actually needs.
          </h1>
          <p className="text-lg text-billboard-inkSoft max-w-xl mb-8">
            We’re a small, early-stage team connecting local businesses with the audiences already worth reaching. Full-time, freelance, or collaborative — however you work best, there’s a way in.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("fulltime")}
              className="bg-billboard-ink text-billboard-paper font-bold px-5 py-2.5 rounded border-[3px] border-billboard-ink hover:-translate-y-0.5 transition text-sm"
            >
              Apply for a role
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("workwithus")}
              className="bg-white font-bold px-5 py-2.5 rounded border-[3px] border-billboard-ink hover:-translate-y-0.5 transition text-sm"
            >
              Freelance / collaborate
            </button>
          </div>
        </div>
      </section>

      {/* ───────────────────────── WHY CHATSCHED ───────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-20">
        <div className="mb-10">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-inkSoft">
            Why ChatSched
          </span>
          <h2 className="font-display text-2xl md:text-3xl mt-2 max-w-xl">
            This isn’t a role. It’s a front-row seat to something being built from scratch.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {WHY_CHATSCHED.map((item) => (
            <div
              key={item.title}
              className="border-[3px] border-billboard-ink rounded p-6 flex flex-col gap-3"
            >
              <span className="inline-block font-mono text-xs font-bold tracking-wider uppercase bg-billboard-yellow border-2 border-billboard-ink px-2.5 py-1 rounded w-fit">
                {item.tag}
              </span>
              <h3 className="font-bold text-base leading-snug">{item.title}</h3>
              <p className="text-sm text-billboard-inkSoft leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────── HOW IT WORKS ───────────────────────── */}
      <section className="border-y-[3px] border-billboard-ink bg-billboard-paperDim py-16">
        <div className="max-w-4xl mx-auto px-5">
          <h2 className="font-display text-xl mb-8">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {HOW_TO_APPLY.map((s) => (
              <div key={s.step} className="flex gap-4">
                <span className="font-display text-3xl font-black text-billboard-ink/20 shrink-0 leading-none mt-1">
                  {s.step}
                </span>
                <div>
                  <h3 className="font-bold mb-1">{s.title}</h3>
                  <p className="text-sm text-billboard-inkSoft">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── CURRENT OPENINGS ───────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-xs font-semibold tracking-wider uppercase text-billboard-red mb-1">Careers</p>
            <h2 className="font-display text-2xl md:text-3xl">Current openings.</h2>
            <p className="text-sm text-billboard-inkSoft mt-1.5 max-w-2xl">Roles published by the ChatSched team appear here automatically. Open a role to see the brief, then apply without retyping the job title.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider border-2 border-billboard-ink rounded-full px-3 py-1.5 shrink-0">
            {careersLoading ? "Loading openings" : careers.length === 1 ? "1 opening" : careers.length + " openings"}
          </span>
        </div>

        {careersError && (
          <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded-lg p-4 text-sm text-billboard-ink mb-4" role="status">
            {careersError}
          </div>
        )}

        {careersLoading ? (
          <div className="border-[3px] border-billboard-ink rounded-lg p-5 bg-white"><SkeletonRows count={3} /></div>
        ) : careers.length === 0 ? (
          <div className="border-[3px] border-dashed border-billboard-ink rounded-lg p-7 bg-billboard-paper text-center">
            <h3 className="font-display text-xl mb-2">No active roles right now.</h3>
            <p className="text-sm text-billboard-inkSoft max-w-xl mx-auto mb-4">
              We still welcome strong general applications. Tell us what you do, where you could contribute, and what you want to build with ChatSched.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCareerId(null);
                setFtRole("");
                setActiveTab("fulltime");
                setTimeout(() => document.getElementById("career-application-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              }}
              className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm"
            >
              Submit a general application →
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {careers.map((career) => (
              <article key={career.id} className="border-[3px] border-billboard-ink rounded-lg bg-white p-5 flex flex-col hover:-translate-y-0.5 transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-greenDeep font-bold mb-1">{career.department}</p>
                    <h3 className="font-display text-xl">{career.job_title}</h3>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-billboard-green shrink-0 mt-2" aria-label="Open role" />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="font-mono text-[10px] border border-billboard-ink/20 rounded-full px-2 py-1">{career.location}</span>
                  <span className="font-mono text-[10px] border border-billboard-ink/20 rounded-full px-2 py-1">{career.remote_type === "remote" ? "Remote" : career.remote_type === "hybrid" ? "Hybrid" : "On-site"}</span>
                  <span className="font-mono text-[10px] border border-billboard-ink/20 rounded-full px-2 py-1">{career.employment_type === "full_time" ? "Full-time" : career.employment_type === "part_time" ? "Part-time" : career.employment_type === "internship" ? "Internship" : career.employment_type.charAt(0).toUpperCase() + career.employment_type.slice(1)}</span>
                </div>
                <p className="text-sm text-billboard-inkSoft mt-4 leading-relaxed flex-1">{career.short_summary}</p>
                {career.salary_min != null || career.salary_max != null ? (
                  <p className="font-mono text-xs mt-4">
                    Salary: {career.salary_min != null ? "R" + career.salary_min.toLocaleString("en-ZA") : ""}{career.salary_min != null && career.salary_max != null ? " – " : ""}{career.salary_max != null ? "R" + career.salary_max.toLocaleString("en-ZA") : ""} / year
                  </p>
                ) : null}
                {career.application_deadline && (
                  <p className="text-[11px] text-billboard-inkSoft mt-2">Apply by {new Date(career.application_deadline).toLocaleDateString("en-ZA")}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCareerId(career.id);
                    setFtRole(career.job_title);
                    setActiveTab("fulltime");
                    setTimeout(() => document.getElementById("career-application-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                  }}
                  className="w-full mt-5 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-4 py-3 rounded hover:-translate-y-0.5 transition text-sm"
                >
                  Apply for this role →
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ───────────────────────── TABS ───────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 pb-24">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-8 border-b-[3px] border-billboard-ink pb-4">
          {([
            { key: "fulltime" as Tab, label: "Apply for a role" },
            { key: "workwithus" as Tab, label: "Freelance / collaborate" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`font-semibold text-sm px-4 py-2 rounded border-2 border-billboard-ink transition ${
                activeTab === t.key
                  ? "bg-billboard-ink text-billboard-paper"
                  : "bg-white hover:bg-billboard-paperDim"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ──── FULL-TIME FORM ──── */}
        {activeTab === "fulltime" && (
          ftSent ? (
            <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paper">
              <span className="inline-block font-mono text-xs font-bold tracking-wider uppercase bg-billboard-yellow border-2 border-billboard-ink px-2.5 py-1 rounded mb-3">
                Application received
              </span>
              <h2 className="font-bold text-xl mb-2">Thanks, {ftName.split(" ")[0]}.</h2>
              <p className="text-sm text-billboard-inkSoft">
                We’ve got your application and will review it properly. If there’s a match — now or down the line — we’ll reach out. We don’t send rejection emails, so if you haven’t heard from us within four weeks, the timing wasn’t right.
              </p>
            </div>
          ) : (
            <form id="career-application-form" onSubmit={handleFtSubmit} className="border-[3px] border-billboard-ink rounded p-6 space-y-4" noValidate>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Full name</label>
                  <input
                    required
                    value={ftName}
                    onChange={(e) => setFtName(e.target.value)}
                    className={fieldCls}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Email address</label>
                  <input
                    required
                    type="email"
                    value={ftEmail}
                    onChange={(e) => setFtEmail(e.target.value)}
                    className={fieldCls}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Role you’re applying for</label>
                  {careers.length > 0 ? (
                    <select
                      required
                      value={selectedCareerId ?? "general"}
                      onChange={(e) => {
                        const id = e.target.value === "general" ? null : e.target.value;
                        setSelectedCareerId(id);
                        const selected = id ? careers.find((career) => career.id === id) : null;
                        setFtRole(selected?.job_title ?? "");
                      }}
                      className={fieldCls}
                    >
                      <option value="general">General application</option>
                      {careers.map((career) => (
                        <option key={career.id} value={career.id}>{career.job_title}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={ftRole}
                      onChange={(e) => {
                        setSelectedCareerId(null);
                        setFtRole(e.target.value);
                      }}
                      placeholder="e.g. Full-Stack Developer"
                      className={fieldCls}
                    />
                  )}
                  <p className="text-xs text-billboard-inkSoft mt-1.5">
                    {selectedCareerId ? "You’re applying for the selected ChatSched opening." : "Choose an opening above or tell us the role you’re interested in."}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Location</label>
                  <input
                    required
                    value={ftLocation}
                    onChange={(e) => setFtLocation(e.target.value)}
                    placeholder="e.g. Cape Town, South Africa"
                    className={fieldCls}
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">
                    Portfolio{" "}
                    <span className="font-normal text-billboard-inkSoft">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={ftPortfolioUrl}
                    onChange={(e) => setFtPortfolioUrl(e.target.value)}
                    placeholder="https://…"
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">
                    LinkedIn{" "}
                    <span className="font-normal text-billboard-inkSoft">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={ftLinkedinUrl}
                    onChange={(e) => setFtLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/…"
                    className={fieldCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">CV</label>
                <input
                  ref={ftFileInputRef}
                  required
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFtFileChange}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
                />
                <p className="text-xs text-billboard-inkSoft mt-1.5">PDF or Word, up to {formatMB(CAREER_CV_MAX_BYTES)}.</p>
                {ftFileError && (
                  <p className="text-billboard-red text-xs font-semibold mt-1.5" role="alert">{ftFileError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Cover letter</label>
                <textarea
                  required
                  value={ftCoverLetter}
                  onChange={(e) => setFtCoverLetter(e.target.value)}
                  rows={6}
                  placeholder="What you’d work on, what you’d bring, and why ChatSched specifically — not a template."
                  className={`${fieldCls} resize-y`}
                />
              </div>

              <div {...ftHoneypot}>
                <label htmlFor="careers-website">Leave this field empty</label>
                <input
                  id="careers-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={ftWebsite}
                  onChange={(e) => setFtWebsite(e.target.value)}
                />
              </div>

              {ftSubmitError && (
                <p className="text-billboard-red text-xs font-semibold" role="alert">{ftSubmitError}</p>
              )}
              {!isSupabaseConfigured && (
                <p className="text-xs text-billboard-inkSoft">
                  Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> directly for now.
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={ftSubmitting || !isSupabaseConfigured}
                className="w-full"
              >
                {ftSubmitting ? "Submitting…" : "Submit my application"}
              </Button>
            </form>
          )
        )}

        {/* ──── WORK WITH US FORM ──── */}
        {activeTab === "workwithus" && (
          wwuSent ? (
            <div className="border-[3px] border-billboard-ink rounded p-6 bg-billboard-paper">
              <span className="inline-block font-mono text-xs font-bold tracking-wider uppercase bg-billboard-yellow border-2 border-billboard-ink px-2.5 py-1 rounded mb-3">
                Received
              </span>
              <h2 className="font-bold text-xl mb-2">Thanks, {wwuName.split(" ")[0]}.</h2>
              <p className="text-sm text-billboard-inkSoft">
                We’ve got your message. If there’s a fit — now or when the timing is right — we’ll be in touch.
              </p>
            </div>
          ) : (
            <form onSubmit={handleWwuSubmit} className="border-[3px] border-billboard-ink rounded p-6 space-y-4" noValidate>
              {/* Category picker */}
              <div>
                <label className="block text-sm font-semibold mb-2">How would you work with us?</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {WORK_WITH_US_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setWwuCategory(c.value)}
                      className={`text-left border-[3px] rounded px-3 py-2.5 transition text-sm font-semibold ${
                        wwuCategory === c.value
                          ? "border-billboard-ink bg-billboard-yellow"
                          : "border-billboard-ink bg-white hover:bg-billboard-paperDim"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Full name</label>
                  <input
                    required
                    value={wwuName}
                    onChange={(e) => setWwuName(e.target.value)}
                    className={fieldCls}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Email address</label>
                  <input
                    required
                    type="email"
                    value={wwuEmail}
                    onChange={(e) => setWwuEmail(e.target.value)}
                    className={fieldCls}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Location</label>
                  <input
                    required
                    value={wwuLocation}
                    onChange={(e) => setWwuLocation(e.target.value)}
                    placeholder="e.g. Johannesburg, South Africa"
                    className={fieldCls}
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">
                    Portfolio / website{" "}
                    <span className="font-normal text-billboard-inkSoft">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={wwuPortfolioUrl}
                    onChange={(e) => setWwuPortfolioUrl(e.target.value)}
                    placeholder="https://…"
                    className={fieldCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">
                    LinkedIn{" "}
                    <span className="font-normal text-billboard-inkSoft">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={wwuLinkedinUrl}
                    onChange={(e) => setWwuLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/…"
                    className={fieldCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Attachment{" "}
                  <span className="font-normal text-billboard-inkSoft">(optional — CV, deck, or sample work)</span>
                </label>
                <input
                  ref={wwuFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                  onChange={handleWwuFileChange}
                  className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
                />
                <p className="text-xs text-billboard-inkSoft mt-1.5">
                  PDF, Word, or image, up to {formatMB(WORK_WITH_US_ATTACHMENT_MAX_BYTES)}.
                </p>
                {wwuFileError && (
                  <p className="text-billboard-red text-xs font-semibold mt-1.5" role="alert">{wwuFileError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">What you’d bring, and how you’d want to be involved</label>
                <textarea
                  required
                  value={wwuMessage}
                  onChange={(e) => setWwuMessage(e.target.value)}
                  rows={6}
                  placeholder="Be specific about what you do well, what kind of engagement you’re looking for, and any relevant experience."
                  className={`${fieldCls} resize-y`}
                />
              </div>

              <div {...wwuHoneypot}>
                <label htmlFor="wwu-website">Leave this field empty</label>
                <input
                  id="wwu-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={wwuWebsite}
                  onChange={(e) => setWwuWebsite(e.target.value)}
                />
              </div>

              {wwuSubmitError && (
                <p className="text-billboard-red text-xs font-semibold" role="alert">{wwuSubmitError}</p>
              )}
              {!isSupabaseConfigured && (
                <p className="text-xs text-billboard-inkSoft">
                  Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> directly for now.
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={wwuSubmitting || !isSupabaseConfigured}
                className="w-full"
              >
                {wwuSubmitting ? "Submitting…" : "Send my details"}
              </Button>
            </form>
          )
        )}
      </section>
    </div>
  );
}
