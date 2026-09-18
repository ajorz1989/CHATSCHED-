import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const MAX_COMPARE = 5;
const STORAGE_KEY = "mb_comparison";

interface ComparisonContextType {
  ids: string[];
  togglePublisher: (id: string) => void;
  removePublisher: (id: string) => void;
  clearComparison: () => void;
  isComparing: (id: string) => boolean;
  isFull: boolean;
  count: number;
}

const Ctx = createContext<ComparisonContextType | null>(null);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);

  const togglePublisher = useCallback((id: string) => {
    setIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }, []);

  const removePublisher = useCallback((id: string) => {
    setIds(prev => prev.filter(x => x !== id));
  }, []);

  const clearComparison = useCallback(() => setIds([]), []);
  const isComparing = useCallback((id: string) => ids.includes(id), [ids]);

  return (
    <Ctx.Provider value={{
      ids, togglePublisher, removePublisher, clearComparison, isComparing,
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
