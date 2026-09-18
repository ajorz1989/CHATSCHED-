const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;

/** True once VITE_PLAUSIBLE_DOMAIN is set — see .env.example. */
export const isAnalyticsConfigured = Boolean(domain);

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

/**
 * Loads Plausible — chosen over Google Analytics because it's cookieless
 * and doesn't fingerprint or build ad profiles, which matches what
 * Privacy.tsx already promises ("limited analytics... we don't use these
 * technologies to build advertising profiles about you for third parties")
 * without needing a cookie-consent banner to stay true to that. No script
 * loads at all — not even to plausible.io — unless VITE_PLAUSIBLE_DOMAIN is
 * set, so local dev and any deploy that hasn't configured it stay silent.
 *
 * Uses the "manual" build of Plausible's script (no automatic pageview on
 * load) because this is a client-rendered SPA — route changes don't
 * trigger a real page load for the default script to catch. trackPageview()
 * is called explicitly on every route change instead (see App.tsx).
 */
export function initAnalytics() {
  if (!domain) {
    // eslint-disable-next-line no-console
    console.warn(
      "[ChatSched] Analytics isn't configured yet — set VITE_PLAUSIBLE_DOMAIN " +
      "to enable it. No tracking script loads without it."
    );
    return;
  }
  const script = document.createElement("script");
  script.defer = true;
  script.dataset.domain = domain;
  script.src = "https://plausible.io/js/script.manual.js";
  document.head.appendChild(script);
}

/** Call on every route change — see the <AnalyticsListener> in App.tsx. */
export function trackPageview() {
  window.plausible?.("pageview");
}

/**
 * For a specific action worth naming beyond "visited a page" — e.g.
 * trackEvent("Request Submitted", { channel: "podcast" }). Optional; most
 * of what's useful here is already covered by pageviews on the funnel
 * pages (Browse → a profile → the request form).
 */
export function trackEvent(name: string, props?: Record<string, string>) {
  window.plausible?.(name, props ? { props } : undefined);
}
