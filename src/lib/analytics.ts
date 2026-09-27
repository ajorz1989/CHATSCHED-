const GOOGLE_ANALYTICS_ID = "G-GTQJRRP6SS";

let googleAnalyticsScriptLoaded = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: string]: unknown;
  }
}

/**
 * Google Analytics 4 integration.
 *
 * The app uses a custom analytics consent banner, so the Google tag library
 * is only loaded after the visitor grants analytics consent. Once loaded,
 * the standard gtag config records the initial page view; Google Analytics'
 * enhanced measurement handles client-side browser-history page changes.
 */
export const isAnalyticsConfigured = true;

/**
 * Prepare the Google tag queue without loading Google's network script.
 * This runs during app startup and is safe before consent because no data is
 * sent until enableGoogleAnalytics() loads and configures the tag.
 */
export function initAnalytics() {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
}

/** Load and configure GA4 after analytics consent has been granted. */
export function enableGoogleAnalytics() {
  initAnalytics();

  const disableKey = `ga-disable-${GOOGLE_ANALYTICS_ID}`;
  window[disableKey] = false;

  if (googleAnalyticsScriptLoaded || document.getElementById("chatsched-google-analytics")) {
    window.gtag?.("config", GOOGLE_ANALYTICS_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    return;
  }

  const script = document.createElement("script");
  script.id = "chatsched-google-analytics";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  document.head.appendChild(script);

  window.gtag?.("js", new Date());
  window.gtag?.("config", GOOGLE_ANALYTICS_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  googleAnalyticsScriptLoaded = true;
}

/** Stop future GA4 collection when analytics consent is withdrawn. */
export function disableGoogleAnalytics() {
  const disableKey = `ga-disable-${GOOGLE_ANALYTICS_ID}`;
  window[disableKey] = true;
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

/** Send a named GA4 event when analytics is enabled. */
export function trackEvent(name: string, props?: Record<string, string>) {
  window.gtag?.("event", name, props);
}

/**
 * Retained as a compatibility export for existing imports. Standard GA4
 * pageview collection is handled by the Google tag plus browser-history
 * measurement for this SPA, rather than manually emitting duplicate
 * pageviews here.
 */
export function trackPageview() {
  // Intentionally empty.
}
