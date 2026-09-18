import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enForBusinesses from "./locales/en/forBusinesses.json";

import afCommon from "./locales/af/common.json";
import afHome from "./locales/af/home.json";
import afForBusinesses from "./locales/af/forBusinesses.json";

import xhCommon from "./locales/xh/common.json";
import xhHome from "./locales/xh/home.json";
import xhForBusinesses from "./locales/xh/forBusinesses.json";

import zuCommon from "./locales/zu/common.json";
import zuHome from "./locales/zu/home.json";
import zuForBusinesses from "./locales/zu/forBusinesses.json";

/**
 * Covers the public marketing surface only — Header, Footer, Home,
 * HowItWorks, ForBusinesses, ForPublishers — deliberately not the
 * authenticated app (dashboards, forms, admin). Those stay English-only
 * for now: translating live transactional UI carries real correctness
 * risk (a mistranslated payment/escrow term is a much bigger problem than
 * a mistranslated marketing headline), and it's the marketing pages that
 * actually drive whether a South African SME owner who reads Afrikaans,
 * isiXhosa, or isiZulu first even gets as far as signing up. See
 * SUPPORTED_LANGUAGES below and supabase/DEPLOY.md's "Localization"
 * section for how to extend this to more pages/languages later — it's
 * just more keys in more JSON files, no code changes needed.
 *
 * Missing keys silently fall back to English (fallbackLng below) rather
 * than showing a raw "home.hero.title"-style key — important since
 * isiXhosa/isiZulu coverage here is a first pass, not yet reviewed by a
 * native speaker (flagged clearly in DEPLOY.md).
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "af", label: "Afrikaans", nativeLabel: "Afrikaans" },
  { code: "xh", label: "isiXhosa", nativeLabel: "isiXhosa" },
  { code: "zu", label: "isiZulu", nativeLabel: "isiZulu" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, home: enHome, forBusinesses: enForBusinesses },
      af: { common: afCommon, home: afHome, forBusinesses: afForBusinesses },
      xh: { common: xhCommon, home: xhHome, forBusinesses: xhForBusinesses },
      zu: { common: zuCommon, home: zuHome, forBusinesses: zuForBusinesses },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    ns: ["common", "home", "forBusinesses"],
    defaultNS: "common",
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      // localStorage first (an explicit past choice from the switcher),
      // then the browser's own language list — never guess from IP/geo.
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "chatsched_language",
    },
    react: { useSuspense: false }, // avoid an extra Suspense boundary just for translation loading — everything is bundled, not fetched
  });

if (typeof document !== "undefined") {
  const syncHtmlLang = (lng?: string) => {
    const targetLang = lng || i18n.resolvedLanguage || i18n.language || "en";
    document.documentElement.lang = targetLang;
  };
  syncHtmlLang();
  i18n.on("languageChanged", (lng) => {
    syncHtmlLang(lng);
  });
}

export default i18n;
