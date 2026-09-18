import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "../i18n";

/**
 * Compact "EN ▾" dropdown — sits in the Header (and Footer, smaller) so
 * it's reachable from every page, even though only a handful of pages
 * actually have translated content yet (see i18n/index.ts's comment).
 * Switching language on an untranslated page just leaves that page in
 * English via i18next's fallbackLng — nothing breaks, nothing shows a
 * raw key.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(code: SupportedLanguageCode) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("language.label")}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={
          compact
            ? "font-mono text-xs font-semibold uppercase text-billboard-paperDim hover:text-billboard-yellow transition-colors"
            : "font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-2.5 py-1.5 hover:bg-billboard-paperDim transition"
        }
      >
        {current.code.toUpperCase()} ▾
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("language.label")}
          className={`absolute ${compact ? "bottom-full mb-2" : "top-full mt-2"} right-0 bg-white border-[3px] border-billboard-ink rounded-lg shadow-block z-40 min-w-[9rem] py-1.5`}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === current.code}
              onClick={() => choose(l.code)}
              className={`w-full text-left px-3.5 py-1.5 text-sm font-semibold hover:bg-billboard-paperDim transition-colors ${l.code === current.code ? "text-billboard-greenDeep font-bold" : "text-billboard-ink"}`}
            >
              {l.nativeLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
