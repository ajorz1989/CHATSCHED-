import { useState } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

/**
 * Renders nothing once the app is already installed, or on a platform with
 * neither a native prompt nor a sensible manual path (desktop Safari/
 * Firefox — no reliable install affordance there worth surfacing). Shows a
 * real "Install app" button where Chrome/Edge/Android's native prompt is
 * available, or iOS-specific Share-sheet instructions otherwise.
 */
export default function InstallAppButton({ className }: { className?: string }) {
  const { installed, canPromptInstall, isIOS, promptInstall } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (installed || (!canPromptInstall && !isIOS)) return null;

  return (
    <>
      <button
        onClick={() => (canPromptInstall ? promptInstall() : setShowIosHelp(true))}
        className={className ?? "inline-flex items-center gap-1.5 text-sm font-semibold hover:text-billboard-greenDeep transition-colors"}
        title="Install ChatSched as an app"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v8m0 0L4 6.5M7 9l3-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1.5 10.5v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Install app
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 bg-billboard-ink/60 z-50 flex items-center justify-center p-4" onClick={() => setShowIosHelp(false)}>
          <div className="bg-white border-[3px] border-billboard-ink rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-3">Install on iPhone or iPad</h3>
            <ol className="text-sm text-billboard-inkSoft space-y-2.5 list-decimal pl-5">
              <li>Tap the <strong className="text-billboard-ink">Share</strong> icon in Safari's toolbar.</li>
              <li>Scroll down and tap <strong className="text-billboard-ink">Add to Home Screen</strong>.</li>
              <li>Tap <strong className="text-billboard-ink">Add</strong> — ChatSched will appear on your home screen like any other app.</li>
            </ol>
            <button
              onClick={() => setShowIosHelp(false)}
              className="w-full mt-5 border-[3px] border-billboard-ink font-bold py-2.5 rounded hover:-translate-y-0.5 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
