import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { redirectToPayfast } from "../lib/payfastRedirect";
import { buildAndDownloadInvoice, chatSchedInvoiceParty } from "../lib/invoice";
import BankDetailsPanel from "../components/BankDetailsPanel";
import EscrowNote from "../components/EscrowNote";
import { formatCurrency } from "../lib/currency";
import MessageThread from "../components/MessageThread";
import CampaignComplianceStrip from "../components/CampaignComplianceStrip";
import DisputeSection from "../components/DisputeSection";
import ChannelCampaignCard from "../components/ChannelCampaignCard";
import PublisherDashboardView from "../components/PublisherDashboardView";
import BusinessHomeSummary from "../components/BusinessHomeSummary";
import MarketingSuite from "../components/marketingSuite/MarketingSuite";
import ActivationNudge from "../components/ActivationNudge";
import CampaignRollup from "../components/CampaignRollup";
import ManagedCampaignsSection from "../components/ManagedCampaignsSection";
import Seo from "../components/Seo";
import { SkeletonRows } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { computeVerificationLevel } from "../lib/businessVerification";
import TrustBadge from "../components/TrustBadge";
import { computeBusinessChecklist } from "../lib/onboardingChecklist";
import OnboardingChecklist from "../components/OnboardingChecklist";
import Button from "../components/Button";
import type { Profile, PublisherRequest, RequestStatus, ChannelRequest } from "../lib/types";

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-billboard-paperDim text-billboard-inkSoft border-billboard-inkSoft",
  contacted: "bg-billboard-yellow text-billboard-ink border-billboard-ink",
  confirmed: "bg-billboard-green text-white border-billboard-greenDeep",
  declined: "bg-white text-billboard-red border-billboard-red",
  completed: "bg-billboard-ink text-white border-billboard-ink",
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<PublisherRequest[]>([]);
  const [channelRequests, setChannelRequests] = useState<ChannelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Publisher-role-only — toggles the opt-in "also see my business
  // activity" section on the publisher dashboard view (see the role
  // branch below). Not persisted; resets to hidden each visit, on purpose
  // — most publishers aren't also advertisers, so defaulting to hidden
  // keeps the primary publisher view uncluttered for them.
  const [showBusinessView, setShowBusinessView] = useState(false);

  async function load() {
    if (!user) return;
    const [{ data }, { data: channelData }] = await Promise.all([
      supabase
        .from("requests")
        .select("*, publisher:publishers(id, name, city, province), payments(*), reviews(*)")
        .eq("business_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("channel_requests")
        .select("*, creator:publishers(id, name, city, province, channel_slug)")
        .eq("business_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setRequests((data ?? []) as unknown as PublisherRequest[]);
    setChannelRequests((channelData ?? []) as unknown as ChannelRequest[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Admins manage things from /admin instead.
  if (profile?.role === "admin") return <Navigate to="/admin" replace />;

  // Publishers get their own view by default — requests, scores, and a way
  // to review the business once a campaign's done. But `requests`/
  // `channel_requests` above are already loaded by business_id = this same
  // user, role-agnostic (see load()) — nothing in the schema stops a
  // publisher from also being a business, so rather than hard-gating them
  // out of ever seeing it, a publisher gets an explicit, opt-in toggle to
  // the same business view everyone else gets. Off by default: most
  // publishers aren't also advertisers, and the toggle costs them nothing
  // unused.
  //
  // CHANNEL_UPDATES_AUDIT.md's own remaining gap, closed here: this used
  // to render only BusinessHomeSummary + two links — a deliberately
  // narrow first pass, not the full business experience (onboarding
  // checklist, marketing suite, campaign rollup, managed campaigns,
  // request/channel-request lists). Now renders BusinessDashboardBody,
  // the exact same component the primary business view below uses — one
  // shared body, not two maintained copies of the same ~70 lines of JSX.
  if (profile?.role === "publisher") {
    return (
      <div>
        <PublisherDashboardView />
        <div className="max-w-4xl mx-auto px-5 pb-14 -mt-4">
          {!showBusinessView ? (
            <button
              onClick={() => setShowBusinessView(true)}
              className="w-full text-left border-2 border-dashed border-billboard-inkSoft rounded p-4 text-sm text-billboard-inkSoft hover:border-billboard-ink hover:text-billboard-ink transition"
            >
              Also want to book campaigns as a business? <span className="font-semibold underline">Show my business activity →</span>
            </button>
          ) : (
            <div className="border-t-4 border-billboard-ink pt-6 mt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded">Your business activity</span>
                <button onClick={() => setShowBusinessView(false)} className="text-xs font-semibold text-billboard-inkSoft hover:text-billboard-ink underline">Hide</button>
              </div>
              <BusinessDashboardBody profile={profile} requests={requests} channelRequests={channelRequests} loading={loading} user={user} onRefresh={load} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-16">
      <Seo title="Your Dashboard · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Your dashboard</span>

      <BusinessDashboardBody profile={profile} requests={requests} channelRequests={channelRequests} loading={loading} user={user} onRefresh={load} />
    </div>
  );
}

// Everything a business account sees below the page-level "Your
// dashboard" heading — extracted so the publisher-role dual-view toggle
// above and the primary business view here render the exact same body,
// not two maintained copies of it. Every child component here already
// fetches or receives whatever it needs on its own (ManagedCampaignsSection,
// CampaignRollup, MarketingSuite take no props at all) — nothing here
// depends on which of the two call sites rendered it.
function BusinessDashboardBody({
  profile, requests, channelRequests, loading, user, onRefresh,
}: {
  profile: Profile | null;
  requests: PublisherRequest[];
  channelRequests: ChannelRequest[];
  loading: boolean;
  user: { id: string; email?: string | null } | null;
  onRefresh: () => void;
}) {
  return (
    <>
      <ActivationNudge />

      {!loading && <BusinessHomeSummary profile={profile} requests={requests} channelRequests={channelRequests} />}

      <p className="text-billboard-inkSoft mb-6">
        Track every campaign request you've sent, in one place.{" "}
        <Link to="/messages" className="font-semibold underline">Open Messages →</Link>
        {" · "}
        <Link to="/saved-searches" className="font-semibold underline">Saved Searches →</Link>
        {" · "}
        <Link to="/account" className="font-semibold underline">Manage account & data →</Link>
      </p>

      {user && !loading && (
        <OnboardingChecklist
          title="Getting started"
          items={computeBusinessChecklist(profile, requests, channelRequests, user.email)}
          storageKey={`cs_onboarding_business_${user.id}`}
        />
      )}

      {profile && <BusinessProfileCard profile={profile} onSaved={onRefresh} />}

      {/* Renders nothing unless this business is an active managed client
          — see ManagedCampaignsSection's own header comment. */}
      <ManagedCampaignsSection />

      {/* Rolled-up totals across every campaign this business has tracked. */}
      <CampaignRollup />

      {/* Marketing Suite. */}
      <MarketingSuite />

      <h2 className="font-display text-lg mb-4" id="your-requests">Your requests</h2>

      {loading ? (
        <SkeletonRows count={2} />
      ) : requests.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded">
          <EmptyState
            kind="list"
            title="No requests yet"
            description="Browse publishers to book your first campaign."
            compact
            action={
              <Link to="/browse" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition text-sm bg-white">
                Browse publishers
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => <RequestCard key={r.id} request={r} onChange={onRefresh} />)}
        </div>
      )}

      {channelRequests.length > 0 && (
        <>
          <h2 className="font-display text-lg mb-4 mt-10">Your channel campaigns</h2>
          <p className="text-xs text-billboard-inkSoft -mt-3 mb-4">Influencer, website, podcast and radio requests you've sent.</p>
          <div className="space-y-4">
            {channelRequests.map((r) => <ChannelCampaignCard key={r.id} request={r} onChange={onRefresh} />)}
          </div>
        </>
      )}
    </>
  );
}

function RequestCard({ request: r, onChange }: { request: PublisherRequest; onChange: () => void }) {
  const { user, profile } = useAuth();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [showPayfast, setShowPayfast] = useState(false);
  const [confirmingEft, setConfirmingEft] = useState(false);
  const [eftError, setEftError] = useState<string | null>(null);
  const [bookingAgain, setBookingAgain] = useState(false);
  const [bookAgainError, setBookAgainError] = useState<string | null>(null);
  const [bookAgainDone, setBookAgainDone] = useState(false);
  const [confirmingBookAgain, setConfirmingBookAgain] = useState(false);

  const payment = [...(r.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const review = r.reviews?.[0];
  const eftReference = `CS-${r.id.slice(0, 8).toUpperCase()}`;

  async function handlePay() {
    setPaying(true);
    setPayError(null);
    try {
      const { data, error } = await supabase.functions.invoke("payfast-checkout", { body: { request_id: r.id } });
      setPaying(false);
      if (error || data?.error) {
        setPayError(data?.error ?? "Couldn't start the payment — try again in a moment.");
        return;
      }
      redirectToPayfast(data.action_url, data.fields);
    } catch {
      // A genuine network failure (offline, dropped connection) throws
      // here instead of returning an { error } result — without this,
      // setPaying(false) above never runs and the button is left
      // permanently disabled with no way to retry short of a refresh.
      setPaying(false);
      setPayError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  async function handleConfirmEft() {
    if (!user || r.agreed_amount == null) return;
    setConfirmingEft(true);
    setEftError(null);

    try {
      let paymentId = payment?.method === "eft" ? payment.id : null;
      if (!paymentId) {
        const { data: created, error: insertError } = await supabase.from("payments").insert({
          request_id: r.id, business_id: user.id, amount: r.agreed_amount, method: "eft", eft_reference: eftReference,
        }).select().single();
        if (insertError || !created) {
          setConfirmingEft(false);
          setEftError("Couldn't start that — try again in a moment.");
          return;
        }
        paymentId = created.id;
      }

      const { error: updateError } = await supabase.from("payments").update({ eft_confirmed_by_business_at: new Date().toISOString() }).eq("id", paymentId);
      setConfirmingEft(false);
      if (updateError) {
        setEftError("Payment was recorded, but confirming it failed — refresh and try again.");
        return;
      }
      onChange();
    } catch {
      // Same reasoning as handlePay's catch above.
      setConfirmingEft(false);
      setEftError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link to={`/browse/${r.publisher_id}`} className="font-bold hover:text-billboard-greenDeep">
            {r.publisher?.name ?? "Publisher"}
          </Link>
          <p className="text-sm text-billboard-inkSoft mt-1 max-w-md">{r.campaign_message}</p>
          {r.budget != null && <p className="text-xs text-billboard-inkSoft mt-1 font-mono">Suggested budget: {formatCurrency(r.budget)}</p>}
        </div>
        <span className={`inline-block font-mono text-xs font-semibold uppercase px-3 py-1.5 rounded border-2 shrink-0 ${STATUS_STYLE[r.status]}`}>
          {r.status}
        </span>
      </div>

      {r.status === "pending" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          Our team reviews every request by hand — you'll hear back once someone's looked at this, usually within a day or two.
        </p>
      )}

      {r.status === "contacted" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          We've reached out about this one — check your email, or reply from wherever we contacted you. Nothing to pay yet.
        </p>
      )}

      {r.status === "declined" && (
        <p className="text-sm text-billboard-inkSoft border-t-2 border-billboard-paperDim pt-4 mt-1">
          This request wasn't taken forward. <Link to="/browse" className="underline font-semibold text-billboard-ink">Browse other publishers</Link> if you'd like to try again.
        </p>
      )}

      {payment?.status === "paid" && (
        <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-billboard-greenDeep">✓ Paid — {formatCurrency(payment.amount)}</p>
          <button
            onClick={() => downloadBusinessInvoice(r, payment, profile)}
            className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:bg-billboard-paperDim transition"
          >
            Download Invoice
          </button>
          {r.status !== "completed" && (
            <p className="text-xs text-billboard-inkSoft w-full">Nothing else needed from you — we'll mark this completed once the placement's run, and you'll be able to leave a review.</p>
          )}
        </div>
      )}

      {r.status === "confirmed" && payment?.status !== "paid" && (
        <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
          {r.agreed_amount == null ? (
            <p className="text-sm text-billboard-inkSoft">Confirmed — we'll set a final amount shortly, then you can pay here.</p>
          ) : payment?.method === "eft" && payment.eft_confirmed_by_business_at ? (
            <p className="text-sm text-billboard-inkSoft">
              You confirmed this payment on {new Date(payment.eft_confirmed_by_business_at).toLocaleDateString("en-ZA")} — waiting on ChatSched to verify it's arrived.
            </p>
          ) : payment?.method === "payfast" && payment.status === "pending" ? (
            <div>
              <p className="text-sm text-billboard-inkSoft mb-2">Payment in progress via PayFast — this updates automatically once PayFast confirms it.</p>
              <button onClick={handlePay} disabled={paying} className="border-[3px] border-billboard-ink font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
                {paying ? "Redirecting…" : "Try PayFast again"}
              </button>
              {payError && <p className="text-billboard-red text-xs font-semibold mt-2">{payError}</p>}
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-billboard-ink mb-1">Pay by EFT — {formatCurrency(r.agreed_amount)}</p>
              <p className="text-xs text-billboard-inkSoft mb-3">Pay directly into our account using the reference exactly as shown, then confirm below.</p>
              <EscrowNote until="your campaign is completed" />
              <div className="mb-3">
                <BankDetailsPanel amount={r.agreed_amount} reference={eftReference} />
              </div>
              <button
                onClick={handleConfirmEft}
                disabled={confirmingEft}
                className="bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60"
              >
                {confirmingEft ? "Confirming…" : "I've made this payment"}
              </button>
              {eftError && <p className="text-billboard-red text-xs font-semibold mt-2">{eftError}</p>}

              {!showPayfast ? (
                <button onClick={() => setShowPayfast(true)} className="block mt-3 text-xs font-semibold underline text-billboard-inkSoft hover:text-billboard-ink">
                  Prefer to pay by card via PayFast instead?
                </button>
              ) : (
                <div className="mt-3 pt-3 border-t border-billboard-ink/10">
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="border-[3px] border-billboard-ink font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60"
                  >
                    {paying ? "Redirecting…" : `Pay via PayFast — ${formatCurrency(r.agreed_amount)}`}
                  </button>
                  {payError && <p className="text-billboard-red text-xs font-semibold mt-2">{payError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {r.status === "completed" && (
        <div className="mt-4 pt-4 border-t-2 border-billboard-paperDim">
          {review ? (
            <p className="text-sm text-billboard-inkSoft">You rated this campaign {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
          ) : (
            <ReviewForm request={r} onDone={onChange} />
          )}
        </div>
      )}

      {/* Quick "Book again" button for businesses who ran this campaign */}
      {profile?.role === "business" && user?.id === r.business_id && r.status === "completed" && (
        <div className="mt-4">
          {bookAgainDone ? (
            <p className="text-sm font-semibold text-billboard-greenDeep">Request created — the publisher will be notified.</p>
          ) : !confirmingBookAgain ? (
            <button
              onClick={() => setConfirmingBookAgain(true)}
              className="font-mono text-xs font-semibold uppercase border-2 border-billboard-yellow bg-billboard-yellow text-billboard-ink rounded px-3 py-1.5"
            >
              Book again
            </button>
          ) : (
            <div className="border-2 border-billboard-ink rounded p-3 bg-billboard-paperDim">
              <p className="text-xs font-semibold mb-2">Create a new request with the same message and budget?</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!user) { setBookAgainError("Please sign in to book again."); return; }
                    setBookingAgain(true);
                    setBookAgainError(null);
                    try {
                      const { data: newReq, error } = await supabase.from("requests").insert({
                        publisher_id: r.publisher_id,
                        business_id: user.id,
                        campaign_message: r.campaign_message,
                        budget: r.budget,
                        status: "pending",
                      }).select().single();
                      if (error) throw error;
                      // best-effort notify (non-blocking)
                      supabase.functions.invoke("notify", { body: { kind: "new_request", request_id: newReq.id } }).catch(() => {});
                      setBookingAgain(false);
                      setConfirmingBookAgain(false);
                      setBookAgainDone(true);
                      onChange();
                    } catch (err) {
                      setBookingAgain(false);
                      setBookAgainError(formatSupabaseError(err, "Could not create request"));
                    }
                  }}
                  disabled={bookingAgain}
                  className="font-mono text-xs font-semibold uppercase bg-billboard-green text-white border-2 border-billboard-ink rounded px-3 py-1.5 hover:-translate-y-0.5 transition disabled:opacity-60"
                >
                  {bookingAgain ? "Creating…" : "Yes, book again"}
                </button>
                <button
                  onClick={() => setConfirmingBookAgain(false)}
                  disabled={bookingAgain}
                  className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:bg-white transition disabled:opacity-60"
                >
                  Never mind
                </button>
              </div>
              {bookAgainError && <p className="text-billboard-red text-xs font-semibold mt-2">{bookAgainError}</p>}
            </div>
          )}
        </div>
      )}

      <Link to={`/campaigns/${r.id}`} className="inline-block font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft underline mt-3">
        Open campaign workspace →
      </Link>
      <CampaignComplianceStrip campaignId={r.id} />
      <MessageThread requestId={r.id} senderRole="business" />
      {(r.status === "confirmed" || r.status === "completed") && <DisputeSection requestId={r.id} />}
    </div>
  );
}

// Builds the SARS-compliant "Billed to" party for a business invoice —
// full postal address (street, suburb, city, province, postal code) plus
// the business's own VAT number if they've entered one, rather than just
// a name and phone number. Any address field the business hasn't filled
// in yet is simply left out of the lines array — the invoice omits what
// it doesn't have rather than showing a blank line.
function billedToParty(profile: Profile | null) {
  const billName = profile?.company_name || profile?.full_name || "Your business";
  const addressLines = [
    profile?.address_line1,
    profile?.address_line2,
    [profile?.city, profile?.province].filter(Boolean).join(", "),
    profile?.postal_code,
  ].filter((l): l is string => Boolean(l && l.trim()));
  return {
    heading: "Billed to",
    lines: [billName, ...addressLines, ...(profile?.phone ? [profile.phone] : [])],
    vatNumber: profile?.vat_number ?? null,
  };
}

function downloadBusinessInvoice(r: PublisherRequest, payment: NonNullable<PublisherRequest["payments"]>[number], profile: Profile | null) {
  const invoiceNumber = `MB-${payment.id.slice(0, 8).toUpperCase()}`;
  const issueDate = new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  buildAndDownloadInvoice({
    invoiceNumber,
    issueDate,
    statusLabel: `Paid${payment.paid_at ? ` on ${new Date(payment.paid_at).toLocaleDateString("en-ZA")}` : ""}`,
    billTo: billedToParty(profile),
    from: chatSchedInvoiceParty(),
    description: `Advertising placement — ${r.publisher?.name ?? "Publisher"}`,
    channelLabel: "Social Media",
    grossAmount: payment.amount,
    showCommissionSplit: false,
    fileName: `invoice-${invoiceNumber}`,
  });
}

function ReviewForm({ request, onDone }: { request: PublisherRequest; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating === 0) {
      setError("Pick a star rating first.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("reviews").insert({
      request_id: request.id,
      publisher_id: request.publisher_id,
      business_id: request.business_id,
      rating,
      comment: comment || null,
    });
    setSaving(false);
    if (error) setError(formatSupabaseError(error, "Couldn't submit review"));
    else onDone();
  }

  return (
    <div>
      <p className="text-sm font-semibold mb-2">How did it go with {request.publisher?.name ?? "this publisher"}?</p>
      <div className="flex gap-1 mb-3 text-2xl leading-none">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`} className="text-billboard-yellow">
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Optional — what stood out?"
        className="w-full border-2 border-billboard-ink rounded px-3 py-2 mb-3 bg-white text-sm"
      />
      {error && <p className="text-billboard-red text-xs font-semibold mb-2">{error}</p>}
      <button onClick={submit} disabled={saving} className="border-[3px] border-billboard-ink font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60">
        {saving ? "Saving…" : "Submit review"}
      </button>
    </div>
  );
}

// email_verified / phone_verified / business_verified are never editable
// here — trg_prevent_self_verification (schema_phase7.sql) silently resets
// them for anyone but an admin, so this form only ever touches the plain
// profile fields below it.
function BusinessProfileCard({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [companyName, setCompanyName] = useState(profile.company_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [province, setProvince] = useState(profile.province ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [industry, setIndustry] = useState(profile.industry ?? "");
  // Phase 81 (Business Value Proposition & Opportunities Engine).
  const [businessType, setBusinessType] = useState(profile.business_type ?? "");
  const [opportunityPreferences, setOpportunityPreferences] = useState<string[]>(profile.opportunity_preferences ?? []);
  const [website, setWebsite] = useState(profile.website ?? "");
  const [facebook, setFacebook] = useState(profile.facebook_url ?? "");
  const [instagram, setInstagram] = useState(profile.instagram_url ?? "");
  // Phase 107 — SARS-compliant tax invoice fields. Kept in their own visual
  // group below the social links so the form still reads business-details
  // → online presence → invoicing, rather than mixing address fields in
  // among unrelated ones.
  const [addressLine1, setAddressLine1] = useState(profile.address_line1 ?? "");
  const [addressLine2, setAddressLine2] = useState(profile.address_line2 ?? "");
  const [postalCode, setPostalCode] = useState(profile.postal_code ?? "");
  const [vatNumber, setVatNumber] = useState(profile.vat_number ?? "");
  const [saving, setSaving] = useState(false);

  const level = computeVerificationLevel(profile);

  async function save() {
    setSaving(true);
    await supabase.from("profiles").update({
      full_name: fullName || null,
      company_name: companyName || null,
      phone: phone || null,
      province, city, industry, business_type: businessType || null, opportunity_preferences: opportunityPreferences,
      website: website || null,
      facebook_url: facebook || null,
      instagram_url: instagram || null,
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      postal_code: postalCode || null,
      vat_number: vatNumber || null,
    }).eq("id", profile.id);
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 mb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        {level ? (
          <span className="bg-billboard-ink text-white text-xs font-mono font-semibold px-2.5 py-1.5 rounded">
            <TrustBadge kind="business" level={level} />
          </span>
        ) : (
          <span className="text-xs font-mono uppercase text-billboard-inkSoft">Not yet verified</span>
        )}
        <button onClick={() => setEditing((e) => !e)} className="text-xs font-semibold underline text-billboard-inkSoft">
          {editing ? "Cancel" : "Edit business profile"}
        </button>
      </div>
      <p className="text-xs text-billboard-inkSoft">
        {profile.email_verified ? "✓ Email confirmed" : "Email not yet confirmed"}
        {" · "}{profile.phone_verified ? "✓ Phone verified" : "Phone not yet verified by us"}
        {" · "}{profile.business_verified ? "✓ Business verified" : "Not yet Gold verified"}
      </p>

      {editing && (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Your name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Company name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Province</label>
            <input value={province} onChange={(e) => setProvince(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Industry</label>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Business type</label>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm">
              <option value="">Select type</option><option>Educational Institution / School</option><option>Retail / SMME</option><option>Event Organizer</option><option>Corporate Brand</option><option>Venue Owner</option><option>Non-profit / Community Organisation</option><option>Sports Club / Organisation</option><option>Media / Publisher</option><option>Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">Opportunity interests</label>
            <input value={opportunityPreferences.join(", ")} onChange={(e) => setOpportunityPreferences(e.target.value.split(",").map(x => x.trim()).filter(Boolean))} placeholder="School Partnership, Newsletter Sponsorship, Venue Display" className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
            <p className="text-[11px] text-billboard-inkSoft mt-1">Separate multiple interests with commas.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Facebook</label>
            <input value={facebook} onChange={(e) => setFacebook(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Instagram</label>
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>

          <div className="sm:col-span-2 pt-3 mt-1 border-t-2 border-billboard-paperDim">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-billboard-inkSoft mb-1">Billing address</p>
            <p className="text-[11px] text-billboard-inkSoft mb-3">
              Used on your invoices — required by SARS for a proper tax invoice. Optional, but a downloaded invoice
              looks incomplete without it.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">Street address</label>
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="e.g. 12 Long Street" className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">
              Address line 2 <span className="font-normal text-billboard-inkSoft">(suburb, complex, unit — optional)</span>
            </label>
            <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Postal code</label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              VAT number <span className="font-normal text-billboard-inkSoft">(if registered)</span>
            </label>
            <input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="e.g. 4123456789" className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 text-sm" />
          </div>

          <Button variant="primary" size="md" onClick={save} disabled={saving} className="sm:col-span-2">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
