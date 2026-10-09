import { useEffect, useRef, useState } from "react";
import { podcastShowUrlError } from "../lib/podcastVerification";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { CATEGORIES, PROVINCES, PLATFORMS, PLACEMENT_TYPES, recommendedPlacementTypes, SA_SUBURBS_AUTOCOMPLETE, CREATOR_APPROVAL_WINDOW_DAYS, BUSINESS_PAYMENT_WINDOW_DAYS, CREATOR_PAYOUT_WINDOW_HOURS, PLATFORM_COMMISSION_RATE, PUBLISHER_SHARE } from "../lib/constants";
import { getChannelBySlug, isPublisherOnboardingChannel } from "../lib/channelRegistry";
import { calculateSuggestedPrice, MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import type { ChannelSlug } from "../lib/channelTypes";
import type { Platform } from "../lib/types";
import type { SocialMediaPlatform } from "../lib/channelOnboardingSchemas";
import { isAuthorityChannel, AUTHORITY_SUBJECT } from "../lib/channelOnboardingSchemas";
import {
  type FormState, initialState, buildChannelMetadata, buildInfluencerLinks, withAuthorityFlag,
  SOCIAL_MEDIA_PLATFORM_LABELS, isSocialMediaPlatform, getSelectedSocialPlatforms,
} from "../lib/channelOnboardingForm";
import ChannelSpecificFields, { AdFormatsPicker, inputClass, labelClass } from "../components/ChannelSpecificFields";
import Seo from "../components/Seo";
import ChannelIcon from "../components/ChannelIcon";
import { formatCurrency, formatCurrencyRange } from "../lib/currency";

const DEFAULT_MIN_FOLLOWERS = 3000;
const DEFAULT_CHECKS = [
  "My page/profile is public",
  "My audience is primarily South African",
  "I've posted in the last 30 days",
];
const APPLY_CHANNEL_STORAGE_KEY = "mb_apply_channel";

// Matches channels.verification_required in every schema_phase file that
// inserts a channels row (74, 75, 76, 77) — duplicated here because this
// page needs it before the first paint and a network round-trip to fetch
// it from `channels` isn't worth adding just for this. If a future channel
// changes this flag, update both places (see 12-Channel Audit fix A1/B1).
const VERIFICATION_REQUIRED_CHANNELS: ChannelSlug[] = ["sports", "events", "community", "transport", "informal-retail", "associations", "restaurants", "in-venue-screens"];

// 12-Channel Audit fix B6 — the Business step (company registration/VAT
// number) was already optional in the sense that nothing validates those
// fields before Continue — but the applicant still had to click through
// an extra screen asking for them. Skip it entirely for the two channels
// this audit specifically named as ChatSched's most inclusive, lowest-
// barrier tier (a spaza shop owner or an individual taxi operator almost
// certainly has neither a VAT number nor formal company registration).
// The step itself is untouched for every other channel.
const LOW_BARRIER_CHANNELS: ChannelSlug[] = ["informal-retail", "transport"];

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type Step = "eligibility" | "details" | "social" | "business" | "review" | "submitted" | "ineligible";
const STEPS: Step[] = ["eligibility", "details", "social", "business", "review"];


const continueClass = "bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition";
const backClass = "font-bold px-5 py-3";

export interface PublisherApplyProps {
  /**
   * Admin mode is intentionally separate from the public publisher flow.
   * It reuses this exact onboarding questionnaire and channel-metadata builder,
   * but an authenticated admin can publish the resulting listing immediately.
   */
  adminMode?: boolean;
  forcedChannel?: ChannelSlug;
  startStep?: Step;
  onAdminCreated?: (publisherId: string, channelSlug: ChannelSlug) => void;
}

export default function PublisherApply({ adminMode = false, forcedChannel, startStep, onAdminCreated }: PublisherApplyProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Which channel is this application for? URL param wins; falls back to
  // whatever Register.tsx stashed in sessionStorage when the applicant
  // clicked "Apply as a creator" on a channel page before signing up (that
  // context would otherwise be lost across the register → login → apply
  // hop, since RequireAuth doesn't carry a return-to destination).
  const paramChannel = searchParams.get("channel") as ChannelSlug | null;
  const storedChannel = (typeof window !== "undefined" ? sessionStorage.getItem(APPLY_CHANNEL_STORAGE_KEY) : null) as ChannelSlug | null;
  const channelSlug: ChannelSlug = forcedChannel || paramChannel || storedChannel || "social-media";
  const channelModule = getChannelBySlug(channelSlug) ?? getChannelBySlug("social-media")!;
  const ch = channelModule.definition;
  const isRequestFlow = ch.bookingFlow === "request";
  // Authority channels are asked "do you own or run this?", not for a number.
  const isAuthority = isAuthorityChannel(channelSlug);
  // Only social media and influencer have an engagement rate and a follower-based reach.
  const hasEngagement = channelSlug === "social-media" || channelSlug === "influencer";

  const minMetric = isRequestFlow && ch.eligibility ? ch.eligibility.minValue : DEFAULT_MIN_FOLLOWERS;
  const metricLabel = isRequestFlow && ch.eligibility ? ch.eligibility.metricLabel : "Follower count";
  const checks = isRequestFlow && ch.eligibility ? ch.eligibility.checks : DEFAULT_CHECKS;

  // Admin creation opens directly on the editable profile step; public applications retain the eligibility gate.
  const [step, setStep] = useState<Step>(() => adminMode ? (startStep ?? "details") : "eligibility");
  const [form, setForm] = useState<FormState>(initialState);
  const packagePriceTooLow = channelSlug === "social-media" && form.platforms.length > 1 && Number(form.packagePrice) > 0 && Number(form.packagePrice) < (Number(form.pricePerPost) || MIN_PRICE_PER_POST);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 12-Channel Audit fix A1/B1 — proof-of-claim upload, gated to channels
  // whose eligibility checklist promises verification beyond
  // self-attestation. Not part of FormState since File objects don't
  // belong in that (already non-persisted, but conceptually
  // string/number/boolean-shaped) state.
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [uploadingProof, setUploadingProof] = useState(false);
  const requiresProof = VERIFICATION_REQUIRED_CHANNELS.includes(channelSlug);
  // The error banner renders at the top of the wizard but the Review step is long,
  // so a failed submit used to look like the button did nothing. Bring it into view.
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  // Development channels are intentionally excluded from the public onboarding
  // flow. Admin mode remains able to use the shared form for internal seeding.
  if (!adminMode && !isPublisherOnboardingChannel(channelSlug)) {
    return (
      <div className="max-w-xl mx-auto px-5 py-20 text-center">
        <Seo title={`${ch.name} · Coming Soon · ChatSched`} noindex />
        <div className="inline-flex items-center gap-2 border-2 border-billboard-yellow text-billboard-ink bg-billboard-yellow/20 px-3 py-1.5 rounded-full font-mono text-xs font-bold uppercase tracking-wide mb-5">
          Coming soon
        </div>
        <h1 className="font-display text-3xl md:text-4xl mb-3">{ch.name} is still in development.</h1>
        <p className="text-billboard-inkSoft mb-8">
          Publisher onboarding for this channel is not open yet. You can review the channel details or browse the live channels already available on ChatSched.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to={`/channels/${ch.slug}`}
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition"
          >
            View channel details →
          </Link>
          <Link
            to="/channels"
            className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-semibold px-5 py-2.5 rounded hover:bg-billboard-paperDim transition"
          >
            Browse live channels
          </Link>
        </div>
      </div>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Low-barrier channels skip the Business step, so the bar and "Step x of y" label
  // should not count it (previously the bar jumped 60% -> 100% for those channels).
  const visibleSteps = STEPS.filter((s) => !(LOW_BARRIER_CHANNELS.includes(channelSlug) && s === "business"));
  const stepIndex = visibleSteps.indexOf(step);
  const progressPct = step === "submitted" || step === "ineligible" || stepIndex < 0 ? 100 : ((stepIndex + 1) / visibleSteps.length) * 100;

  function togglePlatform(p: Platform) {
    update("platforms", form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p]);
  }

  function togglePlacementType(t: string) {
    update("placementTypes", form.placementTypes.includes(t) ? form.placementTypes.filter((x) => x !== t) : [...form.placementTypes, t]);
  }

  function getSelectedSocialVerificationPlatforms(): SocialMediaPlatform[] {
    return getSelectedSocialPlatforms(form);
  }

  function validateSocialVerificationLinks(): string | null {
    if (channelSlug !== "social-media" || adminMode) return null;

    if (!isSocialMediaPlatform(form.smPrimaryPlatform)) {
      return "Choose your primary social platform before submitting your Social Media application.";
    }

    const selectedPlatforms = getSelectedSocialVerificationPlatforms();
    for (const platform of selectedPlatforms) {
      const value = form.smSocialLinks[platform]?.trim() ?? "";
      if (!value) {
        return `Add the public ${SOCIAL_MEDIA_PLATFORM_LABELS[platform]} profile link so ChatSched can verify it.`;
      }
      if (!isValidHttpUrl(value)) {
        return `The ${SOCIAL_MEDIA_PLATFORM_LABELS[platform]} verification link must be a valid http or https URL.`;
      }
    }

    return null;
  }

  // Social media placement selector only makes sense for the social-media
  // channel — the other channels (podcast, radio, website, influencer) have
  // their own booking flow and no equivalent "post format" concept.
  const showPlacementTypes = channelSlug === "social-media";
  const recommendedTypes = recommendedPlacementTypes(form.platforms);

  function continueFromDetails() {
    // Admin listings skip the public eligibility gate, so catch the required profile
    // fields here, on the step where they live, instead of at the final Publish click.
    if (adminMode) {
      if (!form.name.trim()) {
        setError("Add a name for this listing before continuing.");
        return;
      }
      if (!form.province || !form.city.trim()) {
        setError("Choose a province and enter a city before continuing.");
        return;
      }
    }
    setError(null);
    setStep("social");
  }

  function checkEligibility() {
    // 12-Channel Audit fix B5 — the 3 authority-attestation checkboxes
    // used to gate this same step, front-loading trust-interrogation
    // copy before the applicant had described anything about their
    // inventory. Moved to the Review step (see the submit button's own
    // disabled condition below) — after they've built out the listing
    // and are invested in finishing, which is the point real friction
    // research says self-attestation copy converts better at, not before
    // any value has been shown. Only the quick, legitimate metric
    // threshold still gates here.
    if (!adminMode && isAuthority) {
      if (!form.authorityConfirmed) {
        setStep("ineligible");
        return;
      }
    } else {
      const metric = Number(form.followers);
      if (!adminMode && (!metric || metric < minMetric)) {
        setStep("ineligible");
        return;
      }
    }
    setStep("details");
  }

  async function submitApplication() {
    if (!user) return;

    const socialVerificationError = validateSocialVerificationLinks();
    if (socialVerificationError) {
      setError(socialVerificationError);
      return;
    }

    if (channelSlug === "podcast" && !adminMode) {
      const feedError = podcastShowUrlError(form.podcastShowUrl);
      if (feedError) {
        setError(feedError);
        return;
      }
    }

    if (requiresProof && !adminMode && proofFiles.length === 0) {
      setError(`At least one verification evidence photo or video is required for ${ch.name}. This evidence is reviewed before the channel can be approved.`);
      return;
    }

    if (adminMode && !form.name.trim()) {
      setError("Publisher or channel name is required for AJ: Creations.");
      return;
    }
    if (adminMode && (!form.province || !form.city)) {
      setError("Province and city are required for an admin-created listing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase.from("publishers").insert({
      user_id: adminMode ? null : user.id,
      email: adminMode ? null : user.email,
      name: form.name || (adminMode ? "" : profile?.full_name || ""),
      mobile_number: adminMode ? null : profile?.phone ?? null,
      province: form.province,
      city: form.city,
      suburb: form.suburb || null,
      channel_slug: channelSlug,
      channel_metadata: withAuthorityFlag(buildChannelMetadata(channelSlug, form), channelSlug, form.authorityConfirmed || adminMode),
      social_verification_links: channelSlug === "social-media"
        ? getSelectedSocialVerificationPlatforms()
            .map((platform) => ({ platform, url: form.smSocialLinks[platform]?.trim() ?? "" }))
            .filter((link) => link.url)
        : channelSlug === "influencer" ? buildInfluencerLinks(form) : [],
      platforms: form.platforms,
      placement_types: form.placementTypes.length > 0 ? form.placementTypes : null,
      accepted_ad_formats: form.adFormats.length > 0 ? form.adFormats : null,
      category: form.category,
      // Authority channels have no audience number to type: followers stays 0 and the real
      // size lives in channel_metadata. Engagement/reach exist only for social and influencer;
      // influencers answer engagement once, in their channel section.
      followers: isAuthority ? 0 : Number(form.followers) || 0,
      engagement: !hasEngagement ? 0 : Number(channelSlug === "influencer" ? form.infEngagementRate : form.engagement) || 0,
      monthly_reach: hasEngagement ? Number(form.monthlyReach) || null : null,
      audience: form.audience,
      bio: form.bio,
      account_age_months: Number(form.accountAgeMonths) || null,
      posting_frequency: form.postingFrequency,
      business_name: form.businessName || null,
      company_registration: form.companyRegistration || null,
      vat_number: form.vatNumber || null,
      status: adminMode ? "approved" : "pending_review",
      verified: adminMode,
      reviewed_at: adminMode ? now : null,
      creation_source: adminMode ? "aj_creations" : "standard",
      price_per_post: Number(form.pricePerPost) || MIN_PRICE_PER_POST,
      initials: (form.name || profile?.full_name || "?").slice(0, 2).toUpperCase(),
      swatch: "from-billboard-green to-billboard-greenDeep",
    }).select("id").single();
    if (insertError || !inserted) {
      setSubmitting(false);
      setError(insertError?.message ?? "Couldn't submit your application");
      return;
    }

    if (adminMode) {
      await supabase.rpc("refresh_publisher_scores", { p_publisher_id: inserted.id });
      try {
        await supabase.rpc("log_admin_action", {
          p_action: "aj_creation_published",
          p_target_table: "publishers",
          p_target_id: inserted.id,
          p_detail: {
            channel_slug: channelSlug,
            status: "approved",
            verified: true,
            bypassed_public_review: true,
          },
        });
      } catch (auditError) {
        console.warn("AJ: Creations audit log failed (non-fatal)", auditError);
      }
      supabase.functions.invoke("notify-saved-search-matches", { body: { publisher_id: inserted.id } }).catch(() => {});
    }

    // Upload verification proof only after the publisher row exists because
    // the private storage path is keyed by the real publisher id. High-trust
    // channels must select proof before submission and the database will
    // independently block approval if the evidence is still missing.
    if (proofFiles.length > 0) {
      setUploadingProof(true);
      const uploadedPaths: string[] = [];
      for (const file of proofFiles.slice(0, 5)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${inserted.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("publisher-verification-proof").upload(path, file, { cacheControl: "3600", upsert: false });
        if (!uploadErr) uploadedPaths.push(path);
      }
      if (uploadedPaths.length > 0) {
        await supabase.from("publishers").update({ verification_proof_urls: uploadedPaths }).eq("id", inserted.id);
      }
      setUploadingProof(false);
    }

    setSubmitting(false);
    if (typeof window !== "undefined") sessionStorage.removeItem(APPLY_CHANNEL_STORAGE_KEY);
    setStep("submitted");
    if (adminMode) onAdminCreated?.(inserted.id, channelSlug);
  }

  if (step === "ineligible") {
    return (
      <div className="max-w-lg mx-auto px-5 py-24 text-center">
        <Seo title="Creator Application · ChatSched" noindex />
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-4">Not quite yet</span>
        <h1 className="text-2xl md:text-3xl mb-3">Not quite eligible yet.</h1>
        <p className="text-billboard-inkSoft mb-8">
          {isAuthority
            ? `To apply for ${ch.name}, you need to own or run the ${AUTHORITY_SUBJECT[channelSlug as keyof typeof AUTHORITY_SUBJECT]} and be able to sell sponsorship and advertising on it. If that's you, tick the confirmation and try again.`
            : `To apply for ${ch.name}, you'll need at least ${minMetric.toLocaleString()} ${metricLabel.toLowerCase()}. Keep growing and come back — we'd love to have you.`}
        </p>
        <button onClick={() => setStep("eligibility")} className={continueClass}>Check again</button>
      </div>
    );
  }

  if (step === "submitted") {
    return (
      <div className="max-w-lg mx-auto px-5 py-24 text-center">
        <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-3 py-1.5 rounded mb-4">Submitted</span>
        <h1 className="text-2xl md:text-3xl mb-3">Application submitted.</h1>
        <p className="text-billboard-inkSoft mb-8">
          {adminMode
            ? <>This {isRequestFlow ? "channel" : "publisher"} listing is now <strong>Live</strong> in the ChatSched directory.</>
            : <>You're in <strong>Pending Review</strong>. We review every {isRequestFlow ? "creator" : "publisher"} by hand before they go live —
              we'll be in touch by email either way.</>}
        </p>
        <p className="text-billboard-inkSoft mb-8">
          {adminMode
            ? "This listing was created by an administrator."
            : channelSlug === "social-media"
            ? "Your submitted social profile links will be reviewed alongside the rest of your application. Keep those profiles public while your application is being reviewed."
            : requiresProof
            ? "Your application includes channel verification evidence. Our reviewer will check the evidence and eligibility details before approving the listing."
            : "Your application is now in review. We'll contact you if the reviewer needs more information."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to={adminMode ? "/admin" : "/dashboard"} className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
            {adminMode ? "Create another listing →" : "View dashboard →"}
          </Link>
          <button onClick={() => navigate("/")} className="border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto px-5 ${adminMode ? "py-8" : "py-16"}`}>
      <Seo title={`${isRequestFlow ? "Creator" : "Publisher"} Application · ChatSched`} noindex />

      {isRequestFlow && (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-ink px-3 py-1.5 rounded mb-4">
          <ChannelIcon slug={ch.slug} size="sm" /> Applying to {ch.name}
        </span>
      )}

      <div className="mb-8">
        {stepIndex >= 0 && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-billboard-inkSoft mb-1.5">Step {stepIndex + 1} of {visibleSteps.length}</p>
        )}
        <div
          className="h-2 border-2 border-billboard-ink rounded overflow-hidden"
          role="progressbar"
          aria-label="Application progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
        >
          <div className="h-full bg-billboard-green transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {error && <p ref={errorRef} role="alert" className="text-billboard-red text-sm font-semibold mb-4 border-2 border-billboard-red/30 bg-billboard-red/10 rounded p-3">{error}</p>}

      {step === "eligibility" && (
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-4">
          <h1 className="text-2xl mb-1">{adminMode ? "Build this channel listing." : "Let's check you're eligible."}</h1>
          <p className="text-sm text-billboard-inkSoft mb-5">{adminMode ? "AJ: Creations uses the same onboarding metric capture as public applications, but admin publishing does not block on the public eligibility threshold." : "Most approved publishers meet these three things — check before you start, so you're not stopped halfway through."}</p>
          {isAuthority ? (
            <label className="flex items-start gap-3 text-sm border-2 border-billboard-ink rounded p-4 bg-billboard-yellow/10 cursor-pointer">
              <input
                type="checkbox"
                checked={form.authorityConfirmed}
                onChange={(e) => update("authorityConfirmed", e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold block">I own or run this {AUTHORITY_SUBJECT[channelSlug as keyof typeof AUTHORITY_SUBJECT]} and can sell sponsorship and advertising on it.</span>
                <span className="text-billboard-inkSoft block mt-1">You'll describe its size (attendance, members, daily customers and so on) in the next steps. We'll ask for proof of ownership before the listing goes live.</span>
              </span>
            </label>
          ) : (
            <div>
              <label htmlFor="eligibility-metric" className={labelClass}>{metricLabel}</label>
              <input id="eligibility-metric" type="number" value={form.followers} onChange={(e) => update("followers", e.target.value)} className={inputClass} />
            </div>
          )}
          {/* 12-Channel Audit fix E3 — a real, if rough, earnings estimate
              shown BEFORE the full commitment of finishing the wizard —
              proven onboarding-conversion lever (show the payoff before
              asking for the full ask). Uses the channel's own real
              minBudgetZAR from channelTypes.ts, an illustrative
              2–4-bookings/month range labeled honestly as an estimate,
              not a guarantee. */}
          {ch.minBudgetZAR > 0 && (
            <div className="border-2 border-billboard-ink rounded p-3 bg-billboard-green/10 text-sm">
              <span className="font-semibold">What you could earn: </span>
              {formatCurrency(ch.minBudgetZAR * 2)}–{formatCurrency(ch.minBudgetZAR * 4)}/month
              <span className="text-billboard-inkSoft"> at 2–4 bookings a month, from ChatSched's minimum campaign size for {ch.name}. A rough starting estimate, not a guarantee — busier {ch.name.toLowerCase()} publishers earn more.</span>
            </div>
          )}
          <button onClick={checkEligibility} className={continueClass}>{adminMode ? "Continue to profile →" : "Continue"}</button>
        </div>
      )}

      {step === "details" && (
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-4">
          <h1 className="text-2xl mb-1">Where are you based?</h1>
          <div>
            <label htmlFor="listing-name" className={labelClass}>{isRequestFlow ? `${ch.name} name` : "Page/account name"}</label>
            <input id="listing-name" autoFocus={adminMode} value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
          </div>
          {adminMode && !isAuthority && (
            <div className="border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-3">
              <label htmlFor="admin-metric" className={labelClass}>{metricLabel}</label>
              <input
                id="admin-metric"
                type="number"
                min={0}
                value={form.followers}
                onChange={(e) => update("followers", e.target.value)}
                placeholder={isRequestFlow ? `Enter ${metricLabel.toLowerCase()}` : "Enter follower count"}
                className={inputClass}
              />
              <p className="text-xs text-billboard-inkSoft mt-1.5">Admin listing metric used for marketplace matching and publisher scoring.</p>
            </div>
          )}
          <div>
            <label className={labelClass}>Province</label>
            <select value={form.province} onChange={(e) => update("province", e.target.value)} className={inputClass}>
              <option value="">Select a province</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Suburb <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
            <input
              value={form.suburb}
              onChange={(e) => update("suburb", e.target.value)}
              list="suburb-options"
              placeholder="e.g. Sandton"
              className={inputClass}
            />
            <datalist id="suburb-options">
              {SA_SUBURBS_AUTOCOMPLETE.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep("eligibility")} className={backClass}>Back</button>
            <button onClick={continueFromDetails} className={continueClass}>Continue</button>
          </div>
        </div>
      )}

      {step === "social" && (
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-4">
          <h1 className="text-2xl mb-1">Tell us about your {isRequestFlow ? ch.name.toLowerCase() : "page"}.</h1>
          <div>
            <label className={labelClass}>{isRequestFlow ? "Social presence (optional)" : "Platform(s)"}</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button type="button" key={p} onClick={() => togglePlatform(p)}
                  className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.platforms.includes(p) ? "bg-billboard-green" : "bg-billboard-paper"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          {showPlacementTypes && (
            <div>
              <label className={labelClass}>Which placement types do you offer?</label>
              <p className="text-xs text-billboard-inkSoft mb-2">Select every format you're happy to post — businesses can request any of these once you're approved.</p>
              <div className="flex flex-wrap gap-2">
                {PLACEMENT_TYPES.map((t) => {
                  const recommended = recommendedTypes.includes(t);
                  return (
                    <button
                      type="button" key={t} onClick={() => togglePlacementType(t)}
                      className={`text-sm font-semibold px-3 py-1.5 rounded border-2 border-billboard-ink transition ${form.placementTypes.includes(t) ? "bg-billboard-green" : recommended ? "bg-billboard-yellow/40" : "bg-billboard-paper"}`}
                    >
                      {t}{recommended && !form.placementTypes.includes(t) ? " ★" : ""}
                    </button>
                  );
                })}
              </div>
              {form.platforms.length > 0 && (
                <p className="text-xs text-billboard-inkSoft mt-1.5">★ = typical formats for the platform(s) you picked above — just a starting point, pick whatever you actually post.</p>
              )}
            </div>
          )}
          {isRequestFlow && <AdFormatsPicker channelSlug={channelSlug} form={form} update={update} />}

          <ChannelSpecificFields channelSlug={channelSlug} form={form} update={update} />

          <div>
            <label className={labelClass}>Category</label>
            <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          {hasEngagement && (
            <div className={channelSlug === "influencer" ? "" : "grid grid-cols-2 gap-3"}>
              {/* Influencers already gave their engagement rate in their channel section above; asking twice produced two answers that could disagree. */}
              {channelSlug !== "influencer" && (
                <div>
                  <label className={labelClass}>Avg. engagement %</label>
                  <input type="number" step="0.1" value={form.engagement} onChange={(e) => update("engagement", e.target.value)} className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>Avg. monthly reach</label>
                <input type="number" value={form.monthlyReach} onChange={(e) => update("monthlyReach", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Who's your audience?</label>
            <input value={form.audience} onChange={(e) => update("audience", e.target.value)} placeholder="e.g. Young families in the Southern Suburbs" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Describe your {isRequestFlow ? ch.name.toLowerCase() : "page"}</label>
            <textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={3} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{isRequestFlow ? `${ch.name} age (months)` : "Account age (months)"}</label>
              <input type="number" value={form.accountAgeMonths} onChange={(e) => update("accountAgeMonths", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Posting frequency</label>
              <input value={form.postingFrequency} onChange={(e) => update("postingFrequency", e.target.value)} placeholder="e.g. Daily" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Your standard price per post (ZAR)</label>
            <input
              type="number" min={MIN_PRICE_PER_POST} value={form.pricePerPost}
              onChange={(e) => update("pricePerPost", e.target.value)}
              placeholder={`Minimum ${formatCurrency(MIN_PRICE_PER_POST)}`}
              className={inputClass}
            />
            {channelSlug === "social-media" && form.platforms.length > 1 && (
              <div className="mt-4 border-2 border-billboard-ink rounded p-3 bg-billboard-paperDim">
                <label className={labelClass}>All-platforms package price (ZAR) — optional</label>
                <p className="text-xs text-billboard-inkSoft mb-2">
                  The price above is for a post on <strong>one</strong> platform. Businesses can also book all {form.platforms.length} of your platforms ({form.platforms.join(", ")}) as one package. What do you charge for that? Leave blank and businesses will see "price on request".
                </p>
                <input
                  type="number" min={Number(form.pricePerPost) || MIN_PRICE_PER_POST} value={form.packagePrice}
                  onChange={(e) => update("packagePrice", e.target.value)}
                  placeholder={`At least ${formatCurrency(Number(form.pricePerPost) || MIN_PRICE_PER_POST)}`}
                  className={inputClass}
                />
                {packagePriceTooLow && (
                  <p className="text-billboard-red text-xs font-semibold mt-1.5">
                    The package covers {form.platforms.length} platforms, so it can't be less than your single-platform price of {formatCurrency(Number(form.pricePerPost))}.
                  </p>
                )}
              </div>
            )}
            {Number(form.pricePerPost) > 0 && Number(form.pricePerPost) < MIN_PRICE_PER_POST && (
              <p className="text-billboard-red text-xs font-semibold mt-1.5">Price must be at least {formatCurrency(MIN_PRICE_PER_POST)}.</p>
            )}
            {hasEngagement && (() => {
              const val = calculateSuggestedPrice({
                followers: Number(form.followers) || 0,
                engagement: Number(channelSlug === "influencer" ? form.infEngagementRate : form.engagement) || 0,
                monthlyReach: Number(form.monthlyReach) || null,
              });
              return (
                <p className="text-xs text-billboard-inkSoft mt-1.5">
                  Suggested price based on your follower count and engagement: <strong className="text-billboard-greenDeep">{formatCurrency(val.suggested)}</strong>{" "}
                  <span className="text-billboard-inkSoft">(typically {formatCurrencyRange(val.low, val.high)}) — a starting guide, not a rule. You always set the final price.</span>
                </p>
              );
            })()}
            {Number(form.pricePerPost) >= MIN_PRICE_PER_POST && (
              <div className="mt-3 border-2 border-billboard-ink rounded p-3 bg-billboard-paperDim">
                <p className="font-mono text-[10px] uppercase tracking-wide text-billboard-inkSoft mb-2">How your earnings work</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] text-billboard-inkSoft">You set</div>
                    <div className="font-bold">{formatCurrency(Number(form.pricePerPost))}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-billboard-inkSoft">Marketplace fee ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%)</div>
                    <div className="font-bold">-{formatCurrency(Number(form.pricePerPost) * PLATFORM_COMMISSION_RATE)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-billboard-inkSoft">Estimated earnings</div>
                    <div className="font-bold text-billboard-greenDeep">{formatCurrency(Number(form.pricePerPost) * PUBLISHER_SHARE)}</div>
                  </div>
                </div>
                <Link to="/fees" className="text-xs font-semibold underline text-billboard-ink mt-2 inline-block">Read full fees →</Link>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep("details")} className={backClass}>Back</button>
            <button
              onClick={() => setStep(LOW_BARRIER_CHANNELS.includes(channelSlug) ? "review" : "business")}
              disabled={!adminMode && (Number(form.pricePerPost) < MIN_PRICE_PER_POST || packagePriceTooLow)}
              className={`${continueClass} disabled:opacity-60`}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "business" && (
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-4">
          <h1 className="text-2xl mb-1">Registered as a business?</h1>
          <p className="text-sm text-billboard-inkSoft">Optional — skip this if you post as an individual.</p>
          <div>
            <label className={labelClass}>Business name</label>
            <input value={form.businessName} onChange={(e) => update("businessName", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Company registration number</label>
            <input value={form.companyRegistration} onChange={(e) => update("companyRegistration", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>VAT number</label>
            <input value={form.vatNumber} onChange={(e) => update("vatNumber", e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep("social")} className={backClass}>Back</button>
            <button onClick={() => setStep("review")} className={continueClass}>Continue</button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="border-[3px] border-billboard-ink rounded p-6 space-y-4">
          <h1 className="text-2xl mb-1">Last thing.</h1>
          <p className="text-sm text-billboard-inkSoft">
            {adminMode
              ? "AJ: Creations publishes directly to the approved directory. The public review gate is bypassed because this action is performed inside the authenticated admin workspace."
              : "Every application is reviewed by hand — you won't appear in the directory until you're approved."}
          </p>

          {isRequestFlow && !adminMode && (
            <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim">
              <h2 className="font-bold text-sm mb-2">Payment terms for {ch.name} creators</h2>
              <ul className="space-y-1.5 text-sm text-billboard-inkSoft">
                <li>• You'll have {CREATOR_APPROVAL_WINDOW_DAYS} days to approve or decline each request from your dashboard — unanswered requests simply expire, so you're never locked in.</li>
                <li>• Once you approve a request, the business has {BUSINESS_PAYMENT_WINDOW_DAYS} days to pay the platform directly — there's no online checkout for {ch.name.toLowerCase()}, and nothing goes live until that payment is confirmed.</li>
                <li>• You'll be paid within {CREATOR_PAYOUT_WINDOW_HOURS} hours of confirming your sponsored content is live.</li>
              </ul>
              <label className="flex items-start gap-2 text-sm mt-3 pt-3 border-t border-billboard-ink/15">
                <input type="checkbox" checked={form.acceptedPaymentTerms} onChange={(e) => update("acceptedPaymentTerms", e.target.checked)} className="mt-0.5" />
                I understand and accept these payment terms.
              </label>
            </div>
          )}

          {requiresProof && (
            <div className="border-2 border-billboard-ink rounded p-4 bg-billboard-paperDim">
              <h2 className="font-bold text-sm mb-2">Show us the real thing</h2>
              <p className="text-sm text-billboard-inkSoft mb-3">
                {ch.name} listings get extra scrutiny before approval — a photo or short video actually showing what you described above (the vehicle, the venue, the team kit, the shop) makes approval faster and is the single biggest thing reviewers look for. Optional, but strongly recommended — up to 5 files, images or short video.
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                multiple
                onChange={(e) => setProofFiles(Array.from(e.target.files ?? []).slice(0, 5))}
                className="text-sm"
              />
              {proofFiles.length > 0 && (
                <p className="text-xs text-billboard-inkSoft mt-2">{proofFiles.length} file{proofFiles.length === 1 ? "" : "s"} selected — uploaded when you submit below.</p>
              )}
            </div>
          )}

          {channelSlug === "informal-retail" && (
            <label className="flex items-start gap-2 text-sm border-2 border-billboard-yellow bg-billboard-yellow/10 rounded p-3">
              <input type="checkbox" checked={form.retailMunicipalRegistrationConfirmed} onChange={(e) => update("retailMunicipalRegistrationConfirmed", e.target.checked)} className="mt-0.5" />
              <span>I confirm this shop is registered with the relevant local municipality and that I am authorised to offer its advertising inventory through ChatSched.</span>
            </label>
          )}

          {checks.length > 0 && !adminMode && (
            <div className="space-y-2">
              {/* 12-Channel Audit fix B5 — moved here from the Eligibility
                  step (see checkEligibility()'s own comment for why). */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.check1} onChange={(e) => update("check1", e.target.checked)} />
                {checks[0]}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.check2} onChange={(e) => update("check2", e.target.checked)} />
                {checks[1]}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.check3} onChange={(e) => update("check3", e.target.checked)} />
                {checks[2]}
              </label>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={form.acceptedTerms} onChange={(e) => update("acceptedTerms", e.target.checked)} className="mt-0.5" />
            {adminMode
              ? "I confirm these listing details are accurate and want to publish this channel immediately."
              : <>I confirm the details above are accurate and accept the {isRequestFlow ? "creator" : "publisher"} terms.</>}
          </label>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(LOW_BARRIER_CHANNELS.includes(channelSlug) ? "social" : "business")} className={backClass}>Back</button>
            <button onClick={submitApplication} disabled={!form.acceptedTerms || (!adminMode && isRequestFlow && !form.acceptedPaymentTerms) || (!adminMode && checks.length > 0 && (!form.check1 || !form.check2 || !form.check3)) || (!adminMode && channelSlug === "informal-retail" && !form.retailMunicipalRegistrationConfirmed) || submitting}
              className="bg-billboard-green border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition disabled:opacity-60">
              {uploadingProof ? "Uploading proof…" : submitting ? (adminMode ? "Publishing…" : "Submitting…") : adminMode ? "Publish listing now" : "Submit application"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
