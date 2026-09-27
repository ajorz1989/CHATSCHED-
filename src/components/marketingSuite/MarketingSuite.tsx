import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { BUSINESS_SUBSCRIPTION_PRICE } from "../../lib/constants";
import { isSubscriptionUsable } from "../../lib/subscriptions";
import { SkeletonBlock } from "../Skeleton";
import MatchSearch from "./MatchSearch";
import ReachPlanner from "./ReachPlanner";
import CaptionWriter from "./CaptionWriter";
import CampaignBuilder from "./CampaignBuilder";
import RoiCalculator from "./RoiCalculator";
import ContentStudio from "./ContentStudio";
import CampaignTracker from "./CampaignTracker";

type Module =
  | "match"
  | "audience"
  | "content"
  | "captions"
  | "builder"
  | "tracking"
  | "roi";

const MODULES: { id: Module; label: string; blurb: string }[] = [
  { id: "match", label: "Match", blurb: "Describe your business — get ranked publishers" },
  { id: "audience", label: "Reach Planner", blurb: "Guided wizard → plan & schedule" },
  { id: "content", label: "AI Content Studio", blurb: "Photo or brief → 9 ready-to-post formats" },
  { id: "captions", label: "Caption Writer", blurb: "Promotion brief → ready-to-use outputs" },
  { id: "builder", label: "Campaign Builder", blurb: "Plain-language brief + quality score" },
  { id: "tracking", label: "Campaign Tracker", blurb: "Real tracking links — clicks, visits, leads, conversions" },
  { id: "roi", label: "ROI Calculator", blurb: "Budget → estimated reach & return" },
];

// ChatSched Tools (schema_phase100) links into specific modules here via
// ?tool=<module>, e.g. /dashboard?tool=roi from the ROI Calculator tool
// card — see PHASE100_CHATSCHED_TOOLS_DELIVERY.md's "known gap" note.
// Falls back to "match" for a missing/invalid value, same as the old
// hardcoded default.
function initialModuleFromQuery(value: string | null): Module {
  return (MODULES.some((m) => m.id === value) ? value : "match") as Module;
}

export default function MarketingSuite() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [module, setModule] = useState<Module>(() => initialModuleFromQuery(searchParams.get("tool")));
  const [activationLoaded, setActivationLoaded] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadActivation() {
      if (!user) {
        if (!cancelled) {
          setActivated(false);
          setActivationLoaded(true);
        }
        return;
      }

      if (profile?.role === "admin") {
        if (!cancelled) {
          setActivated(true);
          setActivationLoaded(true);
        }
        return;
      }

      if (profile?.role !== "business") {
        if (!cancelled) {
          setActivated(false);
          setActivationLoaded(true);
        }
        return;
      }

      const { data } = await supabase
        .from("business_subscriptions")
        .select("status")
        .eq("business_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setActivated(Boolean(data && isSubscriptionUsable(data.status)));
        setActivationLoaded(true);
      }
    }

    setActivationLoaded(false);
    loadActivation();

    return () => {
      cancelled = true;
    };
  }, [user, profile?.role]);

  if (!activationLoaded) {
    return <SkeletonBlock className="h-56 mb-10" />;
  }

  if (!activated) {
    return (
      <section className="border-[3px] border-billboard-ink rounded p-5 mb-10">
        <div className="border-2 border-billboard-ink/20 rounded-lg p-6 md:p-8 bg-billboard-paperDim">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="inline-block font-mono text-[10px] font-semibold tracking-wider uppercase border-2 border-billboard-ink bg-billboard-yellow px-2 py-1 rounded">
              Marketing Suite
            </span>
            <span className="font-mono text-[10px] font-bold uppercase border-2 border-billboard-red text-billboard-red px-2 py-1 rounded">
              Locked
            </span>
          </div>
          <h2 className="font-display text-xl md:text-2xl mb-2">Your marketing tools are ready when you activate.</h2>
          <p className="text-sm text-billboard-inkSoft max-w-xl mb-5">
            Your Marketing Suite is included with ChatSched Business. New business accounts can see the suite here, but the tools stay locked until the once-off activation fee is paid.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 mb-6 text-sm">
            {MODULES.map((m) => (
              <div key={m.id} className="border-2 border-billboard-ink/10 rounded px-3 py-2 bg-white">
                <span className="font-semibold">{m.label}</span>
                <span className="block text-xs text-billboard-inkSoft mt-0.5">{m.blurb}</span>
              </div>
            ))}
          </div>
          <Link
            to="/activation-fee-info"
            className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition"
          >
            Activate Business — {BUSINESS_SUBSCRIPTION_PRICE} once-off →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="border-[3px] border-billboard-ink rounded p-5 mb-10">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <span className="inline-block font-mono text-[10px] font-semibold tracking-wider uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-2 py-1 rounded mb-2">
            Marketing Suite
          </span>
          <h2 className="font-display text-xl md:text-2xl">Plan campaigns with data — and generate content with AI</h2>
          <p className="text-sm text-billboard-inkSoft mt-1 max-w-xl">
            Your business activation unlocks the full suite: matching, reach planning, content generation, campaign building, tracking and ROI tools.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b-[3px] border-billboard-ink overflow-x-auto">
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModule(m.id)}
            title={m.blurb}
            className={"font-mono text-xs font-semibold uppercase tracking-wide px-3 py-2.5 -mb-[3px] border-b-[3px] whitespace-nowrap transition " +
              (module === m.id ? "border-billboard-ink text-billboard-ink" : "border-transparent text-billboard-inkSoft")}
          >
            {m.label}
          </button>
        ))}
      </div>

      {module === "match" && <MatchSearch />}
      {module === "audience" && <ReachPlanner />}
      {module === "content" && <ContentStudio />}
      {module === "captions" && <CaptionWriter />}
      {module === "builder" && <CampaignBuilder />}
      {module === "tracking" && <CampaignTracker />}
      {module === "roi" && <RoiCalculator />}
    </section>
  );
}
