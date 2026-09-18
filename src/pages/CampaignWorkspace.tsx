import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import { formatCurrency } from "../lib/currency";
import { SkeletonBlock, SkeletonLine } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { getWorkspaceCampaign, isWorkspaceCreator, type WorkspaceCampaign } from "../lib/campaignWorkspace";
import ContentApprovalPanel from "../components/ContentApprovalPanel";
import DeliverablesPanel from "../components/DeliverablesPanel";
import MessageThread from "../components/MessageThread";
import DisputeSection from "../components/DisputeSection";
import EscrowNote from "../components/EscrowNote";
import BankDetailsPanel from "../components/BankDetailsPanel";
import ComplianceBadge from "../components/ComplianceBadge";
import RiskBadge from "../components/RiskBadge";
import ComplianceChecklist from "../components/ComplianceChecklist";
import PlatformRequirementCard from "../components/PlatformRequirementCard";
import DisclosureNotice from "../components/DisclosureNotice";
import ProofSubmissionCard from "../components/ProofSubmissionCard";
import { WarningIcon } from "../components/UiIcons";
import {
  getCampaignComplianceById,
  getComplianceChecklist,
  getEnabledPlatformRules,
  getCategoryRules,
  setCampaignComplianceContext,
  runComplianceScreening,
} from "../lib/compliance";
import { trackingUrl, utmTaggedUrl, buildEmbedSnippet } from "../lib/campaignTracking";
import type {
  CampaignCompliance,
  PlatformComplianceRule,
  CampaignCategoryRule,
  CampaignDisclosure,
  CampaignProof,
  CampaignRiskFlag,
} from "../lib/complianceTypes";
import type { Campaign, CampaignStats } from "../lib/types";
import Button from "../components/Button";

type TabKey = "overview" | "brief" | "messages" | "deliverables" | "compliance" | "content" | "tracking" | "analytics" | "payments" | "proof" | "report";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "brief", label: "Brief" },
  { key: "messages", label: "Messages" },
  { key: "deliverables", label: "Deliverables" },
  { key: "compliance", label: "Compliance" },
  { key: "content", label: "Content" },
  { key: "tracking", label: "Tracking" },
  { key: "analytics", label: "Analytics" },
  { key: "payments", label: "Payments" },
  { key: "proof", label: "Proof" },
  { key: "report", label: "Report" },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * `/campaigns/:id` — one workspace per campaign, spanning both the
 * PayFast/social-media flow (`requests`) and the four request-flow
 * channels (`channel_requests`). `:id` is deliberately just that
 * underlying row's own id, same convention getCampaignComplianceById
 * already uses — see lib/campaignWorkspace.ts's header comment.
 *
 * This doesn't replace the dashboard cards (ChannelCampaignCard /
 * ChannelRequestCard / RequestCard) — those still own the negotiate /
 * pay / confirm actions specific to each flow's early stages, and stay
 * linked from here rather than duplicated. What this adds is the single
 * place everything about ONE campaign already lives across separate
 * pages (compliance, content approval, proof, disputes, tracking) now
 * shows up together, tab by tab, instead of requiring five different
 * URLs to piece the full picture together.
 */
