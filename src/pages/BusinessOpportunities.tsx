import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";
import { SkeletonBlock } from "../components/Skeleton";
import SubscriptionGateNotice from "../components/SubscriptionGateNotice";
import { hasUsableBusinessSubscription } from "../lib/subscriptionGate";
import type { ChannelSlug } from "../lib/channelTypes";
import BundleSuggestion from "../components/BundleSuggestion";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import type { Opportunity, OpportunityApplication, OpportunityStatus } from "../lib/types";

/**
 * Reverse marketplace, business side — post what you need instead of
 * picking a publisher up front; publishers apply, you accept one.
 *
 * Accepting converts the application into an ordinary requests/
 * channel_requests row, the same insert Run Again uses
 * (BusinessPublisherRelationships.tsx, schema_phase67) — see
 * schema_phase68_opportunity_marketplace.sql's header for why this
 * doesn't invent a third booking table. Everything else about that
 * booking (compliance, deliverables, messaging, payment) is completely
 * normal from that point on.
 */

const CHANNEL_LABEL: Record<ChannelSlug, string> = {
  "social-media": "Social Media",
  influencer: "Influencer",
  website: "Website",
  podcast: "Podcast",
  radio: "Radio",
  // All 12 channels are postable as of schema_phase80 — was scoped to
  // just these first 5 at the DB level before that migration widened
  // opportunities.channel_slug from a hardcoded CHECK to a real FK
  // against channels(slug). The posting form's <select> below, the
  // accept-on-application logic further down, and OpportunityFeed.tsx's
  // own channel-match filter were all already written generically ahead
  // of that migration — only the DB constraint was ever the blocker.
  sports: "Sports",
  events: "Events",
  community: "Community",
  transport: "Transport",
  "informal-retail": "Informal Retail",
  associations: "Associations",
  restaurants: "Restaurants",
  "in-venue-screens": "In-Venue Screens",
};

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

