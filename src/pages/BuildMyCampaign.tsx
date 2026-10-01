import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { formatCurrency } from "../lib/currency";
import { usePublishers } from "../hooks/usePublishers";
import { useAuth } from "../hooks/useAuth";
import Seo from "../components/Seo";
import MarketingIcon, { type MarketingIconName } from "../components/MarketingIcon";
import CategoryIcon from "../components/CategoryIcon";
import Button from "../components/Button";
import { WhatsAppChannelIcon } from "../components/PlatformIcons";
import { CheckIcon, ArrowRightIcon, ArrowLeftIcon, PlusIcon } from "../components/UiIcons";
import { MIN_PRICE_PER_POST } from "../lib/pricingEngine";
import { CAMPAIGN_GOAL_OPTIONS, CAMPAIGN_WIZARD_STEPS } from "../lib/campaignGoals";
import { PROVINCES, CATEGORIES, LANGUAGES } from "../lib/constants";

const TOP_CITIES = [
  "Cape Town",
  "Johannesburg",
  "Durban",
  "Pretoria",
  "Gqeberha",
  "Bloemfontein",
  "Stellenbosch",
  "East London",
];

const CUSTOMER_PROFILE_OPTIONS: Array<{
  id: string;
  label: string;
  icon: MarketingIconName;
}> = [
  { id: "students_young_adults", label: "Students & Young Adults", icon: "graduation" },
  { id: "working_professionals", label: "Working Professionals", icon: "briefcase" },
  { id: "parents_families", label: "Parents & Families", icon: "people" },
  { id: "homeowners_renters", label: "Homeowners & Renters", icon: "building" },
  { id: "business_owners", label: "Business Owners & Decision Makers", icon: "store" },
  { id: "shoppers_deal_seekers", label: "Shoppers & Deal Seekers", icon: "bag" },
  { id: "travellers_visitors", label: "Travellers & Visitors", icon: "globe" },
  { id: "event_goers", label: "Event-Goers & Entertainment Audiences", icon: "event" },
];

const CONTACT_METHODS = [
  { id: "email", label: "Email", icon: "mail" as const },
  { id: "whatsapp", label: "WhatsApp", icon: "chat" as const },
  { id: "phone_call", label: "Phone call", icon: "phone" as const },
] as const;

const URGENCY_LEVELS = [
  { id: "flexible", label: "No rush", desc: "Happy to wait for the right slot" },
  { id: "standard", label: "Standard", desc: "Within the usual 24-hour turnaround" },
  { id: "urgent", label: "Urgent", desc: "Time-sensitive — please prioritize" },
] as const;

