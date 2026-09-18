import { useEffect, useState, type ReactNode } from "react";

// Audit finding, in the dashboard's own code comment: "a returning
// publisher shouldn't have to pass six setup panels to see whether
// anyone's requested them." The "Manage listing" tab stacks profile,
// portfolio, pricing, and format panels all open, all the time, for
// every publisher on every visit — regardless of whether a given section
// is already finished. This doesn't touch what any of those panels DO
// (each still owns its own heading, its own "Edit" button, its own save
// logic) — it just wraps each one so a finished section collapses to one
// compact row instead of staying expanded forever, and auto-collapses
// itself the moment `complete` flips true, so working through the list
// top to bottom naturally reveals the next thing left to do instead of
// requiring a scroll past everything already done.
export default function CollapsiblePanel({
  title,
  status,
  complete,
  defaultOpen,
  children,
}: {
  title: string;
  status: string;
  complete: boolean;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (complete) setOpen(false);
  }, [complete]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 border-2 border-billboard-ink rounded p-4 mb-6 text-left hover:bg-billboard-paperDim transition"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <span className={complete ? "text-billboard-greenDeep" : "text-billboard-inkSoft"}>{complete ? "✓" : "○"}</span>
          {title}
        </span>
        <span className="text-xs text-billboard-inkSoft shrink-0">{status} · Edit →</span>
      </button>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-1">
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold underline text-billboard-inkSoft">
          Collapse
        </button>
      </div>
      {children}
    </div>
  );
}
