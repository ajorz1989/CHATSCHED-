import { useEffect, useState, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import SetupNotice from "../components/SetupNotice";
import Seo from "../components/Seo";
import { SkeletonBlock, SkeletonLine } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import ComplianceBadge from "../components/ComplianceBadge";
import RiskBadge from "../components/RiskBadge";
import ComplianceChecklist from "../components/ComplianceChecklist";
import PlatformRequirementCard from "../components/PlatformRequirementCard";
import DisclosureNotice from "../components/DisclosureNotice";
import ProofSubmissionCard from "../components/ProofSubmissionCard";
import {
  getCampaignComplianceById,
  getComplianceChecklist,
  getEnabledPlatformRules,
  getCategoryRules,
  setCampaignComplianceContext,
  runComplianceScreening,
} from "../lib/compliance";
import type {
  CampaignCompliance,
  PlatformComplianceRule,
  CampaignCategoryRule,
  CampaignDisclosure,
  CampaignProof,
  CampaignRiskFlag,
} from "../lib/complianceTypes";

/**
 * /campaigns/:id/compliance — brief section 3. `:id` is either a
 * `requests` or `channel_requests` row id; getCampaignComplianceById
 * checks both, so this page doesn't need to know which flow the campaign
 * came from. Positioning rule this page must never violate: ChatSched
 * does not guarantee platform approval — every status here is ChatSched's
 * own checklist, never a claim about what TikTok/Instagram/etc. will do.
 */
export default function CampaignCompliance() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [compliance, setCompliance] = useState<CampaignCompliance | null | undefined>(undefined); // undefined = loading, null = not found
  const [platforms, setPlatforms] = useState<PlatformComplianceRule[]>([]);
  const [categories, setCategories] = useState<CampaignCategoryRule[]>([]);
  const [disclosures, setDisclosures] = useState<CampaignDisclosure[]>([]);
  const [proof, setProof] = useState<CampaignProof[]>([]);
  const [riskFlags, setRiskFlags] = useState<CampaignRiskFlag[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !user) return;
    const [cc, rules, cats] = await Promise.all([getCampaignComplianceById(id), getEnabledPlatformRules(), getCategoryRules()]);
    setCompliance(cc);
    setPlatforms(rules);
    setCategories(cats);
    if (cc) {
      const [{ disclosures, proof, riskFlags }, { data: pub }] = await Promise.all([
        getComplianceChecklist(cc.id),
        supabase.from("publishers").select("id").eq("id", cc.publisher_id).eq("user_id", user.id).maybeSingle(),
      ]);
      setDisclosures(disclosures);
      setProof(proof);
      setRiskFlags(riskFlags);
      setIsCreator(!!pub);
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

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (authLoading || compliance === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16" aria-busy="true" aria-label="Loading campaign compliance">
        <SkeletonLine className="w-1/3 h-6 mb-4" />
        <SkeletonBlock className="h-64" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/campaigns/${id}/compliance`)}`} replace />;
  if (!compliance) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16">
        <EmptyState kind="lock" title="Campaign not found" description="This campaign doesn't exist, or you don't have access to it." />
      </div>
    );
  }

  const isBusiness = compliance.business_id === user.id;
  const rule = platforms.find((p) => p.platform === compliance.platform) ?? null;

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Campaign compliance · ChatSched" description="Platform requirements and compliance status for this campaign." />

      <p className="font-mono text-[11px] font-semibold uppercase text-billboard-inkSoft mb-2">Campaign compliance</p>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <ComplianceBadge status={compliance.status} />
        <RiskBadge level={compliance.risk_level} score={compliance.risk_score} />
      </div>

      <p className="text-sm text-billboard-inkSoft mb-8">
        ChatSched helps businesses and publishers prepare campaigns for applicable platform requirements. Final publication, enforcement and
        policy decisions remain with the relevant platform.
      </p>

      {isBusiness && compliance.status === "not_started" && (
        <CampaignContextForm
          platforms={platforms}
          categories={categories}
          onSaved={(updated) => setCompliance(updated)}
          complianceId={compliance.id}
        />
      )}

      {isBusiness && compliance.status !== "not_started" && (
        <div className="mb-6">
          <p className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft">Platform &amp; category</p>
          <p className="text-sm mt-0.5">
            {rule?.display_name ?? compliance.platform} · {compliance.category}
          </p>
        </div>
      )}

      <div className="border-[3px] border-billboard-ink rounded bg-white p-4 mb-6">
        <h2 className="font-display text-sm mb-3">Checklist</h2>
        <ComplianceChecklist compliance={compliance} />
      </div>

      {isBusiness && compliance.platform && compliance.category && (
        <div className="mb-6">
          <button
            onClick={screen}
            disabled={screening}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink px-4 py-2 rounded disabled:opacity-60"
          >
            {screening ? "Screening…" : compliance.risk_level ? "Re-run compliance check" : "Run compliance check"}
          </button>
          <p className="text-[11px] text-billboard-inkSoft mt-1.5">
            An AI-assisted first pass over your campaign brief. It flags things worth a second look — it doesn't decide eligibility, and it never
            speaks for TikTok, Instagram, YouTube, or any other platform.
          </p>
          {screeningError && <p className="text-sm text-billboard-red mt-1.5">{screeningError}</p>}
        </div>
      )}

      {riskFlags.some((f) => !f.resolved) && (
        <div className="border-[3px] border-billboard-yellow rounded bg-white p-4 mb-6">
          <h2 className="font-display text-sm mb-2">⚠ Needs attention</h2>
          <ul className="text-sm space-y-1.5">
            {riskFlags.filter((f) => !f.resolved).map((f) => (
              <li key={f.id}>{f.description}</li>
            ))}
          </ul>
        </div>
      )}

      {rule && (
        <div className="mb-6">
          <h2 className="font-display text-sm mb-3">Platform requirements</h2>
          <PlatformRequirementCard rule={rule} />
        </div>
      )}

      {isCreator && rule && rule.disclosure_required && (
        <div className="mb-6">
          <DisclosureNotice
            campaignComplianceId={compliance.id}
            rule={rule}
            existingAck={disclosures[0] ?? null}
            onAcknowledged={load}
          />
        </div>
      )}

      {compliance.platform && (
        <div className="mb-6">
          <ProofSubmissionCard
            campaignComplianceId={compliance.id}
            platform={compliance.platform}
            proof={proof}
            isCreator={isCreator}
            onSubmitted={load}
          />
        </div>
      )}

      <Link to="/dashboard" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}

function CampaignContextForm({
  complianceId,
  platforms,
  categories,
  onSaved,
}: {
  complianceId: string;
  platforms: PlatformComplianceRule[];
  categories: CampaignCategoryRule[];
  onSaved: (updated: CampaignCompliance) => void;
}) {
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!platform || !category) {
      setError("Choose a platform and a category.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await setCampaignComplianceContext(complianceId, platform, category);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded bg-white p-4 mb-6">
      <h2 className="font-display text-sm mb-1">Campaign requirements</h2>
      <p className="text-xs text-billboard-inkSoft mb-3">Tell us the platform and category so we can show what's required before publishing.</p>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm">
            <option value="">Select…</option>
            {platforms.map((p) => (
              <option key={p.platform} value={p.platform}>{p.display_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm">
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>{c.category}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-billboard-red mb-2">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="font-mono text-xs font-semibold uppercase bg-billboard-ink text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {saving ? "Saving…" : "View requirements"}
      </button>
    </div>
  );
}
