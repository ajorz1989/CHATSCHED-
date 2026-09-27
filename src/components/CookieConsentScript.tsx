import { useEffect } from 'react';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { disableGoogleAnalytics, enableGoogleAnalytics } from '../lib/analytics';

/**
 * Loads third-party analytics only after the visitor has made an analytics
 * consent choice. Google Analytics is the site's configured analytics
 * provider and is loaded into document.head using gtag.js once consent is
 * granted. Marketing tags remain separate and disabled by default.
 */
export default function CookieConsentScript() {
  const { consent, hasConsented } = useCookieConsent();

  useEffect(() => {
    if (!hasConsented) return;

    if (consent?.analytics) {
      enableGoogleAnalytics();
    } else {
      disableGoogleAnalytics();
    }
  }, [consent?.analytics, hasConsented]);

  return null;
}
