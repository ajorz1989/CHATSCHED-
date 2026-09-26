import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { usePublishers } from "../hooks/usePublishers";
import { useAuth } from "../hooks/useAuth";
import { useComparison } from "../contexts/ComparisonContext";
import { useSavedLists } from "../contexts/SavedListsContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import SetupNotice from "../components/SetupNotice";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import ChannelRequestForm from "../components/ChannelRequestForm";
import { hasUsableBusinessSubscription } from "../lib/subscriptionGate";
import SubscriptionGateNotice from "../components/SubscriptionGateNotice";
import PortfolioGallery from "../components/PortfolioGallery";
import MarketplaceProfileView from "../components/MarketplaceProfileView";
import EarnedBadges from "../components/EarnedBadges";
import PublisherAvatar from "../components/PublisherAvatar";
import PublisherTrustStrip from "../components/PublisherTrustStrip";
import { formatCurrency } from "../lib/currency";
import { fetchReviewAuthors } from "../lib/businessContact";
import RateCardDisplay from "../components/RateCardDisplay";
import PublisherCard from "../components/PublisherCard";

// 12-Channel Audit fix C4 — same set as PublisherCard.tsx's own copy; see
// that file's comment for why this isn't a shared import.
const VERIFICATION_REQUIRED_CHANNELS = new Set(["sports", "events", "community", "transport", "informal-retail", "associations", "restaurants", "in-venue-screens"]);
import EmptyState from "../components/EmptyState";
import Seo from "../components/Seo";
import { SkeletonBlock, SkeletonLine, SkeletonParagraph } from "../components/Skeleton";
import TrustBadge from "../components/TrustBadge";
import ChannelIcon from "../components/ChannelIcon";
import MarketingIcon from "../components/MarketingIcon";
import { getChannelBySlug } from "../lib/channelRegistry";
import { takeContentStudioDraft } from "../lib/contentStudioDraft";
import type { Review } from "../lib/types";
import Button from "../components/Button";

