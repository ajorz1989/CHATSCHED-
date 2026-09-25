import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";
import { SkeletonBlock } from "../components/Skeleton";
import SubscriptionGateNotice from "../components/SubscriptionGateNotice";
import { hasUsableBusinessSubscription } from "../lib/subscriptionGate";
import type { ChannelSlug } from "../lib/channelTypes";
import BundleSuggestion from "../components/BundleSuggestion";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import type { Opportunity, OpportunityApplication, OpportunityStatus, OpportunityType } from "../lib/types";

const CHANNEL_LABEL: Record<ChannelSlug, string> = {
  "social-media": "Social Media",
  influencer: "Influencer",
  website: "Website",
  podcast: "Podcast",
  radio: "Radio",
  sports: "Sports",
  events: "Events",
  community: "Community",
  transport: "Transport",
  "informal-retail": "Informal Retail",
  associations: "Associations",
  restaurants: "Restaurants",
  "in-venue-screens": "In-Venue Screens",
};

const PROVINCES = [
  "Western Cape",
  "Gauteng",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
];

const FALLBACK_TYPES: OpportunityType[] = [
  { slug: "social-media-promotion", label: "Social Media Promotion", description: "Commission verified social promotion.", suggested_channel_slug: "social-media" },
  { slug: "influencer-product-placement", label: "Influencer Product Placement", description: "Put your product into creator content.", suggested_channel_slug: "influencer" },
  { slug: "website-advertising", label: "Website Advertising", description: "Reach an audience through a website placement.", suggested_channel_slug: "website" },
  { slug: "newsletter-sponsorship", label: "Newsletter Sponsorship", description: "Sponsor a newsletter or subscriber communication.", suggested_channel_slug: "website" },
  { slug: "event-sponsorship", label: "Event Sponsorship", description: "Sponsor an event, activation or gathering.", suggested_channel_slug: "events" },
  { slug: "school-partnership", label: "School Partnership", description: "Sponsor a school or education audience.", suggested_channel_slug: "events" },
  { slug: "sports-sponsorship", label: "Sports Sponsorship", description: "Sponsor a sports audience, club or tournament.", suggested_channel_slug: "sports" },
  { slug: "radio-podcast-spot", label: "Radio / Podcast Spot", description: "Book a radio or podcast opportunity.", suggested_channel_slug: "radio" },
  { slug: "community-sponsorship", label: "Community Sponsorship", description: "Support a local community audience or initiative.", suggested_channel_slug: "community" },
  { slug: "in-venue-screen-display", label: "In-Venue Screen Display", description: "Advertise on an in-venue screen.", suggested_channel_slug: "in-venue-screens" },
  { slug: "restaurant-promotion", label: "Restaurant Promotion", description: "Reach diners through restaurant inventory.", suggested_channel_slug: "restaurants" },
  { slug: "transport-advertising", label: "Transport Advertising", description: "Advertise through transport inventory.", suggested_channel_slug: "transport" },
  { slug: "association-sponsorship", label: "Association Sponsorship", description: "Reach a member or professional audience.", suggested_channel_slug: "associations" },
  { slug: "retail-promotion", label: "Retail Promotion", description: "Promote a product through retail-facing inventory.", suggested_channel_slug: "informal-retail" },
  { slug: "brand-partnership", label: "Brand Partnership", description: "Create a broader sponsored partnership.", suggested_channel_slug: null },
];

const STATUS_LABEL: Record<OpportunityStatus, string> = {
  draft: "Draft",
  open: "Open",
  filled: "Filled",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<OpportunityStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-400",
  open: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  filled: "bg-billboard-green text-white border-billboard-greenDeep",
  closed: "bg-gray-100 text-gray-600 border-gray-400",
  cancelled: "bg-gray-100 text-gray-400 border-gray-300",
};

interface ApplicationRow extends OpportunityApplication {
  publisherName: string;
  publisherChannelSlug: ChannelSlug;
}

function formatR(n: number | null): string {
  return n === null ? "—" : formatCurrencyShared(n);
}

