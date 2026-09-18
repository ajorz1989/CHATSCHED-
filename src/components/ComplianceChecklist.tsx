import type { CampaignCompliance } from "../lib/complianceTypes";

/**
 * Read-only checklist rendering of a CampaignCompliance row. Every item
 * here reflects a server-computed boolean (see recompute_campaign_compliance
 * in schema_phase39_compliance.sql) — there is nothing to check off by
 * hand in this component; the underlying action (set platform/category,
 * acknowledge disclosure, create a tracking link) is what flips it.
 */
export default function ComplianceChecklist({ compliance }: { compliance: CampaignCompliance }) {
  const items: { label: string; done: boolean }[] = [
    { label: "Campaign category assessed", done: compliance.category_assessed },
    { label: "Required disclosure identified", done: compliance.disclosure_identified },
    { label: "Creator accepted disclosure requirement", done: compliance.creator_accepted },
    { label: "Campaign brief supplied", done: compliance.brief_supplied },
    { label: "Tracking configured", done: compliance.tracking_configured },
  ];

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${
              item.done ? "bg-billboard-green text-white border-billboard-greenDeep" : "bg-white text-billboard-inkSoft border-billboard-inkSoft"
            }`}
          >
            {item.done ? "✓" : ""}
          </span>
          <span className={item.done ? "text-billboard-ink" : "text-billboard-inkSoft"}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
