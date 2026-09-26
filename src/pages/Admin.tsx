import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { getChannelBySlug } from "../lib/channelRegistry";
import { getOnboardingSummaryFields } from "../lib/channelOnboardingSchemas";
import { formatCurrency } from "../lib/currency";
import SetupNotice from "../components/SetupNotice";
import MessageThread from "../components/MessageThread";
import Seo from "../components/Seo";
import { SkeletonRows } from "../components/Skeleton";
import AdminAnalytics from "./AdminAnalytics";
import AdminPayouts from "./AdminPayouts";
import AdminChannelRequests from "./AdminChannelRequests";
import AdminLeads from "./AdminLeads";
import AdminClients from "./AdminClients";
import AdminCampaigns from "./AdminCampaigns";
import AdminAuditLog from "./AdminAuditLog";
import AdminOpportunities from "./AdminOpportunities";
import AdminSecurity from "./AdminSecurity";
import AdminCompliance from "./AdminCompliance";
import AdminMessageSafety from "./AdminMessageSafety";
import AdminCareersManager from "./AdminCareersManager";
import AdminAJCreations from "./AdminAJCreations";
import AdminNavigation from "../components/AdminNavigation";
import PayoutComplianceHint from "../components/PayoutComplianceHint";
import { CATEGORIES, PROVINCES, PLATFORMS, SWATCHES, PUBLISHER_SHARE, PAYOUT_DUE_DAYS, FEATURED_DURATION_DAYS, WORK_WITH_US_CATEGORIES, WORK_WITH_US_ATTACHMENT_BUCKET, PARTNER_CATEGORIES, PARTNER_[...]
import { computeVerificationLevel } from "../lib/businessVerification";
import TrustBadge from "../components/TrustBadge";
import { computeAuthenticitySignals, SEVERITY_META } from "../lib/authenticitySignals";
import ExportCsvButton from "../components/ExportCsvButton";
import Button from "../components/Button";
import type { CsvRow } from "../lib/csvExport";
import type { Publisher, PublisherRequest, ContactMessage, RequestStatus, Platform, Profile, Report, Dispute, WorkWithUsApplication, WorkWithUsCategory, WorkWithUsStatus, PartnerApplication, Partn[...]

// Admin sees the real profiles row for a request's business — its own
// is_admin() RLS branch on profiles allows it — so it fetches phone
// directly (unlike the publisher-facing PublisherRequest.business, which
// is deliberately narrowed to business_contact_public's safe columns
// only; see src/lib/businessContact.ts). This widens just the admin
// view's own request shape rather than reopening the shared type.
type AdminRequestRow = PublisherRequest & { business: (Pick<Profile, "full_name" | "company_name" | "phone">) | null };

export type AdminTab = "requests" | "applications" | "publishers" | "businesses" | "messages" | "analytics" | "payouts" | "channel_requests" | "reports" | "disputes" | "security" | "compliance" | [...]
const STATUSES: RequestStatus[] = ["pending", "contacted", "confirmed", "declined", "completed"];
const WWU_STATUSES: WorkWithUsStatus[] = ["new", "contacted", "archived"];
const WWU_STATUS_LABEL: Record<WorkWithUsStatus, string> = { new: "New", contacted: "Contacted", archived: "Archived" };
const WWU_CATEGORY_LABEL: Record<WorkWithUsCategory, string> = Object.fromEntries(WORK_WITH_US_CATEGORIES.map((c) => [c.value, c.label])) as Record<WorkWithUsCategory, string>;
const PARTNER_STATUSES: PartnerStatus[] = ["new", "contacted", "in_discussion", "active", "declined"];
const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = { new: "New", contacted: "Contacted", in_discussion: "In Discussion", active: "Active Partner", declined: "Declined" };
const PARTNER_STATUS_STYLE: Record<PartnerStatus, string> = {
  new: "border-billboard-ink text-billboard-ink",
  contacted: "border-billboard-yellowDeep text-billboard-yellowDeep",
  in_discussion: "border-billboard-green text-billboard-greenDeep",
  active: "border-billboard-greenDeep bg-billboard-green text-white",
  declined: "border-billboard-red text-billboard-red",
};
const PARTNER_CATEGORY_LABEL: Record<PartnerCategory, string> = Object.fromEntries(PARTNER_CATEGORIES.map((c) => [c.value, c.label])) as Record<PartnerCategory, string>;
const PARTNER_TYPE_LABEL: Record<PartnerType, string> = Object.fromEntries(PARTNER_TYPES.map((t) => [t.value, t.label])) as Record<PartnerType, string>;
const ADVERTISE_STATUSES: AdvertiseStatus[] = ["new", "contacted", "in_discussion", "active", "declined"];
const ADVERTISE_STATUS_LABEL: Record<AdvertiseStatus, string> = { new: "New", contacted: "Contacted", in_discussion: "In Discussion", active: "Active", declined: "Declined" };
const ADVERTISE_STATUS_STYLE: Record<AdvertiseStatus, string> = {
  new: "border-billboard-ink text-billboard-ink",
  contacted: "border-billboard-yellowDeep text-billboard-yellowDeep",
  in_discussion: "border-billboard-green text-billboard-greenDeep",
  active: "border-billboard-greenDeep bg-billboard-green text-white",
  declined: "border-billboard-red text-billboard-red",
};
const ADVERTISE_PRODUCT_LABEL: Record<AdvertiseProduct, string> = Object.fromEntries(ADVERTISE_PRODUCTS.map((p) => [p.value, p.label])) as Record<AdvertiseProduct, string>;
const COMMUNITY_EVENT_TYPE_LABEL: Record<CommunityEventType, string> = Object.fromEntries(COMMUNITY_EVENT_TYPES.map((t) => [t.value, t.label])) as Record<CommunityEventType, string>;
const COMMUNITY_QUESTION_CATEGORY_LABEL: Record<CommunityQuestionCategory, string> = Object.fromEntries(COMMUNITY_QUESTION_CATEGORIES.map((c) => [c.value, c.label])) as Record<CommunityQuestionCat[...]

// Best-effort admin audit log — see schema_phase15_audit_log.sql. Never
// allowed to block or fail the real action it's describing.
async function logAdminAction(action: string, targetTable: string, targetId: string | null, detail?: Record<string, unknown>) {
  try {
    await supabase.rpc("log_admin_action", { p_action: action, p_target_table: targetTable, p_target_id: targetId, p_detail: detail ?? null });
  } catch (err) {
    console.warn("Audit log write failed (non-fatal)", err);
  }
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

// Compact badge row for the always-on, free, rule-based signals — shown
// wherever a publisher appears in review contexts. Deliberately doesn't try
// to summarize into one score; each signal is its own explainable claim
// (see authenticitySignals.ts's header comment on why).
function SignalBadges({ publisher }: { publisher: Publisher }) {
  const signals = computeAuthenticitySignals(publisher);
  if (signals.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {signals.map((s) => (
        <span
          key={s.id}
          title={s.detail}
          className={`font-mono text-[10px] font-semibold uppercase border-2 rounded-full px-2 py-0.5 ${SEVERITY_META[s.severity].className}`}
        >
          ⚑ {s.label}
        </span>
      ))}
    </div>
  );
}

// The admin-triggered AI second opinion — cached on the row, re-runnable.
// Kept as its own component since it owns the "run check" request lifecycle
// (loading/error) independent of whatever list it's rendered inside.
function AuthenticityCheck({ publisher: p, onChecked }: { publisher: Publisher; onChecked: () => void }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("publisher-authenticity-check", { body: { publisher_id: p.id } });
      setRunning(false);
      if (invokeError || data?.error) {
        setError(data?.error ?? "Check failed — try again in a moment.");
        return;
      }
      onChecked();
    } catch {
      // A genuine network failure throws here instead of returning an
      // { error } result — without this, setRunning(false) never runs
      // and the button is stuck disabled with no way to retry short of a
      // refresh. See AuthContext.tsx for the same pattern.
      setRunning(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="mt-2">
      {p.authenticity_risk ? (
        <div className={`inline-flex flex-col gap-0.5 border-2 rounded px-2.5 py-1.5 ${SEVERITY_META[p.authenticity_risk].className}`}>
          <span className="font-mono text-[10px] font-semibold uppercase">AI second opinion: {SEVERITY_META[p.authenticity_risk].label} risk</span>
          {p.authenticity_notes && <span className="text-xs normal-case font-sans">{p.authenticity_notes}</span>}
        </div>
      ) : null}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={run}
          disabled={running}
          className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1 hover:-translate-y-0.5 transition disabled:opacity-60"
        >
          {running ? "Checking…" : p.authenticity_risk ? "Re-run AI check" : "Run AI authenticity check"}
        </button>
        {p.authenticity_checked_at && <span className="text-[10px] text-billboard-inkSoft font-mono">last run {daysSince(p.authenticity_checked_at)}d ago</span>}
      </div>
      {error && <p className="text-billboard-red text-xs font-semibold mt-1">{error}</p>}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>("requests");
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [businesses, setBusinesses] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [workWithUs, setWorkWithUs] = useState<WorkWithUsApplication[]>([]);
  const [partners, setPartners] = useState<PartnerApplication[]>([]);
  const [advertiseInquiries, setAdvertiseInquiries] = useState<AdvertiseInquiry[]>([]);
  const [communityAnnouncements, setCommunityAnnouncements] = useState<CommunityAnnouncement[]>([]);
  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>([]);
  const [communityQuestions, setCommunityQuestions] = useState<CommunityQuestion[]>([]);
  // Task 2 (owner-verification workflow): which channels actually require
  // it, and what's already been confirmed per publisher — both fetched
  // once in loadAll() alongside everything else, not per-card, same
  // batched pattern this file already uses everywhere.
  const [verificationRequiredChannels, setVerificationRequiredChannels] = useState<Set<string>>(new Set());
  const [verificationChecks, setVerificationChecks] = useState<Record<string, { checksConfirmed: string[]; checksTotal: number }>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadVersionRef = useRef(0);

  async function loadAll() {
    const loadVersion = ++loadVersionRef.current;
    setLoading(true);
    setLoadError(null);

    const results = await Promise.all([
      supabase.from("requests").select("*, publisher:publishers(id,name), business:profiles(full_name, company_name, phone), payments(*)").order("created_at", { ascending: false }),
      supabase.from("publishers").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "business").order("created_at", { ascending: false }),
      supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("reports").select("*, publisher:publishers(name)").order("created_at", { ascending: false }),
      supabase.from("disputes").select("*, publisher:publishers(name), business:profiles(full_name, company_name), dispute_messages(*)").order("updated_at", { ascending: false }),
      supabase.from("work_with_us_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("advertise_inquiries").select("*").order("created_at", { ascending: false }),
      supabase.from("community_announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("community_events").select("*").order("starts_at", { ascending: false }),
      supabase.from("community_questions").select("*").order("created_at", { ascending: false }),
      supabase.from("channels").select("slug, verification_required"),
      supabase.from("publisher_verification_checks").select("publisher_id, checks_confirmed, checks_total"),
    ]);

    if (loadVersion !== loadVersionRef.current) return;

    const [
      reqRes, pubRes, bizRes, msgRes, reportRes, disputeRes, wwuRes,
      partnerRes, adRes, annRes, evtRes, qRes, channelRes, verifRes,
    ] = results;

    const namedResults = [
      ["requests", reqRes],
      ["publishers", pubRes],
      ["businesses", bizRes],
      ["messages", msgRes],
      ["reports", reportRes],
      ["disputes", disputeRes],
      ["work with us", wwuRes],
      ["partners", partnerRes],
      ["advertise", adRes],
      ["community announcements", annRes],
      ["community events", evtRes],
      ["community questions", qRes],
      ["channels", channelRes],
      ["verification", verifRes],
    ] as const;
    const failed = namedResults.filter(([, result]) => result.error);
    if (failed.length > 0) {
      setLoadError("Some admin data could not be loaded: " + failed.map(([name, result]) => name + " (" + (result.error?.message ?? "unknown error") + ")").join(", "));
    }

    if (!reqRes.error) setRequests((reqRes.data ?? []) as unknown as AdminRequestRow[]);
    if (!pubRes.error) setPublishers((pubRes.data ?? []) as Publisher[]);
    if (!bizRes.error) setBusinesses((bizRes.data ?? []) as Profile[]);
    if (!msgRes.error) setMessages((msgRes.data ?? []) as ContactMessage[]);
    if (!reportRes.error) setReports((reportRes.data ?? []) as unknown as Report[]);
    if (!wwuRes.error) setWorkWithUs((wwuRes.data ?? []) as WorkWithUsApplication[]);
    if (!partnerRes.error) setPartners((partnerRes.data ?? []) as PartnerApplication[]);
    if (!adRes.error) setAdvertiseInquiries((adRes.data ?? []) as AdvertiseInquiry[]);
    if (!annRes.error) setCommunityAnnouncements((annRes.data ?? []) as CommunityAnnouncement[]);
    if (!evtRes.error) setCommunityEvents((evtRes.data ?? []) as CommunityEvent[]);
    if (!qRes.error) setCommunityQuestions((qRes.data ?? []) as CommunityQuestion[]);
    if (!disputeRes.error) {
      setDisputes(((disputeRes.data ?? []) as unknown as Dispute[]).map((d) => ({
        ...d,
        dispute_messages: (d.dispute_messages ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
      })));
    }
    if (!channelRes.error) {
      setVerificationRequiredChannels(
        new Set(((channelRes.data ?? []) as { slug: string; verification_required: boolean }[]).filter((ch) => ch.verification_required).map((ch) => ch.slug))
      );
    }
    if (!verifRes.error) {
      setVerificationChecks(
        Object.fromEntries(
          ((verifRes.data ?? []) as { publisher_id: string; checks_confirmed: string[]; checks_total: number }[]).map((v) => [
            v.publisher_id,
            { checksConfirmed: v.checks_confirmed, checksTotal: v.checks_total },
          ])
        )
      );
    }

    if (loadVersion === loadVersionRef.current) setLoading(false);
  }

  useEffect(() => {
    if (isSupabaseConfigured) loadAll();
  }, []);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function updateStatus(id: string, status: RequestStatus) {
    const previous = requests.find((r) => r.id === id)?.status;
    setActionError(null);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

    const { error } = await supabase.from("requests").update({ status }).eq("id", id);
    if (error) {
      if (previous) setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: previous } : r)));
      setActionError(formatSupabaseError(error, "Couldn't update the request status"));
      return;
    }

    supabase.functions.invoke("notify", { body: { kind: "status_change", request_id: id } }).catch(() => {});
  }

  async function updateAgreedAmount(id: string, agreed_amount: number | null) {
    const previous = requests.find((r) => r.id === id)?.agreed_amount ?? null;
    setActionError(null);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, agreed_amount } : r)));

    const { error } = await supabase.from("requests").update({ agreed_amount }).eq("id", id);
    if (error) {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, agreed_amount: previous } : r)));
      setActionError(formatSupabaseError(error, "Couldn't update the agreed amount"));
    }
  }

  async function markPayoutSent(paymentId: string) {
    setActionError(null);
    const { error } = await supabase.from("payments").update({ payout_status: "paid", payout_date: new Date().toISOString() }).eq("id", paymentId);
    if (error) {
      setActionError(formatSupabaseError(error, "Couldn't mark the payout as sent"));
      return;
    }
    logAdminAction("payout_marked_sent", "payments", paymentId);
    await loadAll();
  }

  // EFT payments (schema_phase28_eft_payment.sql) have no PayFast webhook to
  // auto-confirm them — a business claims they've paid
  // (eft_confirmed_by_business_at), then an admin actually checks the bank
  // account and marks it paid here. Same two-step shape as
  // channel_requests' payment_submitted -> paid.
  async function confirmEftPayment(paymentId: string) {
    setActionError(null);
    const { error } = await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", paymentId);
    if (error) {
      setActionError(formatSupabaseError(error, "Couldn't confirm the EFT payment"));
      return;
    }
    logAdminAction("eft_payment_confirmed", "payments", paymentId);
    await loadAll();
  }

  // All publisher approvals now pass through the server-side approval RPC.
  // High-trust channels require a complete checklist plus uploaded evidence;
  // Social Media verification requires submitted public profile URLs.
  // This keeps the admin UI and database enforcement on one canonical path.
  async function approvePublisher(
    id: string,
    verification?: { channelSlug: string; checksConfirmed: string[]; checksTotal: number }
  ) {
    const { error: approvalError } = await supabase.rpc("approve_publisher_application", {
      p_publisher_id: id,
      p_checks_confirmed: verification?.checksConfirmed ?? [],
    });

    if (approvalError) {
      setActionError(formatSupabaseError(approvalError, "Publisher approval was blocked by verification requirements"));
      await loadAll();
      return;
    }

    await supabase.rpc("refresh_publisher_scores", { p_publisher_id: id });
    // In-app bell notifications for matching saved searches are trigger-driven
    // by the publisher status transition. Keep the email half fire-and-forget.
    supabase.functions.invoke("notify-saved-search-matches", { body: { publisher_id: id } }).catch(() => {});

    logAdminAction(
      "publisher_approved",
      "publishers",
      id,
      verification
        ? {
            channel_slug: verification.channelSlug,
            checks_confirmed: verification.checksConfirmed,
            checks_total: verification.checksTotal,
            ...(verification.channelSlug === "social-media" ? { social_links_reviewed: true } : {}),
          }
        : undefined,
    );
    loadAll();
  }

  async function rejectPublisher(id: string, reason: string) {
    setPublishers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "rejected", rejected_reason: reason } : p)));
    await supabase.from("publishers").update({ status: "rejected", rejected_reason: reason, reviewed_at: new Date().toISOString() }).eq("id", id);
    logAdminAction("publisher_rejected", "publishers", id, { reason });
  }

  // No messaging channel to a publisher exists yet (Phase 3's thread is
  // business <-> admin only), so this just keeps a note on the row for now
  // rather than sending anything — see the note above ApplicationCard.
  async function requestMoreInfo(id: string, note: string) {
    setPublishers((prev) => prev.map((p) => (p.id === id ? { ...p, admin_notes: note } : p)));
    await supabase.from("publishers").update({ admin_notes: note }).eq("id", id);
    logAdminAction("publisher_info_requested", "publishers", id);
  }

  // trg_prevent_self_verification (schema_phase7.sql) only lets these two
  // columns through for an admin session — this button is that session.
  async function toggleBusinessFlag(id: string, field: "phone_verified" | "business_verified", value: boolean) {
    setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
    await supabase.from("profiles").update({ [field]: value }).eq("id", id);
    logAdminAction(value ? `${field}_granted` : `${field}_revoked`, "profiles", id);
  }

  async function toggleFeatured(id: string, featured: boolean) {
    const featured_until = featured ? new Date(Date.now() + FEATURED_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString() : null;
    setPublishers((prev) => prev.map((p) => (p.id === id ? { ...p, featured, featured_until } : p)));
    await supabase.from("publishers").update({ featured, featured_until }).eq("id", id);
    logAdminAction(featured ? "publisher_featured" : "publisher_unfeatured", "publishers", id, { featured_until });
  }

  async function resolveReport(id: string, status: "reviewed" | "dismissed", admin_notes: string) {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status, admin_notes, reviewed_at: new Date().toISOString() } : r)));
    await supabase.from("reports").update({ status, admin_notes: admin_notes || null, reviewed_at: new Date().toISOString() }).eq("id", id);
    logAdminAction(status === "dismissed" ? "report_dismissed" : "report_reviewed", "reports", id, { admin_notes });
  }

  async function suspendPublisher(id: string) {
    setPublishers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "suspended" } : p)));
    await supabase.from("publishers").update({ status: "suspended" }).eq("id", id);
    logAdminAction("publisher_suspended", "publishers", id);
    loadAll();
  }

  async function updateWorkWithUsStatus(id: string, status: WorkWithUsStatus) {
    setWorkWithUs((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    await supabase.from("work_with_us_applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    logAdminAction("work_with_us_status_changed", "work_with_us_applications", id, { status });
  }

  async function updateWorkWithUsNotes(id: string, admin_notes: string) {
    setWorkWithUs((prev) => prev.map((w) => (w.id === id ? { ...w, admin_notes } : w)));
    await supabase.from("work_with_us_applications").update({ admin_notes: admin_notes || null }).eq("id", id);
  }

  async function updatePartnerStatus(id: string, status: PartnerStatus) {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await supabase.from("partner_applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    logAdminAction("partner_status_changed", "partner_applications", id, { status });
  }

  async function updatePartnerNotes(id: string, admin_notes: string) {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, admin_notes } : p)));
    await supabase.from("partner_applications").update({ admin_notes: admin_notes || null }).eq("id", id);
  }

  async function updateAdvertiseStatus(id: string, status: AdvertiseStatus) {
    setAdvertiseInquiries((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await supabase.from("advertise_inquiries").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    logAdminAction("advertise_status_changed", "advertise_inquiries", id, { status });
  }

  async function updateAdvertiseNotes(id: string, admin_notes: string) {
    setAdvertiseInquiries((prev) => prev.map((a) => (a.id === id ? { ...a, admin_notes } : a)));
    await supabase.from("advertise_inquiries").update({ admin_notes: admin_notes || null }).eq("id", id);
  }

  // ── Community: announcements ──────────────────────────────────────────
  async function createAnnouncement(title: string, body: string, pinned: boolean) {
    const { data } = await supabase.from("community_announcements").insert({ title, body, pinned }).select().single();
    if (data) setCommunityAnnouncements((prev) => [data as CommunityAnnouncement, ...prev]);
  }
  async function updateAnnouncement(id: string, patch: Partial<Pick<CommunityAnnouncement, "title" | "body" | "pinned" | "is_published">>) {
    setCommunityAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    await supabase.from("community_announcements").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function deleteAnnouncement(id: string) {
    setCommunityAnnouncements((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("community_announcements").delete().eq("id", id);
  }

  // ── Community: events ────────────────────────────────────────────────
  async function createEvent(input: { title: string; description: string; event_type: CommunityEventType; starts_at: string; location_or_link: string }) {
    const { data } = await supabase.from("community_events").insert(input).select().single();
    if (data) setCommunityEvents((prev) => [data as CommunityEvent, ...prev].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
  }
  async function updateEvent(id: string, patch: Partial<CommunityEvent>) {
    setCommunityEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await supabase.from("community_events").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function deleteEvent(id: string) {
    setCommunityEvents((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("community_events").delete().eq("id", id);
  }

  // ── Community: Q&A ───────────────────────────────────────────────────
  async function updateQuestion(id: string, patch: Partial<Pick<CommunityQuestion, "answer" | "status" | "admin_notes">>) {
    setCommunityQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    const payload: Record<string, unknown> = { ...patch };
    if (patch.status === "answered" || patch.status === "published") payload.answered_at = new Date().toISOString();
    await supabase.from("community_questions").update(payload).eq("id", id);
    logAdminAction("community_question_updated", "community_questions", id, patch);
  }
  async function deleteQuestion(id: string) {
    setCommunityQuestions((prev) => prev.filter((q) => q.id !== id));
    await supabase.from("community_questions").delete().eq("id", id);
  }

  const pendingApplications = publishers.filter((p) => p.status === "pending_review");
  const reviewedPublishers = publishers.filter((p) => p.status !== "pending_review");
  const openReports = reports.filter((r) => r.status === "open");
  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "awaiting_response");

  const navCounts: Partial<Record<AdminTab, string | number>> = {
    requests: requests.length,
    applications: pendingApplications.length,
    publishers: reviewedPublishers.length,
    businesses: businesses.length,
    messages: messages.length,
    channel_requests: "•",
    work_with_us: workWithUs.length,
    partners: partners.length,
    advertise: advertiseInquiries.length,
    community: communityQuestions.filter((q) => q.status === "pending").length,
    reports: openReports.length,
    disputes: openDisputes.length,
    payouts: "⚠",
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 py-8 md:py-10">
      <Seo title="Admin · ChatSched" noindex />
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="inline-block font-mono text-[10px] font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-2">Admin</span>
          <h1 className="text-3xl md:text-4xl">Run the platform.</h1>
          <p className="text-sm text-billboard-inkSoft mt-1.5">One control centre for marketplace operations, content, finance and high-privilege tools.</p>
        </div>
        <Link to="/careers" target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 t[...]
          View public Careers →
        </Link>
      </div>

      {loadError && (
        <div className="mb-5 rounded-lg border-2 border-billboard-red bg-billboard-red/5 px-4 py-3 text-sm text-billboard-red" role="alert">
          {loadError}
        </div>
      )}
      {actionError && (
        <div className="mb-5 rounded-lg border-2 border-billboard-yellowDeep bg-billboard-yellow/10 px-4 py-3 text-sm text-billboard-ink" role="alert">
          {actionError}
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
        <AdminNavigation tab={tab} onSelect={(next) => { setActionError(null); setTab(next); }} counts={navCounts} />

        <section aria-live="polite" aria-busy={loading}>
          {loading ? (
            <SkeletonRows count={4} />
          ) : tab === "requests" ? (
              <RequestsTab requests={requests} onStatusChange={updateStatus} onAmountChange={updateAgreedAmount} onPayoutSent={markPayoutSent} onEftConfirm={confirmEftPayment} />
       ) : tab === "applications" ? (
        <ApplicationsTab
          applications={pendingApplications}
          onApprove={approvePublisher}
          onReject={rejectPublisher}
          onRequestInfo={requestMoreInfo}
          onRefresh={loadAll}
          verificationRequiredChannels={verificationRequiredChannels}
          verificationChecks={verificationChecks}
        />
       ) : tab === "publishers" ? (
        <PublishersTab publishers={reviewedPublishers} onAdded={loadAll} onToggleFeatured={toggleFeatured} />
       ) : tab === "reports" ? (
        <ReportsTab reports={reports} onResolve={resolveReport} onSuspend={suspendPublisher} />
       ) : tab === "disputes" ? (
        <DisputesTab disputes={disputes} onChange={loadAll} />
       ) : tab === "analytics" ? (
        <AdminAnalytics />
       ) : tab === "payouts" ? (
        <AdminPayouts />
       ) : tab === "channel_requests" ? (
        <AdminChannelRequests />
       ) : tab === "work_with_us" ? (
        <WorkWithUsTab applications={workWithUs} onStatusChange={updateWorkWithUsStatus} onNotesChange={updateWorkWithUsNotes} />
       ) : tab === "partners" ? (
        <PartnersTab applications={partners} onStatusChange={updatePartnerStatus} onNotesChange={updatePartnerNotes} />
       ) : tab === "advertise" ? (
        <AdvertiseTab inquiries={advertiseInquiries} onStatusChange={updateAdvertiseStatus} onNotesChange={updateAdvertiseNotes} />
       ) : tab === "community" ? (
        <CommunityAdminTab
          announcements={communityAnnouncements}
          events={communityEvents}
          questions={communityQuestions}
          onCreateAnnouncement={createAnnouncement}
          onUpdateAnnouncement={updateAnnouncement}
          onDeleteAnnouncement={deleteAnnouncement}
          onCreateEvent={createEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onUpdateQuestion={updateQuestion}
          onDeleteQuestion={deleteQuestion}
        />
       ) : tab === "security" ? (
        <AdminSecurity />
       ) : tab === "compliance" ? (
        <AdminCompliance />
       ) : tab === "safety" ? (
        <AdminMessageSafety />
       ) : tab === "leads" ? (
        <AdminLeads />
       ) : tab === "clients" ? (
        <AdminClients />
       ) : tab === "campaigns" ? (
        <AdminCampaigns />
       ) : tab === "audit_log" ? (
        <AdminAuditLog />
       ) : tab === "opportunities" ? (
        <AdminOpportunities />
       ) : tab === "businesses" ? (
        <BusinessesTab businesses={businesses} onToggle={toggleBusinessFlag} />
         ) : tab === "careers" ? (
           <AdminCareersManager />
         ) : tab === "aj_creations" ? (
           <AdminAJCreations />
         ) : (
           <MessagesTab messages={messages} />
         )}
        </section>
      </div>
    </div>
  );
}
