import { useEffect, useRef } from "react";

/**
 * Pauses every CSS animation inside an element while it is scrolled out of
 * view (see `.pause-offscreen` in index.css). Keeps looping decoration free
 * when nobody can see it. Sets a data attribute directly, so scrolling never
 * triggers a React re-render.
 */
export function usePauseOffscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      el.dataset.offscreen = entry.isIntersecting ? "false" : "true";
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
