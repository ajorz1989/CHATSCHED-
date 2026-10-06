import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const MAX_COMPARE = 5;
const STORAGE_KEY = "mb_comparison";
const CHANNEL_KEY = "mb_comparison_channel";

/** Listings with no channel_slug are legacy social pages. */
export function comparisonChannelOf(publisher: { channel_slug?: string | null }): string {
  return publisher.channel_slug || "social-media";
}

interface ComparisonContextType {
  ids: string[];
  /** Pass the listing's channel so a comparison never mixes channels. */
  togglePublisher: (id: string, channel?: string) => void;
  removePublisher: (id: string) => void;
  clearComparison: () => void;
  isComparing: (id: string) => boolean;
  /** The one channel this comparison is for, or null when it is empty or from before channels were tracked. */
  channel: string | null;
  /** True when adding a listing of this channel would mix channels in one comparison. */
  isBlockedByChannel: (channel: string) => boolean;
  isFull: boolean;
  count: number;
}

const Ctx = createContext<ComparisonContextType | null>(null);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  });

  const [channel, setChannel] = useState<string | null>(() => {
    try { return localStorage.getItem(CHANNEL_KEY) || null; }
    catch { return null; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      if (channel && ids.length > 0) localStorage.setItem(CHANNEL_KEY, channel);
      else localStorage.removeItem(CHANNEL_KEY);
    } catch { /* storage unavailable: the comparison just lasts this visit */ }
  }, [ids, channel]);

  // An emptied comparison is free to start again on any channel.
  useEffect(() => {
    if (ids.length === 0 && channel !== null) setChannel(null);
  }, [ids, channel]);

  const isBlockedByChannel = useCallback(
    (c: string) => ids.length > 0 && channel !== null && channel !== c,
    [ids, channel],
  );

  const togglePublisher = useCallback((id: string, c?: string) => {
    if (ids.includes(id)) {
      setIds(ids.filter(x => x !== id));
      return;
    }
    if (ids.length >= MAX_COMPARE) return;
    if (c && ids.length > 0 && channel !== null && channel !== c) return;
    if (c && ids.length === 0) setChannel(c);
    setIds([...ids, id]);
  }, [ids, channel]);

  const removePublisher = useCallback((id: string) => {
    setIds(prev => prev.filter(x => x !== id));
  }, []);

  const clearComparison = useCallback(() => setIds([]), []);
  const isComparing = useCallback((id: string) => ids.includes(id), [ids]);

  return (
    <Ctx.Provider value={{
      ids, togglePublisher, removePublisher, clearComparison, isComparing, channel, isBlockedByChannel,
      isFull: ids.length >= MAX_COMPARE, count: ids.length,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useComparison() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useComparison must be used within ComparisonProvider");
  return ctx;
}
