import { useState } from "react";
import type { CampaignDisclosure, PlatformComplianceRule } from "../lib/complianceTypes";
import { acknowledgeCampaignDisclosure } from "../lib/compliance";

/**
 * The "PAID CAMPAIGN" acknowledgment shown to a creator before they
 * publish (brief section 8). Only rendered for the creator side of a
 * campaign — the page decides that, this component just needs to know
 * whether an ack already exists so it doesn't ask twice.
 */
export default function DisclosureNotice({
  campaignComplianceId,
  rule,
  existingAck,
  onAcknowledged,
}: {
  campaignComplianceId: string;
  rule: PlatformComplianceRule;
  existingAck: CampaignDisclosure | null;
  onAcknowledged: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingAck) {
    return (
      <div className="border-[3px] border-billboard-greenDeep rounded bg-white p-4">
        <p className="font-mono text-[10px] font-semibold uppercase text-billboard-greenDeep mb-1">Disclosure acknowledged</p>
        <p className="text-sm text-billboard-inkSoft">
          You confirmed the {rule.display_name} disclosure requirement on {new Date(existingAck.acknowledged_at).toLocaleDateString()}.
        </p>
      </div>
    );
  }

  async function acknowledge() {
    setSubmitting(true);
    setError(null);
    try {
      await acknowledgeCampaignDisclosure(campaignComplianceId, rule.platform);
      onAcknowledged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record your acknowledgment — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded bg-billboard-yellow p-4">
      <p className="font-mono text-[10px] font-semibold uppercase text-billboard-ink mb-1">Paid campaign</p>
      <p className="text-sm font-semibold mb-2">This is a commercial collaboration.</p>
      {rule.required_creator_actions.length > 0 && (
        <p className="text-sm mb-3">{rule.required_creator_actions[0]}</p>
      )}
      {error && <p className="text-sm text-billboard-red mb-2">{error}</p>}
      <button
        onClick={acknowledge}
        disabled={submitting}
        className="font-mono text-xs font-semibold uppercase bg-billboard-ink text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {submitting ? "Saving…" : "I understand the disclosure requirement"}
      </button>
    </div>
  );
}