const DRAFT_STORAGE_KEY = "chatsched:build-my-campaign:draft:v2";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface CampaignDraft {
  currentStep?: WizardStep;
  maxStep?: WizardStep;
  goalId?: string;
  customGoal?: string;
  targetScope?: "national" | "province" | "city" | "hyperlocal";
  selectedProvinces?: string[];
  selectedCities?: string[];
  hyperlocalArea?: string;
  targetCategories?: string[];
  targetLanguages?: string[];
  customerNotes?: string;
  customBudgetValue?: string;
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
    const parsed = raw ? (JSON.parse(raw) as CampaignDraft) : {};
    // Older drafts stored this city as "Gqeberha (PE)", which never matched a publisher's city.
    if (parsed.selectedCities) {
      parsed.selectedCities = parsed.selectedCities.map((c) => (c === "Gqeberha (PE)" ? "Gqeberha" : c));
    }
    return parsed;
  } catch {
    return {};
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function getReachEstimate(
  budget: number,
  publishers: Array<{
    verified: boolean;
    followers: number;
    price_per_post: number;
    city: string;
    province: string;
  }>,
  targetScope: "national" | "province" | "city" | "hyperlocal",
  selectedProvinces: string[],
  selectedCities: string[],
) {
  const verifiedInventory = publishers.filter(
    (publisher) =>
      publisher.verified &&
      Number.isFinite(Number(publisher.followers)) &&
      Number(publisher.followers) > 0 &&
      Number.isFinite(Number(publisher.price_per_post)) &&
      Number(publisher.price_per_post) > 0,
  );

  const geographyFiltered = verifiedInventory.filter((publisher) => {
    if (targetScope === "national") return true;
    if (targetScope === "province") {
      return selectedProvinces.some((province) =>
        publisher.province?.toLowerCase().includes(province.toLowerCase()),
      );
    }
    return selectedCities.some((city) =>
      publisher.city?.toLowerCase().includes(city.toLowerCase()),
    );
  });

  // With fewer than 2 verified publishers in the chosen area we fall back to all verified
  // inventory so the estimate isn't empty — but the UI must say so (usedFallback).
  const usedFallback = targetScope !== "national" && geographyFiltered.length < 2;
  const pool = usedFallback ? verifiedInventory : geographyFiltered;

  if (!Number.isFinite(budget) || budget <= 0) {
    return {
      reach: "Enter a budget to estimate reach",
      placements: "—",
      inventory: pool.length,
      usedFallback,
      basis: "Planning estimate uses current verified publisher inventory. Final reach depends on selected placements and availability.",
    };
  }

  if (pool.length === 0) {
    return {
      reach: "Reach estimate pending inventory",
      placements: "—",
      inventory: 0,
      usedFallback,
      basis: "A campaign manager will confirm available publisher inventory before the schedule is finalized.",
    };
  }

  const typicalRate = median(pool.map((publisher) => Number(publisher.price_per_post)));
  const typicalAudience = median(pool.map((publisher) => Number(publisher.followers)));
  const placements = Math.min(pool.length, Math.floor(budget / typicalRate));

  if (placements < 1) {
    return {
      reach: "Pending inventory review",
      placements: "Below current median placement level",
      inventory: pool.length,
      usedFallback,
      basis: "Your budget is recorded exactly as entered. Reach will be finalized once ChatSched confirms the available publisher mix.",
    };
  }

  const lower = Math.round(placements * typicalAudience * 0.35);
  const upper = Math.round(placements * typicalAudience * 0.8);

  return {
    reach: lower.toLocaleString() + " – " + upper.toLocaleString() + " estimated impressions",
    placements: placements.toLocaleString() + " placement" + (placements === 1 ? "" : "s"),
    inventory: pool.length,
    usedFallback,
    basis: "Planning estimate based on current verified publisher inventory; it is not a guaranteed result.",
  };
}

function formatTiming(
  timingPreference: CampaignDraft["timingPreference"],
  customTimingDates: string,
  durationOption: CampaignDraft["durationOption"],
) {
  const timingLabel =
    timingPreference === "immediate"
      ? "Immediate launch"
      : timingPreference === "two_weeks"
        ? "Next 2–4 weeks"
        : timingPreference === "next_month"
          ? "Next month / seasonal"
          : "Specific dates";

  const durationLabel =
    durationOption === "7_days"
      ? "7-day sprint"
      : durationOption === "14_days"
        ? "14-day flight"
        : durationOption === "30_days"
          ? "30-day campaign"
          : "Ongoing monthly";

  return timingLabel + " · " + durationLabel + (customTimingDates ? " · " + customTimingDates : "");
}

export default function BuildMyCampaign() {
  const { user, profile } = useAuth();
  const { publishers, loading: publishersLoading } = usePublishers();
  const [searchParams] = useSearchParams();
  const draft = loadDraft();

  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    const restored = draft.currentStep;
    return restored && restored >= 1 && restored <= 7 ? restored : 1;
  });

  const [maxStep, setMaxStep] = useState<WizardStep>(() => {
    const restored = draft.maxStep ?? draft.currentStep;
    return restored && restored >= 1 && restored <= 7 ? restored : 1;
  });
  const [goalId, setGoalId] = useState<string>(() => {
    const fromQuery = searchParams.get("goal");
    if (fromQuery && CAMPAIGN_GOAL_OPTIONS.some((goal) => goal.id === fromQuery)) return fromQuery;
    return draft.goalId ?? "cross_platform_awareness";
  });
  const [customGoal, setCustomGoal] = useState<string>(() => draft.customGoal ?? "");

  const [targetScope, setTargetScope] = useState<"national" | "province" | "city" | "hyperlocal">(
    () => draft.targetScope ?? "city",
  );
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(
    () => draft.selectedProvinces ?? [],
  );
  const [selectedCities, setSelectedCities] = useState<string[]>(
    () => draft.selectedCities ?? [],
  );
  const [hyperlocalArea, setHyperlocalArea] = useState<string>(() => draft.hyperlocalArea ?? "");

  const [targetCategories, setTargetCategories] = useState<string[]>(
    () => draft.targetCategories ?? [],
  );
  const [targetLanguages, setTargetLanguages] = useState<string[]>(
    () => draft.targetLanguages ?? ["English"],
  );
  const [customerNotes, setCustomerNotes] = useState<string>(() => draft.customerNotes ?? "");

  const [customBudgetValue, setCustomBudgetValue] = useState<string>(
    () => draft.customBudgetValue ?? "",
  );
  const [stepError, setStepError] = useState<string | null>(null);

  const [timingPreference, setTimingPreference] = useState<
    "immediate" | "two_weeks" | "next_month" | "custom_dates"
  >(() => draft.timingPreference ?? "two_weeks");
  const [customTimingDates, setCustomTimingDates] = useState<string>(
    () => draft.customTimingDates ?? "",
  );
  const [durationOption, setDurationOption] = useState<
    "7_days" | "14_days" | "30_days" | "monthly_retainer"
  >(() => draft.durationOption ?? "14_days");

  const [brandWebsite, setBrandWebsite] = useState<string>(() => draft.brandWebsite ?? "");
  const [brandStyleNotes, setBrandStyleNotes] = useState<string>(() => draft.brandStyleNotes ?? "");
  const [tagline, setTagline] = useState<string>(() => draft.tagline ?? "");
  const [creativeBriefNotes, setCreativeBriefNotes] = useState<string>(
    () => draft.creativeBriefNotes ?? "",
  );

  const [businessName, setBusinessName] = useState<string>(
    () => profile?.company_name ?? "",
  );
  const [contactName, setContactName] = useState<string>(
    () => profile?.full_name ?? "",
  );
  const [contactEmail, setContactEmail] = useState<string>(
    () => user?.email ?? "",
  );
  const [contactPhone, setContactPhone] = useState<string>(
    () => profile?.phone ?? "",
  );
  const [contactMethod, setContactMethod] = useState<(typeof CONTACT_METHODS)[number]["id"]>(
    () => draft.contactMethod ?? "email",
  );
  const [urgency, setUrgency] = useState<(typeof URGENCY_LEVELS)[number]["id"]>(
    () => draft.urgency ?? "standard",
  );

  // The site header is sticky (z-50); the stepper must stick directly below it, not behind it.
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setHeaderHeight(Math.round(header.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (!businessName && profile?.company_name) setBusinessName(profile.company_name);
    if (!contactName && profile?.full_name) setContactName(profile.full_name);
    if (!contactEmail && user?.email) setContactEmail(user.email);
    if (!contactPhone && profile?.phone) setContactPhone(profile.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);

  useEffect(() => {
    if (submitted) return;

    const toSave: CampaignDraft = {
      currentStep,
      maxStep,
      goalId,
      customGoal,
      targetScope,
      selectedProvinces,
      selectedCities,
      hyperlocalArea,
      targetCategories,
      targetLanguages,
      customerNotes,
      customBudgetValue,
      timingPreference,
      customTimingDates,
      durationOption,
      brandWebsite,
      brandStyleNotes,
      tagline,
      creativeBriefNotes,
      contactMethod,
      urgency,
    };

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Draft saving is best-effort.
    }
  }, [
    submitted,
    currentStep,
    maxStep,
    goalId,
    customGoal,
    targetScope,
    selectedProvinces,
    selectedCities,
    hyperlocalArea,
    targetCategories,
    targetLanguages,
    customerNotes,
    customBudgetValue,
    timingPreference,
    customTimingDates,
    durationOption,
    brandWebsite,
    brandStyleNotes,
    tagline,
    creativeBriefNotes,
    contactMethod,
    urgency,
  ]);

  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    setMaxStep((previous) => (currentStep > previous ? currentStep : previous));
    setStepError(null);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById("cb-step-" + currentStep)?.scrollIntoView({ inline: "center", block: "nearest" });
    panelRef.current?.focus({ preventScroll: true });
  }, [currentStep]);

  function startOver() {
    if (!window.confirm("Clear everything you've entered and start this brief again?")) return;
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // best-effort
    }
    window.location.assign("/build-my-campaign");
  }

  const requestedBudget = Number(customBudgetValue);

  const reachEstimate = useMemo(
    () =>
      getReachEstimate(
        requestedBudget,
        publishers,
        targetScope,
        selectedProvinces,
        selectedCities,
      ),
    [requestedBudget, publishers, targetScope, selectedProvinces, selectedCities],
  );

  const selectedGoal =
    CAMPAIGN_GOAL_OPTIONS.find((goal) => goal.id === goalId) ?? CAMPAIGN_GOAL_OPTIONS[0];

  const audienceLabels = useMemo(() => {
    const lookup = new Map<string, string>();
    CATEGORIES.forEach((category) => lookup.set(category.slug, category.name));
    CUSTOMER_PROFILE_OPTIONS.forEach((category) => lookup.set(category.id, category.label));
    return targetCategories.map((category) => lookup.get(category) ?? category);
  }, [targetCategories]);

  const locationSummary = useMemo(() => {
    if (targetScope === "national") return "South Africa";
    if (targetScope === "province") return selectedProvinces.join(", ") || "Selected provinces";
    if (targetScope === "hyperlocal") {
      return (
        (selectedCities.join(", ") || "Selected cities") +
        (hyperlocalArea ? " · " + hyperlocalArea : "")
      );
    }
    return selectedCities.join(", ") || "Selected cities";
  }, [targetScope, selectedProvinces, selectedCities, hyperlocalArea]);

  function getStepError(step: number): string | null {
    if (step === 2) {
      if (targetScope === "province" && selectedProvinces.length === 0) return "Select at least one province to continue.";
      if ((targetScope === "city" || targetScope === "hyperlocal") && selectedCities.length === 0) {
        return "Select at least one city to continue.";
      }
    }
    if (step === 3) {
      if (targetCategories.length === 0) return "Select at least one industry or customer profile to continue.";
      if (targetLanguages.length === 0) return "Select at least one language to continue.";
    }
    if (step === 4) {
      if (!Number.isFinite(requestedBudget) || requestedBudget <= 0) return "Enter a valid campaign budget before continuing.";
      if (requestedBudget < MIN_PRICE_PER_POST) {
        return "The minimum budget is " + formatCurrency(MIN_PRICE_PER_POST) + " — the lowest price a publisher can list a single placement at.";
      }
    }
    return null;
  }

  function nextStep() {
    const error = getStepError(currentStep);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);

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

  function toggleProvince(province: string) {
    setStepError(null);
    setSelectedProvinces((previous) =>
      previous.includes(province) ? previous.filter((item) => item !== province) : [...previous, province],
    );
  }

  function toggleCity(city: string) {
    setStepError(null);
    setSelectedCities((previous) =>
      previous.includes(city) ? previous.filter((item) => item !== city) : [...previous, city],
    );
  }

  function toggleCategory(categoryId: string) {
    setStepError(null);
    setTargetCategories((previous) =>
      previous.includes(categoryId) ? previous.filter((item) => item !== categoryId) : [...previous, categoryId],
    );
  }

  function toggleLanguage(language: string) {
    setStepError(null);
    setTargetLanguages((previous) =>
      previous.includes(language) ? previous.filter((item) => item !== language) : [...previous, language],
    );
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!businessName.trim() || !contactEmail.trim()) {
      setSubmissionError("Please provide your business name and email address.");
      return;
    }

    for (const step of [2, 3, 4]) {
      const error = getStepError(step);
      if (error) {
        setStepError(error);
        setCurrentStep(step as WizardStep);
        return;
      }
    }

    setSubmitting(true);
    setSubmissionError(null);

    const fullBriefText = [
      "Campaign Goal: " + selectedGoal.title,
      customGoal.trim() ? "Additional Goal Context: " + customGoal.trim() : null,
      "Budget: " + formatCurrency(requestedBudget),
      "Planning Reach: " + reachEstimate.reach,
      "Planning Placements: " + reachEstimate.placements,
      reachEstimate.usedFallback ? "Estimate basis: nationwide verified inventory (few or no publishers listed in the chosen area)" : null,
      "Location: " + locationSummary,
      "Audience Categories: " + audienceLabels.join(", "),
      "Preferred Languages: " + targetLanguages.join(", "),
      customerNotes.trim() ? "Audience Notes: " + customerNotes.trim() : null,
      "Timing: " + formatTiming(timingPreference, customTimingDates, durationOption),
      brandWebsite.trim() ? "Brand Website / Social Link: " + brandWebsite.trim() : null,
      tagline.trim() ? "Tagline: " + tagline.trim() : null,
      brandStyleNotes.trim() ? "Brand Style / Tone: " + brandStyleNotes.trim() : null,
      creativeBriefNotes.trim()
        ? "Creative Instructions:\n" + creativeBriefNotes.trim()
        : null,
      "Preferred Contact: " +
        (CONTACT_METHODS.find((method) => method.id === contactMethod)?.label ?? contactMethod),
      "Urgency: " + (URGENCY_LEVELS.find((level) => level.id === urgency)?.label ?? urgency),
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const result = await submitPublicForm("agency_lead", {
        business_name: businessName.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || null,
        notes: fullBriefText,
        estimated_value: requestedBudget,
        source: "campaign_builder_wizard",
      });

      if (!result.ok) {
        setSubmissionError(result.error ?? "Could not submit campaign.");
        return;
      }

      setSubmittedLeadId(result.id ?? null);
      setSubmitted(true);
      supabase.functions
        .invoke("notify", { body: { kind: "new_agency_lead", lead_id: result.id ?? null } })
        .catch(() => {});
      supabase.functions
        .invoke("notify", {
          body: { kind: "campaign_brief_confirmation", lead_id: result.id ?? null },
        })
        .catch(() => {});

      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Best-effort cleanup.
      }
    } catch {
      setSubmissionError("Something went wrong while submitting your campaign. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-billboard-paper pb-24">
        <Seo
          title="Campaign Submitted · ChatSched Agency"
          description="Your managed campaign brief has been received by ChatSched."
        />

        <header className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <img src="/schedy/schedy-on-it.svg" alt="" width={512} height={512} className="w-32 h-32 mx-auto -mb-1" />
            <span className="inline-block bg-billboard-greenDeep text-white font-mono text-xs font-bold uppercase px-3 py-1 rounded border-2 border-billboard-ink mb-4 shadow-blockSm">
              <span className="inline-flex items-center gap-1.5"><CheckIcon className="w-3.5 h-3.5" /> Campaign Brief Received</span>
            </span>
            <h1 className="text-3xl md:text-5xl font-display leading-tight mb-3">
              Your brief is with ChatSched.
            </h1>
            <p className="text-billboard-inkSoft text-base md:text-lg max-w-xl mx-auto">
              A campaign manager will review your brief and follow up on the next available
              publisher dates.
            </p>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-5 -mt-6">
          <div className="bg-white border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 shadow-block space-y-6">
            {submittedLeadId && (
            <div className="border-2 border-billboard-green/40 bg-[#EAF3EC] rounded p-4 text-xs md:text-sm text-billboard-inkSoft flex items-center justify-between gap-4">
              <div>
                <span className="font-bold text-billboard-greenDeep block mb-0.5">
                  Campaign Reference ID
                </span>
                <span className="font-mono font-bold text-billboard-ink text-xs">
                  {submittedLeadId}
                </span>
              </div>
              <span className="font-mono text-xs uppercase bg-white border border-billboard-greenDeep px-2.5 py-1 rounded font-bold text-billboard-greenDeep">
                Brief Received
              </span>
            </div>
            )}

            <div>
              <h2 className="font-display text-xl mb-3">Campaign Summary</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-xs md:text-sm">
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-xs uppercase font-semibold">
                    Goal
                  </span>
                  <strong className="text-billboard-ink text-sm">{selectedGoal.title}</strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-xs uppercase font-semibold">
                    Budget
                  </span>
                  <strong className="text-billboard-ink text-sm">
                    {formatCurrency(requestedBudget)}
                  </strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-xs uppercase font-semibold">
                    Est. Reach
                  </span>
                  <strong className="text-billboard-ink text-sm">{reachEstimate.reach}</strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-xs uppercase font-semibold">
                    Location
                  </span>
                  <strong className="text-billboard-ink text-sm">{locationSummary}</strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-xs uppercase font-semibold">
                    Timing
                  </span>
                  <strong className="text-billboard-ink text-sm">
                    {formatTiming(timingPreference, customTimingDates, durationOption)}
                  </strong>
                </div>
                <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                  <span className="text-billboard-inkSoft block text-xs uppercase font-semibold">
                    Preferred Contact
                  </span>
                  <strong className="text-billboard-ink text-sm">
                    {CONTACT_METHODS.find((method) => method.id === contactMethod)?.label ??
                      contactMethod}
                  </strong>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-billboard-ink/10 pt-5">
              <h3 className="font-display text-base mb-3">What happens next?</h3>
              <ol className="space-y-3 text-xs md:text-sm text-billboard-inkSoft">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded bg-billboard-ink text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    <strong>Brief review:</strong> ChatSched reviews your audience, budget, timing and
                    creative requirements.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded bg-billboard-ink text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    <strong>Schedule confirmation:</strong> Available publisher placements and dates
                    are assembled into a schedule for your approval.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded bg-billboard-ink text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    <strong>Approval before payment:</strong> No campaign spend is committed until
                    you approve the finalized schedule.
                  </span>
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t-2 border-billboard-ink/10">
              <Link
                to="/dashboard"
                className="flex-1 inline-flex justify-center items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold py-3 px-4 rounded hover:-translate-y-0.5 transition shadow-block text-sm"
              >
                Go to Dashboard <ArrowRightIcon />
              </Link>
              <Link
                to="/browse"
                className="inline-flex justify-center items-center gap-2 border-[3px] border-billboard-ink font-bold py-3 px-5 rounded hover:bg-billboard-paperDim transition text-sm"
              >
                Explore Publisher Marketplace
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-billboard-paper pb-24">
      <Seo
        title="Build My Campaign · ChatSched Managed Advertising"
        description="Build a flexible multi-channel advertising brief for ChatSched using custom budgets, audience targeting and preferred timing."
      />

      <header className="bg-billboard-yellow border-b-[3px] border-billboard-ink py-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <span className="inline-block font-mono text-xs font-bold tracking-wider uppercase border-2 border-billboard-ink bg-white px-3 py-1 rounded mb-3 shadow-blockSm">
            Agency Campaign Builder
          </span>
          <h1 className="text-3xl md:text-5xl font-display leading-tight mb-3">
            Build a campaign around your goals.
          </h1>
          <p className="text-billboard-inkSoft text-base md:text-lg max-w-xl mx-auto">
            Tell us what you want to achieve, who you want to reach, what you want to invest and
            when you want to run. ChatSched turns the brief into a schedule for your approval.
          </p>
        </div>
      </header>

      <div className="bg-white">
        <div className="max-w-4xl mx-auto px-5 pt-8">
          <div className="border-2 border-billboard-ink/15 rounded-lg px-4 py-3 bg-billboard-paperDim flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-billboard-inkSoft">
              See how businesses use ChatSched to coordinate social, broadcast, community, event,
              sports and venue distribution.
            </p>
            <Link to="/case-studies" className="text-xs font-bold underline shrink-0">
              <span className="inline-flex items-center gap-1">View case studies <ArrowRightIcon className="w-3 h-3" /></span>
            </Link>
          </div>
        </div>

      </div>

      <div
        className="bg-white border-b-2 border-billboard-ink/15 sticky z-20 shadow-sm"
        style={{ top: headerHeight }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between overflow-x-auto gap-2">
            {CAMPAIGN_WIZARD_STEPS.map((step) => {
              const isCurrent = currentStep === step.num;
              const isDone = currentStep > step.num;
              const canVisit = step.num <= maxStep;

              return (
                <button
                  key={step.num}
                  id={"cb-step-" + step.num}
                  type="button"
                  disabled={!canVisit}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => setCurrentStep(step.num as WizardStep)}
                  className={
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition " +
                    (isCurrent
                      ? "bg-billboard-ink text-white shadow-blockSm"
                      : isDone
                        ? "bg-billboard-green/20 text-billboard-greenDeep font-bold"
                        : "text-billboard-inkSoft") +
                    (!canVisit ? " opacity-50 cursor-not-allowed" : "")
                  }
                >
                  <span
                    className={
                      "w-5 h-5 rounded flex items-center justify-center text-xs font-mono " +
                      (isCurrent
                        ? "bg-billboard-yellow text-billboard-ink font-bold"
                        : isDone
                          ? "bg-billboard-green text-white"
                          : "bg-billboard-paperDim text-billboard-inkSoft")
                    }
                  >
                    {isDone ? <CheckIcon className="w-3 h-3" /> : step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-8 md:py-16">
        {maxStep > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-xs text-billboard-inkSoft">
              Your progress is saved on this device. Contact details are never saved.
            </p>
            <Button size="sm" onClick={startOver}>Start over</Button>
          </div>
        )}
        <div
          ref={panelRef}
          tabIndex={-1}
          className="bg-white border-[3px] border-billboard-ink rounded-lg p-6 md:p-10 shadow-block outline-none"
        >
          <p className="sr-only" aria-live="polite">
            Step {currentStep} of 7: {CAMPAIGN_WIZARD_STEPS.find((step) => step.num === currentStep)?.label}
          </p>
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 1 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  What do you want this campaign to achieve?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Choose the outcome that best describes the job you want ChatSched to help you
                  solve. You can add your own goal underneath.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {CAMPAIGN_GOAL_OPTIONS.map((goal) => {
                  const selected = goalId === goal.id;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setGoalId(goal.id)}
                      aria-pressed={selected}
                      className={
                        "text-left p-5 rounded-lg border-[3px] transition flex flex-col justify-between " +
                        (selected
                          ? "border-billboard-ink bg-billboard-yellow shadow-block -translate-y-0.5"
                          : "border-billboard-ink/20 hover:border-billboard-ink/60 bg-billboard-paperDim hover:bg-white")
                      }
                    >
                      <div>
                        <MarketingIcon name={goal.icon} className="w-8 h-8 mb-2" />
                        <h3 className="font-display text-base font-bold text-billboard-ink mb-1">
                          {goal.title}
                        </h3>
                        <p className="text-xs text-billboard-inkSoft leading-relaxed">
                          {goal.tagline}
                        </p>
                      </div>
                      <div className="mt-4 text-xs font-mono font-bold uppercase text-billboard-greenDeep">
                        Focus: {goal.focus}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label htmlFor="cb-custom-goal" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Add a specific campaign goal (Optional)
                </label>
                <input
 id="cb-custom-goal"
                  type="text"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="e.g. Drive registrations for our national webinar"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              <div className="flex justify-end pt-4 border-t-2 border-billboard-ink/10">
                <Button variant="primary" onClick={nextStep} className="shadow-block">
                  Next: Where? <ArrowRightIcon />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 2 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  Where do you want to run this campaign?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Set the geographic footprint. ChatSched can combine multiple cities, provinces or
                  hyperlocal areas in one campaign brief.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: "national", label: "National", icon: "globe" as const, desc: "All South Africa" },
                  { id: "city", label: "Specific Cities", icon: "building" as const, desc: "Metro hubs" },
                  { id: "province", label: "Provinces", icon: "map" as const, desc: "Regional focus" },
                  { id: "hyperlocal", label: "Hyperlocal", icon: "pin" as const, desc: "Suburbs & areas" },
                ].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setTargetScope(scope.id as "national" | "province" | "city" | "hyperlocal")}
                    aria-pressed={targetScope === scope.id}
                    className={
                      "p-3 text-left rounded-lg border-2 transition " +
                      (targetScope === scope.id
                        ? "border-billboard-ink bg-billboard-yellow font-bold shadow-blockSm"
                        : "border-billboard-ink/20 bg-billboard-paperDim hover:bg-white")
                    }
                  >
                    <div className="flex items-center gap-2 text-sm font-display">
                      <MarketingIcon name={scope.icon} className="w-5 h-5" />
                      {scope.label}
                    </div>
                    <div className="text-xs text-billboard-inkSoft">{scope.desc}</div>
                  </button>
                ))}
              </div>

              {(targetScope === "city" || targetScope === "hyperlocal") && (
                <div className="space-y-2 border-t-2 border-billboard-ink/10 pt-4">
                  <span id="cb-cities-label" className="block text-xs font-semibold uppercase tracking-wide">
                    Select Target Cities (Multi-select)
                  </span>
                  <div role="group" aria-labelledby="cb-cities-label" className="flex flex-wrap gap-2">
                    {TOP_CITIES.map((city) => {
                      const active = selectedCities.includes(city);
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => toggleCity(city)}
                          aria-pressed={active}
                          className={
                            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold border-2 transition " +
                            (active
                              ? "border-billboard-ink bg-billboard-ink text-white shadow-blockSm"
                              : "border-billboard-ink/30 bg-white text-billboard-ink hover:border-billboard-ink")
                          }
                        >
                          {active ? <CheckIcon className="w-3 h-3" /> : <PlusIcon className="w-3 h-3" />}
                          {city}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {targetScope === "province" && (
                <div className="space-y-2 border-t-2 border-billboard-ink/10 pt-4">
                  <span id="cb-provinces-label" className="block text-xs font-semibold uppercase tracking-wide">
                    Select Target Provinces (Multi-select)
                  </span>
                  <div role="group" aria-labelledby="cb-provinces-label" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROVINCES.map((province) => {
                      const active = selectedProvinces.includes(province);
                      return (
                        <button
                          key={province}
                          type="button"
                          onClick={() => toggleProvince(province)}
                          aria-pressed={active}
                          className={
                            "flex items-center gap-1.5 p-2.5 text-left rounded border-2 text-xs font-semibold transition " +
                            (active
                              ? "border-billboard-ink bg-billboard-yellow font-bold shadow-blockSm"
                              : "border-billboard-ink/20 bg-white hover:border-billboard-ink")
                          }
                        >
                          {active && <CheckIcon className="w-3 h-3" />}
                          {province}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {targetScope === "hyperlocal" && (
                <div className="space-y-2 border-t-2 border-billboard-ink/10 pt-4">
                  <label htmlFor="cb-hyperlocal-area" className="block text-xs font-semibold uppercase tracking-wide">
                    Specific Suburbs / Communities
                  </label>
                  <input
 id="cb-hyperlocal-area"
                    type="text"
                    value={hyperlocalArea}
                    onChange={(e) => setHyperlocalArea(e.target.value)}
                    placeholder="e.g. Camps Bay & Sea Point, Sandton CBD, Umhlanga Ridge"
                    className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                  />
                  <p className="text-xs text-billboard-inkSoft">
                    Add any suburb, community or venue catchment you want the campaign manager to
                    consider.
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <Button onClick={prevStep}>
                  <ArrowLeftIcon /> Back
                </Button>
                <Button variant="primary" onClick={nextStep} className="shadow-block">
                  Next: Customers <ArrowRightIcon />
                </Button>
              </div>
            </div>
          )}

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
                  Select as many relevant audience groups as you need. Combining industry interests
                  with customer profiles gives your campaign manager a clearer brief.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <span id="cb-industries-label" className="block text-xs font-semibold uppercase tracking-wide mb-2">
                    Industries & Interests
                  </span>
                  <div role="group" aria-labelledby="cb-industries-label" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map((category) => {
                      const active = targetCategories.includes(category.slug);
                      return (
                        <button
                          key={category.slug}
                          type="button"
                          onClick={() => toggleCategory(category.slug)}
                          aria-pressed={active}
                          className={
                            "p-3 text-left rounded border-2 text-xs font-semibold transition flex items-center justify-between " +
                            (active
                              ? "border-billboard-ink bg-billboard-yellow font-bold shadow-blockSm"
                              : "border-billboard-ink/20 bg-billboard-paperDim hover:bg-white")
                          }
                        >
                          <span className="flex items-center gap-2 pr-2 min-w-0"><CategoryIcon name={category.icon} className="w-4 h-4 shrink-0" />{category.name}</span>
                          {active && <CheckIcon className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t-2 border-billboard-ink/10 pt-5">
                  <span id="cb-profiles-label" className="block text-xs font-semibold uppercase tracking-wide mb-2">
                    Customer Profiles
                  </span>
                  <div role="group" aria-labelledby="cb-profiles-label" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CUSTOMER_PROFILE_OPTIONS.map((category) => {
                      const active = targetCategories.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          aria-pressed={active}
                          className={
                            "p-3 text-left rounded border-2 text-xs transition " +
                            (active
                              ? "border-billboard-ink bg-billboard-ink text-white font-bold shadow-blockSm"
                              : "border-billboard-ink/20 bg-white hover:border-billboard-ink")
                          }
                        >
                          <MarketingIcon name={category.icon} className="w-5 h-5 mb-1.5" />
                          <span className="block leading-snug">{category.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t-2 border-billboard-ink/10 pt-5">
                  <span id="cb-languages-label" className="block text-xs font-semibold uppercase tracking-wide mb-2">
                    Preferred Languages
                  </span>
                  <div role="group" aria-labelledby="cb-languages-label" className="flex flex-wrap gap-2">
                    {LANGUAGES.map((language) => {
                      const active = targetLanguages.includes(language);
                      return (
                        <button
                          key={language}
                          type="button"
                          onClick={() => toggleLanguage(language)}
                          aria-pressed={active}
                          className={
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border-2 transition " +
                            (active
                              ? "border-billboard-ink bg-billboard-ink text-white"
                              : "border-billboard-ink/30 bg-white hover:border-billboard-ink")
                          }
                        >
                          {active && <CheckIcon className="w-3 h-3" />}
                          {language}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t-2 border-billboard-ink/10 pt-5">
                  <label htmlFor="cb-customer-notes" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Describe your ideal buyer or audience (Optional)
                  </label>
                  <input
 id="cb-customer-notes"
                    type="text"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="e.g. Young professionals aged 24–35 who dine out on weekends"
                    className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <Button onClick={prevStep}>
                  <ArrowLeftIcon /> Back
                </Button>
                <Button variant="primary" onClick={nextStep} className="shadow-block">
                  Next: Budget <ArrowRightIcon />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 4 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  Set your campaign budget
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  There are no preset campaign packages here. Enter the amount you want to invest,
                  and ChatSched will build the publisher mix and schedule around that budget during
                  campaign planning.
                </p>
              </div>

              <div className="border-[3px] border-billboard-ink rounded-lg p-6 bg-billboard-paperDim">
                <label htmlFor="cb-budget" className="block text-xs font-mono font-bold uppercase tracking-wide mb-2">
                  Total Campaign Budget (ZAR)
                </label>
                <div className="relative max-w-xl">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl font-bold text-billboard-ink">
                    R
                  </span>
                  <input
 id="cb-budget"
                    type="number"
                    min={MIN_PRICE_PER_POST}
                    step="1"
                    onWheel={(e) => e.currentTarget.blur()}
                    inputMode="decimal"
                    value={customBudgetValue}
                    onChange={(e) => {
                      setCustomBudgetValue(e.target.value);
                      setStepError(null);
                    }}
                    placeholder="Enter your own campaign budget"
                    aria-invalid={Boolean(stepError)}
                    className="w-full border-[3px] border-billboard-ink rounded-lg pl-10 pr-4 py-4 text-2xl font-mono font-bold bg-white"
                  />
                </div>
                <div role="group" aria-label="Quick budget amounts" className="flex flex-wrap gap-2 mt-3 max-w-xl">
                  {[1000, 2500, 5000, 10000, 25000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      aria-pressed={Number(customBudgetValue) === amount}
                      onClick={() => {
                        setCustomBudgetValue(String(amount));
                        setStepError(null);
                      }}
                      className={
                        "px-3 py-1.5 rounded border-2 text-xs font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-billboard-ink focus-visible:ring-offset-2 " +
                        (Number(customBudgetValue) === amount
                          ? "border-billboard-ink bg-billboard-yellow shadow-blockSm"
                          : "border-billboard-ink/30 bg-white hover:border-billboard-ink")
                      }
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-billboard-inkSoft mt-2 max-w-xl">
                  Your budget is a planning input, not a package purchase. Publisher inventory,
                  placement mix and final dates are confirmed with you before any campaign spend is
                  committed.
                </p>
                {stepError && (
                  <div
                    role="alert"
                    className="mt-3 border-2 border-billboard-red bg-billboard-red/10 text-billboard-red rounded p-3 text-xs font-semibold"
                  >
                    {stepError}
                  </div>
                )}
              </div>

              <div className="border-2 border-billboard-ink rounded-lg p-5 bg-white">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block">
                      Estimated reach
                    </span>
                    <strong className="font-display text-xl text-billboard-greenDeep">
                      {publishersLoading ? "Calculating…" : reachEstimate.reach}
                    </strong>
                  </div>
                  <MarketingIcon name="chart" className="w-8 h-8 text-billboard-greenDeep" />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block">
                      Planning placements
                    </span>
                    <strong className="font-mono text-sm">{reachEstimate.placements}</strong>
                  </div>
                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-billboard-paperDim">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block">
                      {reachEstimate.usedFallback ? "Verified inventory (all areas)" : "Verified inventory in scope"}
                    </span>
                    <strong className="font-mono text-sm">
                      {publishersLoading ? "…" : reachEstimate.inventory}
                    </strong>
                  </div>
                </div>

                <p className="text-xs text-billboard-inkSoft mt-3">
                  {reachEstimate.basis}
                  {reachEstimate.usedFallback &&
                    " Few or no verified publishers are listed in your chosen area yet, so this estimate uses verified publishers from all areas."}
                </p>
              </div>

              {Number.isFinite(requestedBudget) && requestedBudget > 0 && (
                <div className="border-2 border-billboard-green/40 bg-[#EAF3EC] rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono uppercase text-billboard-greenDeep block">
                      Your budget
                    </span>
                    <strong className="font-display text-xl">{formatCurrency(requestedBudget)}</strong>
                  </div>
                  <span className="text-xs font-semibold text-billboard-inkSoft">
                    Fully custom campaign budget
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <Button onClick={prevStep}>
                  <ArrowLeftIcon /> Back
                </Button>
                <Button variant="primary" onClick={nextStep} className="shadow-block">
                  Next: Timing <ArrowRightIcon />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 5 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  When do you want to run it?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  Tell us the window that matters to you. ChatSched will confirm publisher
                  availability and dates during campaign planning.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    id: "immediate",
                    title: "Immediate",
                    icon: "bolt" as const,
                    sub: "3–7 Business Days",
                    desc: "Fast-track rollout if suitable inventory is available",
                  },
                  {
                    id: "two_weeks",
                    title: "Next 2–4 Weeks",
                    icon: "clock" as const,
                    sub: "Standard Window",
                    desc: "Time for creative briefing and publisher confirmation",
                  },
                  {
                    id: "next_month",
                    title: "Next Month / Seasonal",
                    icon: "event" as const,
                    sub: "Scheduled Window",
                    desc: "Useful for seasonal, festive and planned promotions",
                  },
                  {
                    id: "custom_dates",
                    title: "Specific Dates",
                    icon: "calendarCheck" as const,
                    sub: "Event or Deadline",
                    desc: "Best when a fixed launch or event date matters",
                  },
                ].map((timing) => {
                  const selected = timingPreference === timing.id;
                  return (
                    <button
                      key={timing.id}
                      type="button"
                      onClick={() =>
                        setTimingPreference(
                          timing.id as "immediate" | "two_weeks" | "next_month" | "custom_dates",
                        )
                      }
                      aria-pressed={selected}
                      className={
                        "text-left p-4 rounded-lg border-2 transition " +
                        (selected
                          ? "border-billboard-ink bg-billboard-yellow font-bold shadow-blockSm"
                          : "border-billboard-ink/20 bg-billboard-paperDim hover:bg-white")
                      }
                    >
                      <div className="flex items-center gap-2 font-display text-base mb-0.5">
                        <MarketingIcon name={timing.icon} className="w-5 h-5" />
                        {timing.title}
                      </div>
                      <div className="text-xs font-mono font-bold text-billboard-greenDeep mb-1.5">
                        {timing.sub}
                      </div>
                      <div className="text-xs text-billboard-inkSoft">{timing.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <span id="cb-duration-label" className="block text-xs font-semibold uppercase tracking-wide mb-2">
                  Flight Duration
                </span>
                <div role="group" aria-labelledby="cb-duration-label" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "7_days", label: "7-Day Sprint", desc: "Short, focused push" },
                    { id: "14_days", label: "14-Day Flight", desc: "Two-phase campaign" },
                    { id: "30_days", label: "30-Day Campaign", desc: "Sustained presence" },
                    { id: "monthly_retainer", label: "Ongoing Monthly", desc: "Continuous presence" },
                  ].map((duration) => (
                    <button
                      key={duration.id}
                      type="button"
                      onClick={() =>
                        setDurationOption(
                          duration.id as "7_days" | "14_days" | "30_days" | "monthly_retainer",
                        )
                      }
                      aria-pressed={durationOption === duration.id}
                      className={
                        "p-3 text-left rounded border-2 text-xs transition " +
                        (durationOption === duration.id
                          ? "border-billboard-ink bg-billboard-ink text-white font-bold shadow-blockSm"
                          : "border-billboard-ink/20 bg-white hover:border-billboard-ink")
                      }
                    >
                      <div className="font-bold">{duration.label}</div>
                      <div
                        className={
                          "text-xs " +
                          (durationOption === duration.id
                            ? "text-billboard-yellow"
                            : "text-billboard-inkSoft")
                        }
                      >
                        {duration.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label htmlFor="cb-timing-dates" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Specific Launch Dates or Event Deadline (Optional)
                </label>
                <input
 id="cb-timing-dates"
                  type="text"
                  value={customTimingDates}
                  onChange={(e) => setCustomTimingDates(e.target.value)}
                  placeholder="e.g. 15 to 28 October, or before Easter weekend"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              <div className="border-2 border-billboard-ink/10 rounded-lg p-4 bg-billboard-paperDim">
                <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                  Current timing
                </span>
                <strong className="font-display text-lg">
                  {formatTiming(timingPreference, customTimingDates, durationOption)}
                </strong>
              </div>

              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <Button onClick={prevStep}>
                  <ArrowLeftIcon /> Back
                </Button>
                <Button variant="primary" onClick={nextStep} className="shadow-block">
                  Next: Brand & Creative <ArrowRightIcon />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 6 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">
                  What should we know about your brand?
                </h2>
                <p className="text-sm text-billboard-inkSoft">
                  These details help the campaign manager and publishers understand your brand before
                  the schedule is finalized. Everything here is optional.
                </p>
              </div>

              {(() => {
                const fields = [brandWebsite, tagline, brandStyleNotes, creativeBriefNotes];
                const filled = fields.filter((field) => field.trim().length > 0).length;
                const pct = Math.round((filled / fields.length) * 100);

                return (
                  <div className="border-2 border-billboard-ink/15 rounded-lg p-3 bg-billboard-paperDim">
                    <div className="flex items-center justify-between text-xs font-mono uppercase mb-1.5">
                      <span className="text-billboard-inkSoft">Brief completeness</span>
                      <span className="font-bold text-billboard-ink">
                        {filled}/{fields.length} added
                      </span>
                    </div>
                    <div className="h-2 rounded bg-white border border-billboard-ink/20 overflow-hidden">
                      <div
                        className="h-full bg-billboard-green transition-all"
                        style={{ width: pct + "%" }}
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cb-brand-website" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Brand website or social link (Optional)
                  </label>
                  <input
 id="cb-brand-website"
                    type="url"
                    value={brandWebsite}
                    onChange={(e) => setBrandWebsite(e.target.value)}
                    placeholder="e.g. https://yourbrand.co.za"
                    className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cb-tagline" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                    Tagline or slogan (Optional)
                  </label>
                  <input
 id="cb-tagline"
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Cape Town's freshest roast, delivered daily"
                    className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                  />
                </div>
              </div>

              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label htmlFor="cb-brand-style" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Brand colors, tone & style (Optional)
                </label>
                <input
 id="cb-brand-style"
                  type="text"
                  value={brandStyleNotes}
                  onChange={(e) => setBrandStyleNotes(e.target.value)}
                  placeholder="e.g. Warm earth tones, playful tone of voice, always lowercase logo"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              <div className="border-t-2 border-billboard-ink/10 pt-4">
                <label htmlFor="cb-creative-notes" className="block text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Creative instructions, do's & don'ts, or talking points (Optional)
                </label>
                <textarea
 id="cb-creative-notes"
                  rows={4}
                  value={creativeBriefNotes}
                  onChange={(e) => setCreativeBriefNotes(e.target.value)}
                  placeholder="Add key links, campaign messages, promotion codes, claims to avoid, or required talking points"
                  className="w-full border-2 border-billboard-ink rounded px-3.5 py-2.5 text-sm bg-white"
                />
              </div>

              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <Button onClick={prevStep}>
                  <ArrowLeftIcon /> Back
                </Button>
                <Button variant="primary" onClick={nextStep} className="shadow-block">
                  Review & Submit <ArrowRightIcon />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-8">
              <div>
                <span className="font-mono text-xs font-bold uppercase text-billboard-greenDeep block mb-1">
                  Step 7 of 7
                </span>
                <h2 className="text-2xl md:text-3xl font-display mb-2">Review your campaign brief</h2>
                <p className="text-sm text-billboard-inkSoft">
                  Check the information below before sending your brief to the ChatSched campaign
                  team. Your final publisher mix, dates and schedule are confirmed with you after
                  review.
                </p>
              </div>

              <div className="border-2 border-billboard-ink rounded-lg p-5 bg-billboard-paperDim">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-display text-lg font-bold">Campaign brief</h3>
                  <span className="text-xs font-mono uppercase bg-white border border-billboard-ink px-2 py-1 rounded">
                    No package selected
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs md:text-sm">
                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-white">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                      Goal
                    </span>
                    <strong>{selectedGoal.title}</strong>
                    {customGoal.trim() && (
                      <span className="block text-xs text-billboard-inkSoft mt-1">
                        {customGoal.trim()}
                      </span>
                    )}
                  </div>

                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-white">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                      Budget
                    </span>
                    <strong>{formatCurrency(requestedBudget)}</strong>
                  </div>

                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-white">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                      Estimated reach
                    </span>
                    <strong>{reachEstimate.reach}</strong>
                  </div>

                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-white">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                      Location
                    </span>
                    <strong>{locationSummary}</strong>
                  </div>

                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-white">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                      Audience
                    </span>
                    <strong>{audienceLabels.join(", ")}</strong>
                  </div>

                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-white">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                      Languages
                    </span>
                    <strong>{targetLanguages.join(", ")}</strong>
                  </div>

                  <div className="border-2 border-billboard-ink/10 rounded p-3 bg-white sm:col-span-2">
                    <span className="text-xs font-mono uppercase text-billboard-inkSoft block mb-1">
                      Timing
                    </span>
                    <strong>{formatTiming(timingPreference, customTimingDates, durationOption)}</strong>
                  </div>
                </div>
              </div>

              <div className="border-2 border-billboard-ink/10 rounded-lg p-4 bg-white text-xs text-billboard-inkSoft">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <span className="font-mono uppercase text-xs block mb-1">Brand link</span>
                    <strong className="text-billboard-ink">{brandWebsite || "Not provided"}</strong>
                  </div>
                  <div>
                    <span className="font-mono uppercase text-xs block mb-1">Tagline</span>
                    <strong className="text-billboard-ink">{tagline || "Not provided"}</strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t-2 border-billboard-ink/10">
                <Button onClick={() => setCurrentStep(6)}>
                  <ArrowLeftIcon /> Modify Brief
                </Button>
              </div>

              <section className="border-[3px] border-billboard-ink rounded-lg p-6 md:p-8 bg-billboard-yellow shadow-block space-y-6">
                <div>
                  <h3 className="text-2xl font-display mb-1">Ready? Submit Campaign to ChatSched</h3>
                  <p className="text-xs text-billboard-inkSoft">
                    Submit your campaign brief. A ChatSched campaign manager will contact you within 24 hours to review creative assets and lock in publisher dates. No payment is required until you approve the finalized schedule.
                  </p>
                </div>

                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cb-business-name" className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Business / Brand Name *
                      </label>
                      <input
 id="cb-business-name"
                        required
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Table Mountain Coffee Co."
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="cb-contact-name" className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Contact Person Name
                      </label>
                      <input
 id="cb-contact-name"
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
                      <label htmlFor="cb-contact-email" className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Email Address *
                      </label>
                      <input
 id="cb-contact-email"
                        required
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="sarah@brand.co.za"
                        className="w-full border-2 border-billboard-ink rounded px-3 py-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="cb-contact-phone" className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1">
                        Phone / WhatsApp Number
                      </label>
                      <input
 id="cb-contact-phone"
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
                      <span id="cb-contact-method-label" className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1.5">
                        Preferred Contact Method
                      </span>
                      <div role="group" aria-labelledby="cb-contact-method-label" className="flex flex-wrap gap-2">
                        {CONTACT_METHODS.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setContactMethod(method.id)}
                            aria-pressed={contactMethod === method.id}
                            className={
                              "border-2 rounded px-3 py-2 text-xs font-semibold transition inline-flex items-center gap-1.5 " +
                              (contactMethod === method.id
                                ? "border-billboard-ink bg-white"
                                : "border-billboard-ink/30 bg-white/70 hover:border-billboard-ink")
                            }
                          >
                            {method.id === "whatsapp" ? <WhatsAppChannelIcon /> : <MarketingIcon name={method.icon} className="w-4 h-4" />}
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span id="cb-urgency-label" className="block text-xs font-mono font-semibold uppercase tracking-wide mb-1.5">
                        How Urgent Is This?
                      </span>
                      <div role="group" aria-labelledby="cb-urgency-label" className="flex flex-col gap-1.5">
                        {URGENCY_LEVELS.map((level) => (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => setUrgency(level.id)}
                            aria-pressed={urgency === level.id}
                            className={
                              "text-left border-2 rounded px-3 py-1.5 text-xs font-semibold transition " +
                              (urgency === level.id
                                ? "border-billboard-ink bg-white"
                                : "border-billboard-ink/30 bg-white/70 hover:border-billboard-ink")
                            }
                          >
                            {level.label}
                            <span className="block text-xs font-normal text-billboard-inkSoft">
                              {level.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {submissionError && (
                    <div
                      role="alert"
                      className="border-2 border-billboard-red bg-white text-billboard-red rounded p-3 text-xs font-semibold"
                    >
                      {submissionError}
                    </div>
                  )}

                  {submitting && (
                    <div role="status" className="flex flex-col items-center text-center">
                      <picture>
                        <source media="(prefers-reduced-motion: reduce)" srcSet="/schedy/schedy-loading-preview.png" />
                        <img src="/schedy/schedy-loading-animated.svg" alt="" width={800} height={440} className="w-full max-w-[200px] h-auto" />
                      </picture>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="dark"
                    disabled={submitting}
                    className="w-full border-[3px] border-billboard-ink shadow-block !py-3.5 !px-6 !text-sm !normal-case !font-display !font-bold"
                  >
                    {submitting ? "Submitting Campaign to ChatSched…" : <>Submit Campaign Brief <ArrowRightIcon /></>}
                  </Button>
                </form>
              </section>
            </div>
          )}
          {stepError && (currentStep === 2 || currentStep === 3) && (
            <div
              role="alert"
              className="mt-4 border-2 border-billboard-red bg-billboard-red/10 text-billboard-red rounded p-3 text-xs font-semibold"
            >
              {stepError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
