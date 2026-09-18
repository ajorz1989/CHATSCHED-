import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { StatCardGridSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import ComplianceBadge from "../components/ComplianceBadge";
import RiskBadge from "../components/RiskBadge";
import { getEnabledPlatformRules, getCategoryRules, decideComplianceReview, savePlatformComplianceRule, reviewCampaignProof, getProofScreenshotUrl } from "../lib/compliance";
import type {
  ComplianceReview,
  CampaignCompliance,
  PlatformComplianceRule,
  CampaignCategoryRule,
  CategoryStatus,
  CampaignProof,
} from "../lib/complianceTypes";
import Button from "../components/Button";

/**
 * Admin's compliance centre — brief sections 15/16. Rendered as a tab
 * inside Admin.tsx rather than at a standalone /admin/compliance route,
 * matching how AdminPayouts/AdminChannelRequests/AdminSecurity already
 * work in this codebase (Admin.tsx owns the one /admin route and switches
 * on an in-page tab, not on nested routes) — reusing that pattern rather
 * than introducing a second admin routing convention.
 *
 * Every write here goes through the same RPCs the business/creator side
 * uses (set_platform_compliance_rule, decide_compliance_review) — nothing
 * bypasses recompute_campaign_compliance() or the audit log.
 */

type View = "overview" | "reviews" | "proof" | "platforms" | "categories";

interface ReviewRow extends ComplianceReview {
  campaign_compliance?: CampaignCompliance & {
    business?: { full_name: string | null; company_name: string | null } | null;
    publisher?: { name: string } | null;
  };
}

interface ProofRow extends CampaignProof {
  campaign_compliance?: CampaignCompliance & {
    business?: { full_name: string | null; company_name: string | null } | null;
    publisher?: { name: string } | null;
  };
}

export default function AdminCompliance() {
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [proofRows, setProofRows] = useState<ProofRow[]>([]);
  const [compliance, setCompliance] = useState<CampaignCompliance[]>([]);
  const [platforms, setPlatforms] = useState<PlatformComplianceRule[]>([]);
  const [categories, setCategories] = useState<CampaignCategoryRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [reviewsRes, proofRes, complianceRes, platformRules, categoryRules] = await Promise.all([
      supabase
        .from("compliance_reviews")
        .select("*, campaign_compliance(*, business:profiles!business_id(full_name, company_name), publisher:publishers!publisher_id(name))")
        .order("created_at", { ascending: false }),
      supabase
        .from("campaign_proof")
        .select("*, campaign_compliance(*, business:profiles!business_id(full_name, company_name), publisher:publishers!publisher_id(name))")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false }),
      supabase.from("campaign_compliance").select("*"),
      getEnabledPlatformRules(),
      getCategoryRules(),
    ]);
    setReviews((reviewsRes.data ?? []) as unknown as ReviewRow[]);
    setProofRows((proofRes.data ?? []) as unknown as ProofRow[]);
    setCompliance((complianceRes.data ?? []) as CampaignCompliance[]);
    setPlatforms(platformRules);
    setCategories(categoryRules);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function decide(reviewId: string, status: "in_review" | "approved" | "rejected" | "request_changes") {
    setError(null);
    try {
      await decideComplianceReview(reviewId, status);
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the review.");
    }
  }

  async function decideProof(proofId: string, status: "verified" | "rejected") {
    setError(null);
    const rejectionReason = status === "rejected" ? window.prompt("Reason for rejecting this proof (shown to the creator):") ?? undefined : undefined;
    if (status === "rejected" && rejectionReason === undefined) return; // admin cancelled the prompt
    try {
      await reviewCampaignProof(proofId, status, rejectionReason);
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update this proof submission.");
    }
  }

  async function viewScreenshot(proofId: string, path: string) {
    setViewingId(proofId);
    try {
      const url = await getProofScreenshotUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Couldn't open that screenshot — try again.");
    } finally {
      setViewingId(null);
    }
  }

  if (loading) return <StatCardGridSkeleton count={5} />;

  const pendingReviews = reviews.filter((r) => r.status === "pending" || r.status === "in_review");
  const highRisk = compliance.filter((c) => c.risk_level === "high");
  const restrictedCount = compliance.filter((c) => c.status === "not_eligible").length;
  const disclosureIssues = compliance.filter((c) => c.disclosure_identified && !c.creator_accepted).length;

  const views: [View, string][] = [
    ["overview", "Overview"],
    ["reviews", `Review queue (${pendingReviews.length})`],
    ["proof", `Proof (${proofRows.length})`],
    ["platforms", "Platform rules"],
    ["categories", "Categories"],
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {views.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`font-mono text-[11px] font-semibold uppercase px-3 py-1.5 rounded-full border-2 ${
              view === key ? "bg-billboard-ink text-white border-billboard-ink" : "border-billboard-inkSoft text-billboard-inkSoft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}

      {view === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Pending reviews" value={pendingReviews.length} accent={pendingReviews.length > 0} onClick={() => setView("reviews")} />
          <StatBlock label="Proof to review" value={proofRows.length} accent={proofRows.length > 0} onClick={() => setView("proof")} />
          <StatBlock label="High risk campaigns" value={highRisk.length} accent={highRisk.length > 0} />
          <StatBlock label="Not eligible" value={restrictedCount} />
          <StatBlock label="Disclosure issues" value={disclosureIssues} accent={disclosureIssues > 0} />
        </div>
      )}

      {view === "reviews" && (
        pendingReviews.length === 0 ? (
          <EmptyState kind="list" title="No reviews pending" compact />
        ) : (
          <div className="space-y-3">
            {pendingReviews.map((r) => (
              <div key={r.id} className="border-[3px] border-billboard-ink rounded p-4 bg-white">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {r.campaign_compliance && <ComplianceBadge status={r.campaign_compliance.status} />}
                  {r.campaign_compliance && <RiskBadge level={r.campaign_compliance.risk_level} score={r.campaign_compliance.risk_score} />}
                  <span className="font-mono text-[10px] text-billboard-inkSoft">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm">
                  <strong>{r.campaign_compliance?.business?.company_name || r.campaign_compliance?.business?.full_name || "Business"}</strong>
                  {" × "}
                  <strong>{r.campaign_compliance?.publisher?.name || "Publisher"}</strong>
                  {r.campaign_compliance?.platform && ` · ${r.campaign_compliance.platform}`}
                  {r.campaign_compliance?.category && ` · ${r.campaign_compliance.category}`}
                </p>
                {r.flagged_reasons.length > 0 && (
                  <ul className="text-xs text-billboard-inkSoft mt-1.5 space-y-0.5">
                    {r.flagged_reasons.map((f, i) => <li key={i}>⚑ {f}</li>)}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => decide(r.id, "approved")} className="font-mono text-[11px] font-semibold uppercase bg-billboard-green text-white px-3 py-1.5 rounded">Approve</button>
                  <button onClick={() => decide(r.id, "request_changes")} className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink px-3 py-1.5 rounded">Request changes</button>
                  <button onClick={() => decide(r.id, "rejected")} className="font-mono text-[11px] font-semibold uppercase bg-billboard-red text-white px-3 py-1.5 rounded">Reject</button>
                  {r.status === "pending" && (
                    <button onClick={() => decide(r.id, "in_review")} className="font-mono text-[11px] font-semibold uppercase text-billboard-inkSoft px-3 py-1.5">Start review</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {view === "proof" && (
        proofRows.length === 0 ? (
          <EmptyState kind="list" title="No proof waiting on review" compact />
        ) : (
          <div className="space-y-3">
            {proofRows.map((p) => (
              <div key={p.id} className="border-[3px] border-billboard-ink rounded p-4 bg-white">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border border-billboard-ink">{p.platform}</span>
                  <span className="font-mono text-[10px] text-billboard-inkSoft">{new Date(p.created_at).toLocaleDateString()}</span>
                  {p.disclosure_confirmed && <span className="font-mono text-[10px] text-billboard-greenDeep">Disclosure confirmed by creator</span>}
                </div>
                <p className="text-sm mb-1">
                  <strong>{p.campaign_compliance?.business?.company_name || p.campaign_compliance?.business?.full_name || "Business"}</strong>
                  {" × "}
                  <strong>{p.campaign_compliance?.publisher?.name || "Publisher"}</strong>
                </p>
                {p.post_url && (
                  <a href={p.post_url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-billboard-greenDeep underline break-all block">
                    {p.post_url}
                  </a>
                )}
                {p.notes && <p className="text-xs text-billboard-inkSoft mt-1">{p.notes}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {p.screenshot_path && (
                    <button
                      onClick={() => viewScreenshot(p.id, p.screenshot_path!)}
                      disabled={viewingId === p.id}
                      className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink px-3 py-1.5 rounded disabled:opacity-60"
                    >
                      {viewingId === p.id ? "Opening…" : "View screenshot"}
                    </button>
                  )}
                  <button onClick={() => decideProof(p.id, "verified")} className="font-mono text-[11px] font-semibold uppercase bg-billboard-green text-white px-3 py-1.5 rounded">Verify</button>
                  <button onClick={() => decideProof(p.id, "rejected")} className="font-mono text-[11px] font-semibold uppercase bg-billboard-red text-white px-3 py-1.5 rounded">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {view === "platforms" && <PlatformRulesEditor platforms={platforms} onSaved={loadAll} />}
      {view === "categories" && <CategoryRulesEditor categories={categories} onSaved={loadAll} />}
    </div>
  );
}

function StatBlock({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`text-left border-[3px] rounded p-4 ${accent ? "border-billboard-yellow bg-[#FFF9E6]" : "border-billboard-ink bg-white"}`}>
      <div className="font-display text-2xl">{value}</div>
      <div className="font-mono text-[10px] uppercase text-billboard-inkSoft mt-1">{label}</div>
    </Tag>
  );
}

export function arrToText(arr: string[]): string { return arr.join("\n"); }
export function textToArr(text: string): string[] { return text.split("\n").map((l) => l.trim()).filter(Boolean); }

function PlatformRulesEditor({ platforms, onSaved }: { platforms: PlatformComplianceRule[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {platforms.map((p) => (
        <div key={p.platform} className="border-[3px] border-billboard-ink rounded p-4 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-display text-sm">{p.display_name}</p>
              <p className="text-[11px] text-billboard-inkSoft">
                v{p.version} · {p.disclosure_required ? "Disclosure required" : "No disclosure flagged"}
                {p.last_reviewed_at && ` · reviewed ${new Date(p.last_reviewed_at).toLocaleDateString()}`}
              </p>
            </div>
            <button
              onClick={() => setEditing(editing === p.platform ? null : p.platform)}
              className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink px-3 py-1.5 rounded"
            >
              {editing === p.platform ? "Close" : "Edit"}
            </button>
          </div>
          {editing === p.platform && (
            <PlatformRuleForm
              rule={p}
              onDone={() => { setEditing(null); onSaved(); }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PlatformRuleForm({ rule, onDone }: { rule: PlatformComplianceRule; onDone: () => void }) {
  const [displayName, setDisplayName] = useState(rule.display_name);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [disclosureRequired, setDisclosureRequired] = useState(rule.disclosure_required);
  const [creatorActions, setCreatorActions] = useState(arrToText(rule.required_creator_actions));
  const [businessActions, setBusinessActions] = useState(arrToText(rule.required_business_actions));
  const [requiredProof, setRequiredProof] = useState(arrToText(rule.required_proof));
  const [contentRestrictions, setContentRestrictions] = useState(arrToText(rule.content_restrictions));
  const [notes, setNotes] = useState(rule.notes ?? "");
  const [policyReference, setPolicyReference] = useState(rule.policy_reference ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await savePlatformComplianceRule({
        platform: rule.platform,
        display_name: displayName,
        enabled,
        disclosure_required: disclosureRequired,
        content_restrictions: textToArr(contentRestrictions),
        prohibited_categories: rule.prohibited_categories,
        restricted_categories: rule.restricted_categories,
        required_creator_actions: textToArr(creatorActions),
        required_business_actions: textToArr(businessActions),
        required_proof: textToArr(requiredProof),
        notes: notes || null,
        policy_reference: policyReference || null,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-billboard-paperDim space-y-2.5">
      <div className="grid sm:grid-cols-2 gap-2.5">
        <div>
          <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={disclosureRequired} onChange={(e) => setDisclosureRequired(e.target.checked)} /> Disclosure required</label>
        </div>
      </div>
      <div>
        <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Creator actions (one per line)</label>
        <textarea value={creatorActions} onChange={(e) => setCreatorActions(e.target.value)} rows={2} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
      </div>
      <div>
        <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Business actions (one per line)</label>
        <textarea value={businessActions} onChange={(e) => setBusinessActions(e.target.value)} rows={2} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
      </div>
      <div>
        <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Required proof (one per line)</label>
        <textarea value={requiredProof} onChange={(e) => setRequiredProof(e.target.value)} rows={1} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
      </div>
      <div>
        <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Content restrictions (one per line)</label>
        <textarea value={contentRestrictions} onChange={(e) => setContentRestrictions(e.target.value)} rows={1} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <div>
          <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Policy reference (URL/note)</label>
          <input value={policyReference} onChange={(e) => setPolicyReference(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft block mb-1">Internal notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-billboard-red">{error}</p>}
      <Button onClick={save} disabled={saving} variant="dark" size="md">
        {saving ? "Saving…" : "Save (bumps version)"}
      </Button>
    </div>
  );
}

const CATEGORY_STATUS_OPTIONS: CategoryStatus[] = ["allowed", "restricted", "manual_review", "not_accepted"];

function CategoryRulesEditor({ categories, onSaved }: { categories: CampaignCategoryRule[]; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  async function setStatus(category: string, status: CategoryStatus) {
    setError(null);
    const { error } = await supabase.from("campaign_category_rules").update({ chatsched_status: status }).eq("category", category);
    if (error) setError(formatSupabaseError(error, "Couldn't update category status"));
    else onSaved();
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    setError(null);
    const { error } = await supabase.from("campaign_category_rules").insert({ category: newCategory.trim(), chatsched_status: "manual_review" });
    if (error) setError(formatSupabaseError(error, "Couldn't add category"));
    else { setNewCategory(""); onSaved(); }
  }

  return (
    <div>
      {error && <p className="text-billboard-red text-xs font-semibold mb-3">{error}</p>}
      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.category} className="flex items-center justify-between gap-3 border-2 border-billboard-ink rounded px-3 py-2 bg-white">
            <span className="text-sm font-semibold">{c.category}</span>
            <select
              value={c.chatsched_status}
              onChange={(e) => setStatus(c.category, e.target.value as CategoryStatus)}
              className="font-mono text-[11px] uppercase border-2 border-billboard-ink rounded px-2 py-1"
            >
              {CATEGORY_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="New category name"
          className="border-2 border-billboard-ink rounded px-3 py-2 text-sm flex-1"
        />
        <Button onClick={addCategory} variant="outline" size="md">Add</Button>
      </div>
    </div>
  );
}
