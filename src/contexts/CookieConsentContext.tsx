import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CookieCategory = 'essential' | 'analytics' | 'marketing';

export interface CookieConsent {
  essential: boolean; // Always true, non-negotiable
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

interface CookieConsentContextType {
  consent: CookieConsent | null;
  setConsent: (consent: CookieConsent) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  updateConsent: (category: CookieCategory, value: boolean) => void;
  hasConsented: boolean;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

const STORAGE_KEY = 'chatsched-cookie-consent';
const CONSENT_EXPIRY_DAYS = 365;

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<CookieConsent | null>(null);
  const [hasConsented, setHasConsented] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CookieConsent;
        // Check if consent has expired
        const daysSinceConsent = (Date.now() - parsed.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceConsent < CONSENT_EXPIRY_DAYS) {
          setConsentState(parsed);
          setHasConsented(true);
        } else {
          // Expired, clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.warn('Failed to parse stored cookie consent:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const saveConsent = (newConsent: CookieConsent) => {
    // Essential is always true
    const finalConsent = {
      ...newConsent,
      essential: true,
      timestamp: Date.now(),
    };
    setConsentState(finalConsent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalConsent));
    setHasConsented(true);
  };

  const acceptAll = () => {
    saveConsent({
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    });
  };

  const rejectAll = () => {
    saveConsent({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    });
  };

  const updateConsent = (category: CookieCategory, value: boolean) => {
    if (category === 'essential') return; // Can't change essential
    const updated = {
      ...consent,
      [category]: value,
      timestamp: Date.now(),
    } as CookieConsent;
    saveConsent(updated);
  };

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        setConsent: saveConsent,
        acceptAll,
        rejectAll,
        updateConsent,
        hasConsented,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return context;
}
