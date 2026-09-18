import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

const STORAGE_KEY = "mb_saved_lists";

export interface SavedList {
  id: string;
  name: string;
  publisherIds: string[];
  createdAt: string;
}

interface SavedListsCtxType {
  lists: SavedList[];
  createList: (name: string) => string;
  deleteList: (listId: string) => void;
  renameList: (listId: string, name: string) => void;
  addToList: (listId: string, publisherId: string) => void;
  removeFromList: (listId: string, publisherId: string) => void;
  isInAnyList: (publisherId: string) => boolean;
  getListsForPublisher: (publisherId: string) => SavedList[];
}

const Ctx = createContext<SavedListsCtxType | null>(null);

function readLocal(): SavedList[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

interface SavedListRow {
  id: string;
  name: string;
  publisher_ids: string[] | null;
  created_at: string;
}

function rowToList(row: SavedListRow): SavedList {
  return { id: row.id, name: row.name, publisherIds: row.publisher_ids ?? [], createdAt: row.created_at };
}

// Previously localStorage-only (`mb_saved_lists`) — meant a business's
// saved lists lived in exactly one browser and vanished with a cleared
// cache, and were invisible to you as the operator. Now: logged-out
// visitors keep working exactly as before (localStorage), and once a
// business is logged in, the same `lists` state is instead backed by the
// `saved_lists` table (see schema_phase13_saved_lists.sql), with a
// one-time migration of any local lists that existed before they signed
// in. Every method below keeps its original synchronous signature —
// PublisherProfile.tsx calls `const id = createList(name); addToList(id, ...)`
// on consecutive lines without awaiting, so createList must keep
// returning a real id immediately. The id is generated client-side
// (as it always was) and the Supabase write happens in the background.
export function SavedListsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lists, setLists] = useState<SavedList[]>(readLocal);
  const migratedForUser = useRef<string | null>(null);

  // Logged out: mirror to localStorage exactly as before.
  useEffect(() => {
    if (!user) localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  }, [lists, user]);

  // Logged in: cloud becomes the source of truth. One-time migration of
  // any pre-existing local lists into the account on first login.
  useEffect(() => {
    if (!user || !isSupabaseConfigured || migratedForUser.current === user.id) return;
    migratedForUser.current = user.id;
    (async () => {
      const { data, error } = await supabase.from("saved_lists").select("*").eq("business_id", user.id).order("created_at", { ascending: true });
      if (error) { console.error("Could not load saved lists", error); return; }
      const cloudLists = ((data ?? []) as SavedListRow[]).map(rowToList);
      const localLists = readLocal();

      if (cloudLists.length === 0 && localLists.length > 0) {
        const { error: insertError } = await supabase.from("saved_lists").insert(
          localLists.map((l) => ({ id: l.id, business_id: user.id, name: l.name, publisher_ids: l.publisherIds, created_at: l.createdAt }))
        );
        if (insertError) { console.error("Could not migrate local lists", insertError); setLists(cloudLists); return; }
        localStorage.removeItem(STORAGE_KEY);
        setLists(localLists);
      } else {
        setLists(cloudLists);
      }
    })();
  }, [user]);

  const syncEnabled = !!user && isSupabaseConfigured;

  const createList = useCallback((name: string): string => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    setLists((prev) => [...prev, { id, name: name.trim(), publisherIds: [], createdAt }]);
    if (syncEnabled) {
      supabase.from("saved_lists").insert({ id, business_id: user!.id, name: name.trim(), publisher_ids: [], created_at: createdAt })
        .then(({ error }) => { if (error) console.error("Could not sync new list", error); });
    }
    return id;
  }, [syncEnabled, user]);

  const deleteList = useCallback((listId: string) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
    if (syncEnabled) supabase.from("saved_lists").delete().eq("id", listId).then(({ error }) => { if (error) console.error("Could not sync list deletion", error); });
  }, [syncEnabled]);

  const renameList = useCallback((listId: string, name: string) => {
    const trimmed = name.trim();
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name: trimmed } : l)));
    if (syncEnabled) supabase.from("saved_lists").update({ name: trimmed }).eq("id", listId).then(({ error }) => { if (error) console.error("Could not sync list rename", error); });
  }, [syncEnabled]);

  const addToList = useCallback((listId: string, publisherId: string) => {
    setLists((prev) => {
      const target = prev.find((l) => l.id === listId);
      if (!target || target.publisherIds.includes(publisherId)) return prev;
      const nextIds = [...target.publisherIds, publisherId];
      if (syncEnabled) supabase.from("saved_lists").update({ publisher_ids: nextIds }).eq("id", listId).then(({ error }) => { if (error) console.error("Could not sync list", error); });
      return prev.map((l) => (l.id === listId ? { ...l, publisherIds: nextIds } : l));
    });
  }, [syncEnabled]);

  const removeFromList = useCallback((listId: string, publisherId: string) => {
    setLists((prev) => {
      const target = prev.find((l) => l.id === listId);
      if (!target) return prev;
      const nextIds = target.publisherIds.filter((id) => id !== publisherId);
      if (syncEnabled) supabase.from("saved_lists").update({ publisher_ids: nextIds }).eq("id", listId).then(({ error }) => { if (error) console.error("Could not sync list", error); });
      return prev.map((l) => (l.id === listId ? { ...l, publisherIds: nextIds } : l));
    });
  }, [syncEnabled]);

  const isInAnyList = useCallback((publisherId: string) =>
    lists.some((l) => l.publisherIds.includes(publisherId)), [lists]);

  const getListsForPublisher = useCallback((publisherId: string) =>
    lists.filter((l) => l.publisherIds.includes(publisherId)), [lists]);

  return (
    <Ctx.Provider value={{ lists, createList, deleteList, renameList, addToList, removeFromList, isInAnyList, getListsForPublisher }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSavedLists() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSavedLists must be used within SavedListsProvider");
  return ctx;
}
