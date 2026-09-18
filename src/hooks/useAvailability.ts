import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Previously localStorage-only, keyed by publisherId in whatever browser
// happened to be open — which meant a business viewing a publisher's
// profile never actually saw that publisher's real blocked dates, only
// their own browser's empty local storage. Now backed by
// publisher_blocked_dates (schema_phase12_blocked_dates.sql), which
// everyone with visibility into the publisher can read, and only the
// publisher's own account (or an admin) can write to.
//
// Same public shape as before — { blockedDates, toggleDate, isBlocked } —
// so AvailabilityCalendar.tsx needed zero changes. toggleDate updates
// local state immediately (the calendar's existing click handling assumes
// a synchronous-feeling toggle) and persists to Supabase in the
// background; if Supabase isn't configured at all, this quietly falls
// back to empty/no-op rather than breaking the page.
export function useAvailability(publisherId: string) {
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured || !publisherId) { setLoaded(true); return; }
    supabase
      .from("publisher_blocked_dates")
      .select("blocked_date")
      .eq("publisher_id", publisherId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Could not load availability", error);
        setBlockedDates((data ?? []).map((r: { blocked_date: string }) => r.blocked_date));
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [publisherId]);

  const toggleDate = useCallback((dateStr: string) => {
    setBlockedDates((prev) => {
      const isCurrentlyBlocked = prev.includes(dateStr);
      const next = isCurrentlyBlocked ? prev.filter((d) => d !== dateStr) : [...prev, dateStr];

      if (isSupabaseConfigured && publisherId) {
        const op = isCurrentlyBlocked
          ? supabase.from("publisher_blocked_dates").delete().eq("publisher_id", publisherId).eq("blocked_date", dateStr)
          : supabase.from("publisher_blocked_dates").insert({ publisher_id: publisherId, blocked_date: dateStr });
        op.then(({ error }) => {
          if (error) {
            console.error("Could not save availability change", error);
            // RLS rejected it (not the owner) or a network error — undo
            // the optimistic flip so the calendar doesn't show a change
            // that didn't actually save.
            setBlockedDates((cur) => (isCurrentlyBlocked ? [...cur, dateStr] : cur.filter((d) => d !== dateStr)));
          }
        });
      }

      return next;
    });
  }, [publisherId]);

  const isBlocked = useCallback((dateStr: string) => blockedDates.includes(dateStr), [blockedDates]);

  return { blockedDates, toggleDate, isBlocked, loaded };
}