export default function PublisherProfile() {
  const { id } = useParams();
  const { publishers, loading, error: publishersError } = usePublishers();
  const { user, profile } = useAuth();
  const { isComparing, togglePublisher, isFull } = useComparison();
  const { lists, addToList, createList, isInAnyList } = useSavedLists();

  const publisher = publishers.find(p => p.id === id);

  const [reportOpen, setReportOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [subscribed, setSubscribed] = useState<boolean | undefined>(undefined);

  // Admin is always fully enabled, synchronously — nothing below this
  // ever gates or hides anything from an admin viewer.
  const isAdmin = profile?.role === "admin";
  // Was `subscribed !== false`, which defaults TRUE while the async
  // subscription check is still in flight — a non-admin business briefly
  // saw a fully-enabled form before it flipped to disabled once the real
  // answer came back. Now nothing is treated as usable until the check
  // actually resolves (admin still resolves instantly, unaffected).
  const subscriptionChecked = isAdmin || subscribed !== undefined;
  const canUseBusinessFeature = isAdmin || subscribed === true;

  // Full profiles (bio, availability, portfolio, reviews, the request
  // form) are only for signed-in business/publisher/admin accounts.
  // Computed here rather than only below the early returns so the
  // reviews fetch further down can skip the network round trip for
  // anonymous visitors, who are most of this page's traffic and never
  // render that data anyway.
  const isRegisteredViewer = !!user && (profile?.role === "business" || profile?.role === "publisher" || profile?.role === "admin");
  // Sending a campaign request is a business action. Admin can still do
  // everything, everywhere — but a publisher (including one viewing
  // their own listing) shouldn't see a "book this" form meant for
  // buyers, and shouldn't be able to submit a request against
  // themselves or another publisher.
  const canRequestPlacement = isAdmin || profile?.role === "business";

  useEffect(() => {
    if (isAdmin) { setSubscribed(true); return; }
    if (user) hasUsableBusinessSubscription(user.id).then(setSubscribed);
  }, [user, isAdmin]);

  // Save menu
  const [showSave, setShowSave] = useState(false);
  const [newListName, setNewListName] = useState("");
  const saveRef = useRef<HTMLDivElement>(null);

  // Agency-first Campaign Brief States (Goal, Dates, Budget, Deliverables, Requirements)
  const [goal, setGoal] = useState("Brand Awareness");
  const [customGoal, setCustomGoal] = useState("");
  const [targetDates, setTargetDates] = useState("Next 2–3 weeks");
  const [customDates, setCustomDates] = useState("");
  const [budget, setBudget] = useState("");
  const [deliverables, setDeliverables] = useState("1x Feed Post");
  const [customDeliverables, setCustomDeliverables] = useState("");
  const [requirements, setRequirements] = useState(() => takeContentStudioDraft() ?? "");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Anonymous/unregistered visitors never reach the JSX that renders
    // `reviews` (they get the locked-preview early return below), so
    // there's no point spending two network round trips fetching data
    // they'll never see — see isRegisteredViewer above.
    if (!id || !isSupabaseConfigured || !isRegisteredViewer) return;
    let cancelled = false;
    // business:profiles(...) used to be embedded directly here, which
    // relied on the now-dropped profiles_select_via_shared_request policy
    // — silently null for anonymous visitors, who are most of this
    // public page's traffic. reviews are already public
    // (reviews_select_public); review_author_public (schema_phase98)
    // resolves just the attribution safely.
    supabase
      .from("reviews")
      .select("*")
      .eq("publisher_id", id)
      .eq("author_role", "business")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as Review[];
        const authors = await fetchReviewAuthors(rows.map((r) => r.business_id));
        if (cancelled) return;
        setReviews(rows.map((r) => ({ ...r, business: authors.get(r.business_id) ?? null })));
      });
    return () => { cancelled = true; };
  }, [id, isRegisteredViewer]);

  useEffect(() => {
    if (!showSave) return;
    function onDown(e: MouseEvent) {
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) setShowSave(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSave]);

  // Logs a real profile-view event for the publisher's "traction" numbers
  // on their own dashboard — see PublisherDashboardView.tsx and
  // schema_phase37_profile_views.sql. Fire-and-forget: never blocks
  // rendering, and a failed insert (network hiccup, RLS edge case) just
  // means one missed count, not a broken page. Deliberately excludes:
  // the publisher viewing their own listing (RLS also blocks this, this
  // just avoids a doomed network call), and admin views, since those
  // aren't a business showing real interest.
  useEffect(() => {
    if (!id || !user || !publisher) return;
    if (profile?.role !== "business" && profile?.role !== "publisher") return;
    if (publisher.user_id === user.id) return;
    supabase.from("publisher_profile_views").insert({ publisher_id: id, viewer_id: user.id }).then(
      () => {},
      () => {} // duplicate-day or RLS no-op — not worth surfacing to the viewer either way
    );
  }, [id, user, profile?.role, publisher]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16" aria-busy="true" aria-label="Loading publisher profile">
        <SkeletonBlock className="h-40 mb-6" />
        <div className="flex items-center gap-3 mb-5">
          <SkeletonBlock className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <SkeletonLine className="w-1/2 h-5" />
            <SkeletonLine className="w-1/3" />
          </div>
        </div>
        <SkeletonParagraph lines={4} />
      </div>
    );
  }

  // Was previously indistinguishable from "no such listing" below — a
  // real fetch failure (network blip, RLS change, outage) silently
  // rendered as "Publisher not found", with no way to tell the
  // difference or retry.
  if (publishersError) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <h1 className="text-2xl mb-3">Couldn't load this listing</h1>
        <p className="text-billboard-inkSoft mb-6">Something went wrong fetching this publisher. Please try again.</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
          >
            Try again
          </button>
          <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded">← Back to Browse</Link>
        </div>
      </div>
    );
  }

  if (!publisher) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <h1 className="text-2xl mb-3">Publisher not found</h1>
        <p className="text-billboard-inkSoft mb-6">This listing may have moved.</p>
        <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-3 rounded">← Back to Browse</Link>
      </div>
    );
  }

  // Full profiles (contact details, bio, availability, portfolio, reviews,
  // the request form) are only for signed-in business and publisher/creator
  // accounts. Anyone else — including signed-out visitors — sees the same
  // card-level info they'd get from Browse, plus a prompt to register.
  // (isRegisteredViewer is computed above, before the early returns, so
  // the reviews-fetch effect can use it too.)
  if (!isRegisteredViewer) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16">
        <Seo
          title={`${publisher.name} · ChatSched`}
          description={`${publisher.name} in ${publisher.city}, ${publisher.province} — sign up to view the full profile.`}
        />
        <Link to="/browse" className="text-xs font-semibold underline text-billboard-inkSoft">← Back to Browse</Link>
        <div className="max-w-sm mx-auto mt-6 mb-8">
          <PublisherCard publisher={publisher} />
        </div>
        <div className="max-w-sm mx-auto mb-6">
          <Link
            to={`/login?next=${encodeURIComponent(`/browse/${publisher.id}`)}`}
            className="w-full inline-flex justify-center items-center gap-2 border-[3px] border-billboard-greenDeep bg-billboard-green text-white font-bold py-3 rounded hover:bg-billboard-greenDeep transition"
          >
            Start Campaign Request →
          </Link>
          <p className="text-[11px] text-center text-billboard-inkSoft mt-2">
            ChatSched handles publisher outreach, scheduling, content verification, and payment protection. Log in or create an account to start.
          </p>
        </div>
        <div className="border-[3px] border-dashed border-billboard-ink rounded">
          <EmptyState
            kind="lock"
            title="Sign up to view the full profile"
            description="Full profiles — bio, availability, portfolio, reviews and direct messaging — are only visible to registered businesses and creators. It's free and takes a minute."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/register" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
                  Create a free account
                </Link>
                <Link to="/login" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
                  Log in
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const liveRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : publisher.rating;
  const liveReviewCount = reviews.length > 0 ? reviews.length : publisher.reviews;
  const comparing = isComparing(publisher.id);
  const saved = isInAnyList(publisher.id);

  // Is the logged-in user the owner of this publisher profile?
  const isOwner = profile?.role === "publisher" && publisher.user_id === user?.id;

  // The 4 request-flow channels replace the directory pricing + PayFast
  // request form with ChannelRequestForm (below). social-media — and any
  // legacy row with no channel_slug set — keeps this page's original
  // behavior completely unchanged.
  const channelDef = getChannelBySlug(publisher.channel_slug)?.definition;
  const isRequestFlowChannel = !!channelDef && channelDef.bookingFlow === "request";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !publisher) return;

    const resolvedGoal = goal === "Other (Custom)" && customGoal.trim() ? customGoal.trim() : goal;
    const resolvedDates = targetDates === "Specific dates" && customDates.trim() ? customDates.trim() : targetDates;
    const resolvedDeliverables = deliverables === "Custom Deliverable" && customDeliverables.trim() ? customDeliverables.trim() : deliverables;

    if (!resolvedGoal || !resolvedDates || !resolvedDeliverables || !requirements.trim()) {
      setFormError("Please fill in the campaign goal, dates, deliverables, and requirements.");
      return;
    }

    setSending(true);
    setFormError(null);

    const formattedMessage = [
      `Goal: ${resolvedGoal}`,
      `Target Dates: ${resolvedDates}`,
      `Deliverables: ${resolvedDeliverables}`,
      `Requirements & Brief:\n${requirements.trim()}`,
      additionalNotes.trim() ? `Additional Notes:\n${additionalNotes.trim()}` : null,
      `Managed via ChatSched Agency Services`,
    ].filter(Boolean).join("\n\n");

    const { data: inserted, error } = await supabase
      .from("requests")
      .insert({
        publisher_id: publisher.id,
        business_id: user.id,
        campaign_message: formattedMessage,
        budget: budget ? Number(budget) : null,
      })
      .select()
      .single();

    setSending(false);
    if (error) {
      setFormError(formatSupabaseError(error, "Couldn't submit campaign request"));
    } else {
      setSent(true);
      if (inserted) {
        supabase.functions.invoke("notify", { body: { kind: "new_request", request_id: inserted.id } }).catch(() => {});
      }
    }
  }

  function handleSaveToNewList(e: FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const id2 = createList(newListName);
    addToList(id2, publisher!.id);
    setNewListName("");
    setShowSave(false);
  }

  return (
    <div>
      <Seo
        title={`${publisher.name} · ChatSched`}
        description={`${publisher.name} in ${publisher.city}, ${publisher.province} — ${publisher.followers.toLocaleString()} followers, ${formatCurrency(publisher.price_per_post)}/post. ${publisher.bio}`.slice(0, 160)}
      />
      <div className={`h-56 md:h-64 bg-gradient-to-br ${publisher.swatch} border-b-[3px] border-billboard-ink`} />

      <div className="max-w-5xl mx-auto px-5">
        <div className="flex flex-col md:flex-row gap-8 -mt-12 mb-10">
          <PublisherAvatar
            imageUrl={publisher.profile_image_url}
            initials={publisher.initials}
            name={publisher.name}
            size="lg"
            className="shadow-block"
          />
          <div className="flex-1 pt-2 md:pt-14">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl">{publisher.name}</h1>
              {publisher.verified && (
                <span className={`text-white text-[11px] font-mono font-semibold px-2 py-1 rounded ${VERIFICATION_REQUIRED_CHANNELS.has(publisher.channel_slug) ? "bg-billboard-greenDeep" : "bg-billboard-ink"}`}>
                  {VERIFICATION_REQUIRED_CHANNELS.has(publisher.channel_slug) ? "✓ Ownership Verified" : "✓ Verified"}
                </span>
              )}
              {publisher.level && <TrustBadge kind="publisher" level={publisher.level} />}
            </div>
            <p className="text-billboard-inkSoft mb-2">
              {publisher.city}{publisher.suburb ? ` (${publisher.suburb})` : ""}, {publisher.province} · {publisher.category}
              {isRequestFlowChannel && channelDef && (
                <span className="ml-1.5 font-mono text-xs uppercase text-billboard-greenDeep">· <ChannelIcon slug={channelDef.slug} size="sm" /> {channelDef.name}</span>
              )}
            </p>
            <PublisherTrustStrip
              trustScore={publisher.trust_score}
              publisherScore={publisher.publisher_score}
              avgResponseHours={publisher.avg_response_hours}
              responseCount={publisher.response_count}
              lastActiveAt={publisher.last_active_at}
              className="mb-3"
            />

            {/* Compare + Save actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => togglePublisher(publisher.id)}
                disabled={!comparing && isFull}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border-2 transition ${
                  comparing
                    ? "border-billboard-green bg-billboard-green text-white"
                    : "border-billboard-ink hover:bg-billboard-paperDim disabled:opacity-40"
                }`}
              >
                {comparing ? "✓ In comparison" : isFull ? "Comparison full" : "⊞ Compare"}
              </button>
              {comparing && (
                <Link to="/compare" className="text-xs font-semibold underline text-billboard-green">View comparison →</Link>
              )}

              {/* Save dropdown */}
              <div className="relative" ref={saveRef}>
                <button
                  onClick={() => setShowSave(s => !s)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border-2 transition ${
                    saved
                      ? "border-billboard-yellow bg-billboard-yellow text-billboard-ink"
                      : "border-billboard-ink hover:bg-billboard-paperDim"
                  }`}
                >
                  {saved ? "★ Saved to list" : "☆ Save to list"}
                </button>
                {showSave && (
                  <div className="absolute top-full mt-1 left-0 z-30 w-56 bg-white border-[3px] border-billboard-ink rounded shadow-block overflow-hidden">
                    {lists.length > 0 && (
                      <div className="max-h-40 overflow-y-auto">
                        {lists.map(list => (
                          <button
                            key={list.id}
                            onClick={() => { addToList(list.id, publisher.id); setShowSave(false); }}
                            className="w-full text-left px-3 py-2.5 text-xs font-semibold hover:bg-billboard-paperDim border-b border-billboard-paperDim last:border-0 truncate"
                          >
                            {list.publisherIds.includes(publisher.id) ? "✓ " : "+ "}{list.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <form onSubmit={handleSaveToNewList} className={`p-2.5 ${lists.length > 0 ? "border-t-2 border-billboard-paperDim" : ""}`}>
                      <p className="text-[10px] font-mono uppercase text-billboard-inkSoft mb-1.5">New list</p>
                      <input
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        placeholder="e.g. Winter Campaign"
                        className="w-full border-2 border-billboard-ink rounded px-2 py-1.5 text-xs mb-2 bg-white"
                        autoFocus={lists.length === 0}
                      />
                      <Button type="submit" variant="primary" size="sm" className="w-full">
                        Create & save
                      </Button>
                    </form>
                    <Link to="/lists" onClick={() => setShowSave(false)} className="block text-center text-[10px] font-mono uppercase text-billboard-inkSoft py-2 hover:bg-billboard-paperDim border-t border-billboard-paperDim">
                      Manage lists →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_320px] gap-10 pb-20">
          {/* ── Left column ── */}
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              {publisher.platforms.map(p => (
                <span key={p} className="font-mono text-xs border-2 border-billboard-ink rounded-full px-3 py-1 bg-billboard-paperDim">{p}</span>
              ))}
              {publisher.languages?.length > 0 && publisher.languages.map(l => (
                <span key={l} className="font-mono text-xs border-2 border-billboard-inkSoft rounded-full px-3 py-1 bg-white text-billboard-inkSoft">{l}</span>
              ))}
            </div>

            <PortfolioGallery introVideoUrl={publisher.intro_video_url} images={publisher.portfolio_images} isOwner={isOwner} />

            <h2 className="font-display text-lg mb-2">About {publisher.name}</h2>
            <p className="text-billboard-inkSoft mb-8 leading-relaxed">{publisher.bio}</p>

            <MarketplaceProfileView publisher={publisher} liveRating={liveRating} liveReviewCount={liveReviewCount} />
            {/* Was a second, separately-labeled "Audience: ..." paragraph
                much further down the page — confusing next to the
                "Audience" heading + stat cards MarketplaceProfileView
                already renders above. Grouped here as a continuation of
                that same section instead of a stray duplicate. */}
            {publisher.audience && <p className="text-sm text-billboard-inkSoft mb-6">{publisher.audience}</p>}
            <EarnedBadges publisher={publisher} categoryPeers={publishers.filter((p) => p.category === publisher.category)} />
            {/* 12-Channel Audit fix C5 — an aggregate star rating alone
                doesn't do much educating for a buyer unfamiliar with what
                "good" looks like on a less-mainstream channel (would you
                book a taxi-fleet campaign off a bare 4.8 rating with zero
                context?) — a real quote does. Picks the highest-rated
                review that actually has comment text, not just whichever
                is most recent. */}
            {(() => {
              const featured = [...reviews].filter((r) => r.comment && r.comment.trim().length > 0).sort((a, b) => b.rating - a.rating)[0];
              if (!featured) return null;
              return (
                <div className="border-2 border-billboard-ink rounded p-4 mb-4 bg-billboard-paperDim">
                  <div className="text-billboard-yellow mb-1">{"★".repeat(featured.rating)}{"☆".repeat(5 - featured.rating)}</div>
                  <p className="text-sm italic mb-1">"{featured.comment}"</p>
                  <p className="text-xs text-billboard-inkSoft">— {featured.business?.company_name || featured.business?.full_name || "A verified business"}</p>
                </div>
              );
            })()}
            {publisher.monthly_reach != null && (
              <div className="border-2 border-billboard-ink rounded p-4 mb-4">
                <div className="font-display text-xl">{publisher.monthly_reach.toLocaleString()}</div>
                <div className="text-xs font-mono uppercase text-billboard-inkSoft mt-1">Monthly reach</div>
              </div>
            )}
            {publisher.ai_audience_summary && (
              <div className="border-2 border-billboard-green rounded p-4 mb-4 bg-[#EAF3EC]">
                <p className="font-mono text-[10px] uppercase text-billboard-greenDeep font-semibold mb-1">Audience summary — from verified follower data</p>
                <p className="text-sm text-billboard-inkSoft">{publisher.ai_audience_summary}</p>
              </div>
            )}

            {/* Availability calendar */}
            <div className="mb-8">
              <h2 className="font-display text-lg mb-1">Availability</h2>
              <p className="text-sm text-billboard-inkSoft mb-3">
                {isOwner
                  ? "Click dates to mark them as unavailable. Businesses can see this before requesting."
                  : "Check availability before sending a campaign request."}
              </p>
              <AvailabilityCalendar publisherId={publisher.id} canEdit={isOwner} />
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <>
                <h2 className="font-display text-lg mb-3 mt-8">What businesses say</h2>
                <div className="space-y-4">
                  {reviews.map(rev => (
                    <div key={rev.id} className="border-2 border-billboard-ink rounded p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm">{rev.business?.company_name || rev.business?.full_name || "A business"}</span>
                        <span className="text-billboard-yellow text-sm">{"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}</span>
                      </div>
                      {rev.communication_rating != null && (
                        <p className="text-[11px] font-mono uppercase text-billboard-inkSoft mb-1.5">
                          Communication {rev.communication_rating} · Professionalism {rev.professionalism_rating} · Quality {rev.quality_rating} · Timeliness {rev.timeliness_rating} · Value {rev.value_rating}
                        </p>
                      )}
                      {rev.comment && <p className="text-sm text-billboard-inkSoft">{rev.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="border-[3px] border-billboard-ink rounded p-6 h-fit bg-billboard-paperDim md:sticky md:top-24">
            {isRequestFlowChannel ? (
              <>
                <div className="font-display text-lg font-bold text-billboard-greenDeep mb-1">Pricing varies</div>
                <div className="text-xs text-billboard-inkSoft mb-5">Propose your budget in the request below — minimum recommended is {formatCurrency(channelDef?.minBudgetZAR ?? 0)}.</div>
              </>
            ) : (
              <RateCardDisplay publisherId={publisher.id} fallbackPrice={publisher.price_per_post} />
            )}

            {/* Media kit */}
            <div className="mb-5">
              <Link
                to={`/media-kit?publisher=${publisher.id}`}
                className="w-full inline-flex justify-center items-center gap-2 border-[3px] border-billboard-ink font-bold py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white"
              >
                <MarketingIcon name="document" className="w-4 h-4" /> Download Media Kit
              </Link>
            </div>

            {!canRequestPlacement ? (
              <div className="border-2 border-billboard-ink rounded p-4 mb-3 bg-white">
                <div className="font-display text-base mb-1">Campaign requests are sent by businesses</div>
                <p className="text-xs text-billboard-inkSoft">
                  {isOwner
                    ? "This is your own listing — campaign requests come from registered businesses, not from publishers."
                    : `Only registered businesses can send a campaign request to ${publisher.name}.`}
                </p>
              </div>
            ) : isRequestFlowChannel ? (
              <ChannelRequestForm publisher={publisher} />
            ) : sent ? (
              <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] text-billboard-greenDeep rounded p-5">
                <div className="flex items-center gap-2 mb-2 font-display text-base text-billboard-greenDeep">
                  <span>✓</span> Campaign Request Received!
                </div>
                <p className="text-xs text-billboard-inkSoft mb-3">
                  ChatSched is reviewing your brief and will coordinate directly with <strong>{publisher.name}</strong>.
                </p>
                <div className="border-2 border-billboard-green/40 rounded p-3 bg-white text-xs text-billboard-inkSoft mb-4 space-y-1">
                  <p><strong className="text-billboard-ink">Goal:</strong> {goal === "Other (Custom)" && customGoal ? customGoal : goal}</p>
                  <p><strong className="text-billboard-ink">Dates:</strong> {targetDates === "Specific dates" && customDates ? customDates : targetDates}</p>
                  <p><strong className="text-billboard-ink">Deliverables:</strong> {deliverables === "Custom Deliverable" && customDeliverables ? customDeliverables : deliverables}</p>
                  {budget && <p><strong className="text-billboard-ink">Budget:</strong> {formatCurrency(Number(budget))}</p>}
                </div>
                <Link
                  to="/dashboard"
                  className="w-full inline-flex justify-center items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold py-2.5 rounded hover:-translate-y-0.5 transition text-xs text-billboard-ink"
                >
                  Track in Dashboard →
                </Link>
              </div>
            ) : !user ? (
              <div className="border-2 border-billboard-ink rounded p-4 mb-3 bg-white">
                <div className="font-display text-base mb-1">Start Campaign Request</div>
                <p className="text-xs text-billboard-inkSoft mb-3">Log in to send your campaign brief to ChatSched for {publisher.name}.</p>
                <Link to={`/login?next=${encodeURIComponent(`/browse/${publisher.id}`)}`} className="w-full inline-flex justify-center bg-billboard-yellow border-[3px] border-billboard-ink font-bold py-2.5 rounded hover:-translate-y-0.5 transition text-sm">
                  Log in to Start Request
                </Link>
                <p className="text-xs text-billboard-inkSoft mt-2">New here? <Link to="/register" className="underline font-semibold">Create a business account</Link></p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mb-3">
                {subscriptionChecked && !canUseBusinessFeature && <SubscriptionGateNotice role="business" />}
                <fieldset disabled={!subscriptionChecked || !canUseBusinessFeature} className="border-0 p-0 m-0 min-w-0 disabled:opacity-50 space-y-3">
                  <div className="border-b-2 border-billboard-ink/10 pb-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-display text-base">Start Campaign Request</h3>
                      <span className="bg-billboard-greenDeep text-white text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded">
                        Managed
                      </span>
                    </div>
                    <p className="text-[11px] text-billboard-inkSoft">
                      ChatSched handles the publisher relationship: briefing, scheduling, verification, and payment protection. Sending a brief doesn't charge you — ChatSched reviews it and confirms with {publisher.name} before anything is booked.
                    </p>
                  </div>

                  {/* 1. Goal */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1">
                      1. Campaign Goal
                    </label>
                    <select
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-xs"
                    >
                      <option value="Brand Awareness">Brand Awareness</option>
                      <option value="Product / Service Launch">Product / Service Launch</option>
                      <option value="Lead Generation">Lead Generation</option>
                      <option value="Sales / App Conversions">Sales / App Conversions</option>
                      <option value="Event Promotion">Event Promotion</option>
                      <option value="Content & UGC Creation">Content & UGC Creation</option>
                      <option value="Other (Custom)">Other (Custom)</option>
                    </select>
                    {goal === "Other (Custom)" && (
                      <input
                        type="text"
                        value={customGoal}
                        onChange={(e) => setCustomGoal(e.target.value)}
                        placeholder="Specify campaign goal"
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 mt-2 bg-white text-xs"
                        required
                      />
                    )}
                  </div>

                  {/* 2. Dates */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1">
                      2. Target Dates / Timeline
                    </label>
                    <select
                      value={targetDates}
                      onChange={(e) => setTargetDates(e.target.value)}
                      className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-xs"
                    >
                      <option value="Immediate (Next 7–14 days)">Immediate (Next 7–14 days)</option>
                      <option value="Next 2–4 weeks">Next 2–4 weeks</option>
                      <option value="Next month">Next month</option>
                      <option value="Specific dates">Specific dates</option>
                    </select>
                    {targetDates === "Specific dates" && (
                      <input
                        type="text"
                        value={customDates}
                        onChange={(e) => setCustomDates(e.target.value)}
                        placeholder="e.g. 15 Oct – 20 Oct"
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 mt-2 bg-white text-xs"
                        required
                      />
                    )}
                  </div>

                  {/* 3. Budget */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold uppercase tracking-wide">
                        3. Proposed Budget (ZAR)
                      </label>
                      <span className="text-[11px] text-billboard-inkSoft font-mono">
                        Rate: {formatCurrency(publisher.price_per_post)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder={`e.g. ${publisher.price_per_post}`}
                      className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-xs"
                    />
                  </div>

                  {/* 4. Deliverables */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1">
                      4. Deliverables
                    </label>
                    <select
                      value={deliverables}
                      onChange={(e) => setDeliverables(e.target.value)}
                      className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-xs"
                    >
                      <option value="1x Feed Post">1x Feed Post</option>
                      <option value="2x Stories with Link">2x Stories with Link</option>
                      <option value="1x Reel / Video">1x Reel / Video</option>
                      <option value="1x Feed Post + 2x Stories">1x Feed Post + 2x Stories</option>
                      <option value="Dedicated Shoutout / Broadcast">Dedicated Shoutout / Broadcast</option>
                      <option value="Custom Deliverable">Custom Deliverable</option>
                    </select>
                    {deliverables === "Custom Deliverable" && (
                      <input
                        type="text"
                        value={customDeliverables}
                        onChange={(e) => setCustomDeliverables(e.target.value)}
                        placeholder="e.g. 3 TikTok videos + link in bio"
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 mt-2 bg-white text-xs"
                        required
                      />
                    )}
                  </div>

                  {/* 5. Requirements */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1">
                      5. Requirements & Brief
                    </label>
                    <textarea
                      required
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      rows={3}
                      placeholder="Key talking points, hashtags, target links, and brand do's & don'ts"
                      className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-xs"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1">
                      Additional Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Special instructions or asset links"
                      className="w-full border-2 border-billboard-ink rounded px-3 py-2 bg-white text-xs"
                    />
                  </div>

                  {/* Agency Assurance */}
                  <div className="border-2 border-billboard-green rounded p-2.5 bg-[#EAF3EC] text-xs text-billboard-inkSoft space-y-0.5">
                    <p className="font-bold text-billboard-greenDeep flex items-center gap-1">
                      <MarketingIcon name="shield" className="w-4 h-4" /> ChatSched Agency Managed
                    </p>
                    <p className="text-[11px] leading-tight">
                      ChatSched handles the publisher relationship: briefing, rate negotiation, schedule coordination, and held payouts. No money changes hands until confirmed.
                    </p>
                  </div>

                  {formError && <p className="text-billboard-red text-xs font-semibold">{formError}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-billboard-yellow border-[3px] border-billboard-ink font-bold py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60 text-xs shadow-block"
                  >
                    {sending ? "Sending Brief to ChatSched…" : "Send Campaign Brief →"}
                  </button>
                </fieldset>
              </form>
            )}

            {user && (profile?.role === "business" || profile?.role === "publisher" || isAdmin) && (
              <button
                onClick={() => setReportOpen(true)}
                className="w-full text-center text-xs text-billboard-inkSoft underline mt-3 hover:text-billboard-red transition"
              >
                Report this publisher
              </button>
            )}
          </aside>
        </div>
      </div>

      {reportOpen && (
        <ReportPublisherModal
          publisherId={publisher.id}
          publisherName={publisher.name}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "fake_followers", label: "Fake followers / engagement" },
  { value: "no_response", label: "Not responding to requests" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "other", label: "Other" },
];

function ReportPublisherModal({ publisherId, publisherName, onClose }: { publisherId: string; publisherName: string; onClose: () => void }) {
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      setError("You need to be logged in to report a publisher.");
      return;
    }
    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: user.id,
      publisher_id: publisherId,
      reason,
      details: details.trim() || null,
    });
    setSending(false);
    if (insertError) {
      setError(formatSupabaseError(insertError, "Couldn't send that report"));
      return;
    }
    setSent(true);
  }

  return (
    <div className="fixed inset-0 bg-billboard-ink/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border-[3px] border-billboard-ink rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <>
            <h3 className="font-display text-lg mb-2">Report sent</h3>
            <p className="text-sm text-billboard-inkSoft mb-5">Thanks — an admin will review it. This publisher won't be told who reported them.</p>
            <button onClick={onClose} className="w-full border-[3px] border-billboard-ink font-bold py-2.5 rounded hover:-translate-y-0.5 transition">Close</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3 className="font-display text-lg mb-1">Report {publisherName}</h3>
            <p className="text-sm text-billboard-inkSoft mb-4">This goes to ChatSched admin only — the publisher won't see who filed it.</p>

            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-3 bg-white">
              {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Details (optional)</label>
            <textarea
              value={details} onChange={(e) => setDetails(e.target.value)} rows={3}
              placeholder="Anything that would help admin look into this"
              className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-sm mb-4"
            />

            {error && <p className="text-billboard-red text-xs font-semibold mb-3">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="md" disabled={sending} className="flex-1">
                {sending ? "Sending…" : "Send report"}
              </Button>
              <button type="button" onClick={onClose} className="border-[3px] border-billboard-ink font-bold px-4 rounded hover:-translate-y-0.5 transition">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
