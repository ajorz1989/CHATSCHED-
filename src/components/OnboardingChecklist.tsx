import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  actionLabel?: string;
  actionTo?: string;
  // For an in-place action (e.g. "Resend verification email") rather than a
  // navigation — mutually exclusive with actionTo/actionLabel for a given
  // item. Should resolve/reject; this component tracks its own
  // sending/sent/error state per item so the caller doesn't need to.
  onAction?: () => Promise<void>;
  onActionLabel?: string;
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * A self-contained progress checklist for first-time businesses/publishers.
 * Every item's `done` is computed by the caller from real data already
 * loaded on the dashboard (profile fields, request counts, payment status)
 * — this component only handles display, the progress bar, and dismissal.
 *
 * Dismissal persists in localStorage, keyed per-user (storageKey should
 * include the user id) so it doesn't reappear every login, and doesn't leak
 * across accounts on a shared browser. Once every item is done, it collapses
 * to a small "You're all set" banner rather than disappearing outright —
 * still dismissible, but the completion itself is worth a beat of
 * acknowledgment rather than just vanishing.
 */
export default function OnboardingChecklist({ title, items, storageKey }: { title: string; items: ChecklistItem[]; storageKey: string }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));
  const [actionState, setActionState] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});

  useEffect(() => {
    setDismissed(readDismissed(storageKey));
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // best-effort — worst case it just re-shows next visit
    }
  }

  function showAgain() {
    setDismissed(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // best-effort
    }
  }

  async function runAction(item: ChecklistItem) {
    if (!item.onAction) return;
    setActionState((s) => ({ ...s, [item.id]: "sending" }));
    try {
      await item.onAction();
      setActionState((s) => ({ ...s, [item.id]: "sent" }));
    } catch {
      setActionState((s) => ({ ...s, [item.id]: "error" }));
    }
  }

  // Dismissing an incomplete checklist used to be permanent with no way
  // back short of clearing localStorage by hand — this small link is the
  // recovery path, always available in place of the full checklist.
  if (dismissed) {
    return (
      <button onClick={showAgain} className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft underline hover:text-billboard-ink mb-8 block">
        Show setup checklist
      </button>
    );
  }

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;
  const percent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  if (allDone) {
    return (
      <div className="border-[3px] border-billboard-greenDeep bg-[#EAF3EC] rounded p-4 mb-8 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-billboard-greenDeep">✓ You're all set — {title.toLowerCase()} complete.</p>
        <button onClick={dismiss} className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink shrink-0">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 mb-8 bg-billboard-paperDim">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-display text-lg">{title}</h2>
        <button onClick={dismiss} className="font-mono text-[10px] font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink shrink-0">
          Dismiss
        </button>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2 rounded-full bg-white border-2 border-billboard-ink overflow-hidden">
          <div className="h-full bg-billboard-green transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="font-mono text-xs font-semibold text-billboard-inkSoft shrink-0">{doneCount}/{items.length}</span>
      </div>

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span className={`w-5 h-5 rounded-full border-2 border-billboard-ink shrink-0 flex items-center justify-center mt-0.5 ${item.done ? "bg-billboard-green" : "bg-white"}`}>
              {item.done && <span className="text-white text-[10px] leading-none">✓</span>}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${item.done ? "text-billboard-inkSoft line-through" : "text-billboard-ink"}`}>{item.label}</p>
              {!item.done && <p className="text-xs text-billboard-inkSoft">{item.hint}</p>}
            </div>
            {!item.done && item.actionTo && item.actionLabel && (
              <Link to={item.actionTo} className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1 hover:bg-white transition shrink-0 whitespace-nowrap">
                {item.actionLabel}
              </Link>
            )}
            {!item.done && item.onAction && (
              <div className="shrink-0 text-right">
                {actionState[item.id] === "sent" ? (
                  <span className="font-mono text-[10px] font-semibold uppercase text-billboard-greenDeep whitespace-nowrap">Sent ✓</span>
                ) : (
                  <button
                    onClick={() => runAction(item)}
                    disabled={actionState[item.id] === "sending"}
                    className="font-mono text-[10px] font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1 hover:bg-white transition whitespace-nowrap disabled:opacity-60"
                  >
                    {actionState[item.id] === "sending" ? "Sending…" : (item.onActionLabel ?? "Resend")}
                  </button>
                )}
                {actionState[item.id] === "error" && <p className="text-billboard-red text-[10px] font-semibold mt-1">Couldn't send — try again</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
