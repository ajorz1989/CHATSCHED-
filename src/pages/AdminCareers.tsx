import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import Seo from "../components/Seo";
import SetupNotice from "../components/SetupNotice";
import { SkeletonRows } from "../components/Skeleton";
import ExportCsvButton from "../components/ExportCsvButton";
import { CAREER_CV_BUCKET } from "../lib/constants";
import type { CsvRow } from "../lib/csvExport";
import type { CareerApplication, CareerApplicationStatus } from "../lib/types";
import Button from "../components/Button";

const STATUSES: CareerApplicationStatus[] = ["new", "reviewing", "interview", "offer", "hired", "rejected"];
const STATUS_LABEL: Record<CareerApplicationStatus, string> = {
  new: "New", reviewing: "Reviewing", interview: "Interview", offer: "Offer", hired: "Hired", rejected: "Rejected",
};
const STATUS_STYLE: Record<CareerApplicationStatus, string> = {
  new: "border-billboard-ink text-billboard-ink",
  reviewing: "border-billboard-yellowDeep text-billboard-yellowDeep",
  interview: "border-billboard-green text-billboard-greenDeep",
  offer: "border-billboard-greenDeep text-billboard-greenDeep",
  hired: "border-billboard-greenDeep bg-billboard-green text-white",
  rejected: "border-billboard-red text-billboard-red",
};

function buildRows(applications: CareerApplication[]): CsvRow[] {
  return applications.map((a) => ({
    Name: a.name,
    Email: a.email,
    Role: a.role,
    Location: a.location,
    Status: STATUS_LABEL[a.status],
    "Interview date": a.interview_date ? new Date(a.interview_date).toLocaleString("en-ZA") : "",
    Portfolio: a.portfolio_url || "",
    LinkedIn: a.linkedin_url || "",
    "CV filename": a.cv_filename,
    "Admin notes": a.admin_notes || "",
    Applied: new Date(a.created_at).toISOString().slice(0, 10),
  }));
}

export default function AdminCareers() {
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase.from("career_applications").select("*").order("created_at", { ascending: false });
    if (loadError) {
      setApplications([]);
      setError(formatSupabaseError(loadError, "Couldn't load career applications"));
    } else {
      setApplications((data ?? []) as CareerApplication[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isSupabaseConfigured) loadAll();
  }, []);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function updateStatus(id: string, status: CareerApplicationStatus) {
    const previous = applications.find((a) => a.id === id)?.status;
    setError(null);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    const { error: updateError } = await supabase.from("career_applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (updateError) {
      if (previous) setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: previous } : a)));
      setError(formatSupabaseError(updateError, "Couldn't update the application status"));
    }
  }

  async function updateNotes(id: string, admin_notes: string) {
    const previous = applications.find((a) => a.id === id)?.admin_notes ?? null;
    setError(null);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, admin_notes } : a)));
    const { error: updateError } = await supabase.from("career_applications").update({ admin_notes: admin_notes || null }).eq("id", id);
    if (updateError) {
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, admin_notes: previous } : a)));
      setError(formatSupabaseError(updateError, "Couldn't save the application notes"));
    }
  }

  async function updateInterviewDate(id: string, interview_date: string) {
    const previous = applications.find((a) => a.id === id)?.interview_date ?? null;
    let iso: string | null = null;
    if (interview_date) {
      const parsed = new Date(interview_date);
      if (Number.isNaN(parsed.getTime())) {
        setError("That interview date is invalid.");
        return;
      }
      iso = parsed.toISOString();
    }
    setError(null);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, interview_date: iso } : a)));
    const { error: updateError } = await supabase.from("career_applications").update({ interview_date: iso }).eq("id", id);
    if (updateError) {
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, interview_date: previous } : a)));
      setError(formatSupabaseError(updateError, "Couldn't save the interview date"));
    }
  }

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <Seo title="Careers Admin · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Admin</span>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <h1 className="text-3xl md:text-4xl">Careers applications.</h1>
        <Link to="/admin" className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition shrink-0">
          ← Main admin
        </Link>
      </div>
      <p className="text-billboard-inkSoft mb-8">{applications.length} total — {STATUSES.map((s) => `${counts[s] ?? 0} ${STATUS_LABEL[s].toLowerCase()}`).join(" · ")}</p>

      {error && (
        <div className="mb-4 rounded-lg border-2 border-billboard-red bg-billboard-red/5 px-4 py-3 text-sm text-billboard-red" role="alert">{error}</div>
      )}

      {loading ? (
        <SkeletonRows count={4} />
      ) : applications.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No applications yet — submissions from /careers will show up here.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExportCsvButton label="Export CSV" filenameBase="career-applications" rows={buildRows(applications)} />
          </div>
          {applications.map((a) => (
            <ApplicationCard key={a.id} application={a} onStatusChange={updateStatus} onNotesChange={updateNotes} onInterviewDateChange={updateInterviewDate} />
          ))}
        </div>
      )}
    </div>
  );
}

