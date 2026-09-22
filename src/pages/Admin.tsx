import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
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
import { CATEGORIES, PROVINCES, PLATFORMS, SWATCHES, PUBLISHER_SHARE, PAYOUT_DUE_DAYS, FEATURED_DURATION_DAYS, WORK_WITH_US_CATEGORIES, WORK_WITH_US_ATTACHMENT_BUCKET, PARTNER_CATEGORIES, PARTNER_TYPES, ADVERTISE_PRODUCTS, COMMUNITY_EVENT_TYPES, COMMUNITY_QUESTION_CATEGORIES } from "../lib/constants";
import { computeVerificationLevel } from "../lib/businessVerification";
import TrustBadge from "../components/TrustBadge";
import { computeAuthenticitySignals, SEVERITY_META } from "../lib/authenticitySignals";
import ExportCsvButton from "../components/ExportCsvButton";
import Button from "../components/Button";
import type { CsvRow } from "../lib/csvExport";
import type { Publisher, PublisherRequest, ContactMessage, RequestStatus, Platform, Profile, Report, Dispute, WorkWithUsApplication, WorkWithUsCategory, WorkWithUsStatus, PartnerApplication, PartnerCategory, PartnerStatus, PartnerType, AdvertiseInquiry, AdvertiseProduct, AdvertiseStatus, CommunityAnnouncement, CommunityEvent, CommunityEventType, CommunityQuestion, CommunityQuestionCategory, CommunityQuestionStatus } from "../lib/types";

// Admin sees the real profiles row for a request's business — its own
// is_admin() RLS branch on profiles allows it — so it fetches phone
// directly (unlike the publisher-facing PublisherRequest.business, which
// is deliberately narrowed to business_contact_public's safe columns
// only; see src/lib/businessContact.ts). This widens just the admin
// view's own request shape rather than reopening the shared type.
type AdminRequestRow = PublisherRequest & { business: (Pick<Profile, "full_name" | "company_name" | "phone">) | null };

