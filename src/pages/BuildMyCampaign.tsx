import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { formatCurrency } from "../lib/currency";
import { usePublishers } from "../hooks/usePublishers";
import { useAuth } from "../hooks/useAuth";
import Seo from "../components/Seo";
import MarketingIcon from "../components/MarketingIcon";
import {
  CAMPAIGN_GOALS,
  BUDGET_TIERS,
  generateCampaignRecommendation,
  type CampaignBuilderInputs,
  type RecommendedCampaign,
} from "../lib/campaignRecommendation";
import { PROVINCES, CATEGORIES } from "../lib/constants";
import { bestScenarioForCategories } from "../lib/caseStudyScenarios";
import { buildAndDownloadCampaignBrief } from "../lib/campaignBriefPdf";

const TOP_CITIES = [
  "Cape Town",
  "Johannesburg",
  "Durban",
  "Pretoria",
  "Gqeberha (PE)",
  "Bloemfontein",
  "Stellenbosch",
  "East London",
];

const SA_LANGUAGES = ["English", "isiZulu", "isiXhosa", "Afrikaans", "Sesotho", "Setswana"];

const CONTACT_METHODS = [
  { id: "email", label: "Email", icon: "mail" as const },
  { id: "whatsapp", label: "WhatsApp", icon: "chat" as const },
  { id: "phone_call", label: "Phone call", icon: "microphone" as const },
] as const;

const URGENCY_LEVELS = [
  { id: "flexible", label: "No rush", desc: "Happy to wait for the right slot" },
  { id: "standard", label: "Standard", desc: "Within the usual 24-hour turnaround" },
  { id: "urgent", label: "Urgent", desc: "Time-sensitive — please prioritize" },
] as const;

// localStorage only — never sent anywhere, purely so a business that
// closes the tab mid-wizard (this thing has 7 steps) doesn't lose their
// answers. Cleared on successful submission. Versioned key so a future
// change to the draft's shape doesn't hand old, incompatible data back
// to a rewritten restore effect.
const DRAFT_STORAGE_KEY = "chatsched:build-my-campaign:draft:v1";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface CampaignDraft {
  currentStep?: WizardStep;
  goalId?: string;
  customGoal?: string;
  targetScope?: "national" | "province" | "city" | "hyperlocal";
  selectedProvinces?: string[];
  selectedCities?: string[];
  hyperlocalArea?: string;
  targetCategories?: string[];
  targetLanguages?: string[];
  customerNotes?: string;
  budgetTierId?: string;
  customBudgetValue?: string;
  useCustomBudget?: boolean;
  timingPreference?: "immediate" | "two_weeks" | "next_month" | "custom_dates";
  customTimingDates?: string;
  durationOption?: "7_days" | "14_days" | "30_days" | "monthly_retainer";
  brandWebsite?: string;
  brandStyleNotes?: string;
  tagline?: string;
  creativeBriefNotes?: string;
  businessName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactMethod?: (typeof CONTACT_METHODS)[number]["id"];
  urgency?: (typeof URGENCY_LEVELS)[number]["id"];
}

function loadDraft(): CampaignDraft {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CampaignDraft) : {};
  } catch {
    // Malformed/inaccessible localStorage (private browsing, a value left
    // over from a future, incompatible draft shape) — treat as no draft
    // rather than breaking the page.
    return {};
  }
}