function toLocalInputValue(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default function BusinessOpportunities() {
  const { user, profile } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunityTypes, setOpportunityTypes] = useState<OpportunityType[]>([]);
  const [applicationsByOpp, setApplicationsByOpp] = useState<Record<string, ApplicationRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [channelSlug, setChannelSlug] = useState<ChannelSlug | "">("");
  const [opportunityType, setOpportunityType] = useState("");
  const [targetProvince, setTargetProvince] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [publishersNeeded, setPublishersNeeded] = useState("1");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [campaignStartAt, setCampaignStartAt] = useState("");
  const [campaignEndAt, setCampaignEndAt] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [publisherRequirements, setPublisherRequirements] = useState("");
  const [matchKeywords, setMatchKeywords] = useState("");
  const [saveStatus, setSaveStatus] = useState<"draft" | "open">("open");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const typeOptions = opportunityTypes.length > 0 ? opportunityTypes : FALLBACK_TYPES;
  const typeMap = useMemo(() => new Map(typeOptions.map((t) => [t.slug, t])), [typeOptions]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const query = supabase.from("opportunities").select("*").order("created_at", { ascending: false });
    if (!isAdmin) query.eq("business_id", user.id);
    const [{ data: oppData }, { data: typeData }] = await Promise.all([
      query,
      supabase.from("opportunity_types").select("slug,label,description,suggested_channel_slug").eq("active", true).order("sort_order", { ascending: true }),
    ]);
    setOpportunities((oppData ?? []) as Opportunity[]);
    setOpportunityTypes((typeData ?? []) as OpportunityType[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (isAdmin) setSubscribed(true);
    else if (user) hasUsableBusinessSubscription(user.id).then(setSubscribed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  async function loadApplications(opportunityId: string) {
    const { data, error } = (await supabase
      .from("opportunity_applications")
      .select("*, publisher:publishers!publisher_id(name, channel_slug)")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })) as any;

    if (error) {
      setActionError(formatSupabaseError(error, "Couldn't load applications"));
      return;
    }

    setApplicationsByOpp((prev) => ({
      ...prev,
      [opportunityId]: (data ?? []).map((r: any) => ({
        ...r,
        publisherName: r.publisher?.name ?? "Unknown publisher",
        publisherChannelSlug: r.publisher?.channel_slug,
      })),
    }));
  }

  function resetForm() {
    setTitle("");
    setBrief("");
    setChannelSlug("");
    setOpportunityType("");
    setTargetProvince("");
    setTargetCity("");
    setTargetAudience("");
    setBudgetMin("");
    setBudgetMax("");
    setPublishersNeeded("1");
    setApplicationDeadline("");
    setCampaignStartAt("");
    setCampaignEndAt("");
    setDeliverables("");
    setPublisherRequirements("");
    setMatchKeywords("");
    setSaveStatus("open");
    setEditingId(null);
  }

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!applicationsByOpp[id]) loadApplications(id);
  }

  function validateForm() {
    const min = budgetMin ? Number(budgetMin) : null;
    const max = budgetMax ? Number(budgetMax) : null;
    const needed = publishersNeeded ? Number(publishersNeeded) : 1;
    const deadline = fromLocalInputValue(applicationDeadline);
    const start = fromLocalInputValue(campaignStartAt);
    const end = fromLocalInputValue(campaignEndAt);

    if (min !== null && (!Number.isFinite(min) || min < 0)) return "Budget minimum must be a valid non-negative amount.";
    if (max !== null && (!Number.isFinite(max) || max < 0)) return "Budget maximum must be a valid non-negative amount.";
    if (min !== null && max !== null && min > max) return "Budget minimum cannot be higher than budget maximum.";
    if (!Number.isInteger(needed) || needed < 1) return "Publishers needed must be at least 1.";
    if (applicationDeadline && !deadline) return "Enter a valid application deadline.";
    if (campaignStartAt && !start) return "Enter a valid campaign start date.";
    if (campaignEndAt && !end) return "Enter a valid campaign end date.";
    if (start && end && new Date(start) > new Date(end)) return "Campaign end must be after campaign start.";
    if (deadline && start && new Date(deadline) > new Date(start)) return "Application deadline should be before the campaign starts.";
    return null;
  }

  async function saveOpportunity(status: "draft" | "open") {
    if (!user || !title.trim() || !brief.trim()) return;
    const validation = validateForm();
    if (validation) {
      setPostError(validation);
      return;
    }

    setPosting(true);
    setPostError(null);
    setSuccess(null);

    const deadline = fromLocalInputValue(applicationDeadline);
    const payload = {
      title: title.trim(),
      brief: brief.trim(),
      opportunity_type: opportunityType || null,
      target_province: targetProvince || null,
      target_city: targetCity.trim() || null,
      target_audience: targetAudience.trim() || null,
      channel_slug: channelSlug || null,
      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,
      publishers_needed: publishersNeeded ? Number(publishersNeeded) : 1,
      application_deadline: deadline,
      expires_at: deadline,
      campaign_start_at: fromLocalInputValue(campaignStartAt),
      campaign_end_at: fromLocalInputValue(campaignEndAt),
      deliverables: deliverables.trim() || null,
      publisher_requirements: publisherRequirements.trim() || null,
      match_keywords: matchKeywords.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean).slice(0, 30),
      status,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("opportunities").update(payload).eq("id", editingId).match(isAdmin ? {} : { business_id: user.id })
      : await supabase.from("opportunities").insert({ business_id: user.id, ...payload });

    setPosting(false);

    if (result.error) {
      setPostError(formatSupabaseError(result.error, "Couldn't save this opportunity"));
      return;
    }

    setSuccess(status === "open" ? "Opportunity published. Matching verified publishers can now see it." : "Opportunity saved as a draft.");
    resetForm();
    setShowForm(false);
    await load();
  }

  async function publishDraft(o: Opportunity) {
    setActionError(null);
    const { data, error } = await supabase.rpc("publish_opportunity", { p_opportunity_id: o.id });
    if (error || !data?.ok) {
      setActionError(formatSupabaseError(error, data?.error ?? "Couldn't publish the draft"));
      return;
    }
    setSuccess("Draft published. Matching verified publishers can now apply.");
    await load();
  }

  function editOpportunity(o: Opportunity) {
    setEditingId(o.id);
    setShowForm(true);
    setSuccess(null);
    setTitle(o.title);
    setBrief(o.brief);
    setOpportunityType(o.opportunity_type ?? "");
    setTargetProvince(o.target_province ?? "");
    setTargetCity(o.target_city ?? "");
    setTargetAudience(o.target_audience ?? "");
    setChannelSlug(o.channel_slug ?? "");
    setBudgetMin(o.budget_min?.toString() ?? "");
    setBudgetMax(o.budget_max?.toString() ?? "");
    setPublishersNeeded(String(o.publishers_needed));
    setApplicationDeadline(toLocalInputValue(o.application_deadline ?? o.expires_at));
    setCampaignStartAt(toLocalInputValue(o.campaign_start_at));
    setCampaignEndAt(toLocalInputValue(o.campaign_end_at));
    setDeliverables(o.deliverables ?? "");
    setPublisherRequirements(o.publisher_requirements ?? "");
    setMatchKeywords((o.match_keywords ?? []).join(", "));
    setSaveStatus(o.status === "draft" ? "draft" : "open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function closeOpportunity(id: string) {
    setActionError(null);
    const { error } = await supabase.from("opportunities").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      setActionError(formatSupabaseError(error, "Couldn't close opportunity"));
      return;
    }
    await load();
  }

  async function decide(application: ApplicationRow, opportunity: Opportunity, decision: "accepted" | "declined") {
    setActionError(null);
    setSuccess(null);
    setDecidingId(application.id);

    if (decision === "accepted") {
      const { data, error: rpcError } = await supabase.rpc("accept_opportunity_application", { p_application_id: application.id });
      if (rpcError || !data?.ok) {
        setActionError(formatSupabaseError(rpcError, data?.error ?? "Couldn't accept that application"));
        setDecidingId(null);
        return;
      }
      setSuccess("Application accepted and moved into the normal ChatSched booking workflow.");
    } else {
      const { error: err } = await supabase.from("opportunity_applications").update({ status: "declined" }).eq("id", application.id);
      if (err) {
        setActionError(formatSupabaseError(err, "Couldn't decline that application"));
        setDecidingId(null);
        return;
      }
      setSuccess("Application declined.");
    }

    await loadApplications(opportunity.id);
    await load();
    setDecidingId(null);
  }

  if (loading) return <SkeletonBlock className="h-64" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Seo title="Business Opportunities — ChatSched" description="Post targeted advertising and sponsorship opportunities and receive proposals from verified ChatSched publishers." />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Business Opportunities Engine</span>
          <h1 className="font-display text-3xl md:text-4xl mt-1">Turn an advertising need into a live brief.</h1>
          <p className="text-sm text-billboard-inkSoft mt-2 max-w-2xl">Define the channel, audience, timing, budget and deliverables. ChatSched then puts the brief in front of eligible publishers without exposing private contact details.</p>
        </div>
        {subscribed !== false && (
          <button
            type="button"
            onClick={() => {
              setShowForm((s) => !s);
              if (!showForm) { resetForm(); setPostError(null); setSuccess(null); }
            }}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2.5 bg-billboard-yellow hover:-translate-y-0.5 transition shrink-0"
          >
            {showForm ? "Close editor" : "+ Create opportunity"}
          </button>
        )}
      </div>

      {subscribed === false && <SubscriptionGateNotice role="business" />}
      {success && <div className="border-2 border-billboard-green bg-billboard-green/10 text-billboard-greenDeep rounded-lg p-3 text-sm mb-5" role="status">{success}</div>}
      {actionError && <div className="border-2 border-billboard-red bg-billboard-red/5 text-billboard-red rounded-lg p-3 text-sm mb-5" role="alert">{actionError}</div>}

      {showForm && (
        <section className="border-[3px] border-billboard-ink rounded-xl bg-white shadow-blockSm p-5 mb-6" aria-label="Opportunity editor">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">{editingId ? "Edit opportunity" : "New opportunity"}</span>
              <h2 className="font-display text-2xl mt-1">{editingId ? "Refine the brief" : "Build your advertising brief"}</h2>
              <p className="text-xs text-billboard-inkSoft mt-1">Drafts stay private. Published briefs become discoverable to verified, active publishers who match the targeting.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Opportunity title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sponsor a Cape Town fitness audience" className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm" />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Brief</label>
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Describe what you need, why it matters, what the publisher should understand before applying, and any important campaign context." rows={5} className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm" />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Opportunity type</label>
                <select value={opportunityType} onChange={(e) => setOpportunityType(e.target.value)} className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Choose a type</option>
                  {typeOptions.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
                </select>
                {opportunityType && <p className="text-[11px] text-billboard-inkSoft mt-1">{typeMap.get(opportunityType)?.description}</p>}
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Preferred channel</label>
                <select value={channelSlug} onChange={(e) => setChannelSlug(e.target.value as ChannelSlug | "")} className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Open to any channel</option>
                  {(Object.keys(CHANNEL_LABEL) as ChannelSlug[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              </div>
            </div>

            <div className="border-2 border-billboard-ink/15 rounded-xl bg-billboard-paperDim p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider mb-3">Targeting</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select value={targetProvince} onChange={(e) => setTargetProvince(e.target.value)} className="border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Any province</option>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
                <input value={targetCity} onChange={(e) => setTargetCity(e.target.value)} placeholder="Target city" className="border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
                <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Target audience" className="border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
                <input value={matchKeywords} onChange={(e) => setMatchKeywords(e.target.value)} placeholder="Match keywords, comma-separated" className="border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="border-2 border-billboard-ink/15 rounded-xl p-4 bg-billboard-paperDim">
                <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Budget minimum</label>
                <input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} type="number" min={0} placeholder="R" className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
              </div>
              <div className="border-2 border-billboard-ink/15 rounded-xl p-4 bg-billboard-paperDim">
                <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Budget maximum</label>
                <input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} type="number" min={0} placeholder="R" className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
              </div>
              <div className="border-2 border-billboard-ink/15 rounded-xl p-4 bg-billboard-paperDim">
                <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Publishers needed</label>
                <input value={publishersNeeded} onChange={(e) => setPublishersNeeded(e.target.value)} type="number" min={1} step={1} className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
              </div>
            </div>

            <div className="border-2 border-billboard-ink/15 rounded-xl bg-billboard-paperDim p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider mb-3">Timing</div>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Application deadline</label>
                  <input value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} type="datetime-local" className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
                  <p className="text-[10px] text-billboard-inkSoft mt-1">The brief automatically closes when this deadline is reached.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Campaign starts</label>
                  <input value={campaignStartAt} onChange={(e) => setCampaignStartAt(e.target.value)} type="datetime-local" className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Campaign ends</label>
                  <input value={campaignEndAt} onChange={(e) => setCampaignEndAt(e.target.value)} type="datetime-local" className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm bg-white" />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Expected deliverables</label>
                <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="e.g. 2 feed posts, 3 stories, one podcast mention, proof screenshots" rows={4} className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider mb-1.5">Publisher requirements</label>
                <textarea value={publisherRequirements} onChange={(e) => setPublisherRequirements(e.target.value)} placeholder="e.g. verified Cape Town audience, 10K+ followers, fitness category" rows={4} className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2.5 text-sm" />
              </div>
            </div>

            <BundleSuggestion channelSlug={channelSlug} />
            {postError && <p className="text-billboard-red text-xs font-semibold" role="alert">{postError}</p>}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {editingId && saveStatus === "draft" ? (
                <>
                  <button type="button" onClick={() => saveOpportunity("draft")} disabled={posting || !title.trim() || !brief.trim()} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2.5 bg-billboard-paperDim disabled:opacity-50">{posting ? "Saving…" : "Save draft"}</button>
                  <button type="button" onClick={() => saveOpportunity("open")} disabled={posting || !title.trim() || !brief.trim()} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2.5 bg-billboard-yellow disabled:opacity-50">Publish</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => saveOpportunity(saveStatus)} disabled={posting || !title.trim() || !brief.trim()} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2.5 bg-billboard-yellow disabled:opacity-50">{posting ? "Saving…" : editingId ? "Save changes" : "Publish opportunity"}</button>
                  {!editingId && <button type="button" onClick={() => saveOpportunity("draft")} disabled={posting || !title.trim() || !brief.trim()} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2.5 bg-white disabled:opacity-50">Save draft</button>}
                </>
              )}
              <button type="button" onClick={() => { resetForm(); setShowForm(false); setPostError(null); }} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2.5">Cancel</button>
            </div>
          </div>
        </section>
      )}

      {opportunities.length === 0 ? (
        <EmptyState kind="list" title="No opportunities posted yet" description="Create a draft to prepare your next brief, or publish one for verified publishers to discover." compact />
      ) : (
        <div className="space-y-4">
          {opportunities.map((o) => {
            const apps = applicationsByOpp[o.id] ?? [];
            const loaded = applicationsByOpp[o.id] !== undefined;
            const pendingCount = apps.filter((a) => a.status === "pending").length;
            const acceptedCount = apps.filter((a) => a.status === "accepted").length;
            const deadline = formatDate(o.application_deadline ?? o.expires_at);
            const type = typeMap.get(o.opportunity_type ?? "");

            return (
              <article key={o.id} className="border-[3px] border-billboard-ink rounded-xl bg-white shadow-blockSm overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">{type?.label ?? "Advertising opportunity"}</span>
                        <span className={"font-mono text-[10px] font-semibold uppercase border-2 rounded-full px-2 py-0.5 " + STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</span>
                      </div>
                      <h2 className="font-display text-xl mb-1">{o.title}</h2>
                      <p className="text-sm text-billboard-inkSoft whitespace-pre-wrap">{o.brief}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[9px] uppercase text-billboard-inkSoft">Budget</div>
                      <div className="font-display text-lg">{o.budget_min != null || o.budget_max != null ? formatR(o.budget_min) + " – " + formatR(o.budget_max) : "Open budget"}</div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4 text-xs">
                    <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Channel</div><div>{o.channel_slug ? CHANNEL_LABEL[o.channel_slug] : "Open to any channel"}</div></div>
                    <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Target</div><div>{[o.target_city, o.target_province].filter(Boolean).join(", ") || "Flexible geography"}</div></div>
                    <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Publishers</div><div>{o.publishers_needed} needed{loaded && o.publishers_needed > 1 ? " · " + acceptedCount + " accepted" : ""}</div></div>
                    <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Deadline</div><div>{deadline ?? "No deadline"}</div></div>
                  </div>

                  {o.target_audience && <p className="text-xs mt-3"><span className="font-semibold">Audience:</span> {o.target_audience}</p>}
                  {o.deliverables && <p className="text-xs mt-2"><span className="font-semibold">Deliverables:</span> {o.deliverables}</p>}
                  {o.publisher_requirements && <p className="text-xs mt-2"><span className="font-semibold">Requirements:</span> {o.publisher_requirements}</p>}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => toggleExpand(o.id)} className="text-xs font-semibold underline">
                      {expanded === o.id ? "Hide applications" : "View applications" + (pendingCount ? " (" + pendingCount + " pending)" : "")}
                    </button>
                    {o.status === "draft" && <button type="button" onClick={() => publishDraft(o)} className="text-xs font-semibold underline">Publish draft</button>}
                    {(o.status === "open" || o.status === "draft") && <button type="button" onClick={() => editOpportunity(o)} className="text-xs font-semibold underline">Edit</button>}
                    {o.status === "open" && <button type="button" onClick={() => closeOpportunity(o.id)} className="text-xs font-semibold underline text-billboard-inkSoft">Close posting</button>}
                  </div>
                </div>

                {expanded === o.id && (
                  <div className="border-t-[3px] border-billboard-ink bg-billboard-paperDim p-5">
                    {apps.length === 0 ? (
                      <p className="text-sm text-billboard-inkSoft">No applications yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {apps.map((a) => (
                          <div key={a.id} className="border-2 border-billboard-ink rounded-lg bg-white p-4">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Link to={"/browse/" + a.publisher_id} className="text-sm font-semibold underline">{a.publisherName}</Link>
                              {a.publisherChannelSlug && <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">{CHANNEL_LABEL[a.publisherChannelSlug]}</span>}
                              <span className="font-mono text-[10px] uppercase ml-auto text-billboard-inkSoft">{a.status}</span>
                            </div>
                            {a.advertising_method && <p className="text-xs font-semibold mb-1">{a.advertising_method}</p>}
                            <p className="text-sm whitespace-pre-wrap">{a.message}</p>
                            {a.proposed_amount != null && <p className="font-display text-lg mt-2">{formatCurrencyShared(a.proposed_amount)}</p>}
                            {a.status === "pending" && (
                              <div className="flex gap-2 mt-3">
                                <button type="button" onClick={() => decide(a, o, "accepted")} disabled={decidingId === a.id} className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded-lg px-3 py-1.5 bg-billboard-green text-white disabled:opacity-50">{decidingId === a.id ? "Working…" : "Accept & create booking"}</button>
                                <button type="button" onClick={() => decide(a, o, "declined")} disabled={decidingId === a.id} className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded-lg px-3 py-1.5 bg-white disabled:opacity-50">Decline</button>
                              </div>
                            )}
                            {a.status === "accepted" && <p className="text-xs mt-3 p-3 rounded-lg bg-billboard-green/10 border border-billboard-green/30">Accepted. The resulting booking continues through ChatSched's normal messaging, payment and campaign workflow.</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
