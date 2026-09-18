import { useState, useEffect } from 'react';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { X } from 'lucide-react';

export default function CookieConsentBanner() {
  const { hasConsented, acceptAll, rejectAll, updateConsent, consent } = useCookieConsent();
  const [isOpen, setIsOpen] = useState(!hasConsented);
  const [showDetails, setShowDetails] = useState(false);
  const [localConsent, setLocalConsent] = useState({
    analytics: consent?.analytics ?? true,
    marketing: consent?.marketing ?? false,
  });

  useEffect(() => {
    setIsOpen(!hasConsented);
  }, [hasConsented]);

  if (!isOpen) return null;

  const handleSavePreferences = () => {
    updateConsent('analytics', localConsent.analytics);
    updateConsent('marketing', localConsent.marketing);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-billboard-ink text-billboard-paper border-t-4 border-billboard-yellow shadow-lg">
      <div className="max-w-6xl mx-auto px-5 py-6">
        {/* Compact view */}
        {!showDetails && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-display text-lg mb-2">Your Privacy Matters</h3>
              <p className="text-sm leading-relaxed text-billboard-paper/90">
                We use essential cookies to keep the site secure and functional. We also use analytics to understand how you use ChatSched, and optional marketing cookies to improve our ads. You're in control.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <button
                onClick={rejectAll}
                className="px-4 py-2 border-2 border-billboard-paper text-billboard-paper hover:bg-billboard-paper/10 transition-colors font-medium text-sm"
              >
                Reject All
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="px-4 py-2 border-2 border-billboard-yellow text-billboard-ink bg-billboard-yellow hover:bg-billboard-yellowDeep transition-colors font-display text-sm"
              >
                Customize
              </button>
              <button
                onClick={acceptAll}
                className="px-6 py-2 bg-billboard-yellow text-billboard-ink hover:bg-billboard-yellowDeep transition-colors font-display font-bold text-sm shadow-blockSm"
              >
                Accept All
              </button>
            </div>
          </div>
        )}

        {/* Detailed view */}
        {showDetails && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-xl">Cookie Preferences</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-billboard-paper/20 transition-colors"
                aria-label="Close preferences"
              >
                <X size={24} />
              </button>
            </div>

            {/* Cookie categories */}
            <div className="space-y-4">
              {/* Essential cookies - always on */}
              <div className="bg-billboard-paper/10 border border-billboard-paper/20 rounded p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-display text-base mb-1">Essential Cookies</h4>
                    <p className="text-sm text-billboard-paper/80">
                      Required for site security, authentication, and basic functionality. These are always enabled and cannot be disabled.
                    </p>
                  </div>
                  <div className="ml-3 text-billboard-yellow font-bold text-sm">Always On</div>
                </div>
              </div>

              {/* Analytics cookies */}
              <div className="bg-billboard-paper/10 border border-billboard-paper/20 rounded p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-display text-base mb-1">Analytics</h4>
                    <p className="text-sm text-billboard-paper/80">
                      Helps us understand how you use ChatSched so we can make improvements. No personal data is stored, and we use Plausible (a privacy-first analytics service).
                    </p>
                  </div>
                  <label className="ml-3 flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConsent.analytics}
                      onChange={(e) => setLocalConsent({ ...localConsent, analytics: e.target.checked })}
                      className="w-5 h-5 border-2 border-billboard-yellow text-billboard-yellow cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Marketing cookies */}
              <div className="bg-billboard-paper/10 border border-billboard-paper/20 rounded p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-display text-base mb-1">Marketing</h4>
                    <p className="text-sm text-billboard-paper/80">
                      Used to deliver more relevant advertising based on your interests. Only enabled if you explicitly agree.
                    </p>
                  </div>
                  <label className="ml-3 flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConsent.marketing}
                      onChange={(e) => setLocalConsent({ ...localConsent, marketing: e.target.checked })}
                      className="w-5 h-5 border-2 border-billboard-yellow text-billboard-yellow cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Links and buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-billboard-paper/20">
              <a
                href="/privacy"
                className="text-billboard-yellow hover:underline text-sm"
              >
                Privacy Policy
              </a>
              <div className="hidden sm:block text-billboard-paper/40">•</div>
              <a
                href="/terms"
                className="text-billboard-yellow hover:underline text-sm"
              >
                Terms of Service
              </a>
              <div className="flex-1" />
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 border-2 border-billboard-paper text-billboard-paper hover:bg-billboard-paper/10 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-6 py-2 bg-billboard-yellow text-billboard-ink hover:bg-billboard-yellowDeep transition-colors font-display font-bold text-sm shadow-blockSm"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
