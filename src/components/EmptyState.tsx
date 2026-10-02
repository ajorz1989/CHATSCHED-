import type { ReactNode } from "react";

/**
 * On-theme empty-state illustrations. Hand-built inline SVGs using the billboard
 * palette (paper/ink/yellow/green) so they read as part of the product, not stock art.
 * Kept small and geometric to match the bold-block aesthetic.
 */
export type EmptyIllustrationKind =
  | "search"
  | "inbox"
  | "bell"
  | "chart"
  | "wallet"
  | "list"
  | "map"
  | "compare"
  | "lock";

export function EmptyIllustration({ kind }: { kind: EmptyIllustrationKind }) {
  const common = "w-full h-full";
  switch (kind) {
    case "search":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <rect x="10" y="10" width="100" height="100" rx="6" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3" />
          <circle cx="50" cy="52" r="22" fill="#F5B700" stroke="#1A1712" strokeWidth="4" />
          <line x1="66" y1="68" x2="88" y2="90" stroke="#1A1712" strokeWidth="6" strokeLinecap="round" />
          <line x1="41" y1="52" x2="59" y2="52" stroke="#1A1712" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "inbox":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <rect x="14" y="30" width="92" height="66" rx="5" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3" />
          <path d="M14 34 L60 68 L106 34" fill="none" stroke="#1A1712" strokeWidth="3" />
          <rect x="40" y="14" width="40" height="24" rx="3" fill="#1C6B45" stroke="#1A1712" strokeWidth="3" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <path
            d="M60 18c-14 0-22 10-22 24v14l-10 16h64l-10-16V42c0-14-8-24-22-24z"
            fill="#FAF9F5"
            stroke="#1A1712"
            strokeWidth="3.5"
          />
          <path d="M50 82a10 10 0 0020 0" fill="none" stroke="#1A1712" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="88" cy="30" r="9" fill="#D4451F" stroke="#1A1712" strokeWidth="3" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <rect x="12" y="12" width="96" height="96" rx="6" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3" />
          <rect x="28" y="60" width="14" height="34" fill="#F5B700" stroke="#1A1712" strokeWidth="3" />
          <rect x="53" y="42" width="14" height="52" fill="#1C6B45" stroke="#1A1712" strokeWidth="3" />
          <rect x="78" y="70" width="14" height="24" fill="#D4451F" stroke="#1A1712" strokeWidth="3" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <rect x="14" y="34" width="92" height="60" rx="6" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3.5" />
          <path d="M14 50h92" stroke="#1A1712" strokeWidth="3" />
          <rect x="72" y="58" width="26" height="18" rx="3" fill="#F5B700" stroke="#1A1712" strokeWidth="3" />
          <circle cx="85" cy="67" r="2.5" fill="#1A1712" />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <rect x="16" y="16" width="88" height="88" rx="6" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3" />
          <circle cx="34" cy="38" r="4" fill="#1C6B45" />
          <line x1="46" y1="38" x2="90" y2="38" stroke="#1A1712" strokeWidth="4" strokeLinecap="round" />
          <circle cx="34" cy="60" r="4" fill="#F5B700" />
          <line x1="46" y1="60" x2="90" y2="60" stroke="#1A1712" strokeWidth="4" strokeLinecap="round" />
          <circle cx="34" cy="82" r="4" fill="#D4451F" />
          <line x1="46" y1="82" x2="76" y2="82" stroke="#1A1712" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <path
            d="M60 16c-15 0-27 12-27 27 0 20 27 55 27 55s27-35 27-55c0-15-12-27-27-27z"
            fill="#F5B700"
            stroke="#1A1712"
            strokeWidth="3.5"
          />
          <circle cx="60" cy="43" r="11" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3" />
        </svg>
      );
    case "compare":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <rect x="12" y="20" width="40" height="80" rx="5" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3" />
          <rect x="68" y="20" width="40" height="80" rx="5" fill="#FAF9F5" stroke="#1A1712" strokeWidth="3" />
          <circle cx="60" cy="60" r="14" fill="#1C6B45" stroke="#1A1712" strokeWidth="3" />
          <path d="M55 60l4 4 7-8" fill="none" stroke="#FAF9F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 120 120" className={common} aria-hidden="true">
          <rect x="30" y="52" width="60" height="46" rx="6" fill="#F5B700" stroke="#1A1712" strokeWidth="3.5" />
          <path d="M42 52V38a18 18 0 0136 0v14" fill="none" stroke="#1A1712" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="60" cy="72" r="6" fill="#1A1712" />
          <line x1="60" y1="78" x2="60" y2="87" stroke="#1A1712" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function EmptyState({
  kind,
  title,
  description,
  action,
  compact = false,
}: {
  kind: EmptyIllustrationKind;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? "py-8 px-4" : "py-16 px-6"}`}
      role="status"
    >
      <div className={compact ? "w-14 h-14 mb-3" : "w-24 h-24 mb-5"}>
        <EmptyIllustration kind={kind} />
      </div>
      <h3 className={`font-display ${compact ? "text-base" : "text-xl"} text-billboard-ink mb-1.5`}>{title}</h3>
      {description && (
        <p className={`text-billboard-inkSoft ${compact ? "text-xs" : "text-sm"} max-w-sm`}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
