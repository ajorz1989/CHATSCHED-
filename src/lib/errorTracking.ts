import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Fraction of page loads that get real-performance data reported —
// separate from error tracking, which always reports 100% of errors
// regardless of this value. Defaults to a modest 10% rather than 100%:
// Web Vitals percentiles (LCP/CLS/INP/TTFB) are statistically meaningful
// well under full sampling, and this keeps event volume — and the Sentry
// bill — proportional to actual need, the same cost-consciousness that
// originally kept this at 0. Override with VITE_SENTRY_TRACES_SAMPLE_RATE
// if traffic volume ends up needing a different number either way.
const tracesSampleRateEnv = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined;
const parsedTracesSampleRate = tracesSampleRateEnv ? Number(tracesSampleRateEnv) : NaN;
const tracesSampleRate = Number.isFinite(parsedTracesSampleRate) ? parsedTracesSampleRate : 0.1;

/** True once VITE_SENTRY_DSN is set — see .env.example. */
export const isErrorTrackingConfigured = Boolean(dsn);

/**
 * Sets up error reporting. Safe to call unconditionally: without a DSN,
 * this only attaches the window-level listeners (so uncaught errors still
 * reach the console with real context instead of vanishing), and every
 * reportError() call becomes a no-op past its console.error — same
 * degrade-gracefully shape as isSupabaseConfigured elsewhere in this repo.
 * Call once, before the app renders (see main.tsx).
 */
export function initErrorTracking() {
  if (dsn) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // POPIA: don't attach IP address / request headers by default. Turn
      // this on deliberately later if there's a real need to, not by
      // accident via Sentry's default.
      sendDefaultPii: false,
      // Real-user performance monitoring — Core Web Vitals (LCP, CLS,
      // INP, TTFB), not just errors. browserTracingIntegration() is what
      // actually captures these; tracesSampleRate alone does nothing
      // without it. This was previously off entirely (tracesSampleRate:
      // 0, no integration) with a comment saying this app had no need for
      // it — it does now: this is the same @sentry/react SDK this repo
      // already ships, already configured with a DSN, already POPIA-
      // reviewed for PII — turning on a capability it already had, not
      // adding a new one. Verified against @sentry/react v10's actual
      // current docs before wiring this up, not assumed from memory —
      // FID reporting was dropped in v10 in favor of INP, which is on by
      // default and needs no extra option here.
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate,
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[ChatSched] Sentry isn't configured yet — set VITE_SENTRY_DSN to send " +
      "errors there. Until then, errors still print to the console, they just " +
      "don't leave the browser of whoever hit them."
    );
  }

  // Attached regardless of whether Sentry is configured — a React error
  // boundary only catches render-phase errors, not a rejected promise from
  // an unawaited fetch or a stray setTimeout callback. Without this, those
  // fail completely silently in production.
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" });
  });
  window.addEventListener("error", (event) => {
    // Only real script errors — this also fires for failed <img>/<script>
    // loads with event.error unset, which isn't useful to report.
    if (event.error) reportError(event.error, { source: "window.onerror" });
  });
}

/**
 * Reports an error. Always logs to the console first (so local dev never
 * depends on Sentry being configured); forwards to Sentry too when it is.
 * Use this instead of a bare console.error anywhere an error is caught and
 * handled rather than left to crash — a failed background fetch, a caught
 * exception in an event handler, etc.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.error("[ChatSched]", error, context ?? "");
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
