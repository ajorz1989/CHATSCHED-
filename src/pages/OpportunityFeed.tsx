import { useEffect, useState } from "react";
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
import type { Opportunity, OpportunityApplication, OpportunityApplicationStatus } from "../lib/types";

/**
 * Reverse marketplace, publisher side — browse what businesses are
 * looking for and apply, instead of waiting for a business to find your
 * profile. See schema_phase68_opportunity_marketplace.sql for why
 * accepting converts an application into an ordinary channel_requests/
 * requests row rather than a parallel booking type.
 */

const CHANNEL_LABEL: Record<ChannelSlug, string> = {
  "social-media": "Social Media",
  influencer: "Influencer",
  website: "Website",
  podcast: "Podcast",
  radio: "Radio",
  // All 12 channels are postable as of schema_phase80 — see
  // BusinessOpportunities.tsx's matching comment for detail. This
  // feed's own channel-match filter below was already channel-agnostic
  // ahead of that migration.
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

function formatR(n: number | null): string {
  return n === null ? "—" : formatCurrencyShared(n);
}

export default function OpportunityFeed() {
  const { user, profile } = useAuth();
  const [publisherId, setPublisherId] = useState<string | null>(null);
  const [publisherChannelSlug, setPublisherChannelSlug] = useState<ChannelSlug | null>(null);
  const [view, setView] = useState<"browse" | "applications">("browse");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [appliedOpportunityIds, setAppliedOpportunityIds] = useState<Set<string>>(new Set());
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [advertisingMethod, setAdvertisingMethod] = useState("");
  const [proposedAmount, setProposedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = profile?.role === "admin";

  async function loadPublisher() {
    if (!user) return;
    if (isAdmin) {
      const { data } = await supabase
        .from("publishers")
        .select("id, channel_slug")
        .order("name", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        setPublisherId(data.id);
        setPublisherChannelSlug(data.channel_slug);
      }
      return;
    }
    const { data } = await supabase
      .from("publishers")
      .select("id, channel_slug")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setPublisherId(data.id);
      setPublisherChannelSlug(data.channel_slug);
    }
  }

  async function loadOpportunities() {
    setLoading(true);
    const { data } = await supabase
      .from("opportunities")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    setOpportunities((data as Opportunity[]) ?? []);
    setLoading(false);
  }

  async function loadMyApplications(pubId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = (await supabase
      .from("opportunity_applications")
      .select("*, opportunity:opportunities(title)")
      .eq("publisher_id", pubId)
      .order("created_at", { ascending: false })) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: MyApplication[] = (data ?? []).map((r: any) => ({
      ...r,
      opportunityTitle: r.opportunity?.title ?? "Opportunity",
    }));
    setMyApplications(mapped);
    setAppliedOpportunityIds(new Set(mapped.map((m) => m.opportunity_id)));
  }

  useEffect(() => {
    loadPublisher();
    loadOpportunities();
    if (isAdmin) setSubscribed(true);
    else if (user) hasUsablePublisherSubscription(user.id).then(setSubscribed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  useEffect(() => {
    if (publisherId) loadMyApplications(publisherId);
  }, [publisherId]);

  async function submitApplication(opportunityId: string) {
    if (!publisherId || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.from("opportunity_applications").insert({
      opportunity_id: opportunityId,
      publisher_id: publisherId,
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
    await loadMyApplications(publisherId);
  }

  async function withdraw(applicationId: string) {
    await supabase.from("opportunity_applications").update({ status: "withdrawn" }).eq("id", applicationId);
    if (publisherId) await loadMyApplications(publisherId);
  }

  if (loading) return <SkeletonBlock className="h-64" />;

  const visible = showAllChannels
    ? opportunities
    : opportunities.filter((o) => o.channel_slug === null || o.channel_slug === publisherChannelSlug);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Seo title="Opportunities — ChatSched" />
      <h1 className="font-display text-2xl mb-4">Opportunities</h1>

      <div className="flex gap-2 mb-4">
        {(["browse", "applications"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 ${
              view === v ? "bg-billboard-ink text-white" : ""
            }`}
          >
            {v === "browse" ? "Browse" : `My applications (${myApplications.length})`}
          </button>
        ))}
      </div>

      {view === "browse" ? (
        <>
          <label className="flex items-center gap-2 text-xs text-billboard-inkSoft mb-4">
            <input type="checkbox" checked={showAllChannels} onChange={(e) => setShowAllChannels(e.target.checked)} />
            Show opportunities outside my channel type too
          </label>

          {subscribed === false && <SubscriptionGateNotice role="publisher" />}
          {error && <p className="text-billboard-red text-xs font-semibold mb-4">{error}</p>}

          {visible.length === 0 ? (
            <EmptyState kind="list" title="No open opportunities right now" compact />
          ) : (
            <div className="space-y-3">
              {visible.map((o) => {
                const alreadyApplied = appliedOpportunityIds.has(o.id);
                return (
                  <div key={o.id} className="border-[3px] border-billboard-ink rounded p-4 bg-white">
                    <h2 className="font-display text-lg mb-1">{o.title}</h2>
                    <p className="text-sm text-billboard-inkSoft mb-2">{o.brief}</p>
                    <p className="text-[11px] text-billboard-inkSoft mb-3">
                      {o.channel_slug ? CHANNEL_LABEL[o.channel_slug] : "Open to any channel"} ·{" "}
                      {o.budget_min || o.budget_max ? `${formatR(o.budget_min)} – ${formatR(o.budget_max)}` : "Budget not specified"}
                      {o.publishers_needed > 1 && ` · Looking for ${o.publishers_needed} publishers`}
                    </p>

                    {alreadyApplied ? (
                      <span className="font-mono text-[11px] uppercase text-billboard-inkSoft">Already applied</span>
                    ) : subscribed === false ? null : applyingTo === o.id ? (
                      <div className="mt-2 pt-2 border-t-2 border-billboard-ink">
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Why you're a fit, and what you'd deliver"
                          rows={3}
                          className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-2"
                        />
                        <div className="flex flex-wrap gap-2 mb-2">
                          <input
                            value={advertisingMethod}
                            onChange={(e) => setAdvertisingMethod(e.target.value)}
                            placeholder="What you'd actually do — e.g. '3 Instagram posts'"
                            className="flex-1 min-w-[10rem] border-2 border-billboard-ink rounded px-2 py-1.5 text-xs"
                          />
                          <input
                            value={proposedAmount}
                            onChange={(e) => setProposedAmount(e.target.value)}
                            type="number"
                            placeholder="Your price (R)"
                            className="w-32 border-2 border-billboard-ink rounded px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => submitApplication(o.id)}
                            disabled={submitting || !message.trim()}
                            className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 bg-billboard-ink text-white disabled:opacity-60"
                          >
                            {submitting ? "Sending…" : "Submit application"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setApplyingTo(null)}
                            className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setApplyingTo(o.id);
                          setError(null);
                        }}
                        className="font-mono text-[11px] font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 bg-billboard-yellow hover:-translate-y-0.5 transition"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : myApplications.length === 0 ? (
        <EmptyState kind="list" title="You haven't applied to anything yet" compact />
      ) : (
        <div className="space-y-2">
          {myApplications.map((a) => (
            <div key={a.id} className="border-2 border-billboard-ink rounded p-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">{a.opportunityTitle}</span>
                <span className="font-mono text-[10px] uppercase text-billboard-inkSoft ml-auto">
                  {APPLICATION_STATUS_LABEL[a.status]}
                </span>
              </div>
              {a.status === "pending" && (
                <button type="button" onClick={() => withdraw(a.id)} className="text-[11px] font-semibold underline text-billboard-inkSoft mt-1">
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