export default function BuildMyCampaign() {
  const { user, profile } = useAuth();
  const { publishers, loading: publishersLoading } = usePublishers();
  const [searchParams] = useSearchParams();

  // Read once per mount — cheap (a handful of short fields), and every
  // field below reads from it directly rather than re-parsing localStorage
  // per field.
  const draft = loadDraft();

  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    const restored = draft.currentStep;
    return restored && restored >= 1 && restored <= 7 ? restored : 1;
  });

  // Step 1: Goal
  const [goalId, setGoalId] = useState<string>(() => {
    const fromQuery = searchParams.get("goal");
    if (fromQuery && CAMPAIGN_GOALS.some((g) => g.id === fromQuery)) return fromQuery;
    return draft.goalId ?? "footfall";
  });
  const [customGoal, setCustomGoal] = useState<string>(() => draft.customGoal ?? "");

  // Step 2: Location
  const [targetScope, setTargetScope] = useState<"national" | "province" | "city" | "hyperlocal">(() => draft.targetScope ?? "city");
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(() => draft.selectedProvinces ?? ["Western Cape"]);
  const [selectedCities, setSelectedCities] = useState<string[]>(() => draft.selectedCities ?? ["Cape Town"]);
  const [hyperlocalArea, setHyperlocalArea] = useState<string>(() => draft.hyperlocalArea ?? "");

  // Step 3: Customers & Audience
  const [targetCategories, setTargetCategories] = useState<string[]>(() => draft.targetCategories ?? ["food", "lifestyle"]);
  const [targetLanguages, setTargetLanguages] = useState<string[]>(() => draft.targetLanguages ?? ["English"]);
  const [customerNotes, setCustomerNotes] = useState<string>(() => draft.customerNotes ?? "");

  // Step 4: Budget
  const [budgetTierId, setBudgetTierId] = useState<string>(() => {
    const fromQuery = searchParams.get("budget");
    if (fromQuery && BUDGET_TIERS.some((t) => t.id === fromQuery)) return fromQuery;
    return draft.budgetTierId ?? "growth";
  });
  const [customBudgetValue, setCustomBudgetValue] = useState<string>(() => draft.customBudgetValue ?? "");
  const [useCustomBudget, setUseCustomBudget] = useState<boolean>(() => draft.useCustomBudget ?? false);

  // Step 5: Preferred Timing
  const [timingPreference, setTimingPreference] = useState<"immediate" | "two_weeks" | "next_month" | "custom_dates">(() => draft.timingPreference ?? "two_weeks");
  const [customTimingDates, setCustomTimingDates] = useState<string>(() => draft.customTimingDates ?? "");
  const [durationOption, setDurationOption] = useState<"7_days" | "14_days" | "30_days" | "monthly_retainer">(() => draft.durationOption ?? "14_days");

  // Step 6: Brand & Creative Brief
  const [brandWebsite, setBrandWebsite] = useState<string>(() => draft.brandWebsite ?? "");
  const [brandStyleNotes, setBrandStyleNotes] = useState<string>(() => draft.brandStyleNotes ?? "");
  const [tagline, setTagline] = useState<string>(() => draft.tagline ?? "");
  const [creativeBriefNotes, setCreativeBriefNotes] = useState<string>(() => draft.creativeBriefNotes ?? "");

  // Step 7: Submission state
  const [businessName, setBusinessName] = useState<string>(() => draft.businessName ?? profile?.company_name ?? "");
  const [contactName, setContactName] = useState<string>(() => draft.contactName ?? profile?.full_name ?? "");
  const [contactEmail, setContactEmail] = useState<string>(() => draft.contactEmail ?? user?.email ?? "");
  const [contactPhone, setContactPhone] = useState<string>(() => draft.contactPhone ?? profile?.phone ?? "");
  const [contactMethod, setContactMethod] = useState<(typeof CONTACT_METHODS)[number]["id"]>(() => draft.contactMethod ?? "email");
  const [urgency, setUrgency] = useState<(typeof URGENCY_LEVELS)[number]["id"]>(() => draft.urgency ?? "standard");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);

  // The account's own details only ever fill in a field that's still
  // blank — restoring a saved draft, or something the person already
  // typed and then cleared, always wins. profile/user can load in after
  // this component's first render, so a one-shot lazy useState
  // initializer above would miss them; this effect catches that case.
  useEffect(() => {
    if (!businessName && profile?.company_name) setBusinessName(profile.company_name);
    if (!contactName && profile?.full_name) setContactName(profile.full_name);
    if (!contactEmail && user?.email) setContactEmail(user.email);
    if (!contactPhone && profile?.phone) setContactPhone(profile.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);

  // Persist a draft on every change so closing the tab partway through
  // this 7-step wizard doesn't lose the business's answers. Skipped once
  // submittedLeadId is set — see the cleanup in handleFinalSubmit.
  useEffect(() => {
    if (submittedLeadId) return;
    const toSave: CampaignDraft = {
      currentStep, goalId, customGoal, targetScope, selectedProvinces, selectedCities, hyperlocalArea,
      targetCategories, targetLanguages, customerNotes, budgetTierId, customBudgetValue, useCustomBudget,
      timingPreference, customTimingDates, durationOption, brandWebsite, brandStyleNotes, tagline,
      creativeBriefNotes, businessName, contactName, contactEmail, contactPhone, contactMethod, urgency,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Private browsing / storage full / disabled — the wizard still
      // works within this one session, it just won't survive a reload.
    }
  }, [
    submittedLeadId, currentStep, goalId, customGoal, targetScope, selectedProvinces, selectedCities,
    hyperlocalArea, targetCategories, targetLanguages, customerNotes, budgetTierId, customBudgetValue,
    useCustomBudget, timingPreference, customTimingDates, durationOption, brandWebsite, brandStyleNotes,
    tagline, creativeBriefNotes, businessName, contactName, contactEmail, contactPhone, contactMethod, urgency,
  ]);

  // Compile inputs
  const builderInputs: CampaignBuilderInputs = useMemo(() => {
    const numBudget = useCustomBudget && customBudgetValue ? parseFloat(customBudgetValue) : undefined;
    return {
      goalId,
      customGoal,
      targetScope,
      selectedProvinces,
      selectedCities,
      hyperlocalArea,
      targetCategories,
      targetLanguages,
      budgetTierId,
      customBudget: numBudget && numBudget > 0 ? numBudget : undefined,
      timingPreference,
      customTimingDates,
      durationOption,
    };
  }, [
    goalId,
    customGoal,
    targetScope,
    selectedProvinces,
    selectedCities,
    hyperlocalArea,
    targetCategories,
    targetLanguages,
    budgetTierId,
    customBudgetValue,
    useCustomBudget,
    timingPreference,
    customTimingDates,
    durationOption,
  ]);

  // Generate recommendation
  const recommendation: RecommendedCampaign = useMemo(() => {
    return generateCampaignRecommendation(builderInputs, publishers);
  }, [builderInputs, publishers]);

  // Step navigation helpers
  function nextStep() {
    if (currentStep < 7) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function toggleProvince(prov: string) {
    setSelectedProvinces((prev) =>
      prev.includes(prov) ? (prev.length > 1 ? prev.filter((p) => p !== prov) : prev) : [...prev, prov]
    );
  }

  function toggleCity(city: string) {
    setSelectedCities((prev) =>
      prev.includes(city) ? (prev.length > 1 ? prev.filter((c) => c !== city) : prev) : [...prev, city]
    );
  }

  function toggleCategory(slug: string) {
    setTargetCategories((prev) =>
      prev.includes(slug) ? (prev.length > 1 ? prev.filter((c) => c !== slug) : prev) : [...prev, slug]
    );
  }

  function toggleLanguage(lang: string) {
    setTargetLanguages((prev) =>
      prev.includes(lang) ? (prev.length > 1 ? prev.filter((l) => l !== lang) : prev) : [...prev, lang]
    );
  }

  // Handle final campaign submission
  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !contactEmail.trim()) {
      setSubmissionError("Please provide your business name and email address.");
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    const fullBriefText = [
      `Campaign Plan: ${recommendation.packageName}`,
      `Strategy: ${recommendation.strategySummary}`,
      `Budget: ${formatCurrency(recommendation.estimatedCost.totalBudgetZar)} (Media: ${formatCurrency(recommendation.estimatedCost.creatorInventoryZar)}, Management: ${formatCurrency(recommendation.estimatedCost.managementFeeZar)})`,
      `Timing: ${timingPreference} (${durationOption}) ${customTimingDates ? `| Dates: ${customTimingDates}` : ""}`,
      `Location: ${targetScope} (${selectedCities.join(", ") || selectedProvinces.join(", ") || "National"}) ${hyperlocalArea ? `[Area: ${hyperlocalArea}]` : ""}`,
      `Audience: ${targetCategories.join(", ")} | Languages: ${targetLanguages.join(", ")}`,
      customerNotes.trim() ? `Audience Notes: ${customerNotes.trim()}` : null,
      `Deliverables:\n- ${recommendation.deliverables.join("\n- ")}`,
      `Matched Publishers: ${recommendation.matchedPublishers.map((p) => `${p.name} (${formatCurrency(p.price_per_post)})`).join(", ")}`,
      brandWebsite.trim() ? `Brand Website: ${brandWebsite.trim()}` : null,
      tagline.trim() ? `Tagline: ${tagline.trim()}` : null,
      brandStyleNotes.trim() ? `Brand Colors/Style: ${brandStyleNotes.trim()}` : null,
      creativeBriefNotes.trim() ? `Client Instructions:\n${creativeBriefNotes.trim()}` : null,
      `Preferred Contact: ${CONTACT_METHODS.find((m) => m.id === contactMethod)?.label ?? contactMethod}`,
      `Urgency: ${URGENCY_LEVELS.find((u) => u.id === urgency)?.label ?? urgency}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await submitPublicForm("agency_lead", {
      business_name: businessName.trim(),
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim() || null,
      notes: fullBriefText,
      estimated_value: recommendation.estimatedCost.totalBudgetZar,
      source: "campaign_builder_wizard",
      // business_id/stage/campaign_manager_id are no longer client-supplied
      // at all — public-form-submit derives business_id from the caller's
      // own JWT (or leaves it null when logged out, same as `user?.id ||
      // null` did here before) and forces stage/campaign_manager_id
      // itself. See public-form-submit/index.ts's agency_lead config.
      // contactMethod/urgency have no dedicated agency_leads columns —
      // folded into notes above instead, same as every other free-text
      // brief detail here (deliverables, matched publishers, etc.).
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmissionError(result.error ?? "Could not submit campaign");
      return;
    }

    if (result.id) {
      setSubmittedLeadId(result.id);
      supabase.functions.invoke("notify", { body: { kind: "new_agency_lead", lead_id: result.id } }).catch(() => {});
      supabase.functions.invoke("notify", { body: { kind: "campaign_brief_confirmation", lead_id: result.id } }).catch(() => {});
      // The draft's job is done — clear it so a later visit to this page
      // starts fresh rather than resurrecting an already-submitted brief.
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Same "best-effort, never blocks the flow" reasoning as the save
        // effect above.
      }
    }
  }

  function handleDownloadPdf() {
    buildAndDownloadCampaignBrief({
      businessName: businessName.trim() || "Your business",
      packageName: recommendation.packageName,
      strategySummary: recommendation.strategySummary,
      estimatedReach: recommendation.estimatedReach,
      channels: recommendation.channels.map((c) => c.platform),
      deliverables: recommendation.deliverables,
      matchedPublisherNames: recommendation.matchedPublishers.map((p) => p.name),
      creatorInventoryZar: recommendation.estimatedCost.creatorInventoryZar,
      managementFeeZar: recommendation.estimatedCost.managementFeeZar,
      totalBudgetZar: recommendation.estimatedCost.totalBudgetZar,
      timingSummary: `${timingPreference.replace(/_/g, " ")} · ${durationOption.replace(/_/g, " ")}${customTimingDates ? ` · ${customTimingDates}` : ""}`,
      locationSummary: `${selectedCities.join(", ") || selectedProvinces.join(", ") || "National"}${hyperlocalArea ? ` (${hyperlocalArea})` : ""}`,
    });
  }

  // ── Success View ────────────────────────────────────────────────────────
  if (submittedLeadId) {
    return (
      <div className="min-h-screen bg-billboard-paper pb-24">
        <Seo
          title="Campaign Submitted · ChatSched Agency"
          description="Your managed campaign brief has been received by ChatSched."
        />
        <header className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <span className="inline-block bg-billboard-greenDeep text-white font-mono text-xs font-bold uppercase px-3 py-1 rounded border-2 border-billboard-ink mb-4 shadow-block-sm">
              ✓ Campaign Brief Received
            </span>
            <h1 className="text-3xl md:text-5xl font-display leading-tight mb-3">
              We're building your campaign.
            </h1>
            <p className="text-billboard-inkSoft text-base md:text-lg max-w-xl mx-auto">
              Your campaign strategy has been routed to our dedicated campaign management team.
            </p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-5 -mt-6">
          <div className="bg-white border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 shadow-block space-y-6">
            <div className="border-2 border-billboard-green/40 bg-[#EAF3EC] rounded p-4 text-xs md:text-sm text-billboard-inkSoft flex items-center justify-between">
              <div>
                <span className="font-bold text-billboard-greenDeep block mb-0.5">Campaign Reference ID</span>
                <span className="font-mono font-bold text-billboard-ink text-xs">{submittedLeadId}</span>
              </div>
              <span className="font-mono text-xs uppercase bg-white border border-billboard-greenDeep px-2.5 py-1 rounded font-bold text-billboard-greenDeep">
                Manager Assigned
              </span>
            </div>

            <div>
              <h2 className="font-display text-xl mb-3">Campaign Summary</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-xs md:text-sm">
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-[11px] uppercase font-semibold">Package</span>
                  <strong className="text-billboard-ink text-sm">{recommendation.packageName}</strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-[11px] uppercase font-semibold">Total Budget</span>
                  <strong className="text-billboard-ink text-sm">
                    {formatCurrency(recommendation.estimatedCost.totalBudgetZar)}
                  </strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-[11px] uppercase font-semibold">Est. Reach</span>
                  <strong className="text-billboard-ink text-sm">{recommendation.estimatedReach}</strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-[11px] uppercase font-semibold">Timing</span>
                  <strong className="text-billboard-ink text-sm">
                    {timingPreference === "immediate" ? "Immediate Launch (3–7 Days)" : "Next 2–4 Weeks"}
                  </strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-[11px] uppercase font-semibold">Preferred Contact</span>
                  <strong className="text-billboard-ink text-sm">
                    {CONTACT_METHODS.find((m) => m.id === contactMethod)?.label ?? contactMethod}
                  </strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-[11px] uppercase font-semibold">Urgency</span>
                  <strong className="text-billboard-ink text-sm">
                    {URGENCY_LEVELS.find((u) => u.id === urgency)?.label ?? urgency}
                  </strong>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-billboard-ink/10 pt-5">
              <h3 className="font-display text-base mb-3">What happens next?</h3>
              <ol className="space-y-3 text-xs md:text-sm text-billboard-inkSoft">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-billboard-ink text-white font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    <strong>Campaign Manager Assignment:</strong> A dedicated ChatSched manager reviews your brief, locks in creator rate cards, and verifies inventory availability.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-billboard-ink text-white font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    <strong>Strategy & Content Approval:</strong> You receive a finalized flight schedule and creative guidelines for approval. No publisher posts without your sign-off.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-billboard-ink text-white font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    <strong>Payment-Protected Execution:</strong> Funds are held securely by ChatSched. Payouts are released only after verified proof of publication.
                  </span>
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t-2 border-billboard-ink/10">
              <Link
                to="/dashboard"
                className="flex-1 inline-flex justify-center items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold py-3 px-4 rounded hover:-translate-y-0.5 transition shadow-block text-sm"
              >
                Go to Dashboard →
              </Link>
              <Link
                to="/browse"
                className="inline-flex justify-center items-center gap-2 border-[3px] border-billboard-ink font-bold py-3 px-5 rounded hover:bg-billboard-paperDim transition text-sm"
              >
                Explore Publisher Marketplace
              </Link>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex justify-center items-center gap-2 border-[3px] border-billboard-ink font-bold py-3 px-5 rounded hover:bg-billboard-paperDim transition text-sm"
              >
                <MarketingIcon name="document" className="w-4 h-4" /> Download Campaign Brief (PDF)
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Step Content Renderer ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-billboard-paper pb-24">
      <Seo
        title="Build My Campaign · ChatSched Managed Advertising"
        description="Interactive campaign planner for South African brands. Tell us your goals, location, and budget — get a custom multi-channel publisher strategy."
      />

      {/* Header Banner */}
      <header className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16 md:py-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <span className="inline-block font-mono text-xs font-bold tracking-wider uppercase border-2 border-billboard-ink bg-white px-3 py-1 rounded mb-3 shadow-block-sm">
            Agency Campaign Builder
          </span>
          <h1 className="text-3xl md:text-5xl font-display leading-tight mb-3">
            Tell us what you need. Walk away with a plan.
          </h1>
          <p className="text-billboard-inkSoft text-base md:text-lg max-w-xl mx-auto">
            Answer a few questions about your goal, audience and budget — our campaign team turns it into a real multi-channel plan and runs it for you.
          </p>
        </div>
      </header>

      {/* Stepper Indicator */}
      <div className="bg-white border-b-2 border-billboard-ink/15 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between overflow-x-auto gap-2">
            {[
              { num: 1, label: "Goal" },
              { num: 2, label: "Where" },
              { num: 3, label: "Customers" },
              { num: 4, label: "Budget" },
              { num: 5, label: "Timing" },
              { num: 6, label: "Brand" },
              { num: 7, label: "Recommended Plan" },
            ].map((step) => {
              const isCurrent = currentStep === step.num;
              const isDone = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num as WizardStep)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    isCurrent
                      ? "bg-billboard-ink text-white shadow-block-sm"
                      : isDone
                      ? "bg-billboard-green/20 text-billboard-greenDeep font-bold"
                      : "text-billboard-inkSoft hover:text-billboard-ink"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      isCurrent
                        ? "bg-billboard-yellow text-billboard-ink font-bold"
                        : isDone
                        ? "bg-billboard-green text-white"
                        : "bg-billboard-paperDim text-billboard-inkSoft"
                    }`}
                  >
                    {isDone ? "✓" : step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <main className="max-w-4xl mx-auto px-5 py-8 md:py-16">
        <div className="bg-white border-[3px] border-billboard-ink rounded-lg p-6 md:p-10 shadow-block">

          {/* STEP 1: GOAL */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 1 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  What do you want to achieve?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Select your primary campaign objective. This determines the optimal channel mix, content formats, and call-to-action triggers.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {CAMPAIGN_GOALS.map((g) => {
                  const selected = goalId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoalId(g.id)}
                      className={`text-left p-5 rounded-lg border-[3px] transition flex flex-col justify-between ${
                        selected
                          ? "border-billboard-ink bg-billboard-yellow shadow-block -translate-y-0.5"
                          : "border-billboard-ink/20 hover:border-billboard-ink/60 bg-billboard-paperDim hover:bg-white"
                      }`}
                    >
                      <div>
                        <MarketingIcon name={g.icon} className="w-8 h-8 mb-2" />
                        <h3 className="font-display text-base font-bold text-billboard-ink mb-1">
                          {g.title}
                        </h3>
                        <p className="text-xs text-billboard-inkSoft leading-relaxed">
                          {g.tagline}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1">
                        {g.recommendedChannels.slice(0, 2).map((ch) => (
                          <span
                            key={ch}
                            className="text-[10px] font-mono font-semibold uppercase bg-white/80 border border-billboard-ink/20 px-2 py-0.5 rounded"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Goal Option */}
              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Have a specific or custom goal? (Optional)
                </label>
                <input
                  type="text"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="e.g. Drive registrations for our national webinar with 500+ signups"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              {/* Step 1 Actions */}
              <div className="flex justify-end pt-4 border-t-2 border-billboard-ink/10">
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-billboard-ink text-white font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition shadow-block text-sm inline-flex items-center gap-2"
                >
                  Next: Where? →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: WHERE (LOCATION) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 2 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  Where do you want to run this?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Choose your geographic focus so ChatSched can curate publishers with verified local audience density.
                </p>
              </div>

              {/* Scope Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: "national", label: "National", icon: "globe" as const, desc: "All South Africa" },
                  { id: "city", label: "Specific Cities", icon: "building" as const, desc: "Metro hubs" },
                  { id: "province", label: "Provinces", icon: "location" as const, desc: "Regional focus" },
                  { id: "hyperlocal", label: "Hyperlocal", icon: "pin" as const, desc: "Suburbs & areas" },
                ].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setTargetScope(scope.id as any)}
                    className={`p-3 text-left rounded-lg border-2 transition ${
                      targetScope === scope.id
                        ? "border-billboard-ink bg-billboard-yellow font-bold shadow-block-sm"
                        : "border-billboard-ink/20 bg-billboard-paperDim hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-display"><MarketingIcon name={scope.icon} className="w-5 h-5" />{scope.label}</div>
                    <div className="text-[11px] text-billboard-inkSoft">{scope.desc}</div>
                  </button>
                ))}
              </div>

              {/* City Selection */}
              {(targetScope === "city" || targetScope === "hyperlocal") && (
                <div className="space-y-2 border-t-2 border-billboard-ink/10 pt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide">
                    Select Target Metro Hubs (Multi-select)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TOP_CITIES.map((city) => {
                      const active = selectedCities.includes(city);
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => toggleCity(city)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition ${
                            active
                              ? "border-billboard-ink bg-billboard-ink text-white shadow-block-sm"
                              : "border-billboard-ink/30 bg-white text-billboard-ink hover:border-billboard-ink"
                          }`}
                        >
                          {active ? "✓ " : "+ "}
                          {city}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Province Selection */}
              {targetScope === "province" && (
                <div className="space-y-2 border-t-2 border-billboard-ink/10 pt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide">
                    Select Target Provinces
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROVINCES.map((prov) => {
                      const active = selectedProvinces.includes(prov);
                      return (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => toggleProvince(prov)}
                          className={`p-2.5 text-left rounded border-2 text-xs font-semibold transition ${
                            active
                              ? "border-billboard-ink bg-billboard-yellow font-bold shadow-block-sm"
                              : "border-billboard-ink/20 bg-white hover:border-billboard-ink"
                          }`}
                        >
                          {active ? "✓ " : ""}
                          {prov}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hyperlocal Input */}
              {targetScope === "hyperlocal" && (
                <div className="space-y-2 border-t-2 border-billboard-ink/10 pt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide">
                    Specific Suburbs / Communities
                  </label>
                  <input
                    type="text"
                    value={hyperlocalArea}
                    onChange={(e) => setHyperlocalArea(e.target.value)}
                    placeholder="e.g. Camps Bay & Sea Point, Sandton CBD, Umhlanga Ridge"
                    className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                  />
                  <p className="text-[11px] text-billboard-inkSoft">
                    ChatSched will prioritize publishers and WhatsApp community channels residing directly in these suburbs.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <button
                  type="button"
                  onClick={prevStep}
                  className="border-2 border-billboard-ink px-4 py-2.5 rounded font-bold text-xs hover:bg-billboard-paperDim transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-billboard-ink text-white font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition shadow-block text-sm inline-flex items-center gap-2"
                >
                  Next: Customers →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: WHO ARE YOUR CUSTOMERS? */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 3 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  Who are your customers?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Select your audience categories and language preferences so we match creator niches with the highest buyer affinity.
                </p>
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2">
                  Interest & Industry Categories (Select 1 or more)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.slice(0, 12).map((cat) => {
                    const active = targetCategories.includes(cat.slug);
                    return (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => toggleCategory(cat.slug)}
                        className={`p-2.5 text-left rounded border-2 text-xs font-semibold transition flex items-center justify-between ${
                          active
                            ? "border-billboard-ink bg-billboard-yellow font-bold shadow-block-sm"
                            : "border-billboard-ink/20 bg-billboard-paperDim hover:bg-white"
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {active && <span className="font-mono text-[10px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Languages */}
              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2">
                  Preferred Creator Languages
                </label>
                <div className="flex flex-wrap gap-2">
                  {SA_LANGUAGES.map((lang) => {
                    const active = targetLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition ${
                          active
                            ? "border-billboard-ink bg-billboard-ink text-white"
                            : "border-billboard-ink/30 bg-white hover:border-billboard-ink"
                        }`}
                      >
                        {active ? "✓ " : ""}
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Case-study card — social proof matched to whichever
                  categories are currently selected, via
                  bestScenarioForCategories (src/lib/caseStudyScenarios.ts,
                  shared with the full /case-studies page so the two never
                  disagree on a story's details). Recomputes live as the
                  business ticks/unticks categories above. */}
              {(() => {
                const scenario = bestScenarioForCategories(targetCategories);
                return (
                  <div className="border-2 border-billboard-green/40 bg-[#EAF3EC] rounded-lg p-4">
                    <span className="font-mono text-[10px] font-bold uppercase text-billboard-greenDeep block mb-2">
                      <MarketingIcon name={scenario.channelIcon} className="w-5 h-5 inline-block mr-1.5 align-[-3px]" /> How this has worked before
                    </span>
                    <p className="text-xs text-billboard-inkSoft leading-relaxed">
                      <strong className="text-billboard-ink">{scenario.business}</strong> — {scenario.businessDetail} Matched with{" "}
                      <strong className="text-billboard-ink">{scenario.creator}</strong>, who ran: “{scenario.request}”
                    </p>
                    <Link to="/case-studies" className="inline-block mt-2 text-[11px] font-semibold underline text-billboard-greenDeep">
                      See the full story →
                    </Link>
                  </div>
                );
              })()}

              {/* Customer description */}
              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Describe your ideal buyer (Optional)
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Young professionals aged 24-35 who dine out on weekends"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <button
                  type="button"
                  onClick={prevStep}
                  className="border-2 border-billboard-ink px-4 py-2.5 rounded font-bold text-xs hover:bg-billboard-paperDim transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-billboard-ink text-white font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition shadow-block text-sm inline-flex items-center gap-2"
                >
                  Next: Budget →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: BUDGET? */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 4 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  What is your budget?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Choose a standard package tier or enter a custom amount in South African Rand (ZAR). All tiers include creator payouts, briefing, and ChatSched campaign management.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {BUDGET_TIERS.map((tier) => {
                  const selected = !useCustomBudget && budgetTierId === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => {
                        setBudgetTierId(tier.id);
                        setUseCustomBudget(false);
                      }}
                      className={`text-left p-5 rounded-lg border-[3px] transition flex flex-col justify-between ${
                        selected
                          ? "border-billboard-ink bg-billboard-yellow shadow-block -translate-y-0.5"
                          : "border-billboard-ink/20 hover:border-billboard-ink/60 bg-billboard-paperDim hover:bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs font-bold uppercase bg-white border border-billboard-ink/30 px-2 py-0.5 rounded">
                            {tier.tag}
                          </span>
                          <span className="text-xs font-mono font-bold text-billboard-greenDeep">
                            {tier.reachEstimate}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-billboard-ink">
                          {tier.title}
                        </h3>
                        <p className="font-display text-2xl font-bold my-1 text-billboard-ink">
                          {formatCurrency(tier.defaultAmount)}
                        </p>
                        <p className="text-xs text-billboard-inkSoft leading-relaxed mt-2">
                          {tier.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Budget Input */}
              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2">
                  Or enter a specific custom budget (ZAR)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-billboard-ink text-sm">
                      R
                    </span>
                    <input
                      type="number"
                      min={1000}
                      value={customBudgetValue}
                      onChange={(e) => {
                        setCustomBudgetValue(e.target.value);
                        setUseCustomBudget(true);
                      }}
                      placeholder="e.g. 12000"
                      className="w-full border-2 border-billboard-ink rounded pl-8 pr-3 py-2.5 text-sm bg-white"
                    />
                  </div>
                  {useCustomBudget && (
                    <button
                      type="button"
                      onClick={() => setUseCustomBudget(false)}
                      className="text-xs underline text-billboard-inkSoft hover:text-billboard-ink font-semibold"
                    >
                      Reset to tiers
                    </button>
                  )}
                </div>
              </div>

              {/* Live preview — recommendation recomputes on every
                  keystroke/tier click above, so this reflects the plan
                  as it stands right now, before the full breakdown on
                  the final step. */}
              <div className="border-2 border-billboard-ink rounded-lg p-4 bg-billboard-paperDim flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-[11px] font-mono uppercase text-billboard-inkSoft block">At this budget, right now</span>
                  <strong className="font-display text-lg">{recommendation.packageName}</strong>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-billboard-inkSoft block">Est. reach</span>
                    <strong className="font-mono text-sm text-billboard-greenDeep">{recommendation.estimatedReach}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-billboard-inkSoft block">Total investment</span>
                    <strong className="font-mono text-sm">{formatCurrency(recommendation.estimatedCost.totalBudgetZar)}</strong>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <button
                  type="button"
                  onClick={prevStep}
                  className="border-2 border-billboard-ink px-4 py-2.5 rounded font-bold text-xs hover:bg-billboard-paperDim transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-billboard-ink text-white font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition shadow-block text-sm inline-flex items-center gap-2"
                >
                  Next: Timing →
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: PREFERRED TIMING */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 5 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  When do you want to launch?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Let us know your flight timeline so our campaign managers can secure publisher scheduling windows.
                </p>
              </div>

              {/* Launch Timing Options */}
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "immediate",
                    title: "Immediate",
                    icon: "bolt" as const,
                    sub: "3–7 Business Days",
                    desc: "Fast-track rollout with active creator roster",
                  },
                  {
                    id: "two_weeks",
                    title: "Next 2–4 Weeks",
                    icon: "event" as const,
                    sub: "Standard Window",
                    desc: "Optimal for creator creative briefing & review",
                  },
                  {
                    id: "next_month",
                    title: "Next Month / Seasonal",
                    icon: "event" as const,
                    sub: "Scheduled Window",
                    desc: "Month-end, Black Friday, or festive campaign",
                  },
                ].map((timing) => {
                  const selected = timingPreference === timing.id;
                  return (
                    <button
                      key={timing.id}
                      type="button"
                      onClick={() => setTimingPreference(timing.id as any)}
                      className={`text-left p-4 rounded-lg border-2 transition ${
                        selected
                          ? "border-billboard-ink bg-billboard-yellow font-bold shadow-block-sm"
                          : "border-billboard-ink/20 bg-billboard-paperDim hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-display text-base mb-0.5"><MarketingIcon name={timing.icon} className="w-5 h-5" />{timing.title}</div>
                      <div className="text-xs font-mono font-bold text-billboard-greenDeep mb-1.5">{timing.sub}</div>
                      <div className="text-[11px] text-billboard-inkSoft">{timing.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Campaign Duration */}
              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2">
                  Flight Duration
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "7_days", label: "7-Day Sprint", desc: "High-impact blitz" },
                    { id: "14_days", label: "14-Day Flight", desc: "Two-phase push" },
                    { id: "30_days", label: "30-Day Campaign", desc: "Sustained awareness" },
                    { id: "monthly_retainer", label: "Ongoing Monthly", desc: "Continuous presence" },
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setDurationOption(dur.id as any)}
                      className={`p-3 text-left rounded border-2 text-xs transition ${
                        durationOption === dur.id
                          ? "border-billboard-ink bg-billboard-ink text-white font-bold shadow-block-sm"
                          : "border-billboard-ink/20 bg-white hover:border-billboard-ink"
                      }`}
                    >
                      <div className="font-bold">{dur.label}</div>
                      <div className={`text-[10px] ${durationOption === dur.id ? "text-billboard-yellow" : "text-billboard-inkSoft"}`}>
                        {dur.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Date input */}
              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Specific Launch Dates or Event Deadline (Optional)
                </label>
                <input
                  type="text"
                  value={customTimingDates}
                  onChange={(e) => setCustomTimingDates(e.target.value)}
                  placeholder="e.g. 15th to 28th October, or before Easter weekend"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              {/* Live preview — see the matching box on Step 4 for why. */}
              <div className="border-2 border-billboard-ink rounded-lg p-4 bg-billboard-paperDim flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-[11px] font-mono uppercase text-billboard-inkSoft block">With this timing, right now</span>
                  <strong className="font-display text-lg">{recommendation.packageName}</strong>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-billboard-inkSoft block">Est. reach</span>
                    <strong className="font-mono text-sm text-billboard-greenDeep">{recommendation.estimatedReach}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-billboard-inkSoft block">Total investment</span>
                    <strong className="font-mono text-sm">{formatCurrency(recommendation.estimatedCost.totalBudgetZar)}</strong>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <button
                  type="button"
                  onClick={prevStep}
                  className="border-2 border-billboard-ink px-4 py-2.5 rounded font-bold text-xs hover:bg-billboard-paperDim transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-billboard-yellow text-billboard-ink border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition shadow-block text-sm inline-flex items-center gap-2"
                >
                  Next: Brand & Creative Brief →
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: BRAND & CREATIVE BRIEF */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 6 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  Anything about your brand we should know?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Everything here is optional — but the more your campaign manager has up front, the less back-and-forth before creators start briefing.
                </p>
              </div>

              {/* Brief-completeness indicator — every field on this step
                  is optional, so this is encouragement, not a gate: it
                  never blocks Next. */}
              {(() => {
                const fields = [brandWebsite, tagline, brandStyleNotes, creativeBriefNotes];
                const filled = fields.filter((f) => f.trim().length > 0).length;
                const pct = Math.round((filled / fields.length) * 100);
                return (
                  <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim">
                    <div className="flex items-center justify-between text-[11px] font-mono uppercase mb-1.5">
                      <span className="text-billboard-inkSoft">Brief completeness</span>
                      <span className="font-bold text-billboard-ink">{filled}/{fields.length} added</span>
                    </div>
                    <div className="h-2 rounded-full bg-white border border-billboard-ink/20 overflow-hidden">
                      <div className="h-full bg-billboard-green transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Brand website or social link (Optional)
                  </label>
                  <input
                    type="text"
                    value={brandWebsite}
                    onChange={(e) => setBrandWebsite(e.target.value)}
                    placeholder="e.g. https://yourbrand.co.za"
                    className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                  />
                  <p className="text-[11px] text-billboard-inkSoft mt-1">Gives creators a real sense of your visual identity before they're briefed.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Tagline or slogan to include (Optional)
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Cape Town's freshest roast, delivered daily"
                    className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                  />
                </div>
              </div>

              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Brand colors, tone & style notes (Optional)
                </label>
                <input
                  type="text"
                  value={brandStyleNotes}
                  onChange={(e) => setBrandStyleNotes(e.target.value)}
                  placeholder="e.g. Warm earth tones, playful tone of voice, always lowercase logo"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Creative instructions, do's & don'ts, or talking points (Optional)
                </label>
                <textarea
                  rows={3}
                  value={creativeBriefNotes}
                  onChange={(e) => setCreativeBriefNotes(e.target.value)}
                  placeholder="Add key links, brand do's & don'ts, or special promotion codes"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <button
                  type="button"
                  onClick={prevStep}
                  className="border-2 border-billboard-ink px-4 py-2.5 rounded font-bold text-xs hover:bg-billboard-paperDim transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-billboard-yellow text-billboard-ink border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition shadow-block text-sm inline-flex items-center gap-2"
                >
                  <MarketingIcon name="rocket" className="w-5 h-5" /> Generate Recommended Campaign →
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: RECOMMENDED CAMPAIGN & SUBMISSION */}
          {currentStep === 7 && (
            <div className="space-y-8">
              {/* Header Box */}
              <div className="border-[3px] border-billboard-ink bg-billboard-yellow rounded-lg p-6 md:p-8 shadow-block-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-xs font-bold uppercase bg-white border-2 border-billboard-ink px-3 py-1 rounded shadow-block-sm">
                    Recommended Campaign
                  </span>
                  <span className="font-mono text-xs font-bold bg-billboard-greenDeep text-white px-3 py-1 rounded">
                    {recommendation.estimatedReach}
                  </span>
                </div>
                <h2 className="text-2xl md:text-4xl font-display mb-2">
                  {recommendation.packageName}
                </h2>
                <p className="text-sm md:text-base text-billboard-ink leading-relaxed">
                  {recommendation.strategySummary}
                </p>
              </div>

              {/* 1. Recommended Channels */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg font-bold">1. Recommended Channel Mix</h3>
                  <span className="text-xs text-billboard-inkSoft font-mono">Multi-Channel Distribution</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {recommendation.channels.map((ch) => (
                    <div
                      key={ch.platform}
                      className="border-2 border-billboard-ink rounded-lg p-4 bg-billboard-paperDim flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <MarketingIcon name={ch.icon} className="w-6 h-6" />
                          <strong className="text-sm font-display">{ch.platform}</strong>
                        </div>
                        <p className="text-xs text-billboard-inkSoft leading-relaxed">{ch.role}</p>
                      </div>
                      <span className="mt-3 text-[10px] font-mono font-bold uppercase text-billboard-greenDeep">
                        ✓ Strategy Fit
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Curated Publishers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg font-bold">2. Matched Publishers & Creators</h3>
                  <span className="text-xs text-billboard-inkSoft font-mono">
                    {recommendation.matchedPublishers.length} Curated Creators
                  </span>
                </div>
                {publishersLoading ? (
                  <div className="p-8 text-center border-2 border-dashed border-billboard-ink/30 rounded text-xs text-billboard-inkSoft">
                    Loading verified publishers…
                  </div>
                ) : recommendation.matchedPublishers.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {recommendation.matchedPublishers.map((pub) => (
                      <div
                        key={pub.id}
                        className="border-2 border-billboard-ink rounded-lg p-4 bg-white flex items-center justify-between gap-3 shadow-block-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-xs text-white bg-gradient-to-tr ${
                              pub.swatch || "from-amber-500 to-red-500"
                            }`}
                          >
                            {pub.initials || pub.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-display text-sm font-bold truncate max-w-[160px]">
                                {pub.name}
                              </h4>
                              {pub.verified && (
                                <span className="text-billboard-green text-xs" title="Verified Publisher">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-billboard-inkSoft flex items-center gap-2">
                              <span>{pub.city || pub.province}</span>
                              <span>•</span>
                              <span>{pub.followers ? `${(pub.followers / 1000).toFixed(0)}k reach` : "Active"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-bold block">
                            {formatCurrency(pub.price_per_post)}
                          </span>
                          <span className="text-[10px] text-billboard-inkSoft uppercase font-mono">Rate Card</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-billboard-inkSoft italic">
                    Our team will hand-select additional niche publishers during campaign onboarding.
                  </p>
                )}
              </div>

              {/* 3. Package & Estimated Cost Breakdown */}
              <div className="border-2 border-billboard-ink rounded-lg p-6 bg-billboard-paperDim space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">3. Package & Cost Transparency</h3>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase bg-white border border-billboard-ink px-2 py-0.5 rounded font-bold">
                      Fixed Total Budget
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="font-mono text-[11px] uppercase bg-white border-2 border-billboard-ink px-2.5 py-1 rounded font-bold hover:bg-billboard-paperDim transition inline-flex items-center gap-1.5"
                    >
                      <MarketingIcon name="document" className="w-4 h-4" /> Download as PDF
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 text-xs">
                  <div className="border-2 border-billboard-ink/20 rounded p-3 bg-white">
                    <span className="text-billboard-inkSoft block mb-1 text-[11px] uppercase font-semibold">
                      Creator Media Spend
                    </span>
                    <strong className="text-base font-mono font-bold text-billboard-ink block">
                      {formatCurrency(recommendation.estimatedCost.creatorInventoryZar)}
                    </strong>
                    <p className="text-[10px] text-billboard-inkSoft mt-1">100% direct payouts to creators, held by ChatSched until verified</p>
                  </div>
                  <div className="border-2 border-billboard-ink/20 rounded p-3 bg-white">
                    <span className="text-billboard-inkSoft block mb-1 text-[11px] uppercase font-semibold">
                      ChatSched Management Fee
                    </span>
                    <strong className="text-base font-mono font-bold text-billboard-ink block">
                      {formatCurrency(recommendation.estimatedCost.managementFeeZar)}
                    </strong>
                    <p className="text-[10px] text-billboard-inkSoft mt-1">Briefing, scheduling, vetting, tracking & proof</p>
                  </div>
                  <div className="border-[3px] border-billboard-ink rounded p-3 bg-billboard-yellow">
                    <span className="text-billboard-ink block mb-1 text-[11px] uppercase font-bold">
                      Total Campaign Investment
                    </span>
                    <strong className="text-xl font-mono font-bold text-billboard-ink block">
                      {formatCurrency(recommendation.estimatedCost.totalBudgetZar)}
                    </strong>
                    <p className="text-[10px] text-billboard-ink mt-1 font-semibold">Guaranteed fixed price — no hidden fees</p>
                  </div>
                </div>
              </div>

              {/* 4. Deliverables Package */}
              <div>
                <h3 className="font-display text-lg font-bold mb-3">4. Campaign Deliverables Package</h3>
                <div className="border-2 border-billboard-ink rounded-lg p-5 bg-white space-y-2.5">
                  {recommendation.deliverables.map((del, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs md:text-sm">
                      <span className="text-billboard-green text-sm font-bold mt-0.5">✓</span>
                      <span className="text-billboard-ink">{del}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Tracking & Proof of Performance */}
              <div>
                <h3 className="font-display text-lg font-bold mb-3">5. Tracking, Attribution & Payment Protection</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {recommendation.trackingFeatures.map((tr, idx) => (
                    <div
                      key={idx}
                      className="border-2 border-billboard-green/40 bg-[#EAF3EC] rounded-lg p-4 text-xs space-y-1"
                    >
                      <strong className="font-bold text-billboard-greenDeep block text-sm flex items-center gap-1.5">
                        <MarketingIcon name="shield" className="w-4 h-4" /> {tr.title}
                      </strong>
                      <p className="text-billboard-inkSoft leading-relaxed">{tr.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SUBMIT CAMPAIGN SECTION */}
              <div className="border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 bg-white shadow-block space-y-6">
                <div>
                  <h3 className="text-2xl font-display mb-1">Ready? Submit Campaign to ChatSched</h3>
                  <p className="text-xs text-billboard-inkSoft">
                    Submit your campaign brief. A ChatSched campaign manager will contact you within 24 hours to review creative assets and lock in publisher dates. No payment is required until you approve the finalized schedule.
                  </p>
                </div>

                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Business / Brand Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Table Mountain Coffee Co."
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Contact Person Name
                      </label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Email Address *
                      </label>
                      <input
                        required
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="sarah@brand.co.za"
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Phone / WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="082 123 4567"
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1.5">
                        Preferred Contact Method
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {CONTACT_METHODS.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setContactMethod(m.id)}
                            className={`border-2 rounded px-3 py-2 text-xs font-semibold transition ${
                              contactMethod === m.id
                                ? "border-billboard-ink bg-billboard-yellow"
                                : "border-billboard-ink/30 bg-white hover:border-billboard-ink"
                            }`}
                          >
                            <MarketingIcon name={m.icon} className="w-4 h-4" /> {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1.5">
                        How Urgent Is This?
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {URGENCY_LEVELS.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setUrgency(u.id)}
                            title={u.desc}
                            className={`text-left border-2 rounded px-3 py-1.5 text-xs font-semibold transition ${
                              urgency === u.id
                                ? "border-billboard-ink bg-billboard-yellow"
                                : "border-billboard-ink/30 bg-white hover:border-billboard-ink"
                            }`}
                          >
                            {u.label}
                            <span className="block text-[10px] font-normal text-billboard-inkSoft">{u.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                      Creative Instructions, Website Links & Talking Points (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={creativeBriefNotes}
                      onChange={(e) => setCreativeBriefNotes(e.target.value)}
                      placeholder="Add key links, brand do's & don'ts, or special promotion codes"
                      className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-xs bg-white"
                    />
                  </div>

                  {submissionError && (
                    <div className="border-2 border-billboard-red bg-billboard-red/10 text-billboard-red rounded p-3 text-xs font-semibold">
                      {submissionError}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(6)}
                      className="border-2 border-billboard-ink px-4 py-3 rounded font-bold text-xs hover:bg-billboard-paperDim transition"
                    >
                      ← Modify Inputs
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-billboard-yellow border-[3px] border-billboard-ink font-bold py-3.5 px-6 rounded hover:-translate-y-0.5 transition shadow-block disabled:opacity-60 text-sm font-display"
                    >
                      {submitting ? "Submitting Campaign to ChatSched…" : "Submit Campaign Brief →"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
