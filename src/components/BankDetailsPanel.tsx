import { useState } from "react";
import { PLATFORM_BANK_DETAILS } from "../lib/constants";
import { formatCurrency } from "../lib/currency";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-billboard-ink/10 last:border-b-0">
      <div>
        <p className="font-mono text-[10px] uppercase text-billboard-inkSoft">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2 py-1 hover:bg-billboard-paperDim transition shrink-0"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

/** The real Capitec details from constants.ts, plus whatever's specific to this one payment (amount + reference). Used by both the channel_requests flow and the requests-flow EFT option. */
export default function BankDetailsPanel({ amount, reference }: { amount: number; reference: string }) {
  return (
    <div className="border-2 border-billboard-ink rounded p-3.5 bg-billboard-paperDim">
      <CopyField label="Account holder" value={PLATFORM_BANK_DETAILS.accountHolder} />
      <CopyField label="Bank" value={PLATFORM_BANK_DETAILS.bank} />
      <CopyField label="Account number" value={PLATFORM_BANK_DETAILS.accountNumber} />
      <CopyField label="Branch code" value={PLATFORM_BANK_DETAILS.branchCode} />
      <CopyField label="Account type" value={PLATFORM_BANK_DETAILS.accountType} />
      <CopyField label="Amount" value={formatCurrency(amount)} />
      <CopyField label="Reference (required)" value={reference} />
    </div>
  );
}
