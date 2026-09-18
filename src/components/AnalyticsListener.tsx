import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageview } from "../lib/analytics";

/**
 * Renders nothing — just watches the route. Plausible's script.manual.js
 * doesn't auto-fire on load or on client-side navigation (there's no real
 * page load for it to catch in a SPA), so this calls trackPageview()
 * itself: once for the page you land on, then again on every route change.
 * A no-op when analytics isn't configured (trackPageview checks for
 * window.plausible existing first).
 */
export default function AnalyticsListener() {
  const location = useLocation();

  useEffect(() => {
    trackPageview();
  }, [location.pathname]);

  return null;
}
