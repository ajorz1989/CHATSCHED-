import type { PlatformComplianceRule } from "../lib/complianceTypes";

/**
 * Displays one platform's requirements, exactly as configured in
 * platform_compliance_rules — never hard-coded copy. Used on
 * /campaigns/:id/compliance, and reusable as-is on the future /compliance
 * and /platform-rules hub pages (brief sections 1, 14).
 *
 * Positioning rule (brief section 33 — do not remove): this card must
 * never claim platform approval. "ChatSched compliance check complete" /
 * "Platform requirements identified" only.
 */
export default function PlatformRequirementCard({ rule, compact = false }: { rule: PlatformComplianceRule; compact?: boolean }) {
  return (
    <div className="border-[3px] border-billboard-ink rounded bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="font-display text-sm">{rule.display_name}</h3>
        {rule.disclosure_required && (
          <span className="font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border border-billboard-ink bg-billboard-yellow text-billboard-ink shrink-0">
            Disclosure required
          </span>
        )}
      </div>

      {rule.required_creator_actions.length > 0 && (
        <div className="mb-2.5">
          <p className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft mb-1">Creator action</p>
          <ul className="text-sm space-y-1">
            {rule.required_creator_actions.map((a, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden="true">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && rule.required_business_actions.length > 0 && (
        <div className="mb-2.5">
          <p className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft mb-1">Business responsibility</p>
          <ul className="text-sm space-y-1">
            {rule.required_business_actions.map((a, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden="true">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && rule.required_proof.length > 0 && (
        <div className="mb-2.5">
          <p className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft mb-1">Proof to submit</p>
          <p className="text-sm text-billboard-inkSoft">{rule.required_proof.join(", ")}</p>
        </div>
      )}

      {!compact && (rule.content_restrictions.length > 0 || rule.restricted_categories.length > 0 || rule.prohibited_categories.length > 0) && (
        <details className="mt-2 text-xs text-billboard-inkSoft">
          <summary className="cursor-pointer font-mono uppercase font-semibold">Learn more</summary>
          {rule.prohibited_categories.length > 0 && <p className="mt-1.5">Not accepted on this platform: {rule.prohibited_categories.join(", ")}</p>}
          {rule.restricted_categories.length > 0 && <p className="mt-1.5">Restricted categories: {rule.restricted_categories.join(", ")}</p>}
          {rule.content_restrictions.length > 0 && <p className="mt-1.5">Content restrictions: {rule.content_restrictions.join(", ")}</p>}
          {rule.notes && <p className="mt-1.5">{rule.notes}</p>}
        </details>
      )}

      <p className="text-[11px] text-billboard-inkSoft mt-3 pt-2.5 border-t border-billboard-paperDim">
        {rule.last_reviewed_at ? `Last reviewed ${new Date(rule.last_reviewed_at).toLocaleDateString()}. ` : ""}
        Requirements may change. Always verify the current platform policy before publishing.
      </p>
    </div>
  );
}
