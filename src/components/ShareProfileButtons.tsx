import { useState } from "react";
import MarketingIcon from "./MarketingIcon";

/**
 * "Share this publisher" — WhatsApp share + copy link, for the Publisher
 * Profile sidebar. Deliberately its own https://wa.me/?text=... link
 * rather than lib/constants.ts's whatsappLink() helper: that one always
 * targets ChatSched's own support number (WHATSAPP_NUMBER) for contacting
 * the platform, whereas this opens the phone's own contact/chat picker
 * with no fixed recipient — sharing WITH someone, not messaging
 * ChatSched. Copy-link follows the same copied-state pattern already used
 * by BankDetailsPanel.tsx / CampaignTracker.tsx elsewhere in the app.
 */
export default function ShareProfileButtons({ publisherName, url }: { publisherName: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const shareText = `Check out ${publisherName} on ChatSched: ${url}`;

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex gap-2 mb-5">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex justify-center items-center gap-1.5 border-[3px] border-billboard-ink font-bold py-2 rounded hover:-translate-y-0.5 transition text-xs bg-white"
      >
        <MarketingIcon name="chat" className="w-3.5 h-3.5" /> WhatsApp
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="flex-1 inline-flex justify-center items-center gap-1.5 border-[3px] border-billboard-ink font-bold py-2 rounded hover:-translate-y-0.5 transition text-xs bg-white"
      >
        <MarketingIcon name={copied ? "check" : "link"} className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
