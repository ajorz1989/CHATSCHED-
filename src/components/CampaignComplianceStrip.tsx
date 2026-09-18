import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ComplianceBadge from "./ComplianceBadge";
import { getCampaignComplianceById } from "../lib/compliance";
import { outstandingComplianceItems } from "../lib/complianceTypes";
import type { CampaignCompliance } from "../lib/complianceTypes";

/**
 * "Campaign Status" strip — brief section 22: compliance surfaced inside
 * the conversation/booking card itself, not only on its own page. Shows
 * the status badge, a one-line summary of what's outstanding, and a link
 * through to the full checklist. Deliberately quiet: renders nothing while
 * loading and nothing if the campaign has no compliance context set yet
 * (nothing to warn about before a platform/category is even chosen), so it
 * never spams a generic warning on every booking regardless of relevance.
 */
export default function CampaignComplianceStrip({ campaignId }: { campaignId: string }) {
  const [compliance, setCompliance] = useState<CampaignCompliance | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getCampaignComplianceById(campaignId).then((cc) => { if (!cancelled) setCompliance(cc); });
    return () => { cancelled = true; };
  }, [campaignId]);

  if (!compliance || compliance.status === "not_started") return null;

  const outstanding = outstandingComplianceItems(compliance);

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-2 border-billboard-paperDim rounded px-3 py-2 my-3 text-sm">
      <span className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft">Campaign status</span>
      <ComplianceBadge status={compliance.status} />
      {outstanding.length > 0 && <span className="text-billboard-inkSoft text-xs">{outstanding.join(" · ")}</span>}
      <Link to={`/campaigns/${campaignId}?tab=compliance`} className="ml-auto font-mono text-[10px] font-semibold uppercase text-billboard-greenDeep underline whitespace-nowrap">
        View campaign requirements
      </Link>
    </div>
  );
}
