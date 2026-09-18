import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { readStoredVisualSystem, writeStoredVisualSystem, type VisualSystem } from "../lib/publisherVisual";

// Deliberately NOT mounted in App.tsx's provider tree — it is only ever
// provided locally, inside AdminVisualIdentity.tsx, wrapping just that
// page's own content. That keeps this entirely self-contained: nothing
// outside the studio page can ever call useVisualSystem() and get a
// non-"current" value, because nothing outside the studio page is inside
// this provider. See publisherVisual.ts's top comment for the full reasoning.
const VisualSystemCtx = createContext<{ system: VisualSystem; setSystem: (s: VisualSystem) => void } | null>(null);

export function VisualSystemProvider({ children }: { children: ReactNode }) {
  const [system, setSystemState] = useState<VisualSystem>(() => readStoredVisualSystem());

  const setSystem = useCallback((s: VisualSystem) => {
    setSystemState(s);
    writeStoredVisualSystem(s);
  }, []);

  const value = useMemo(() => ({ system, setSystem }), [system, setSystem]);
  return <VisualSystemCtx.Provider value={value}>{children}</VisualSystemCtx.Provider>;
}

export function useVisualSystem() {
  const ctx = useContext(VisualSystemCtx);
  // Bug-proofing on merge: the source workspace's version had no provider
  // guard — useContext() silently returns null outside a provider, so any
  // component reading .system would crash with "Cannot read properties of
  // null" the first time someone forgot to wrap it. This still defaults
  // safely to "current" instead, same as everywhere else in this file that
  // degrades gracefully rather than throwing.
  return ctx ?? { system: "current" as VisualSystem, setSystem: () => {} };
}
