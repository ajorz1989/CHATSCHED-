import { useEffect } from 'react';
import { useCookieConsent } from '../contexts/CookieConsentContext';

/**
 * CookieConsentScript
 *
 * Loads third-party tracking scripts (Sentry, Plausible) based on user consent.
 * This component should be rendered early in the app tree (e.g., in App.tsx)
 * but AFTER CookieConsentProvider is mounted so consent can be read.
 *
 * Script loading strategy:
 * - Essential scripts (Sentry for error tracking) always load
 * - Analytics scripts (Plausible) load only if analytics consent is given
 * - Marketing scripts load only if marketing consent is given
 */
export default function CookieConsentScript() {
  const { consent, hasConsented } = useCookieConsent();

  // Load Sentry (essential error tracking)
  useEffect(() => {
    if (hasConsented && consent?.essential) {
      // Sentry is already initialized in the app (likely in main.tsx or a Sentry init file)
      // This is just a placeholder for any script that needs to be loaded after consent
    }
  }, [consent, hasConsented]);

  // Load Plausible (analytics)
  useEffect(() => {
    if (!hasConsented || !consent?.analytics) return;

    const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
    if (!plausibleDomain) return;

    // Plausible tracking script
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.setAttribute('data-domain', plausibleDomain);
    script.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(script);

    return () => {
      // Clean up if consent changes
      document.head.removeChild(script);
    };
  }, [consent?.analytics, hasConsented]);

  // Marketing scripts would go here
  // useEffect(() => {
  //   if (!hasConsented || !consent?.marketing) return;
  //   // Load marketing scripts (e.g., Google Ads, Facebook Pixel)
  // }, [consent?.marketing, hasConsented]);

  return null;
}
