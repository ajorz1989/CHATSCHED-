import { describe, it, expect } from "vitest";

import enCommon from "./locales/en/common.json";
import afCommon from "./locales/af/common.json";
import xhCommon from "./locales/xh/common.json";
import zuCommon from "./locales/zu/common.json";

import enHome from "./locales/en/home.json";
import afHome from "./locales/af/home.json";
import xhHome from "./locales/xh/home.json";
import zuHome from "./locales/zu/home.json";

import enForBusinesses from "./locales/en/forBusinesses.json";
import afForBusinesses from "./locales/af/forBusinesses.json";
import xhForBusinesses from "./locales/xh/forBusinesses.json";
import zuForBusinesses from "./locales/zu/forBusinesses.json";

/**
 * Guards against translation drift: if a key gets added/renamed in the
 * English source and the other three languages aren't updated to match,
 * i18next's fallbackLng silently shows English for that one key rather
 * than erroring — which is the right behaviour for a person visiting the
 * site, but means a missed translation could sit unnoticed indefinitely
 * without a test like this one to catch it in CI.
 *
 * HowItWorks/ForPublishers dead stub namespaces were pruned in Fix #4;
 * ForBusinesses was re-added with real content and real translations.
 * Active namespaces under full key parity verification are 'common',
 * 'home' and 'forBusinesses'.
 */
function collectKeyPaths(obj: unknown, prefix = ""): string[] {
  if (Array.isArray(obj)) {
    // Array leaf for arrays of primitives (e.g. howItWorks.categories);
    // arrays of objects (e.g. forBusinesses' steps/tools/rows/faq items)
    // still need each element's own keys checked for parity, since a
    // dropped or reordered field inside one locale's array item would
    // otherwise slip through unnoticed.
    if (obj.length > 0 && obj.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      return obj.flatMap((item, i) => collectKeyPaths(item, `${prefix}.${i}`));
    }
    return [prefix];
  }
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => collectKeyPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe("i18n key parity", () => {
  const namespaces: [string, object, object, object, object][] = [
    ["common", enCommon, afCommon, xhCommon, zuCommon],
    ["home", enHome, afHome, xhHome, zuHome],
    ["forBusinesses", enForBusinesses, afForBusinesses, xhForBusinesses, zuForBusinesses],
  ];

  for (const [name, en, af, xh, zu] of namespaces) {
    const enKeys = collectKeyPaths(en).sort();

    it(`af/${name}.json has exactly the same keys as en/${name}.json`, () => {
      expect(collectKeyPaths(af).sort()).toEqual(enKeys);
    });
    it(`xh/${name}.json has exactly the same keys as en/${name}.json`, () => {
      expect(collectKeyPaths(xh).sort()).toEqual(enKeys);
    });
    it(`zu/${name}.json has exactly the same keys as en/${name}.json`, () => {
      expect(collectKeyPaths(zu).sort()).toEqual(enKeys);
    });
  }

  it("no translated string is left empty in any checked namespace/language", () => {
    const all: Record<string, object> = {
      "af/common": afCommon, "xh/common": xhCommon, "zu/common": zuCommon,
      "af/home": afHome, "xh/home": xhHome, "zu/home": zuHome,
      "af/forBusinesses": afForBusinesses, "xh/forBusinesses": xhForBusinesses, "zu/forBusinesses": zuForBusinesses,
    };
    for (const [label, dict] of Object.entries(all)) {
      const emptyKeys = collectKeyPaths(dict).filter((path) => {
        const value = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict);
        return typeof value === "string" && value.trim() === "";
      });
      expect(emptyKeys, `${label} has empty values at: ${emptyKeys.join(", ")}`).toEqual([]);
    }
  });
});
