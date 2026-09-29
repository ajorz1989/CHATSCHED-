import { useEffect } from "react";
import { useCookieConsent } from "../contexts/CookieConsentContext";
import { trackEvent } from "../lib/analytics";

/**
 * Delegated click tracking for anything marked `data-cta="section-action"`.
 * One capture-phase listener for the whole app (so the path recorded is the
 * page the click happened on, not the page it navigated to), so adding tracking to a link is just an
 * attribute. Only reports after the visitor has granted analytics consent
 * (the gtag queue would otherwise flush earlier clicks once consent is given).
 */
export default function CtaTracker() {
  const { consent } = useCookieConsent();
  const allowed = consent?.analytics === true;

  useEffect(() => {
    if (!allowed) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cta]");
      if (!el) return;
      trackEvent("cta_click", { cta: el.dataset.cta ?? "", path: window.location.pathname });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [allowed]);

  return null;
}
