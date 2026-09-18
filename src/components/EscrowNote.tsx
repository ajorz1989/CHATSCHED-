import { Link } from "react-router-dom";

/**
 * Surfaced right at the payment decision point (ChannelCampaignCard.tsx,
 * Dashboard.tsx) — not just pre-read on the static /how-payment-works
 * page. The moment someone's about to hand over money is exactly when
 * "is this safe" hesitation actually happens, so the reassurance belongs
 * there, not only somewhere they might have read it days earlier.
 */
export default function EscrowNote({ until }: { until: string }) {
  return (
    <p className="text-xs text-billboard-inkSoft border-2 border-billboard-ink/15 rounded px-3 py-2 mb-3 bg-billboard-paperDim">
      🔒 Held by ChatSched until {until} — not released to the creator before then.{" "}
      <Link to="/how-payment-works" className="underline font-semibold whitespace-nowrap">How this works →</Link>
    </p>
  );
}
