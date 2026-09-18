import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "../lib/supabase";
import type { Notification } from "../lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// Realtime, not polling — schema_phase45_realtime.sql enables Postgres
// Changes on public.notifications for exactly this. Primary signal is the
// subscription below; the one remaining timer-like thing here is a
// refetch when the tab regains focus (document.visibilitychange), which
// covers a dropped websocket after the laptop slept or wifi blipped —
// something a fixed-interval poll would eventually catch too, but only by
// polling constantly even while the tab is backgrounded and nothing could
// possibly be dropped. This fires only when it might matter.
const LIST_LIMIT = 30;

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    setUnreadCount(count ?? 0);
  }, [user]);

  const loadList = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    setNotifications((data ?? []) as Notification[]);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoaded(false);
      return;
    }
    refreshUnreadCount();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          const row = payload.new as Notification;
          setNotifications((list) => (list.some((n) => n.id === row.id) ? list : [row, ...list].slice(0, LIST_LIMIT)));
          if (!row.read_at) setUnreadCount((c) => c + 1);
        }
      )
      .on(
        // Covers this notification being marked read from elsewhere —
        // another open tab, or a different device on the same account.
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          const row = payload.new as Notification;
          const previous = payload.old as Partial<Notification>;
          setNotifications((list) => list.map((n) => (n.id === row.id ? row : n)));
          if (!previous.read_at && row.read_at) setUnreadCount((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    function onVisible() {
      if (document.visibilityState === "visible") refreshUnreadCount();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, refreshUnreadCount]);

  async function markAsRead(id: string) {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setNotifications((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    await Promise.all(unread.map((n) => supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id)));
  }

  return { notifications, unreadCount, loaded, loadList, markAsRead, markAllAsRead, refreshUnreadCount };
}
