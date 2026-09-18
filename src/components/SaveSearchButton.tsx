import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { summarizeFilters, type Filters } from "../lib/browseFilters";
import { formatSupabaseError } from "../lib/supabaseErrors";
import Button from "./Button";

/**
 * "Save this search" — sits next to Browse's "Clear all". Publisher/admin
 * accounts don't get this (saved searches are a business tool: "tell me
 * when a new publisher matching this shows up"), and a logged-out visitor
 * gets a "log in to save" prompt instead of the form, same pattern as
 * PublisherCard's save-to-list button.
 */
export default function SaveSearchButton({ filters, resultCount }: { filters: Filters; resultCount: number }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openPopover() {
    setName(summarizeFilters(filters));
    setSaved(false);
    setError(null);
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user || name.trim().length < 2) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("saved_searches").insert({
      business_id: user.id,
      name: name.trim(),
      filters,
    });
    setSaving(false);
    if (insertError) {
      setError(formatSupabaseError(insertError, "Couldn't save that search"));
      return;
    }
    setSaved(true);
  }

  // Publishers/admins never see this — saved searches are a business tool.
  if (profile?.role === "publisher" || profile?.role === "admin") return null;

  if (!user) {
    return (
      <Button to="/login" size="md" className="shrink-0">
        💾 Log in to save this search
      </Button>
    );
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button onClick={() => (open ? setOpen(false) : openPopover())}>
        💾 Save this search
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border-[3px] border-billboard-ink rounded-lg shadow-block z-30 p-4">
          {saved ? (
            <div>
              <p className="text-sm font-semibold mb-1">Saved ✓</p>
              <p className="text-xs text-billboard-inkSoft mb-3">
                We'll email you when a new publisher matching this joins the directory.
              </p>
              <Link to="/saved-searches" className="text-xs font-semibold underline text-billboard-inkSoft hover:text-billboard-ink">
                Manage your saved searches →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5">Name this search</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full border-2 border-billboard-ink rounded px-2.5 py-2 bg-white text-sm mb-2"
              />
              <p className="text-xs text-billboard-inkSoft mb-3">
                {resultCount} publisher{resultCount === 1 ? "" : "s"} match right now. We'll email you when a new one does too.
              </p>
              {error && <p className="text-billboard-red text-xs font-semibold mb-2">{error}</p>}
              <Button type="submit" variant="primary" size="md" disabled={saving || name.trim().length < 2} className="w-full">
                {saving ? "Saving…" : "Save & get alerts"}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
