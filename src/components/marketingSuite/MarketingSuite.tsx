import { useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const [module, setModule] = useState<Module>(() => initialModuleFromQuery(searchParams.get("tool")));

  return (
    <section className="border-[3px] border-billboard-ink rounded p-5 mb-10">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <span className="inline-block font-mono text-[10px] font-semibold tracking-wider uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-2 py-1 rounded mb-2">
            Marketing Suite
          </span>
          <h2 className="font-display text-xl md:text-2xl">Plan campaigns with data — and generate content with AI</h2>
          <p className="text-sm text-billboard-inkSoft mt-1 max-w-xl">
            Rule-based matching and estimates, plus AI Content Studio for real, ready-to-post copy across nine formats,
            and Caption Writer for one platform caption at a time from the same generator.
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
            className={`font-mono text-xs font-semibold uppercase tracking-wide px-3 py-2.5 -mb-[3px] border-b-[3px] whitespace-nowrap transition ${
              module === m.id
                ? "border-billboard-ink text-billboard-ink"
                : "border-transparent text-billboard-inkSoft"
            }`}
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