export default function CampaignWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey) || "overview";

  const [campaign, setCampaign] = useState<WorkspaceCampaign | null | undefined>(undefined); // undefined = loading
  const [isCreator, setIsCreator] = useState(false);

  // Compliance + proof data, shared by the Compliance and Proof tabs.
  const [compliance, setCompliance] = useState<CampaignCompliance | null | undefined>(undefined);
  const [platforms, setPlatforms] = useState<PlatformComplianceRule[]>([]);
  const [categories, setCategories] = useState<CampaignCategoryRule[]>([]);
  const [disclosures, setDisclosures] = useState<CampaignDisclosure[]>([]);
  const [proof, setProof] = useState<CampaignProof[]>([]);
  const [riskFlags, setRiskFlags] = useState<CampaignRiskFlag[]>([]);
  const [screening, setScreening] = useState(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);

  // Tracking + analytics data.
  const [trackingCampaigns, setTrackingCampaigns] = useState<Campaign[]>([]);
  const [trackingStats, setTrackingStats] = useState<Record<string, CampaignStats>>({});

  const load = useCallback(async () => {
    if (!id || !user) return;
    const [c, cc, rules, cats] = await Promise.all([
      getWorkspaceCampaign(id),
      getCampaignComplianceById(id),
      getEnabledPlatformRules(),
      getCategoryRules(),
    ]);
    setCampaign(c);
    setCompliance(cc);
    setPlatforms(rules);
    setCategories(cats);
    if (c) setIsCreator(await isWorkspaceCreator(c.creatorPublisherId, user.id));
    if (cc) {
      const { disclosures, proof, riskFlags } = await getComplianceChecklist(cc.id);
      setDisclosures(disclosures);
      setProof(proof);
      setRiskFlags(riskFlags);
    }
    const { data: trackData } = await supabase
      .from("campaigns")
      .select("*")
      .or(`request_id.eq.${id},channel_request_id.eq.${id}`);
    const tCampaigns = (trackData ?? []) as Campaign[];
    setTrackingCampaigns(tCampaigns);
    if (tCampaigns.length > 0) {
      const { data: statsData } = await supabase.from("campaign_stats").select("*").in("campaign_id", tCampaigns.map((c) => c.id));
      const byId: Record<string, CampaignStats> = {};
      for (const s of (statsData ?? []) as CampaignStats[]) byId[s.campaign_id] = s;
      setTrackingStats(byId);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function screen() {
    if (!compliance) return;
    setScreening(true);
    setScreeningError(null);
    try {
      await runComplianceScreening(compliance.id);
      await load();
    } catch (e) {
      setScreeningError(e instanceof Error ? e.message : "Couldn't run the compliance check — try again.");
    } finally {
      setScreening(false);
    }
  }

  function setTab(t: TabKey) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", t);
      return next;
    });
  }

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (authLoading || campaign === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-16" aria-busy="true" aria-label="Loading campaign workspace">
        <SkeletonLine className="w-1/3 h-6 mb-4" />
        <SkeletonBlock className="h-64" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/campaigns/${id}`)}`} replace />;
  if (!campaign) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16">
        <EmptyState kind="lock" title="Campaign not found" description="This campaign doesn't exist, or you don't have access to it." />
      </div>
    );
  }

  const isBusiness = campaign.businessId === user.id;

  return (
    <div className="max-w-4xl mx-auto px-5 py-16">
      <Seo title="Campaign workspace · ChatSched" description="Everything about this campaign in one place." noindex />

      <Link to="/dashboard" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft underline">← Back to dashboard</Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mt-3 mb-2">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase text-billboard-inkSoft mb-1">
            {isBusiness ? campaign.creatorName : campaign.businessName}
          </p>
          <h1 className="text-2xl font-display">{campaign.summary.length > 80 ? `${campaign.summary.slice(0, 80)}…` : campaign.summary}</h1>
        </div>
        <span className="inline-block font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 border-billboard-ink bg-billboard-paperDim shrink-0">
          {campaign.status.replace(/_/g, " ")}
        </span>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b-2 border-billboard-ink/15 mb-6 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`font-mono text-[11px] font-semibold uppercase px-3 py-2.5 whitespace-nowrap border-b-2 -mb-0.5 transition ${
              tab === t.key ? "border-billboard-ink text-billboard-ink" : "border-transparent text-billboard-inkSoft hover:text-billboard-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab campaign={campaign} isBusiness={isBusiness} compliance={compliance} proof={proof} trackingCampaigns={trackingCampaigns} setTab={setTab} />}
      {tab === "brief" && <BriefTab campaign={campaign} />}
      {tab === "messages" && <MessagesTab campaign={campaign} isBusiness={isBusiness} />}
      {tab === "deliverables" && <DeliverablesTab campaign={campaign} isBusiness={isBusiness} isCreator={isCreator} isAdmin={profile?.role === "admin"} setTab={setTab} />}
      {tab === "compliance" && (
        <ComplianceTab
          compliance={compliance}
          platforms={platforms}
          categories={categories}
          riskFlags={riskFlags}
          disclosures={disclosures}
          isBusiness={isBusiness}
          isCreator={isCreator}
          screening={screening}
          screeningError={screeningError}
          onScreen={screen}
          onSaved={(updated) => setCompliance(updated)}
          onReload={load}
        />
      )}
      {tab === "content" && campaign.kind === "channel_request" && (
        <ContentApprovalPanel
          channelRequestId={campaign.id}
          requestStatus={campaign.status}
          isCreator={isCreator}
          isBusiness={isBusiness}
          advertisingMethod={campaign.raw.advertising_method}
          onPublished={load}
        />
      )}
      {tab === "content" && campaign.kind === "request" && (
        <p className="text-sm text-billboard-inkSoft">Content approval isn't part of this campaign type — see the Deliverables tab.</p>
      )}
      {tab === "tracking" && <TrackingTab campaign={campaign} campaigns={trackingCampaigns} stats={trackingStats} />}
      {tab === "analytics" && <AnalyticsTab campaigns={trackingCampaigns} stats={trackingStats} />}
      {tab === "payments" && <PaymentsTab campaign={campaign} />}
      {tab === "proof" && (
        compliance && compliance.platform ? (
          <ProofSubmissionCard campaignComplianceId={compliance.id} platform={compliance.platform} proof={proof} isCreator={isCreator} onSubmitted={load} />
        ) : (
          <p className="text-sm text-billboard-inkSoft">Set a platform in the Compliance tab before submitting proof of publication.</p>
        )
      )}
      {tab === "report" && <ReportTab campaign={campaign} compliance={compliance} proof={proof} trackingCampaigns={trackingCampaigns} trackingStats={trackingStats} />}

      <div className="mt-8 pt-6 border-t-2 border-billboard-paperDim">
        <DisputeSection
          requestId={campaign.kind === "request" ? campaign.id : undefined}
          channelRequestId={campaign.kind === "channel_request" ? campaign.id : undefined}
        />
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────

/**
 * "This booking is part of your Q3 Push campaign" — the backlink the
 * other direction from ManagedCampaignsSection.tsx already provides
 * (campaign -> its bookings' workspaces). Business-only: a creator has
 * no relationship to the client's agency_campaigns row at all.
 *
 * Deliberately reuses get_my_managed_campaigns() rather than a new RPC —
 * that call already returns every campaign this business can see, name
 * included, so finding the one matching this booking's
 * agency_campaign_id is a client-side filter, not a reason to add
 * another migration for a one-line lookup. No dedicated
 * /managed-campaigns/:id route exists (see
 * PHASE7_MANAGED_CAMPAIGN_CLIENT_VIEW_DELIVERY.md's design note on why —
 * an expand-in-place card list on the dashboard, not its own page), so
 * this links back to /dashboard rather than a campaign-specific URL.
 */
function ManagedCampaignBacklink({ agencyCampaignId }: { agencyCampaignId: string }) {
  const [name, setName] = useState<string | null | undefined>(undefined); // undefined = loading, null = not found/no access

  useEffect(() => {
    supabase.rpc("get_my_managed_campaigns").then(({ data }) => {
      const match = ((data ?? []) as { id: string; name: string }[]).find((c) => c.id === agencyCampaignId);
      setName(match?.name ?? null);
    }, () => setName(null));
  }, [agencyCampaignId]);

  if (!name) return null; // still loading, or this viewer can't see the parent campaign — say nothing either way

  return (
    <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs font-semibold text-billboard-ink underline">
      ← Part of your managed campaign: {name}
    </Link>
  );
}

function OverviewTab({
  campaign, isBusiness, compliance, proof, trackingCampaigns, setTab,
}: {
  campaign: WorkspaceCampaign;
  isBusiness: boolean;
  compliance: CampaignCompliance | null | undefined;
  proof: CampaignProof[];
  trackingCampaigns: Campaign[];
  setTab: (t: TabKey) => void;
}) {
  const needsAttention: { label: string; tab: TabKey }[] = [];
  if (campaign.kind === "channel_request" && campaign.status === "paid") {
    needsAttention.push({ label: "Content needs your attention", tab: "content" });
  }
  if (compliance && compliance.status === "not_started" && isBusiness) {
    needsAttention.push({ label: "Set platform & category for compliance", tab: "compliance" });
  }
  if (compliance && proof.length === 0 && (campaign.status === "live" || campaign.status === "completed" || campaign.status === "confirmed")) {
    needsAttention.push({ label: "Submit proof of publication", tab: "proof" });
  }

  return (
    <div className="space-y-6">
      {isBusiness && campaign.raw.agency_campaign_id && <ManagedCampaignBacklink agencyCampaignId={campaign.raw.agency_campaign_id} />}
      {needsAttention.length > 0 && (
        <div className="border-2 border-billboard-yellow rounded p-4 bg-billboard-yellow/10">
          <p className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft mb-2">Needs attention</p>
          <div className="flex flex-wrap gap-2">
            {needsAttention.map((n) => (
              <button key={n.tab} onClick={() => setTab(n.tab)} className="text-xs font-semibold underline text-billboard-ink">
                {n.label} →
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border-2 border-billboard-ink rounded p-3">
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Business</p>
          <p className="text-sm font-semibold">{campaign.businessName}</p>
        </div>
        <div className="border-2 border-billboard-ink rounded p-3">
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Creator</p>
          <p className="text-sm font-semibold">{campaign.creatorName}</p>
        </div>
        <div className="border-2 border-billboard-ink rounded p-3">
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Value</p>
          <p className="text-sm font-semibold">{campaign.amount != null ? formatCurrency(campaign.amount) : "Not set"}</p>
        </div>
        <div className="border-2 border-billboard-ink rounded p-3">
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Started</p>
          <p className="text-sm font-semibold">{formatDate(campaign.createdAt)}</p>
        </div>
      </div>

      {compliance && (
        <div className="border-2 border-billboard-ink/15 rounded p-3 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-mono uppercase text-billboard-inkSoft">Compliance</span>
          <ComplianceBadge status={compliance.status} />
          <RiskBadge level={compliance.risk_level} score={compliance.risk_score} />
        </div>
      )}

      {trackingCampaigns.length > 0 && (
        <div className="border-2 border-billboard-ink/15 rounded p-3">
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Tracking links</p>
          <p className="text-sm">{trackingCampaigns.length} linked — see the Tracking tab for details.</p>
        </div>
      )}
    </div>
  );
}

// ── Brief ─────────────────────────────────────────────────────────────────

function BriefTab({ campaign }: { campaign: WorkspaceCampaign }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Campaign message</p>
        <p className="text-sm whitespace-pre-wrap">{campaign.summary}</p>
      </div>
      {campaign.kind === "channel_request" && (
        <div>
          <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Advertising method</p>
          <p className="text-sm">{campaign.raw.advertising_method}</p>
        </div>
      )}
      <div>
        <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">{campaign.kind === "channel_request" ? "Proposed amount" : "Budget / agreed amount"}</p>
        <p className="text-sm">{campaign.amount != null ? formatCurrency(campaign.amount) : "Not set"}</p>
      </div>
      <p className="text-xs text-billboard-inkSoft">The creative brief (image, video, caption, CTA, link) lives in the Content tab, alongside the approval workflow.</p>
    </div>
  );
}

// ── Messages ──────────────────────────────────────────────────────────────

function MessagesTab({ campaign, isBusiness }: { campaign: WorkspaceCampaign; isBusiness: boolean }) {
  return <MessageThread {...(campaign.kind === "channel_request" ? { channelRequestId: campaign.id } : { requestId: campaign.id })} senderRole={isBusiness ? "business" : "publisher"} />;
}

// ── Deliverables ──────────────────────────────────────────────────────────

function DeliverablesTab({ campaign, isBusiness, isCreator, isAdmin, setTab }: { campaign: WorkspaceCampaign; isBusiness: boolean; isCreator: boolean; isAdmin: boolean; setTab: (t: TabKey) => void }) {
  return (
    <div className="space-y-4">
      <DeliverablesPanel
        campaign={{ kind: campaign.kind, id: campaign.id }}
        isBusiness={isBusiness}
        isCreator={isCreator}
        isAdmin={isAdmin}
        durationDays={campaign.kind === "channel_request" ? campaign.raw.duration_days : null}
        canEditDuration={isBusiness && campaign.kind === "channel_request"}
      />
      <p className="text-xs text-billboard-inkSoft">
        For campaigns using the content approval workflow, the creative itself — draft, approval, publish — lives in{" "}
        {campaign.kind === "channel_request" ? (
          <button onClick={() => setTab("content")} className="underline font-semibold text-billboard-ink">the Content tab</button>
        ) : null}
        . Evidence a deliverable went live can also be attached in{" "}
        <button onClick={() => setTab("proof")} className="underline font-semibold text-billboard-ink">the Proof tab</button>.
      </p>
    </div>
  );
}

// ── Compliance ────────────────────────────────────────────────────────────

function ComplianceTab({
  compliance, platforms, categories, riskFlags, disclosures, isBusiness, isCreator, screening, screeningError, onScreen, onSaved, onReload,
}: {
  compliance: CampaignCompliance | null | undefined;
  platforms: PlatformComplianceRule[];
  categories: CampaignCategoryRule[];
  riskFlags: CampaignRiskFlag[];
  disclosures: CampaignDisclosure[];
  isBusiness: boolean;
  isCreator: boolean;
  screening: boolean;
  screeningError: string | null;
  onScreen: () => void;
  onSaved: (updated: CampaignCompliance) => void;
  onReload: () => void;
}) {
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!compliance) return <p className="text-sm text-billboard-inkSoft">No compliance record for this campaign.</p>;
  const rule = platforms.find((p) => p.platform === compliance.platform) ?? null;

  async function save() {
    if (!compliance || !platform || !category) {
      setSaveError("Choose a platform and a category.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await setCampaignComplianceContext(compliance.id, platform, category);
      onSaved(updated);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ComplianceBadge status={compliance.status} />
        <RiskBadge level={compliance.risk_level} score={compliance.risk_score} />
      </div>

      {isBusiness && compliance.status === "not_started" && (
        <div className="border-[3px] border-billboard-ink rounded bg-white p-4">
          <h2 className="font-display text-sm mb-1">Campaign requirements</h2>
          <p className="text-xs text-billboard-inkSoft mb-3">Tell us the platform and category so we can show what's required before publishing.</p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm">
                <option value="">Select…</option>
                {platforms.map((p) => <option key={p.platform} value={p.platform}>{p.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm">
                <option value="">Select…</option>
                {categories.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
              </select>
            </div>
          </div>
          {saveError && <p className="text-sm text-billboard-red mb-2">{saveError}</p>}
          <Button onClick={save} disabled={saving} variant="dark" size="md">
            {saving ? "Saving…" : "View requirements"}
          </Button>
        </div>
      )}

      {isBusiness && compliance.status !== "not_started" && (
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft">Platform &amp; category</p>
          <p className="text-sm mt-0.5">{rule?.display_name ?? compliance.platform} · {compliance.category}</p>
        </div>
      )}

      <div className="border-[3px] border-billboard-ink rounded bg-white p-4">
        <h2 className="font-display text-sm mb-3">Checklist</h2>
        <ComplianceChecklist compliance={compliance} />
      </div>

      {isBusiness && compliance.platform && compliance.category && (
        <div>
          <Button onClick={onScreen} disabled={screening} variant="outline" size="md">
            {screening ? "Screening…" : compliance.risk_level ? "Re-run compliance check" : "Run compliance check"}
          </Button>
          <p className="text-[11px] text-billboard-inkSoft mt-1.5">
            An AI-assisted first pass over your campaign brief. It flags things worth a second look — it doesn't decide eligibility, and it never speaks for TikTok, Instagram, YouTube, or any other platform.
          </p>
          {screeningError && <p className="text-sm text-billboard-red mt-1.5">{screeningError}</p>}
        </div>
      )}

      {riskFlags.some((f) => !f.resolved) && (
        <div className="border-[3px] border-billboard-yellow rounded bg-white p-4">
          <h2 className="font-display text-sm mb-2 flex items-center gap-1.5"><WarningIcon className="w-3.5 h-3.5" /> Needs attention</h2>
          <ul className="text-sm space-y-1.5">
            {riskFlags.filter((f) => !f.resolved).map((f) => <li key={f.id}>{f.description}</li>)}
          </ul>
        </div>
      )}

      {rule && (
        <div>
          <h2 className="font-display text-sm mb-3">Platform requirements</h2>
          <PlatformRequirementCard rule={rule} />
        </div>
      )}

      {isCreator && rule && rule.disclosure_required && (
        <DisclosureNotice campaignComplianceId={compliance.id} rule={rule} existingAck={disclosures[0] ?? null} onAcknowledged={onReload} />
      )}
    </div>
  );
}

// ── Tracking ──────────────────────────────────────────────────────────────

function TrackingTab({ campaign, campaigns, stats }: { campaign: WorkspaceCampaign; campaigns: Campaign[]; stats: Record<string, CampaignStats> }) {
  if (campaigns.length === 0) {
    return (
      <div>
        <p className="text-sm text-billboard-inkSoft mb-3">No tracking link linked to this campaign yet.</p>
        <Link to="/dashboard?tab=marketing" className="text-xs font-semibold underline text-billboard-ink">Create one in Marketing Suite → Campaign Tracker →</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {campaigns.map((c) => {
        const s = stats[c.id];
        return (
          <div key={c.id} className="border-2 border-billboard-ink rounded p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-bold text-sm">{c.name}</p>
              <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">{c.status}</span>
            </div>
            <p className="text-xs font-mono break-all text-billboard-inkSoft mb-1">{trackingUrl(c.slug)}</p>
            <p className="text-xs font-mono break-all text-billboard-inkSoft mb-3">{utmTaggedUrl(c)}</p>
            {s && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><div className="font-display text-sm">{s.clicks}</div><div className="text-[9px] font-mono uppercase text-billboard-inkSoft">Clicks</div></div>
                <div><div className="font-display text-sm">{s.visits}</div><div className="text-[9px] font-mono uppercase text-billboard-inkSoft">Visits</div></div>
                <div><div className="font-display text-sm">{s.leads}</div><div className="text-[9px] font-mono uppercase text-billboard-inkSoft">Leads</div></div>
                <div><div className="font-display text-sm">{s.conversions}</div><div className="text-[9px] font-mono uppercase text-billboard-inkSoft">Conversions</div></div>
              </div>
            )}
          </div>
        );
      })}
      {SUPABASE_URL && SUPABASE_ANON_KEY && campaigns[0] && (
        <details className="border-2 border-billboard-ink/15 rounded p-3">
          <summary className="text-xs font-semibold cursor-pointer">Embed snippet (for {campaigns[0].name})</summary>
          <pre className="text-[10px] mt-2 whitespace-pre-wrap break-all bg-billboard-paperDim p-2 rounded">{buildEmbedSnippet(SUPABASE_URL, SUPABASE_ANON_KEY, campaigns[0].slug)}</pre>
        </details>
      )}
      <p className="text-xs text-billboard-inkSoft">
        Manage, pause or create more links for {campaign.kind === "channel_request" ? "this campaign" : "this booking"} in{" "}
        <Link to="/dashboard?tab=marketing" className="underline font-semibold text-billboard-ink">Marketing Suite → Campaign Tracker</Link>.
      </p>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────

function AnalyticsTab({ campaigns, stats }: { campaigns: Campaign[]; stats: Record<string, CampaignStats> }) {
  const rows = campaigns.map((c) => stats[c.id]).filter((s): s is CampaignStats => !!s);
  if (rows.length === 0) {
    return <p className="text-sm text-billboard-inkSoft">No performance data yet — link a tracking URL in the Tracking tab and share it to start collecting clicks, visits, leads and conversions.</p>;
  }
  const totals = rows.reduce(
    (acc, s) => ({ clicks: acc.clicks + s.clicks, visits: acc.visits + s.visits, leads: acc.leads + s.leads, conversions: acc.conversions + s.conversions, value: acc.value + (s.conversion_value || 0) }),
    { clicks: 0, visits: 0, leads: 0, conversions: 0, value: 0 },
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="border-2 border-billboard-ink rounded p-3"><div className="font-display text-lg">{totals.clicks}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Clicks</div></div>
        <div className="border-2 border-billboard-ink rounded p-3"><div className="font-display text-lg">{totals.visits}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Visits</div></div>
        <div className="border-2 border-billboard-ink rounded p-3"><div className="font-display text-lg">{totals.leads}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Leads</div></div>
        <div className="border-2 border-billboard-ink rounded p-3"><div className="font-display text-lg">{totals.conversions}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Conversions</div></div>
        <div className="border-2 border-billboard-ink rounded p-3"><div className="font-display text-lg">{formatCurrency(totals.value)}</div><div className="text-[10px] font-mono uppercase text-billboard-inkSoft">Value</div></div>
      </div>
      <p className="text-xs text-billboard-inkSoft">
        {totals.clicks > 0 ? `${((totals.visits / totals.clicks) * 100).toFixed(0)}% of clicks reached the destination page` : "No clicks recorded yet"}
        {totals.visits > 0 ? `, and ${((totals.leads / totals.visits) * 100).toFixed(0)}% of visits became leads.` : "."}
      </p>
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────

function PaymentsTab({ campaign }: { campaign: WorkspaceCampaign }) {
  if (campaign.kind === "channel_request") {
    const r = campaign.raw;
    const reference = `CS-${r.id.slice(0, 8).toUpperCase()}`;
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Amount</p><p className="text-sm font-semibold">{formatCurrency(r.proposed_amount)}</p></div>
          <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Payment status</p><p className="text-sm font-semibold">{r.status.replace(/_/g, " ")}</p></div>
          <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Payment submitted</p><p className="text-sm">{formatDate(r.payment_submitted_at)}</p></div>
          <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Payment confirmed</p><p className="text-sm">{formatDate(r.paid_at)}</p></div>
        </div>
        {r.status === "awaiting_payment" && (
          <div>
            <EscrowNote until="your placement goes live" />
            <div className="mt-3"><BankDetailsPanel amount={r.proposed_amount} reference={reference} /></div>
            <p className="text-xs text-billboard-inkSoft mt-2">Confirm payment from your dashboard once it's sent.</p>
          </div>
        )}
      </div>
    );
  }

  const r = campaign.raw;
  const payment = [...(r.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Agreed amount</p><p className="text-sm font-semibold">{r.agreed_amount != null ? formatCurrency(r.agreed_amount) : "Not agreed yet"}</p></div>
        <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Payment status</p><p className="text-sm font-semibold">{payment?.status ?? "No payment yet"}</p></div>
        <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Method</p><p className="text-sm">{payment?.method ?? "—"}</p></div>
        <div className="border-2 border-billboard-ink rounded p-3"><p className="text-[10px] font-mono uppercase text-billboard-inkSoft">Paid</p><p className="text-sm">{formatDate(payment?.paid_at)}</p></div>
      </div>
      {!payment && <p className="text-xs text-billboard-inkSoft">Start or confirm payment from your dashboard.</p>}
    </div>
  );
}

// ── Report ────────────────────────────────────────────────────────────────

function ReportTab({
  campaign, compliance, proof, trackingCampaigns, trackingStats,
}: {
  campaign: WorkspaceCampaign;
  compliance: CampaignCompliance | null | undefined;
  proof: CampaignProof[];
  trackingCampaigns: Campaign[];
  trackingStats: Record<string, CampaignStats>;
}) {
  const totals = trackingCampaigns.reduce(
    (acc, c) => {
      const s = trackingStats[c.id];
      if (!s) return acc;
      return { clicks: acc.clicks + s.clicks, visits: acc.visits + s.visits, leads: acc.leads + s.leads, conversions: acc.conversions + s.conversions };
    },
    { clicks: 0, visits: 0, leads: 0, conversions: 0 },
  );
  return (
    <div className="space-y-4">
      <p className="text-xs text-billboard-inkSoft">A quick rollup of this campaign end to end — for a document to send someone, screenshot this tab.</p>
      <div className="border-2 border-billboard-ink rounded p-4">
        <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Deal</p>
        <p className="text-sm">{campaign.businessName} × {campaign.creatorName} — {campaign.amount != null ? formatCurrency(campaign.amount) : "amount not set"} — status: {campaign.status.replace(/_/g, " ")}</p>
      </div>
      <div className="border-2 border-billboard-ink rounded p-4">
        <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Compliance</p>
        <p className="text-sm">{compliance ? `${compliance.status.replace(/_/g, " ")}${compliance.risk_level ? ` · risk: ${compliance.risk_level}` : ""}` : "No compliance record"}</p>
      </div>
      <div className="border-2 border-billboard-ink rounded p-4">
        <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Proof</p>
        <p className="text-sm">{proof.length > 0 ? `${proof.length} submission${proof.length === 1 ? "" : "s"} — latest: ${proof[0].status.replace(/_/g, " ")}` : "No proof submitted yet"}</p>
      </div>
      <div className="border-2 border-billboard-ink rounded p-4">
        <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1">Performance</p>
        <p className="text-sm">{totals.clicks} clicks · {totals.visits} visits · {totals.leads} leads · {totals.conversions} conversions</p>
      </div>
    </div>
  );
}