export default function BusinessOpportunities() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applicationsByOpp, setApplicationsByOpp] = useState<Record<string, ApplicationRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [channelSlug, setChannelSlug] = useState<ChannelSlug | "">("");
  // Phase 81 (Business Value Proposition & Opportunities Engine) —
  // structured targeting fields, additive to channel_slug above.
  const [opportunityType, setOpportunityType] = useState("");
  const [targetProvince, setTargetProvince] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [publishersNeeded, setPublishersNeeded] = useState("1");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("opportunities")
      .select("*")
      .eq("business_id", user.id)
      .order("created_at", { ascending: false });
    setOpportunities((data as Opportunity[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (user) hasUsableBusinessSubscription(user.id).then(setSubscribed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadApplications(opportunityId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = (await supabase
      .from("opportunity_applications")
      .select("*, publisher:publishers!publisher_id(name, channel_slug)")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })) as any;
    setApplicationsByOpp((prev) => ({
      ...prev,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [opportunityId]: (data ?? []).map((r: any) => ({
        ...r,
        publisherName: r.publisher?.name ?? "Unknown publisher",
        publisherChannelSlug: r.publisher?.channel_slug,
      })),
    }));
  }

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!applicationsByOpp[id]) loadApplications(id);
  }

  async function postOpportunity() {
    if (!user || !title.trim() || !brief.trim()) return;
    setPosting(true);
    setPostError(null);
    const payload = {
      title: title.trim(),
      brief: brief.trim(),
      opportunity_type: opportunityType || null,
      target_province: targetProvince || null,
      target_city: targetCity || null,
      target_audience: targetAudience || null,
      channel_slug: channelSlug || null,
      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,
      publishers_needed: publishersNeeded ? Number(publishersNeeded) : 1,
    };
    const { error: err } = editingId
      ? await supabase.from("opportunities").update({ ...payload, status: "open", updated_at: new Date().toISOString() }).eq("id", editingId).eq("business_id", user.id)
      : await supabase.from("opportunities").insert({
          business_id: user.id,
          ...payload,
          status: "open",
        });
    setPosting(false);
    if (err) {
      setPostError("Couldn't post that — check the budget range (min can't be above max) and try again.");
      return;
    }
    setTitle("");
    setBrief("");
    setEditingId(null);
    setPublishersNeeded("1");
    setChannelSlug("");
    setOpportunityType(""); setTargetProvince(""); setTargetCity(""); setTargetAudience("");
    setBudgetMin("");
    setBudgetMax("");
    setShowForm(false);
    load();
  }

  function editOpportunity(o: Opportunity) {
    setEditingId(o.id); setShowForm(true); setTitle(o.title); setBrief(o.brief); setOpportunityType(o.opportunity_type ?? "");
    setTargetProvince(o.target_province ?? ""); setTargetCity(o.target_city ?? ""); setTargetAudience(o.target_audience ?? "");
    setChannelSlug(o.channel_slug ?? ""); setBudgetMin(o.budget_min?.toString() ?? ""); setBudgetMax(o.budget_max?.toString() ?? ""); setPublishersNeeded(o.publishers_needed.toString());
  }

  async function closeOpportunity(id: string) {
    await supabase.from("opportunities").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  async function decide(application: ApplicationRow, opportunity: Opportunity, decision: "accepted" | "declined") {
    setActionError(null);
    setDecidingId(application.id);

    if (decision === "accepted") {
      // accept_opportunity_application() (item 12, schema_phase89) does
      // everything that used to happen here as two separate, unguarded
      // steps — locking the application, verifying it's still pending
      // and the opportunity still has room, creating the actual
      // requests/channel_requests row, and updating the application's
      // status — inside one transaction. Used to update the application
      // to 'accepted' first (which alone triggers
      // close_out_accepted_opportunity()'s cascade — declining other
      // applicants, marking the opportunity filled) and only then try to
      // create the booking, with that insert's result never even
      // checked: a failure there left the application accepted with no
      // booking ever created.
      const { data, error: rpcError } = await supabase.rpc("accept_opportunity_application", { p_application_id: application.id });
      if (rpcError || !data?.ok) {
        setActionError(data?.error ?? "Couldn't accept that application — try again.");
        setDecidingId(null);
        return;
      }
    } else {
      const { error: err } = await supabase
        .from("opportunity_applications")
        .update({ status: decision })
        .eq("id", application.id);

      if (err) {
        setActionError("Couldn't update that application — try again.");
        setDecidingId(null);
        return;
      }
    }

    await loadApplications(opportunity.id);
    await load();
    setDecidingId(null);
  }

  if (loading) return <SkeletonBlock className="h-64" />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Seo title="Your Opportunities — ChatSched" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">Your opportunities</h1>
        {subscribed !== false && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 bg-billboard-yellow hover:-translate-y-0.5 transition"
          >
            {showForm ? "Cancel" : "+ Post an opportunity"}
          </button>
        )}
      </div>

      {subscribed === false && <SubscriptionGateNotice role="business" />}

      {showForm && (
        <div className="border-[3px] border-billboard-ink rounded p-4 mb-6 bg-white">
          <p className="text-xs text-billboard-inkSoft mb-3">
            Post what you need instead of picking a publisher yourself — publishers who match will see it and apply.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short title — e.g. 'Need 3 Instagram posts for a product launch'"
            className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-2"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What are you looking for? Timeline, audience, anything a publisher would need to know before applying."
            rows={4}
            className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-2"
          />
          <div className="flex flex-wrap gap-2 mb-2">
            <select value={opportunityType} onChange={(e) => setOpportunityType(e.target.value)} className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase">
              <option value="">Opportunity type</option>
              {Array.from(new Set(["Newsletter Sponsorship","School Partnership","Event Sponsorship","In-Venue Screen Display","Influencer Product Placement","Radio / Podcast Spot","Sports Sponsorship","Website Advertising","Community Sponsorship","Social Media Promotion"])).map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={targetProvince} onChange={(e) => setTargetProvince(e.target.value)} className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs">
              <option value="">Any province</option><option>Western Cape</option><option>Gauteng</option><option>KwaZulu-Natal</option><option>Eastern Cape</option><option>Free State</option><option>Limpopo</option><option>Mpumalanga</option><option>North West</option><option>Northern Cape</option>
            </select>
            <input value={targetCity} onChange={(e) => setTargetCity(e.target.value)} placeholder="Target city" className="w-32 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs" />
            <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Target audience" className="w-40 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs" />
            <select
              value={channelSlug}
              onChange={(e) => setChannelSlug(e.target.value as ChannelSlug | "")}
              className="border-2 border-billboard-ink rounded px-2 py-1.5 text-xs font-mono uppercase"
            >
              <option value="">Any channel type</option>
              {(Object.keys(CHANNEL_LABEL) as ChannelSlug[]).map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
            <input
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              type="number"
              placeholder="Budget min (R)"
              className="w-32 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs"
            />
            <input
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              type="number"
              placeholder="Budget max (R)"
              className="w-32 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs"
            />
            <input
              value={publishersNeeded}
              onChange={(e) => setPublishersNeeded(e.target.value)}
              type="number"
              min={1}
              placeholder="Publishers needed"
              className="w-32 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs"
            />
          </div>
          <BundleSuggestion channelSlug={channelSlug} />
          {postError && <p className="text-billboard-red text-xs font-semibold mb-2 mt-2">{postError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={postOpportunity}
              disabled={posting || !title.trim() || !brief.trim()}
              className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-4 py-2 bg-billboard-ink text-white hover:-translate-y-0.5 transition disabled:opacity-60"
            >
              {posting ? "Saving…" : editingId ? "Save changes & publish" : "Post opportunity"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {actionError && <p className="text-billboard-red text-xs font-semibold mb-4">{actionError}</p>}

      {opportunities.length === 0 ? (
        <EmptyState kind="list" title="No opportunities posted yet" compact />
      ) : (
        <div className="space-y-3">
          {opportunities.map((o) => {
            const loaded = applicationsByOpp[o.id] !== undefined;
            const apps = applicationsByOpp[o.id] ?? [];
            const pendingCount = apps.filter((a) => a.status === "pending").length;
            const acceptedCount = apps.filter((a) => a.status === "accepted").length;
            return (
              <div key={o.id} className="border-[3px] border-billboard-ink rounded p-4 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <h2 className="font-display text-lg">{o.title}</h2>
                  <span className={`font-mono text-[10px] font-semibold uppercase border-2 px-2 py-0.5 rounded ${STATUS_TONE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <p className="text-sm text-billboard-inkSoft mb-2">{o.brief}</p>
                <p className="text-[11px] text-billboard-inkSoft mb-3">
                  {o.channel_slug ? CHANNEL_LABEL[o.channel_slug] : "Any channel"} ·{" "}
                  {o.budget_min || o.budget_max ? `${formatR(o.budget_min)} – ${formatR(o.budget_max)}` : "Budget not specified"}
                  {o.publishers_needed > 1 && ` · ${o.publishers_needed} needed`}
                  {o.publishers_needed > 1 && loaded && ` (${acceptedCount} accepted so far)`}
                </p>
                <button
                  type="button"
                  onClick={() => toggleExpand(o.id)}
                  className="text-xs font-semibold underline mr-4"
                >
                  {expanded === o.id ? "Hide applications" : `View applications${pendingCount ? ` (${pendingCount} new)` : ""}`}
                </button>
                {(o.status === "open" || o.status === "draft") && (
                  <button type="button" onClick={() => editOpportunity(o)} className="text-xs font-semibold underline mr-4">Edit</button>
                )}
                {o.status === "open" && (
                  <button type="button" onClick={() => closeOpportunity(o.id)} className="text-xs font-semibold underline text-billboard-inkSoft">
                    Close without filling
                  </button>
                )}

                {expanded === o.id && (
                  <div className="mt-3 pt-3 border-t-2 border-billboard-ink space-y-2">
                    {apps.length === 0 ? (
                      <p className="text-xs text-billboard-inkSoft">No applications yet.</p>
                    ) : (
                      apps.map((a) => (
                        <div key={a.id} className="border-2 border-billboard-ink rounded p-3">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Link to={`/browse/${a.publisher_id}`} className="text-sm font-semibold underline">
                              {a.publisherName}
                            </Link>
                            <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">
                              {a.publisherChannelSlug ? CHANNEL_LABEL[a.publisherChannelSlug] : ""}
                            </span>
                            <span className="text-xs font-semibold ml-auto">{formatR(a.proposed_amount)}</span>
                          </div>
                          <p className="text-sm mb-2">{a.message}</p>
                          {a.status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => decide(a, o, "accepted")}
                                disabled={decidingId === a.id}
                                className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1 bg-billboard-green text-white disabled:opacity-60"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => decide(a, o, "declined")}
                                disabled={decidingId === a.id}
                                className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1 disabled:opacity-60"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">{a.status}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