// Local-datetime-input helper — <input type="datetime-local"> wants
// "YYYY-MM-DDTHH:mm" in local time, not the ISO string stored on the row.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ApplicationCard({
  application: a, onStatusChange, onNotesChange, onInterviewDateChange,
}: {
  application: CareerApplication;
  onStatusChange: (id: string, status: CareerApplicationStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
  onInterviewDateChange: (id: string, date: string) => void;
}) {
  const [notes, setNotes] = useState(a.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function saveNotes() {
    setSavingNotes(true);
    await onNotesChange(a.id, notes);
    setSavingNotes(false);
  }

  async function downloadCv() {
    setDownloading(true);
    setDownloadError(null);
    const { data, error } = await supabase.storage.from(CAREER_CV_BUCKET).createSignedUrl(a.cv_path, 300); // 5 minutes — long enough to open, short enough not to matter if it leaks
    setDownloading(false);
    if (error || !data?.signedUrl) {
      setDownloadError(formatSupabaseError(error, "Couldn't generate download link"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="font-bold">{a.name} <span className="font-normal text-billboard-inkSoft text-sm">· {a.role}</span></p>
          <p className="text-xs text-billboard-inkSoft mt-1 font-mono">{a.email} · {a.location}</p>
          <p className="text-xs text-billboard-inkSoft mt-1 font-mono">
            {[a.portfolio_url ? "Portfolio" : null, a.linkedin_url ? "LinkedIn" : null].filter(Boolean).length > 0 && (
              <>
                {a.portfolio_url && <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="underline">Portfolio</a>}
                {a.portfolio_url && a.linkedin_url && " · "}
                {a.linkedin_url && <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline">LinkedIn</a>}
              </>
            )}
          </p>
        </div>
        <select
          value={a.status}
          onChange={(e) => onStatusChange(a.id, e.target.value as CareerApplicationStatus)}
          className={`font-mono text-xs font-semibold uppercase border-2 rounded px-2.5 py-2 bg-white shrink-0 ${STATUS_STYLE[a.status]}`}
        >
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <p className="text-sm text-billboard-inkSoft mt-3 max-w-2xl whitespace-pre-wrap">{a.cover_letter}</p>

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap items-center gap-3">
        <button
          onClick={downloadCv}
          disabled={downloading}
          className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60"
        >
          {downloading ? "Preparing…" : `⬇ Download CV (${a.cv_filename})`}
        </button>
        <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">Applied {new Date(a.created_at).toLocaleDateString("en-ZA")}</span>
        {downloadError && <span className="text-billboard-red text-xs font-semibold">{downloadError}</span>}
      </div>

      {(a.status === "interview" || a.interview_date) && (
        <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Interview status / scheduled time</label>
          <input
            type="datetime-local"
            defaultValue={toLocalInputValue(a.interview_date)}
            onBlur={(e) => onInterviewDateChange(a.id, e.target.value)}
            className="border-2 border-billboard-ink rounded px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Notes</label>
        <div className="flex gap-2">
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes on this candidate"
            className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
          />
          <Button onClick={saveNotes} disabled={savingNotes} variant="outline" size="md" className="shrink-0">
            {savingNotes ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
