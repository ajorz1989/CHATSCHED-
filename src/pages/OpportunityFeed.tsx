import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";
import { SkeletonBlock } from "../components/Skeleton";
import SubscriptionGateNotice from "../components/SubscriptionGateNotice";
import { hasUsablePublisherSubscription } from "../lib/subscriptionGate";
import type { ChannelSlug } from "../lib/channelTypes";
import { formatCurrency as formatCurrencyShared } from "../lib/currency";
import type { Opportunity, OpportunityApplication, OpportunityApplicationStatus, OpportunityType } from "../lib/types";
import { scoreOpportunity, type OpportunityMatch, type OpportunityPublisherProfile } from "../lib/opportunityMatching";

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

const APPLICATION_STATUS_LABEL: Record<OpportunityApplicationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Not selected",
  withdrawn: "Withdrawn",
};

interface MyApplication extends OpportunityApplication {
  opportunityTitle: string;
}

interface PublisherSummary extends OpportunityPublisherProfile {
  id: string;
  name: string;
}

function formatR(n: number | null): string {
  return n === null ? "—" : formatCurrencyShared(n);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function deadlineLabel(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const hours = (d.getTime() - Date.now()) / 36e5;
  if (hours <= 0) return "Deadline passed";
  if (hours < 24) return "Closes in " + Math.max(1, Math.round(hours)) + "h";
  return "Closes in " + Math.round(hours / 24) + "d";
}

export default function OpportunityFeed() {
  const { user, profile } = useAuth();
  const [publisher, setPublisher] = useState<PublisherSummary | null>(null);
  const [view, setView] = useState<"browse" | "applications">("browse");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunityTypes, setOpportunityTypes] = useState<OpportunityType[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [appliedOpportunityIds, setAppliedOpportunityIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelSlug | "">("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState<"match" | "newest" | "budget">("match");
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [message, setMessage] = useState("");
  const [advertisingMethod, setAdvertisingMethod] = useState("");
  const [proposedAmount, setProposedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) {
        if (active) setLoading(false);
        return;
      }
      setLoading(true);

      const [typeResult, opportunityResult] = await Promise.all([
        supabase.from("opportunity_types").select("slug,label,description,suggested_channel_slug,active").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("opportunities").select("*").eq("status", "open").order("created_at", { ascending: false }),
      ]);

      if (!active) return;
      setOpportunityTypes((typeResult.data ?? []) as OpportunityType[]);
      setOpportunities((opportunityResult.data ?? []) as Opportunity[]);

      const publisherQuery = supabase
        .from("publishers")
        .select("id,name,channel_slug,city,province,category,audience,bio,followers,price_per_post,trust_score,languages")
        .order("name", { ascending: true })
        .limit(1);

      const { data: publisherRows } = isAdmin
        ? await publisherQuery.eq("status", "approved")
        : await publisherQuery.eq("user_id", user.id);

      const p = publisherRows?.[0] as PublisherSummary | undefined;
      if (p) setPublisher(p);

      setSubscribed(isAdmin ? true : await hasUsablePublisherSubscription(user.id));
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!publisher?.id) return;
    let active = true;
    async function loadApplications() {
      const { data } = (await supabase
        .from("opportunity_applications")
        .select("*, opportunity:opportunities(title)")
        .eq("publisher_id", publisher!.id)
        .order("created_at", { ascending: false })) as any;
      if (!active) return;
      const mapped: MyApplication[] = (data ?? []).map((r: any) => ({
        ...r,
        opportunityTitle: r.opportunity?.title ?? "Opportunity",
      }));
      setMyApplications(mapped);
      setAppliedOpportunityIds(new Set(mapped.map((m) => m.opportunity_id)));
    }
    loadApplications();
    return () => { active = false; };
  }, [publisher?.id]);

  const typeMap = useMemo(() => new Map(opportunityTypes.map((t) => [t.slug, t])), [opportunityTypes]);

  const scored = useMemo(() => {
    return opportunities.map((opportunity) => ({
      opportunity,
      match: publisher
        ? scoreOpportunity(opportunity, publisher)
        : ({ score: 0, reasons: [] } as OpportunityMatch),
    }));
  }, [opportunities, publisher]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const locationNeedle = locationFilter.trim().toLowerCase();

    return scored
      .filter(({ opportunity }) => {
        if (typeFilter && opportunity.opportunity_type !== typeFilter) return false;
        if (channelFilter && opportunity.channel_slug !== channelFilter) return false;
        if (!showAllChannels && publisher?.channel_slug && opportunity.channel_slug && opportunity.channel_slug !== publisher.channel_slug) return false;
        if (locationNeedle) {
          const haystack = [opportunity.target_city, opportunity.target_province, opportunity.target_audience]
            .filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(locationNeedle)) return false;
        }
        if (needle) {
          const haystack = [
            opportunity.title,
            opportunity.brief,
            opportunity.target_audience,
            opportunity.target_city,
            opportunity.target_province,
            typeMap.get(opportunity.opportunity_type ?? "")?.label,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "match") {
          return b.match.score - a.match.score || new Date(b.opportunity.created_at).getTime() - new Date(a.opportunity.created_at).getTime();
        }
        if (sortBy === "budget") {
          return (b.opportunity.budget_max ?? b.opportunity.budget_min ?? 0) - (a.opportunity.budget_max ?? a.opportunity.budget_min ?? 0);
        }
        return new Date(b.opportunity.created_at).getTime() - new Date(a.opportunity.created_at).getTime();
      });
  }, [scored, query, locationFilter, typeFilter, channelFilter, sortBy, showAllChannels, publisher, typeMap]);

  async function refreshApplications() {
    if (!publisher?.id) return;
    const { data } = (await supabase
      .from("opportunity_applications")
      .select("*, opportunity:opportunities(title)")
      .eq("publisher_id", publisher.id)
      .order("created_at", { ascending: false })) as any;
    const mapped: MyApplication[] = (data ?? []).map((r: any) => ({
      ...r,
      opportunityTitle: r.opportunity?.title ?? "Opportunity",
    }));
    setMyApplications(mapped);
    setAppliedOpportunityIds(new Set(mapped.map((m) => m.opportunity_id)));
  }

  async function submitApplication(opportunityId: string) {
    if (!publisher?.id || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.from("opportunity_applications").insert({
      opportunity_id: opportunityId,
      publisher_id: publisher.id,
      message: message.trim(),
      advertising_method: advertisingMethod.trim() || null,
      proposed_amount: proposedAmount ? Number(proposedAmount) : null,
    });
    setSubmitting(false);
    if (err) {
      setError(formatSupabaseError(err, "Couldn't submit application"));
      return;
    }
    setApplyingTo(null);
    setMessage("");
    setAdvertisingMethod("");
    setProposedAmount("");
    await refreshApplications();
  }

  async function withdraw(applicationId: string) {
    setError(null);
    const { error: err } = await supabase.from("opportunity_applications").update({ status: "withdrawn" }).eq("id", applicationId);
    if (err) setError(formatSupabaseError(err, "Couldn't withdraw application"));
    await refreshApplications();
  }

  if (loading) return <SkeletonBlock className="h-64 max-w-4xl mx-auto mt-12" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Seo title="Opportunities — ChatSched" description="Verified publishers discover and apply to advertising opportunities matched to their channel, location and audience." />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">Publisher Opportunity Feed</span>
          <h1 className="font-display text-3xl md:text-4xl mt-1">Find work that fits your inventory.</h1>
          <p className="text-sm text-billboard-inkSoft mt-2 max-w-2xl">ChatSched matches briefs to your channel and local audience while keeping the proposal and booking workflow on-platform.</p>
        </div>
        <div className="flex gap-2">
          {(["browse", "applications"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={"font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 " + (view === v ? "bg-billboard-ink text-white" : "bg-white")}>
              {v === "browse" ? "Discover" : "My applications (" + myApplications.length + ")"}
            </button>
          ))}
        </div>
      </div>

      {view === "browse" ? (
        <>
          <div className="border-[3px] border-billboard-ink rounded-xl bg-billboard-paperDim p-4 mb-5">
            <div className="grid md:grid-cols-[1.4fr_1fr_1fr] gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search briefs, audience, city or opportunity type" className="border-2 border-billboard-ink rounded-lg px-3 py-2 text-sm bg-white" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border-2 border-billboard-ink rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">All opportunity types</option>
                {opportunityTypes.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
              </select>
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as ChannelSlug | "")} className="border-2 border-billboard-ink rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">All channels</option>
                {(Object.keys(CHANNEL_LABEL) as ChannelSlug[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Location or audience filter" className="border-2 border-billboard-ink rounded-lg px-3 py-2 text-xs bg-white w-52" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="border-2 border-billboard-ink rounded-lg px-3 py-2 text-xs bg-white">
                <option value="match">Best match</option>
                <option value="newest">Newest</option>
                <option value="budget">Highest budget</option>
              </select>
              {publisher?.channel_slug && (
                <label className="flex items-center gap-2 text-xs text-billboard-inkSoft">
                  <input type="checkbox" checked={showAllChannels} onChange={(e) => setShowAllChannels(e.target.checked)} />
                  Show other channels
                </label>
              )}
            </div>
          </div>

          {subscribed === false && <SubscriptionGateNotice role="publisher" />}
          {error && <p className="text-billboard-red text-xs font-semibold mb-4" role="alert">{error}</p>}

          {visible.length === 0 ? (
            <EmptyState kind="list" title="No open opportunities match your filters" description="Try widening the channel or location filters, or check back when new briefs are posted." compact />
          ) : (
            <div className="space-y-4">
              {visible.map(({ opportunity: o, match }) => {
                const alreadyApplied = appliedOpportunityIds.has(o.id);
                const type = typeMap.get(o.opportunity_type ?? "");
                const deadline = deadlineLabel(o.application_deadline ?? o.expires_at);

                return (
                  <article key={o.id} className="border-[3px] border-billboard-ink rounded-xl p-5 bg-white shadow-blockSm">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft">{type?.label ?? "Advertising opportunity"}</span>
                          {o.channel_slug && <span className="font-mono text-[10px] uppercase border border-billboard-ink/30 rounded-full px-2 py-0.5">{CHANNEL_LABEL[o.channel_slug]}</span>}
                          {match.score > 0 && <span className="font-mono text-[10px] font-bold uppercase bg-billboard-green text-white rounded-full px-2 py-0.5">{match.score} match</span>}
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
                      <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Target</div><div>{[o.target_city, o.target_province].filter(Boolean).join(", ") || "Flexible geography"}</div></div>
                      <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Publishers</div><div>{o.publishers_needed} needed</div></div>
                      <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Campaign window</div><div>{formatDate(o.campaign_start_at) ?? "Flexible"}{o.campaign_end_at ? " → " + formatDate(o.campaign_end_at) : ""}</div></div>
                      <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim"><div className="font-mono text-[9px] uppercase text-billboard-inkSoft mb-1">Deadline</div><div>{deadline ?? "No deadline set"}</div></div>
                    </div>

                    {o.target_audience && <p className="text-xs mt-3"><span className="font-semibold">Audience:</span> {o.target_audience}</p>}
                    {o.deliverables && <p className="text-xs mt-2"><span className="font-semibold">Expected deliverables:</span> {o.deliverables}</p>}
                    {o.publisher_requirements && <p className="text-xs mt-2"><span className="font-semibold">Publisher requirements:</span> {o.publisher_requirements}</p>}
                    {match.reasons.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{match.reasons.map((reason) => <span key={reason} className="font-mono text-[9px] uppercase border border-billboard-green/30 text-billboard-greenDeep rounded-full px-2 py-1">{reason}</span>)}</div>}

                    <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
                      {alreadyApplied ? (
                        <span className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft">Already applied</span>
                      ) : subscribed === false ? (
                        <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">Activation required to apply</span>
                      ) : applyingTo === o.id ? (
                        <div>
                          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why you're a fit and what you would deliver" rows={3} className="w-full border-2 border-billboard-ink rounded-lg px-3 py-2 text-sm mb-2" />
                          <div className="grid sm:grid-cols-[1fr_10rem_auto] gap-2">
                            <input value={advertisingMethod} onChange={(e) => setAdvertisingMethod(e.target.value)} placeholder="Proposed placement / deliverable" className="border-2 border-billboard-ink rounded-lg px-3 py-2 text-xs" />
                            <input value={proposedAmount} onChange={(e) => setProposedAmount(e.target.value)} type="number" min={0} placeholder="Your price (R)" className="border-2 border-billboard-ink rounded-lg px-3 py-2 text-xs" />
                            <button type="button" onClick={() => submitApplication(o.id)} disabled={submitting || !message.trim()} className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2 bg-billboard-green text-white disabled:opacity-60">{submitting ? "Sending…" : "Send proposal"}</button>
                          </div>
                          <button type="button" onClick={() => setApplyingTo(null)} className="text-xs underline mt-2">Cancel</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setApplyingTo(o.id); setError(null); }} className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded-lg px-4 py-2 bg-billboard-yellow hover:-translate-y-0.5 transition">
                          Apply to this opportunity
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {error && <p className="text-billboard-red text-xs font-semibold mb-4" role="alert">{error}</p>}
          {myApplications.length === 0 ? (
            <EmptyState kind="list" title="You haven't applied to anything yet" description="Your proposals will appear here with their status and the next step." compact />
          ) : (
            <div className="space-y-3">
              {myApplications.map((a) => (
                <article key={a.id} className="border-[3px] border-billboard-ink rounded-xl p-4 bg-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg">{a.opportunityTitle}</h2>
                    <span className="font-mono text-[10px] uppercase ml-auto">{APPLICATION_STATUS_LABEL[a.status]}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-billboard-inkSoft">
                    {a.proposed_amount != null && <span>Proposed {formatCurrencyShared(a.proposed_amount)}</span>}
                    {a.advertising_method && <span>{a.advertising_method}</span>}
                    <span>Applied {new Date(a.created_at).toLocaleDateString("en-ZA")}</span>
                  </div>
                  {a.status === "accepted" && <p className="text-xs mt-3 p-3 rounded-lg bg-billboard-green/10 border border-billboard-green/30">Accepted. ChatSched has moved the opportunity into the normal booking workflow.</p>}
                  {a.status === "pending" && <button type="button" onClick={() => withdraw(a.id)} className="text-[11px] font-semibold underline text-billboard-inkSoft mt-3">Withdraw proposal</button>}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