export type AdminTab = "requests" | "applications" | "publishers" | "businesses" | "messages" | "analytics" | "payouts" | "channel_requests" | "reports" | "disputes" | "security" | "compliance" | "safety" | "leads" | "clients" | "campaigns" | "audit_log" | "opportunities" | "work_with_us" | "partners" | "advertise" | "community" | "careers" | "aj_creations";
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
const COMMUNITY_QUESTION_CATEGORY_LABEL: Record<CommunityQuestionCategory, string> = Object.fromEntries(COMMUNITY_QUESTION_CATEGORIES.map((c) => [c.value, c.label])) as Record<CommunityQuestionCategory, string>;

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
  const { user } = useAuth();
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

  // Approving recomputes trust_score / publisher_score / level right away via
  // the same SQL function the review/request triggers call — otherwise a
  // freshly-approved publisher would show no level until their first
  // completed campaign or review came in and fired one of those triggers.
  //
  // `verification` (Task 2) is only ever passed for a channel where
  // channels.verification_required is true — see ApplicationCard below.
  // When present, it persists which of that channel's eligibility.checks
  // were actually confirmed (publisher_verification_checks, current
  // state — schema_phase79) and logs the approval distinctly if it went
  // through without every check confirmed (overridden: true), per Task
  // 2's own acceptance criteria: approving without checking is still
  // possible, it's a tool not a hard gate, but it has to be an explicit,
  // audited action, not indistinguishable from a fully-checked approval.
  //
  // "claude to fix 2" item 24's own audit of this system (already
  // confirmed correct on every other count — checklist content is
  // properly varied per inventory type, channel_slug can't be
  // self-service-switched post-approval per
  // enforce_publisher_self_update()'s trigger, and the checklist-to-
  // application wiring is per-application not global) found one real
  // gap: overriding required no explanation at all, unlike Reject and
  // Request-more-info right next to it in the same component, which both
  // require a reason "kept on file." overrideReason closes that —
  // required (mirrors reason/note's `disabled={!x.trim()}` pattern
  // below), logged into admin_audit_log's details alongside which checks
  // were/weren't ticked, not bolted onto publishers.admin_notes (a
  // different, general-purpose field — mixing an override's specific
  // justification into it would get confusing across repeated overrides
  // over time; the audit log is the purpose-built place for "why did
  // admin X do Y at time Z").
  async function approvePublisher(
    id: string,
    verification?: { channelSlug: string; checksConfirmed: string[]; checksTotal: number; overridden: boolean; overrideReason?: string }
  ) {
    setPublishers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "approved" } : p)));
    await supabase.from("publishers").update({ status: "approved", reviewed_at: new Date().toISOString(), rejected_reason: null }).eq("id", id);
    await supabase.rpc("refresh_publisher_scores", { p_publisher_id: id });
    // In-app bell notifications for matching saved searches are trigger-driven
    // (trg_notify_saved_search_matches, schema_phase33) and already fired by
    // the update above. This is only the email half — fire-and-forget, same
    // as the `notify` calls elsewhere in this file, so a slow/failed email
    // never blocks the approval itself.
    supabase.functions.invoke("notify-saved-search-matches", { body: { publisher_id: id } }).catch(() => {});
    if (verification) {
      await supabase.from("publisher_verification_checks").upsert({
        publisher_id: id,
        channel_slug: verification.channelSlug,
        checks_confirmed: verification.checksConfirmed,
        checks_total: verification.checksTotal,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      logAdminAction(
        verification.overridden ? "publisher_approved_verification_overridden" : "publisher_approved",
        "publishers",
        id,
        {
          channel_slug: verification.channelSlug,
          checks_confirmed: verification.checksConfirmed,
          checks_total: verification.checksTotal,
          overridden: verification.overridden,
          ...(verification.overridden ? { override_reason: verification.overrideReason } : {}),
        }
      );
    } else {
      logAdminAction("publisher_approved", "publishers", id);
    }
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
        <Link to="/careers" target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:-translate-y-0.5 transition">
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

function buildRequestRows(requests: AdminRequestRow[]): CsvRow[] {
  return requests.map((r) => {
    const payment = [...(r.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      Business: r.business?.company_name || r.business?.full_name || "",
      "Business phone": r.business?.phone || "",
      Publisher: r.publisher?.name || "",
      Status: r.status,
      "Campaign message": r.campaign_message,
      "Budget (R)": r.budget ?? "",
      "Agreed amount (R)": r.agreed_amount ?? "",
      "Payment status": payment?.status ?? "",
      "Payment method": payment?.method ?? "",
      "Payment amount (R)": payment?.amount ?? "",
      "Payout status": payment?.payout_status ?? "",
      Created: new Date(r.created_at).toISOString().slice(0, 10),
    };
  });
}

function RequestsTab({
  requests, onStatusChange, onAmountChange, onPayoutSent, onEftConfirm,
}: {
  requests: AdminRequestRow[];
  onStatusChange: (id: string, status: RequestStatus) => void;
  onAmountChange: (id: string, amount: number | null) => void;
  onPayoutSent: (paymentId: string) => void;
  onEftConfirm: (paymentId: string) => void;
}) {
  if (requests.length === 0) {
    return <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No requests yet — they'll show up here as soon as a business books a publisher.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton label="Export CSV" filenameBase="requests" rows={buildRequestRows(requests)} />
      </div>
      {requests.map((r) => {
        const payment = [...(r.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return (
          <div key={r.id} className="border-[3px] border-billboard-ink rounded p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="font-bold">
                  {r.business?.company_name || r.business?.full_name || "A business"} → {r.publisher?.name ?? "Publisher"}
                </p>
                <p className="text-sm text-billboard-inkSoft mt-1 max-w-lg">{r.campaign_message}</p>
                <p className="text-xs text-billboard-inkSoft mt-2 font-mono">
                  {r.business?.full_name}{r.business?.phone ? ` · ${r.business.phone}` : ""}{r.budget != null ? ` · Suggested ${formatCurrency(r.budget)}` : ""}
                </p>
              </div>
              <select
                value={r.status}
                onChange={(e) => onStatusChange(r.id, e.target.value as RequestStatus)}
                className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-2 bg-white shrink-0"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                Agreed amount
                <span className="font-mono text-sm">R</span>
                <input
                  type="number" min={0} defaultValue={r.agreed_amount ?? ""}
                  onBlur={(e) => onAmountChange(r.id, e.target.value ? Number(e.target.value) : null)}
                  className="w-24 border-2 border-billboard-ink rounded px-2 py-1 bg-white font-mono text-sm"
                />
              </label>

              {payment && (
                <span className="font-mono text-xs uppercase text-billboard-inkSoft">
                  Payment: <strong className="text-billboard-ink">{payment.status}</strong> ({payment.method === "eft" ? "EFT" : "PayFast"})
                </span>
              )}

              {payment?.method === "eft" && payment.status === "pending" && (
                <span className="flex items-center gap-2">
                  {payment.eft_confirmed_by_business_at ? (
                    <span className="font-mono text-xs uppercase text-billboard-yellowDeep font-semibold">
                      Business claims paid {new Date(payment.eft_confirmed_by_business_at).toLocaleDateString("en-ZA")} — check the bank account
                    </span>
                  ) : (
                    <span className="font-mono text-xs uppercase text-billboard-inkSoft">Awaiting business confirmation</span>
                  )}
                  <button
                    onClick={() => onEftConfirm(payment.id)}
                    className="font-mono text-xs font-semibold uppercase border-2 border-billboard-greenDeep bg-billboard-green rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
                  >
                    Confirm payment received
                  </button>
                </span>
              )}

              {payment?.status === "paid" && (
                payment.payout_status === "paid" ? (
                  <span className="font-mono text-xs uppercase text-billboard-greenDeep font-semibold">
                    ✓ Payout sent ({formatCurrency(payment.amount * PUBLISHER_SHARE, { cents: true })})
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => onPayoutSent(payment.id)}
                      className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
                    >
                      Mark payout sent ({formatCurrency(payment.amount * PUBLISHER_SHARE, { cents: true })})
                    </button>
                    <PayoutComplianceHint campaignId={r.id} />
                    {payment.paid_at && daysSince(payment.paid_at) >= PAYOUT_DUE_DAYS && (
                      <span className="font-mono text-[10px] uppercase text-billboard-red font-semibold">
                        ⚠ Paid {daysSince(payment.paid_at)}d ago, no payout yet
                      </span>
                    )}
                  </>
                )
              )}
            </div>

            <MessageThread requestId={r.id} senderRole="admin" />
          </div>
        );
      })}
    </div>
  );
}

function buildMessageRows(messages: ContactMessage[]): CsvRow[] {
  return messages.map((m) => ({
    Name: m.name,
    Email: m.email,
    Message: m.message,
    Received: new Date(m.created_at).toISOString().slice(0, 10),
  }));
}

function MessagesTab({ messages }: { messages: ContactMessage[] }) {
  if (messages.length === 0) {
    return <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No messages yet.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton label="Export CSV" filenameBase="messages" rows={buildMessageRows(messages)} />
      </div>
      {messages.map((m) => (
        <div key={m.id} className="border-[3px] border-billboard-ink rounded p-5">
          <p className="font-bold">{m.name} <span className="font-normal text-billboard-inkSoft text-sm">· {m.email}</span></p>
          <p className="text-sm text-billboard-inkSoft mt-1.5">{m.message}</p>
        </div>
      ))}
    </div>
  );
}

function buildPublisherRows(publishers: Publisher[]): CsvRow[] {
  return publishers.map((p) => ({
    Name: p.name,
    Status: p.status,
    Category: p.category || "",
    City: p.city,
    Province: p.province,
    Channel: p.channel_slug,
    Followers: p.followers,
    "Engagement (%)": p.engagement,
    "Price per post (R)": p.price_per_post,
    Level: p.level || "",
    "Trust score": p.trust_score,
    "Publisher score": p.publisher_score,
    Verified: p.verified ? "Yes" : "No",
    Featured: p.featured ? "Yes" : "No",
    Email: p.email || "",
    Mobile: p.mobile_number || "",
    "Business name": p.business_name || "",
    "VAT number": p.vat_number || "",
    "Self-serve": p.user_id ? "Yes" : "No (added by admin)",
    "Reviewed": p.reviewed_at ? new Date(p.reviewed_at).toISOString().slice(0, 10) : "",
  }));
}

function PublishersTab({ publishers, onAdded, onToggleFeatured }: { publishers: Publisher[]; onAdded: () => void; onToggleFeatured: (id: string, featured: boolean) => void }) {
  const [showForm, setShowForm] = useState(false);

  async function toggleVerified(p: Publisher) {
    await supabase.from("publishers").update({ verified: !p.verified }).eq("id", p.id);
    logAdminAction(p.verified ? "publisher_unverified" : "publisher_verified", "publishers", p.id);
    onAdded();
  }

  async function toggleSuspended(p: Publisher) {
    const status = p.status === "suspended" ? "approved" : "suspended";
    await supabase.from("publishers").update({ status }).eq("id", p.id);
    if (status === "approved") await supabase.rpc("refresh_publisher_scores", { p_publisher_id: p.id });
    logAdminAction(status === "suspended" ? "publisher_suspended" : "publisher_reinstated", "publishers", p.id);
    onAdded();
  }

  function isCurrentlyFeatured(p: Publisher): boolean {
    return p.featured && (!p.featured_until || new Date(p.featured_until) > new Date());
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2.5 rounded hover:-translate-y-0.5 transition">
          {showForm ? "Cancel" : "+ Add publisher"}
        </button>
        <ExportCsvButton label="Export CSV" filenameBase="publishers" rows={buildPublisherRows(publishers)} />
      </div>
      {showForm && <AddPublisherForm onAdded={() => { setShowForm(false); onAdded(); }} />}

      {publishers.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No reviewed publishers yet — approvals from the Applications tab, and anyone added by hand above, show up here.</div>
      ) : (
        <div className="space-y-3">
          {publishers.map((p) => (
            <div key={p.id} className="border-2 border-billboard-ink rounded p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.swatch} border-2 border-billboard-ink flex items-center justify-center font-display text-xs shrink-0`}>{p.initials}</div>
                <div>
                  <p className="font-bold text-sm">
                    {p.name} {p.verified && <span title="Verified">✓</span>}
                    {p.level && <span className="ml-2 font-mono text-[10px] uppercase text-billboard-inkSoft">{p.level}</span>}
                    {isCurrentlyFeatured(p) && <span className="ml-2 font-mono text-[10px] uppercase text-billboard-ink">★ Featured</span>}
                    {p.status === "rejected" && <span className="ml-2 font-mono text-[10px] uppercase text-billboard-red">Rejected</span>}
                    {p.status === "suspended" && <span className="ml-2 font-mono text-[10px] uppercase text-billboard-red">Suspended</span>}
                  </p>
                  <p className="text-xs text-billboard-inkSoft">{p.city}, {p.province} · {p.category} · {formatCurrency(p.price_per_post)}/post</p>
                  <SignalBadges publisher={p} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.status === "approved" && (
                  <button
                    onClick={() => onToggleFeatured(p.id, !isCurrentlyFeatured(p))}
                    title={isCurrentlyFeatured(p) ? "Remove featured placement" : `Feature for ${FEATURED_DURATION_DAYS} days`}
                    className={`font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition ${isCurrentlyFeatured(p) ? "bg-billboard-yellow" : ""}`}
                  >
                    {isCurrentlyFeatured(p) ? "★ Unfeature" : "☆ Feature"}
                  </button>
                )}
                {p.status !== "rejected" && (
                  <button
                    onClick={() => toggleSuspended(p)}
                    className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
                  >
                    {p.status === "suspended" ? "Reinstate" : "Suspend"}
                  </button>
                )}
                <button
                  onClick={() => toggleVerified(p)}
                  className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
                >
                  {p.verified ? "Unverify" : "Mark verified"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPublisherForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState(PROVINCES[0]);
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [followers, setFollowers] = useState("");
  const [engagement, setEngagement] = useState("");
  const [pricePerPost, setPricePerPost] = useState("");
  const [bio, setBio] = useState("");
  const [audience, setAudience] = useState("");
  const [initials, setInitials] = useState("");
  const [swatch, setSwatch] = useState(SWATCHES[0].value);
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (platforms.length === 0) {
      setError("Pick at least one platform.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error } = await supabase.from("publishers").insert({
      name, city, province, category, platforms,
      followers: Number(followers) || 0,
      engagement: Number(engagement) || 0,
      price_per_post: Number(pricePerPost) || 0,
      bio, audience,
      initials: initials || name.slice(0, 2).toUpperCase(),
      swatch, verified,
    }).select("id").single();
    setSaving(false);
    if (error) setError(formatSupabaseError(error, "Couldn't add publisher"));
    else {
      // Defaults to status: 'approved' (see schema_phase5's comment on
      // publishers.status) — live in the directory immediately, so this
      // gets the same saved-search email pass as the review-queue approve
      // path above. The in-app bell side is trigger-driven either way.
      if (data?.id) supabase.functions.invoke("notify-saved-search-matches", { body: { publisher_id: data.id } }).catch(() => {});
      onAdded();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-[3px] border-billboard-ink rounded p-6 mb-8 bg-billboard-paperDim">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Page / group name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Initials (for the avatar)</label>
          <input maxLength={3} value={initials} onChange={(e) => setInitials(e.target.value)} placeholder={name.slice(0, 2).toUpperCase() || "e.g. BB"} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">City</label>
          <input required value={city} onChange={(e) => setCity(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Province</label>
          <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm">
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm">
            {CATEGORIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Price per post (R)</label>
          <input required type="number" min={0} value={pricePerPost} onChange={(e) => setPricePerPost(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Followers</label>
          <input required type="number" min={0} value={followers} onChange={(e) => setFollowers(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Engagement rate (%)</label>
          <input required type="number" min={0} step="0.1" value={engagement} onChange={(e) => setEngagement(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
        </div>
      </div>

      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Platforms</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {PLATFORMS.map((p) => (
          <button type="button" key={p} onClick={() => togglePlatform(p)} className={`font-mono text-xs border-2 border-billboard-ink rounded-full px-3 py-1.5 transition ${platforms.includes(p) ? "bg-billboard-ink text-white" : "bg-white"}`}>
            {p}
          </button>
        ))}
      </div>

      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Cover colour</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {SWATCHES.map((s) => (
          <button
            type="button" key={s.value} onClick={() => setSwatch(s.value)} title={s.label}
            className={`w-9 h-9 rounded-full bg-gradient-to-br ${s.value} border-2 border-billboard-ink transition ${swatch === s.value ? "ring-2 ring-offset-2 ring-billboard-ink" : ""}`}
          />
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Bio</label>
        <textarea required value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
      </div>
      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Audience description</label>
        <input required value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. 25–44, mostly local Sandton residents" className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-sm" />
      </div>

      <label className="inline-flex items-center gap-2 mb-5 text-sm font-semibold">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="w-4 h-4 accent-billboard-green" />
        Mark as verified
      </label>

      {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}
      <Button type="submit" variant="primary" size="md" disabled={saving}>
        {saving ? "Adding…" : "Add publisher"}
      </Button>
    </form>
  );
}

function buildApplicationRows(applications: Publisher[]): CsvRow[] {
  return applications.map((p) => ({
    Name: p.name,
    Category: p.category || "",
    City: p.city,
    Province: p.province,
    Channel: p.channel_slug,
    Followers: p.followers,
    "Engagement (%)": p.engagement,
    "Monthly reach": p.monthly_reach ?? "",
    Platforms: p.platforms.join("; "),
    Email: p.email || "",
    Mobile: p.mobile_number || "",
    "Business name": p.business_name || "",
    "VAT number": p.vat_number || "",
    "Company registration": p.company_registration || "",
    "Admin notes": p.admin_notes || "",
    Applied: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
  }));
}

function ApplicationsTab({
  applications, onApprove, onReject, onRequestInfo, onRefresh, verificationRequiredChannels, verificationChecks,
}: {
  applications: Publisher[];
  onApprove: (id: string, verification?: { channelSlug: string; checksConfirmed: string[]; checksTotal: number; overridden: boolean; overrideReason?: string }) => void;
  onReject: (id: string, reason: string) => void;
  onRequestInfo: (id: string, note: string) => void;
  onRefresh: () => void;
  verificationRequiredChannels: Set<string>;
  verificationChecks: Record<string, { checksConfirmed: string[]; checksTotal: number }>;
}) {
  if (applications.length === 0) {
    return <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No pending applications — new self-serve publisher signups from /apply will show up here.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton label="Export CSV" filenameBase="applications" rows={buildApplicationRows(applications)} />
      </div>
      {applications.map((p) => (
        <ApplicationCard
          key={p.id}
          publisher={p}
          onApprove={onApprove}
          onReject={onReject}
          onRequestInfo={onRequestInfo}
          onRefresh={onRefresh}
          verificationRequired={verificationRequiredChannels.has(p.channel_slug)}
          previouslyConfirmedChecks={verificationChecks[p.id]?.checksConfirmed ?? []}
        />
      ))}
    </div>
  );
}

// 12-Channel Audit fix A1/B1 — renders signed-URL thumbnails for whatever
// proof an applicant uploaded (publisher-verification-proof bucket,
// private — schema_phase97). Generates signed URLs client-side on mount
// rather than storing them, since a stored signed URL would eventually
// expire while the underlying file remains valid.
function VerificationProofThumbnails({ publisherId, proofPaths }: { publisherId: string; proofPaths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (proofPaths.length === 0) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      proofPaths.map((path) => supabase.storage.from("publisher-verification-proof").createSignedUrl(path, 3600))
    ).then((results) => {
      if (cancelled) return;
      setUrls(results.map((r) => r.data?.signedUrl).filter((u): u is string => !!u));
    });
    return () => {
      cancelled = true;
    };
  }, [publisherId, proofPaths]);

  if (proofPaths.length === 0) {
    return <p className="text-xs text-billboard-inkSoft italic mb-2">No proof photo/video attached — self-attested only.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {urls.map((url) =>
        url.match(/\.(mp4|mov)(\?|$)/i) ? (
          <video key={url} src={url} controls className="w-24 h-24 object-cover border-2 border-billboard-ink rounded" />
        ) : (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt="Verification proof" className="w-24 h-24 object-cover border-2 border-billboard-ink rounded hover:opacity-80" />
          </a>
        )
      )}
    </div>
  );
}

// "Request more info" just saves a note on the row rather than sending
// anything — there's no publisher-facing dashboard yet to show it in, and
// no admin <-> publisher message thread (Phase 3's is business <-> admin
// only). It's here so the decision isn't lost, and so a note field exists
// once there's somewhere for a publisher to actually see it.
function ApplicationCard({
  publisher: p, onApprove, onReject, onRequestInfo, onRefresh, verificationRequired, previouslyConfirmedChecks,
}: {
  publisher: Publisher;
  onApprove: (id: string, verification?: { channelSlug: string; checksConfirmed: string[]; checksTotal: number; overridden: boolean; overrideReason?: string }) => void;
  onReject: (id: string, reason: string) => void;
  onRequestInfo: (id: string, note: string) => void;
  onRefresh: () => void;
  verificationRequired: boolean;
  previouslyConfirmedChecks: string[];
}) {
  const [showReject, setShowReject] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  // Task 2: channels.verification_required gives this application a
  // channel-specific checklist instead of just the generic review
  // screen, sourced from that ChannelModule's own eligibility.checks
  // (src/channels/*/index.ts) — not a new, separately-maintained list.
  // Pre-ticked from publisher_verification_checks if this application
  // was partially reviewed before (e.g. a "request more info" round
  // trip) — re-confirming the same box twice on a revisit would be
  // busywork, not rigor.
  const checks = verificationRequired ? getChannelBySlug(p.channel_slug)?.definition.eligibility?.checks ?? [] : [];
  const [ticked, setTicked] = useState<Set<string>>(new Set(previouslyConfirmedChecks));
  const [confirmingOverride, setConfirmingOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  function toggleCheck(check: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(check)) next.delete(check);
      else next.add(check);
      return next;
    });
    setConfirmingOverride(false);
  }

  function handleApproveClick() {
    if (checks.length === 0) {
      onApprove(p.id);
      return;
    }
    const allChecked = checks.every((c) => ticked.has(c));
    if (allChecked) {
      onApprove(p.id, { channelSlug: p.channel_slug, checksConfirmed: [...ticked], checksTotal: checks.length, overridden: false });
      return;
    }
    // Not every box ticked — this is still allowed (a tool, not a hard
    // gate) but needs an explicit second click, not the same one-click
    // path a fully-checked approval gets, so it's never accidental and
    // it's always distinguishable in admin_audit_log afterward.
    setConfirmingOverride(true);
  }

  function confirmOverrideApprove() {
    onApprove(p.id, { channelSlug: p.channel_slug, checksConfirmed: [...ticked], checksTotal: checks.length, overridden: true, overrideReason: overrideReason.trim() });
    setConfirmingOverride(false);
    setOverrideReason("");
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div>
        <p className="font-bold">
          {p.name} <span className="font-normal text-billboard-inkSoft text-sm">· {p.category || "—"} · {p.city}, {p.province}</span>
        </p>
        <p className="text-xs text-billboard-inkSoft mt-1 font-mono">
          {p.followers.toLocaleString()} followers · {p.engagement}% engagement
          {p.monthly_reach ? ` · ${p.monthly_reach.toLocaleString()} monthly reach` : ""}
        </p>
        {p.platforms.length > 0 && <p className="text-xs text-billboard-inkSoft mt-1 font-mono">{p.platforms.join(", ")}</p>}
        {(p.email || p.mobile_number) && (
          <p className="text-xs text-billboard-inkSoft mt-1 font-mono">{p.email}{p.mobile_number ? ` · ${p.mobile_number}` : ""}</p>
        )}
        {p.bio && <p className="text-sm text-billboard-inkSoft mt-2 max-w-lg">{p.bio}</p>}
        {p.business_name && (
          <p className="text-xs text-billboard-inkSoft mt-2 font-mono">
            {p.business_name}{p.vat_number ? ` · VAT ${p.vat_number}` : ""}{p.company_registration ? ` · Reg ${p.company_registration}` : ""}
          </p>
        )}
        {/* CHANNEL_UPDATES_AUDIT.md's own remaining "not done" item: channel_metadata
            was stored and used on the public profile but invisible here. One generic
            formatter (getOnboardingSummaryFields) covers all 12 channels — nothing new
            to maintain per channel as more get added. Empty for any application that
            predates schema_phase74's channel_metadata column, which is expected, not
            an error. */}
        {(() => {
          const fields = getOnboardingSummaryFields(p);
          if (fields.length === 0) return null;
          return (
            <div className="mt-3 border-2 border-billboard-inkSoft/40 rounded p-3 bg-billboard-paperDim">
              <p className="text-[10px] font-mono uppercase tracking-wider text-billboard-inkSoft mb-2">Channel-specific details</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {fields.map((f) => (
                  <div key={f.label} className="contents">
                    <dt className="text-billboard-inkSoft">{f.label}</dt>
                    <dd className="font-semibold text-right truncate" title={f.value}>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })()}
        {p.admin_notes && (
          <p className="text-xs text-billboard-ink mt-2 bg-billboard-paperDim border-2 border-billboard-inkSoft rounded px-2.5 py-1.5 inline-block">
            Note on file: {p.admin_notes}
          </p>
        )}
        <SignalBadges publisher={p} />
        <AuthenticityCheck publisher={p} onChecked={onRefresh} />
      </div>

      {checks.length > 0 && (
        <div className="mt-3 border-2 border-billboard-ink rounded p-3 bg-billboard-paperDim">
          <p className="font-mono text-xs font-semibold uppercase tracking-wide mb-2">
            {getChannelBySlug(p.channel_slug)?.definition.name ?? p.channel_slug} verification checklist
          </p>
          {/* 12-Channel Audit fix A1/B1 — the checklist above used to be
              purely self-attested with nothing for a reviewer to actually
              look at. VerificationProofThumbnails renders whatever the
              applicant uploaded (publisher-verification-proof, private
              bucket — signed URLs, not public ones) right next to it. */}
          <VerificationProofThumbnails publisherId={p.id} proofPaths={p.verification_proof_urls ?? []} />
          <div className="space-y-1.5">
            {checks.map((check) => (
              <label key={check} className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={ticked.has(check)} onChange={() => toggleCheck(check)} className="mt-0.5" />
                <span>{check}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap gap-2">
        <button onClick={handleApproveClick} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-greenDeep bg-billboard-green rounded px-3 py-1.5 hover:-translate-y-0.5 transition">
          Approve
        </button>
        <button onClick={() => setShowInfo((s) => !s)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition">
          Request more info
        </button>
        <button onClick={() => setShowReject((s) => !s)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-3 py-1.5 hover:-translate-y-0.5 transition">
          Reject
        </button>
      </div>

      {confirmingOverride && (
        <div className="mt-3 border-2 border-billboard-yellowDeep rounded p-3 bg-billboard-paperDim">
          <p className="text-sm mb-2">
            {ticked.size} of {checks.length} checks confirmed. Approving anyway is recorded as an override in the admin audit log — this can't be undone quietly.
          </p>
          <input
            value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Why approve without every check confirmed? (kept on file)"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-2"
          />
          <div className="flex gap-2">
            <button onClick={confirmOverrideApprove} disabled={!overrideReason.trim()} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-greenDeep bg-billboard-green rounded px-3 py-1.5 disabled:opacity-60">
              Approve anyway
            </button>
            <button onClick={() => { setConfirmingOverride(false); setOverrideReason(""); }} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showInfo && (
        <div className="mt-3 flex gap-2">
          <input
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="What do you need from them?"
            className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => { onRequestInfo(p.id, note); setShowInfo(false); setNote(""); }}
            disabled={!note.trim()}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 disabled:opacity-60"
          >
            Save note
          </button>
        </div>
      )}
      {showReject && (
        <div className="mt-3 flex gap-2">
          <input
            value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept on file)"
            className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => { onReject(p.id, reason); setShowReject(false); }}
            disabled={!reason.trim()}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-3 py-2 disabled:opacity-60"
          >
            Confirm reject
          </button>
        </div>
      )}
    </div>
  );
}

function buildBusinessRows(businesses: Profile[]): CsvRow[] {
  return businesses.map((b) => ({
    Name: b.company_name || b.full_name || "",
    "Contact name": b.full_name || "",
    Phone: b.phone || "",
    Industry: b.industry || "",
    City: b.city || "",
    Province: b.province || "",
    Website: b.website || "",
    "Email verified": b.email_verified ? "Yes" : "No",
    "Phone verified": b.phone_verified ? "Yes" : "No",
    "Business verified (Gold)": b.business_verified ? "Yes" : "No",
  }));
}

function BusinessesTab({
  businesses, onToggle,
}: {
  businesses: Profile[];
  onToggle: (id: string, field: "phone_verified" | "business_verified", value: boolean) => void;
}) {
  if (businesses.length === 0) {
    return <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No business accounts yet.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end mb-1">
        <ExportCsvButton label="Export CSV" filenameBase="businesses" rows={buildBusinessRows(businesses)} />
      </div>
      {businesses.map((b) => {
        const level = computeVerificationLevel(b);
        const detailLine = [
          b.company_name && b.full_name ? b.full_name : null,
          b.phone,
          b.industry,
          b.city ? `${b.city}, ${b.province}` : null,
        ].filter(Boolean).join(" · ");
        const linkLine = [b.website, b.facebook_url, b.instagram_url].filter(Boolean).join(" · ");

        return (
          <div key={b.id} className="border-2 border-billboard-ink rounded p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-bold text-sm">
                  {b.company_name || b.full_name || "Unnamed business"}
                  {level && (
                    <span className="ml-2 font-mono text-[10px] uppercase text-billboard-inkSoft">
                      <TrustBadge kind="business" level={level} />
                    </span>
                  )}
                </p>
                {detailLine && <p className="text-xs text-billboard-inkSoft mt-0.5">{detailLine}</p>}
                {linkLine && <p className="text-xs text-billboard-inkSoft mt-0.5 font-mono">{linkLine}</p>}
                <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-1">
                  Email {b.email_verified ? "✓ confirmed" : "not confirmed"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onToggle(b.id, "phone_verified", !b.phone_verified)}
                  className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
                >
                  {b.phone_verified ? "Unverify phone" : "Verify phone"}
                </button>
                <button
                  onClick={() => onToggle(b.id, "business_verified", !b.business_verified)}
                  className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
                >
                  {b.business_verified ? "Revoke Gold" : "Mark Gold"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const REASON_LABEL: Record<Report["reason"], string> = {
  fake_followers: "Fake followers",
  no_response: "No response",
  inappropriate_content: "Inappropriate content",
  scam_or_fraud: "Scam / fraud",
  other: "Other",
};

function buildReportRows(reports: Report[]): CsvRow[] {
  return reports.map((r) => ({
    Publisher: r.publisher?.name || "",
    Reason: REASON_LABEL[r.reason],
    Details: r.details || "",
    Status: r.status,
    "Admin notes": r.admin_notes || "",
    Filed: new Date(r.created_at).toISOString().slice(0, 10),
    Reviewed: r.reviewed_at ? new Date(r.reviewed_at).toISOString().slice(0, 10) : "",
  }));
}

function ReportsTab({
  reports, onResolve, onSuspend,
}: {
  reports: Report[];
  onResolve: (id: string, status: "reviewed" | "dismissed", admin_notes: string) => void;
  onSuspend: (publisherId: string) => void;
}) {
  if (reports.length === 0) {
    return <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No reports yet — businesses can report a publisher from that publisher's profile page.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton label="Export CSV" filenameBase="reports" rows={buildReportRows(reports)} />
      </div>
      {reports.map((r) => <ReportCard key={r.id} report={r} onResolve={onResolve} onSuspend={onSuspend} />)}
    </div>
  );
}

function ReportCard({
  report: r, onResolve, onSuspend,
}: {
  report: Report;
  onResolve: (id: string, status: "reviewed" | "dismissed", admin_notes: string) => void;
  onSuspend: (publisherId: string) => void;
}) {
  const [note, setNote] = useState(r.admin_notes ?? "");

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {r.publisher?.name ?? "A publisher"} <span className="font-normal text-billboard-inkSoft text-sm">· {REASON_LABEL[r.reason]}</span>
          </p>
          {r.details && <p className="text-sm text-billboard-inkSoft mt-1.5 max-w-lg">{r.details}</p>}
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-2">Filed {daysSince(r.created_at)}d ago</p>
        </div>
        <span className={`font-mono text-xs font-semibold uppercase border-2 rounded px-2.5 py-1 shrink-0 ${
          r.status === "open" ? "border-billboard-red text-billboard-red" : r.status === "dismissed" ? "border-billboard-inkSoft text-billboard-inkSoft" : "border-billboard-greenDeep text-billboard-greenDeep"
        }`}>
          {r.status}
        </span>
      </div>

      {r.status === "open" ? (
        <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
          <input
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes on how this was resolved (kept on file)"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-3"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSuspend(r.publisher_id)}
              className="font-mono text-xs font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
            >
              Suspend publisher
            </button>
            <button
              onClick={() => onResolve(r.id, "reviewed", note)}
              className="font-mono text-xs font-semibold uppercase border-2 border-billboard-greenDeep bg-billboard-green rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
            >
              Mark reviewed
            </button>
            <button
              onClick={() => onResolve(r.id, "dismissed", note)}
              className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : r.admin_notes ? (
        <p className="text-xs text-billboard-ink mt-3 bg-billboard-paperDim border-2 border-billboard-inkSoft rounded px-2.5 py-1.5 inline-block">
          Resolution: {r.admin_notes}
        </p>
      ) : null}
    </div>
  );
}

const DISPUTE_CATEGORY_LABEL: Record<Dispute["category"], string> = {
  payment_issue: "Payment issue",
  quality_issue: "Quality issue",
  non_delivery: "Non-delivery",
  communication: "Communication",
  other: "Other",
};

const DISPUTE_STATUS_STYLE: Record<Dispute["status"], string> = {
  open: "border-billboard-red text-billboard-red",
  awaiting_response: "border-billboard-inkSoft text-billboard-inkSoft",
  resolved: "border-billboard-greenDeep text-billboard-greenDeep",
  closed: "border-billboard-ink text-billboard-ink",
};

const OUTCOME_OPTIONS: { value: NonNullable<Dispute["resolution_outcome"]>; label: string }[] = [
  { value: "refund_business", label: "Refunded to business" },
  { value: "release_to_publisher", label: "Released to publisher" },
  { value: "partial", label: "Partially resolved" },
  { value: "no_action", label: "No action taken" },
  { value: "other", label: "Other" },
];

function buildDisputeRows(disputes: Dispute[]): CsvRow[] {
  return disputes.map((d) => ({
    Business: d.business?.company_name || d.business?.full_name || "",
    Publisher: d.publisher?.name || "",
    "Opened by": d.opened_by_role,
    Category: DISPUTE_CATEGORY_LABEL[d.category],
    Subject: d.subject,
    Status: d.status,
    Outcome: d.resolution_outcome || "",
    "Resolution notes": d.resolution_notes || "",
    Created: new Date(d.created_at).toISOString().slice(0, 10),
    Closed: d.closed_at ? new Date(d.closed_at).toISOString().slice(0, 10) : "",
  }));
}

function DisputesTab({ disputes, onChange }: { disputes: Dispute[]; onChange: () => void }) {
  if (disputes.length === 0) {
    return <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">No disputes yet — either side can open one from a campaign in progress.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton label="Export CSV" filenameBase="disputes" rows={buildDisputeRows(disputes)} />
      </div>
      {disputes.map((d) => <AdminDisputeCard key={d.id} dispute={d} onChange={onChange} />)}
    </div>
  );
}

function AdminDisputeCard({ dispute: d, onChange }: { dispute: Dispute; onChange: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(d.status === "open" || d.status === "awaiting_response");
  const [outcome, setOutcome] = useState<NonNullable<Dispute["resolution_outcome"]>>(d.resolution_outcome ?? "no_action");
  const [notes, setNotes] = useState(d.resolution_notes ?? "");
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function setStatus(status: "resolved" | "closed" | "open") {
    setSaving(true);
    await supabase.from("disputes").update({
      status,
      resolution_outcome: status === "resolved" ? outcome : d.resolution_outcome,
      resolution_notes: status === "resolved" ? (notes.trim() || null) : d.resolution_notes,
    }).eq("id", d.id);
    setSaving(false);
    onChange();
  }

  async function sendReply() {
    if (!reply.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("dispute_messages").insert({ dispute_id: d.id, sender_id: user.id, body: reply.trim() });
    setSending(false);
    if (!error) {
      setReply("");
      onChange();
    }
  }

  const businessName = d.business?.company_name || d.business?.full_name || "A business";

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex flex-wrap items-start justify-between gap-3 text-left">
        <div>
          <p className="font-bold">{d.subject}</p>
          <p className="text-xs text-billboard-inkSoft mt-1">
            {businessName} ↔ {d.publisher?.name ?? "a publisher"} · {DISPUTE_CATEGORY_LABEL[d.category]} · opened by {d.opened_by_role}
          </p>
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mt-1.5">{daysSince(d.created_at)}d ago · updated {daysSince(d.updated_at)}d ago</p>
        </div>
        <span className={`font-mono text-xs font-semibold uppercase border-2 rounded px-2.5 py-1 shrink-0 ${DISPUTE_STATUS_STYLE[d.status]}`}>
          {d.status.replace(/_/g, " ")}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
          {(d.dispute_messages ?? []).length === 0 ? (
            <p className="text-xs text-billboard-inkSoft mb-3">No messages yet.</p>
          ) : (
            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
              {(d.dispute_messages ?? []).map((m) => (
                <div key={m.id} className={`text-sm p-2.5 rounded border-2 ${m.sender_role === "admin" ? "border-billboard-yellowDeep bg-billboard-yellow/20" : "border-billboard-ink bg-billboard-paperDim"}`}>
                  <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">
                    {m.sender_role === "admin" ? "Platform" : m.sender_role === "publisher" ? "Publisher" : "Business"} · {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
          )}

          {d.status !== "closed" && (
            <div className="flex gap-2 mb-5">
              <input
                value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()}
                placeholder="Reply as ChatSched…" className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
              />
              <button onClick={sendReply} disabled={sending || !reply.trim()} className="border-2 border-billboard-ink font-bold px-4 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
                Send
              </button>
            </div>
          )}

          {d.status !== "closed" && (
            <div className="border-2 border-billboard-ink rounded p-3.5 bg-billboard-paperDim">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider mb-2">Resolve</p>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as NonNullable<Dispute["resolution_outcome"]>)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm mb-2 bg-white">
                {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Resolution notes (shown to both sides)"
                className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-3 bg-white"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setStatus("resolved")} disabled={saving} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-greenDeep bg-billboard-green rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60">
                  Mark resolved
                </button>
                <button onClick={() => setStatus("closed")} disabled={saving} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60">
                  Close without resolving
                </button>
              </div>
            </div>
          )}

          {(d.status === "resolved" || d.status === "closed") && d.resolution_notes && (
            <p className="text-xs text-billboard-ink bg-billboard-paperDim border-2 border-billboard-inkSoft rounded px-2.5 py-1.5 inline-block">
              Resolution: {d.resolution_notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function buildWorkWithUsRows(applications: WorkWithUsApplication[]): CsvRow[] {
  return applications.map((w) => ({
    Name: w.name,
    Email: w.email,
    Category: WWU_CATEGORY_LABEL[w.category],
    Location: w.location,
    Status: WWU_STATUS_LABEL[w.status],
    Portfolio: w.portfolio_url || "",
    LinkedIn: w.linkedin_url || "",
    Attachment: w.attachment_filename || "",
    Message: w.message,
    "Admin notes": w.admin_notes || "",
    Submitted: new Date(w.created_at).toISOString().slice(0, 10),
  }));
}

// Sits above the applications list — the point of this tab isn't just
// triage, it's answering "which category is /work-with-us actually
// attracting" at a glance, before scrolling into any individual
// submission. Pure client-side count over whatever's already loaded, same
// as the tab-label counts elsewhere in this file — no separate query.
function WorkWithUsBreakdown({ applications }: { applications: WorkWithUsApplication[] }) {
  if (applications.length === 0) return null;
  const max = Math.max(...WORK_WITH_US_CATEGORIES.map((c) => applications.filter((a) => a.category === c.value).length), 1);
  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 mb-6">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-wider mb-4">Which pipeline people are using</h3>
      <div className="space-y-2.5">
        {WORK_WITH_US_CATEGORIES.map((c) => {
          const count = applications.filter((a) => a.category === c.value).length;
          const pct = Math.round((count / max) * 100);
          return (
            <div key={c.value} className="flex items-center gap-3">
              <span className="text-xs font-semibold w-40 shrink-0">{c.label}</span>
              <div className="flex-1 h-4 bg-billboard-paperDim border-2 border-billboard-ink rounded overflow-hidden">
                <div className="h-full bg-billboard-yellow" style={{ width: `${count === 0 ? 0 : Math.max(pct, 6)}%` }} />
              </div>
              <span className="font-mono text-xs text-billboard-inkSoft w-6 text-right shrink-0">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkWithUsTab({
  applications, onStatusChange, onNotesChange,
}: {
  applications: WorkWithUsApplication[];
  onStatusChange: (id: string, status: WorkWithUsStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<WorkWithUsCategory | "all">("all");
  const visible = categoryFilter === "all" ? applications : applications.filter((a) => a.category === categoryFilter);

  return (
    <div>
      <WorkWithUsBreakdown applications={applications} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as WorkWithUsCategory | "all")}
          className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 bg-white"
        >
          <option value="all">All categories</option>
          {WORK_WITH_US_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <ExportCsvButton label="Export CSV" filenameBase="work-with-us" rows={buildWorkWithUsRows(visible)} />
      </div>

      {visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          {applications.length === 0 ? "No submissions yet — entries from /work-with-us will show up here." : "No submissions in this category."}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((w) => <WorkWithUsCard key={w.id} application={w} onStatusChange={onStatusChange} onNotesChange={onNotesChange} />)}
        </div>
      )}
    </div>
  );
}

function WorkWithUsCard({
  application: w, onStatusChange, onNotesChange,
}: {
  application: WorkWithUsApplication;
  onStatusChange: (id: string, status: WorkWithUsStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(w.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function saveNotes() {
    setSavingNotes(true);
    await onNotesChange(w.id, notes);
    setSavingNotes(false);
  }

  async function downloadAttachment() {
    if (!w.attachment_path) return;
    setDownloading(true);
    setDownloadError(null);
    const { data, error } = await supabase.storage.from(WORK_WITH_US_ATTACHMENT_BUCKET).createSignedUrl(w.attachment_path, 300);
    setDownloading(false);
    if (error || !data?.signedUrl) {
      setDownloadError("Couldn't generate a download link — try again.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="font-bold">
            {w.name} <span className="font-normal text-billboard-inkSoft text-sm">· {WWU_CATEGORY_LABEL[w.category]} · {w.location}</span>
          </p>
          <p className="text-xs text-billboard-inkSoft mt-1 font-mono">{w.email}</p>
          {(w.portfolio_url || w.linkedin_url) && (
            <p className="text-xs text-billboard-inkSoft mt-1 font-mono">
              {w.portfolio_url && <a href={w.portfolio_url} target="_blank" rel="noopener noreferrer" className="underline">Portfolio</a>}
              {w.portfolio_url && w.linkedin_url && " · "}
              {w.linkedin_url && <a href={w.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline">LinkedIn</a>}
            </p>
          )}
        </div>
        <select
          value={w.status}
          onChange={(e) => onStatusChange(w.id, e.target.value as WorkWithUsStatus)}
          className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-2 bg-white shrink-0"
        >
          {WWU_STATUSES.map((s) => <option key={s} value={s}>{WWU_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <p className="text-sm text-billboard-inkSoft mt-3 max-w-2xl whitespace-pre-wrap">{w.message}</p>

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap items-center gap-3">
        {w.attachment_path && (
          <button
            onClick={downloadAttachment}
            disabled={downloading}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {downloading ? "Preparing…" : `⬇ Download attachment (${w.attachment_filename})`}
          </button>
        )}
        <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">Submitted {new Date(w.created_at).toLocaleDateString("en-ZA")}</span>
        {downloadError && <span className="text-billboard-red text-xs font-semibold">{downloadError}</span>}
      </div>

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Notes</label>
        <div className="flex gap-2">
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes"
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

function buildPartnerRows(applications: PartnerApplication[]): CsvRow[] {
  return applications.map((p) => ({
    Company: p.company_name,
    Contact: p.contact_name,
    Email: p.email,
    Phone: p.phone || "",
    Category: p.category ? PARTNER_CATEGORY_LABEL[p.category] : "",
    "Partner type": p.partner_type ? PARTNER_TYPE_LABEL[p.partner_type] : "",
    Website: p.website || "",
    Status: PARTNER_STATUS_LABEL[p.status],
    Message: p.message,
    "Admin notes": p.admin_notes || "",
    Submitted: new Date(p.created_at).toISOString().slice(0, 10),
  }));
}

// Same "which category is this pipeline attracting" breakdown as the Work
// With Us tab above — pure client-side count over whatever's loaded.
// Two independent axes now that /partners/apply adds partner_type
// alongside /partners' industry category (schema_phase48): shown as two
// separate bars since an application may set either, both, or (per the
// DB check constraint) at least one.
function PartnersBreakdown({ applications }: { applications: PartnerApplication[] }) {
  if (applications.length === 0) return null;
  const catMax = Math.max(...PARTNER_CATEGORIES.map((c) => applications.filter((a) => a.category === c.value).length), 1);
  const typeMax = Math.max(...PARTNER_TYPES.map((t) => applications.filter((a) => a.partner_type === t.value).length), 1);
  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-6">
      <div className="border-[3px] border-billboard-ink rounded p-5">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider mb-4">By industry category</h3>
        <div className="space-y-2.5">
          {PARTNER_CATEGORIES.map((c) => {
            const count = applications.filter((a) => a.category === c.value).length;
            const pct = Math.round((count / catMax) * 100);
            return (
              <div key={c.value} className="flex items-center gap-3">
                <span className="text-xs font-semibold w-36 shrink-0">{c.label}</span>
                <div className="flex-1 h-4 bg-billboard-paperDim border-2 border-billboard-ink rounded overflow-hidden">
                  <div className="h-full bg-billboard-yellow" style={{ width: `${count === 0 ? 0 : Math.max(pct, 6)}%` }} />
                </div>
                <span className="font-mono text-xs text-billboard-inkSoft w-6 text-right shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-[3px] border-billboard-ink rounded p-5">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider mb-4">By partner type (/partners/apply)</h3>
        <div className="space-y-2.5">
          {PARTNER_TYPES.map((t) => {
            const count = applications.filter((a) => a.partner_type === t.value).length;
            const pct = Math.round((count / typeMax) * 100);
            return (
              <div key={t.value} className="flex items-center gap-3">
                <span className="text-xs font-semibold w-36 shrink-0">{t.label}</span>
                <div className="flex-1 h-4 bg-billboard-paperDim border-2 border-billboard-ink rounded overflow-hidden">
                  <div className="h-full bg-billboard-green" style={{ width: `${count === 0 ? 0 : Math.max(pct, 6)}%` }} />
                </div>
                <span className="font-mono text-xs text-billboard-inkSoft w-6 text-right shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PartnersTab({
  applications, onStatusChange, onNotesChange,
}: {
  applications: PartnerApplication[];
  onStatusChange: (id: string, status: PartnerStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<PartnerCategory | "all">("all");
  const [typeFilter, setTypeFilter] = useState<PartnerType | "all">("all");
  const visible = applications
    .filter((a) => categoryFilter === "all" || a.category === categoryFilter)
    .filter((a) => typeFilter === "all" || a.partner_type === typeFilter);

  return (
    <div>
      <PartnersBreakdown applications={applications} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as PartnerCategory | "all")}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 bg-white"
          >
            <option value="all">All categories</option>
            {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PartnerType | "all")}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 bg-white"
          >
            <option value="all">All partner types</option>
            {PARTNER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <ExportCsvButton label="Export CSV" filenameBase="partner-applications" rows={buildPartnerRows(visible)} />
      </div>

      {visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          {applications.length === 0 ? "No applications yet — submissions from /partners and /partners/apply will show up here." : "No applications match this filter."}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((p) => <PartnerCard key={p.id} application={p} onStatusChange={onStatusChange} onNotesChange={onNotesChange} />)}
        </div>
      )}
    </div>
  );
}

function PartnerCard({
  application: p, onStatusChange, onNotesChange,
}: {
  application: PartnerApplication;
  onStatusChange: (id: string, status: PartnerStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(p.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function saveNotes() {
    setSavingNotes(true);
    await onNotesChange(p.id, notes);
    setSavingNotes(false);
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="font-bold">
            {p.company_name}
            {(p.category || p.partner_type) && (
              <span className="font-normal text-billboard-inkSoft text-sm">
                {" · "}
                {[p.category ? PARTNER_CATEGORY_LABEL[p.category] : null, p.partner_type ? PARTNER_TYPE_LABEL[p.partner_type] : null].filter(Boolean).join(" · ")}
              </span>
            )}
          </p>
          <p className="text-xs text-billboard-inkSoft mt-1 font-mono">{p.contact_name} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
          {p.website && (
            <p className="text-xs text-billboard-inkSoft mt-1 font-mono">
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="underline">{p.website}</a>
            </p>
          )}
        </div>
        <select
          value={p.status}
          onChange={(e) => onStatusChange(p.id, e.target.value as PartnerStatus)}
          className={`font-mono text-xs font-semibold uppercase border-2 rounded px-2.5 py-2 bg-white shrink-0 ${PARTNER_STATUS_STYLE[p.status]}`}
        >
          {PARTNER_STATUSES.map((s) => <option key={s} value={s}>{PARTNER_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <p className="text-sm text-billboard-inkSoft mt-3 max-w-2xl whitespace-pre-wrap">{p.message}</p>

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">Submitted {new Date(p.created_at).toLocaleDateString("en-ZA")}</span>
      </div>

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Notes</label>
        <div className="flex gap-2">
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes"
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

function buildAdvertiseRows(inquiries: AdvertiseInquiry[]): CsvRow[] {
  return inquiries.map((a) => ({
    Company: a.company_name,
    Contact: a.contact_name,
    Email: a.email,
    Phone: a.phone || "",
    Product: ADVERTISE_PRODUCT_LABEL[a.product],
    "Budget range": a.budget_range || "",
    Status: ADVERTISE_STATUS_LABEL[a.status],
    Message: a.message,
    "Admin notes": a.admin_notes || "",
    Submitted: new Date(a.created_at).toISOString().slice(0, 10),
  }));
}

// Same "which product is this pipeline attracting" breakdown as Work
// With Us / Partners above.
function AdvertiseBreakdown({ inquiries }: { inquiries: AdvertiseInquiry[] }) {
  if (inquiries.length === 0) return null;
  const max = Math.max(...ADVERTISE_PRODUCTS.map((p) => inquiries.filter((a) => a.product === p.value).length), 1);
  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 mb-6">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-wider mb-4">Which ad product people are enquiring about</h3>
      <div className="space-y-2.5">
        {ADVERTISE_PRODUCTS.map((p) => {
          const count = inquiries.filter((a) => a.product === p.value).length;
          const pct = Math.round((count / max) * 100);
          return (
            <div key={p.value} className="flex items-center gap-3">
              <span className="text-xs font-semibold w-48 shrink-0">{p.label}</span>
              <div className="flex-1 h-4 bg-billboard-paperDim border-2 border-billboard-ink rounded overflow-hidden">
                <div className="h-full bg-billboard-yellow" style={{ width: `${count === 0 ? 0 : Math.max(pct, 6)}%` }} />
              </div>
              <span className="font-mono text-xs text-billboard-inkSoft w-6 text-right shrink-0">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdvertiseTab({
  inquiries, onStatusChange, onNotesChange,
}: {
  inquiries: AdvertiseInquiry[];
  onStatusChange: (id: string, status: AdvertiseStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [productFilter, setProductFilter] = useState<AdvertiseProduct | "all">("all");
  const visible = productFilter === "all" ? inquiries : inquiries.filter((a) => a.product === productFilter);

  return (
    <div>
      <AdvertiseBreakdown inquiries={inquiries} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value as AdvertiseProduct | "all")}
          className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 bg-white"
        >
          <option value="all">All products</option>
          {ADVERTISE_PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <ExportCsvButton label="Export CSV" filenameBase="advertise-inquiries" rows={buildAdvertiseRows(visible)} />
      </div>

      {visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          {inquiries.length === 0 ? "No enquiries yet — submissions from /advertise will show up here." : "No enquiries for this product."}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((a) => <AdvertiseCard key={a.id} inquiry={a} onStatusChange={onStatusChange} onNotesChange={onNotesChange} />)}
        </div>
      )}
    </div>
  );
}

function AdvertiseCard({
  inquiry: a, onStatusChange, onNotesChange,
}: {
  inquiry: AdvertiseInquiry;
  onStatusChange: (id: string, status: AdvertiseStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(a.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function saveNotes() {
    setSavingNotes(true);
    await onNotesChange(a.id, notes);
    setSavingNotes(false);
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="font-bold">
            {a.company_name} <span className="font-normal text-billboard-inkSoft text-sm">· {ADVERTISE_PRODUCT_LABEL[a.product]}</span>
          </p>
          <p className="text-xs text-billboard-inkSoft mt-1 font-mono">{a.contact_name} · {a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
          {a.budget_range && <p className="text-xs text-billboard-inkSoft mt-1 font-mono">Budget: {a.budget_range}</p>}
        </div>
        <select
          value={a.status}
          onChange={(e) => onStatusChange(a.id, e.target.value as AdvertiseStatus)}
          className={`font-mono text-xs font-semibold uppercase border-2 rounded px-2.5 py-2 bg-white shrink-0 ${ADVERTISE_STATUS_STYLE[a.status]}`}
        >
          {ADVERTISE_STATUSES.map((s) => <option key={s} value={s}>{ADVERTISE_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <p className="text-sm text-billboard-inkSoft mt-3 max-w-2xl whitespace-pre-wrap">{a.message}</p>

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">Submitted {new Date(a.created_at).toLocaleDateString("en-ZA")}</span>
      </div>

      <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Notes</label>
        <div className="flex gap-2">
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes"
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

// ── Community admin ───────────────────────────────────────────────────────
// One top-level tab with three inner sub-tabs, rather than three more
// top-level tabs — Admin.tsx already has a lot of them, and these three
// resources (announcements, events, Q&A) are small enough individually
// that they read better grouped under one "Community" heading than
// competing for space in the main tab bar.

function CommunityAdminTab({
  announcements, events, questions,
  onCreateAnnouncement, onUpdateAnnouncement, onDeleteAnnouncement,
  onCreateEvent, onUpdateEvent, onDeleteEvent,
  onUpdateQuestion, onDeleteQuestion,
}: {
  announcements: CommunityAnnouncement[];
  events: CommunityEvent[];
  questions: CommunityQuestion[];
  onCreateAnnouncement: (title: string, body: string, pinned: boolean) => Promise<void>;
  onUpdateAnnouncement: (id: string, patch: Partial<Pick<CommunityAnnouncement, "title" | "body" | "pinned" | "is_published">>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onCreateEvent: (input: { title: string; description: string; event_type: CommunityEventType; starts_at: string; location_or_link: string }) => Promise<void>;
  onUpdateEvent: (id: string, patch: Partial<CommunityEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onUpdateQuestion: (id: string, patch: Partial<Pick<CommunityQuestion, "answer" | "status" | "admin_notes">>) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<"announcements" | "events" | "qa">("announcements");
  const pendingCount = questions.filter((q) => q.status === "pending").length;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          ["announcements", `Announcements (${announcements.length})`],
          ["events", `Events (${events.length})`],
          ["qa", `Q&A (${pendingCount} pending)`],
        ] as [typeof subTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`font-mono text-xs font-semibold uppercase px-3 py-2 rounded border-2 border-billboard-ink transition ${subTab === key ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "announcements" && (
        <AnnouncementsAdmin announcements={announcements} onCreate={onCreateAnnouncement} onUpdate={onUpdateAnnouncement} onDelete={onDeleteAnnouncement} />
      )}
      {subTab === "events" && (
        <EventsAdmin events={events} onCreate={onCreateEvent} onUpdate={onUpdateEvent} onDelete={onDeleteEvent} />
      )}
      {subTab === "qa" && (
        <QaAdmin questions={questions} onUpdate={onUpdateQuestion} onDelete={onDeleteQuestion} />
      )}
    </div>
  );
}

function AnnouncementsAdmin({
  announcements, onCreate, onUpdate, onDelete,
}: {
  announcements: CommunityAnnouncement[];
  onCreate: (title: string, body: string, pinned: boolean) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Pick<CommunityAnnouncement, "title" | "body" | "pinned" | "is_published">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setCreating(true);
    await onCreate(title.trim(), body.trim(), pinned);
    setCreating(false);
    setTitle("");
    setBody("");
    setPinned(false);
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="border-[3px] border-billboard-ink rounded p-5 mb-6 space-y-3">
        <h3 className="font-bold text-sm mb-1">New announcement</h3>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
        <textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" rows={3} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm resize-y" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to top
        </label>
        <button type="submit" disabled={creating} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-4 py-2 bg-billboard-yellow hover:-translate-y-0.5 transition disabled:opacity-60">
          {creating ? "Posting…" : "Post announcement"}
        </button>
      </form>

      {announcements.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-8 text-center text-billboard-inkSoft text-sm">No announcements yet.</div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="border-[3px] border-billboard-ink rounded p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h4 className="font-bold text-sm">{a.title}{a.pinned && <span className="ml-2 font-mono text-[10px] uppercase border-2 border-billboard-ink bg-billboard-yellow px-1.5 py-0.5 rounded">Pinned</span>}</h4>
                <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border-2 shrink-0 ${a.is_published ? "border-billboard-greenDeep text-billboard-greenDeep" : "border-billboard-inkSoft text-billboard-inkSoft"}`}>{a.is_published ? "Published" : "Draft"}</span>
              </div>
              <p className="text-sm text-billboard-inkSoft mb-3 whitespace-pre-wrap">{a.body}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onUpdate(a.id, { is_published: !a.is_published })} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition">
                  {a.is_published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => onUpdate(a.id, { pinned: !a.pinned })} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition">
                  {a.pinned ? "Unpin" : "Pin"}
                </button>
                <button onClick={() => onDelete(a.id)} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsAdmin({
  events, onCreate, onUpdate, onDelete,
}: {
  events: CommunityEvent[];
  onCreate: (input: { title: string; description: string; event_type: CommunityEventType; starts_at: string; location_or_link: string }) => Promise<void>;
  onUpdate: (id: string, patch: Partial<CommunityEvent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<CommunityEventType>("webinar");
  const [startsAt, setStartsAt] = useState("");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startsAt || !locationOrLink.trim()) return;
    setCreating(true);
    await onCreate({ title: title.trim(), description: description.trim(), event_type: eventType, starts_at: new Date(startsAt).toISOString(), location_or_link: locationOrLink.trim() });
    setCreating(false);
    setTitle(""); setDescription(""); setStartsAt(""); setLocationOrLink("");
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="border-[3px] border-billboard-ink rounded p-5 mb-6 space-y-3">
        <h3 className="font-bold text-sm mb-1">New event</h3>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm resize-y" />
        <div className="grid sm:grid-cols-2 gap-3">
          <select value={eventType} onChange={(e) => setEventType(e.target.value as CommunityEventType)} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm bg-white">
            {COMMUNITY_EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
        </div>
        <input required value={locationOrLink} onChange={(e) => setLocationOrLink(e.target.value)} placeholder={eventType === "in_person" ? "Physical address" : "Join link (URL)"} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm" />
        <button type="submit" disabled={creating} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-4 py-2 bg-billboard-yellow hover:-translate-y-0.5 transition disabled:opacity-60">
          {creating ? "Creating…" : "Create event"}
        </button>
      </form>

      {events.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-8 text-center text-billboard-inkSoft text-sm">No events yet.</div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="border-[3px] border-billboard-ink rounded p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h4 className="font-bold text-sm">{ev.title} <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">· {COMMUNITY_EVENT_TYPE_LABEL[ev.event_type]}</span></h4>
                <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border-2 shrink-0 ${ev.is_published ? "border-billboard-greenDeep text-billboard-greenDeep" : "border-billboard-inkSoft text-billboard-inkSoft"}`}>{ev.is_published ? "Published" : "Draft"}</span>
              </div>
              <p className="text-sm text-billboard-inkSoft mb-1">{ev.description}</p>
              <p className="font-mono text-[10px] text-billboard-inkSoft mb-3">{new Date(ev.starts_at).toLocaleString("en-ZA")} · {ev.location_or_link}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onUpdate(ev.id, { is_published: !ev.is_published })} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition">
                  {ev.is_published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => onDelete(ev.id)} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QaAdmin({
  questions, onUpdate, onDelete,
}: {
  questions: CommunityQuestion[];
  onUpdate: (id: string, patch: Partial<Pick<CommunityQuestion, "answer" | "status" | "admin_notes">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<CommunityQuestionStatus | "all">("all");
  const visible = statusFilter === "all" ? questions : questions.filter((q) => q.status === statusFilter);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {(["all", "pending", "answered", "published"] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`font-mono text-[10px] font-semibold uppercase px-2.5 py-1.5 rounded border-2 border-billboard-ink transition ${statusFilter === s ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}>
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-8 text-center text-billboard-inkSoft text-sm">Nothing here.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((q) => <QaCard key={q.id} question={q} onUpdate={onUpdate} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

function QaCard({
  question: q, onUpdate, onDelete,
}: {
  question: CommunityQuestion;
  onUpdate: (id: string, patch: Partial<Pick<CommunityQuestion, "answer" | "status" | "admin_notes">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [answer, setAnswer] = useState(q.answer ?? "");
  const [saving, setSaving] = useState(false);

  async function saveAnswer(nextStatus?: CommunityQuestionStatus) {
    setSaving(true);
    await onUpdate(q.id, { answer, ...(nextStatus ? { status: nextStatus } : {}) });
    setSaving(false);
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-4">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2 py-0.5 rounded">{COMMUNITY_QUESTION_CATEGORY_LABEL[q.category]}</span>
        <span className="font-mono text-[10px] uppercase text-billboard-inkSoft shrink-0">{q.status}</span>
      </div>
      <p className="font-bold text-sm mb-1">{q.question}</p>
      <p className="font-mono text-[10px] text-billboard-inkSoft mb-3">{q.asked_by_name || "Anonymous"}{q.asked_by_email ? ` · ${q.asked_by_email}` : ""} · {new Date(q.created_at).toLocaleDateString("en-ZA")}</p>
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write an answer…" rows={3} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm resize-y mb-3" />
      <div className="flex flex-wrap gap-2">
        <button onClick={() => saveAnswer()} disabled={saving} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60">
          {saving ? "Saving…" : "Save answer"}
        </button>
        <button onClick={() => saveAnswer("answered")} disabled={saving || !answer.trim()} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60">
          Mark answered
        </button>
        <button onClick={() => saveAnswer("published")} disabled={saving || !answer.trim()} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60">
          Publish
        </button>
        {q.status === "published" && (
          <button onClick={() => onUpdate(q.id, { status: "answered" })} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition">
            Unpublish
          </button>
        )}
        <button onClick={() => onDelete(q.id)} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-red text-billboard-red rounded px-2.5 py-1.5 hover:-translate-y-0.5 transition">
          Delete
        </button>
      </div>
    </div>
  );
}
