import { useEffect, useState } from "react";
import Seo from "../components/Seo";
import PlatformRequirementCard from "../components/PlatformRequirementCard";
import { SkeletonRows } from "../components/Skeleton";
import { getEnabledPlatformRules } from "../lib/compliance";
import type { PlatformComplianceRule } from "../lib/complianceTypes";

/**
 * Brief section 14 — a dedicated page (distinct from the /compliance hub's
 * compact platform grid) showing each platform's full requirements:
 * disclosure guidance, restrictions, creator/business responsibilities,
 * and proof requirements, with the "last reviewed" date and the
 * non-guarantee disclaimer PlatformRequirementCard already renders on
 * every copy of itself.
 */
export default function PlatformRules() {
  const [platforms, setPlatforms] = useState<PlatformComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEnabledPlatformRules().then((p) => { setPlatforms(p); setLoading(false); });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo
        title="Platform Rules · ChatSched"
        description="Commercial-content disclosure guidance, restrictions, and proof requirements ChatSched currently tracks for each supported platform."
      />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        Platform rules
      </span>
      <h1 className="text-3xl md:text-4xl mb-3 max-w-xl">What each platform expects — so your campaign doesn't get pulled.</h1>
      <p className="text-billboard-inkSoft max-w-xl mb-2">
        ChatSched helps businesses and publishers prepare campaigns for applicable platform requirements. Final
        publication, enforcement, and policy decisions remain with the relevant platform.
      </p>
      <p className="text-billboard-inkSoft max-w-xl mb-12">
        Requirements may change. Always verify the current platform policy before publishing — this list is a
        starting point, not a substitute for it.
      </p>

      {loading ? (
        <SkeletonRows count={4} />
      ) : (
        <div className="space-y-4">
          {platforms.map((p) => <PlatformRequirementCard key={p.platform} rule={p} />)}
        </div>
      )}
    </div>
  );
}
