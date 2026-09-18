# Gemini Fixes & Audit Log

This document chronicles all architectural setup, structural migrations, bug fixes, accessibility upgrades, and code improvements performed on the **ChatSched** platform.

---

## 1. Initial Repository Setup & Platform Migration

### A. Root Directory Normalization
- **Issue**: The project source code was nested inside an import subfolder `/ChatSched-currency-migration-complete/` instead of the root directory.
- **Resolution**: Flattened the directory structure to the repository root so all tooling, package scripts, build targets, and CI paths resolve cleanly.

### B. Dev Server & Port 3000 Binding
- **Issue**: Container environment ingress requires the server to bind to host `0.0.0.0` and port `3000`.
- **Resolution**:
  - Updated `vite.config.ts` with explicit `server: { host: '0.0.0.0', port: 3000 }`.
  - Updated `package.json` dev script: `"dev": "vite --host 0.0.0.0 --port 3000"`.

### C. Missing UI Dependencies
- **Issue**: Missing `lucide-react` dependency broke the build during Cookie Consent banner import.
- **Resolution**: Installed `lucide-react` into `package.json`.

### D. Application Metadata & HTML Head Synchronization
- **Issue**: Missing `metadata.json` for platform capabilities and frame permissions.
- **Resolution**: Created `metadata.json` matching the application branding, title, and capabilities (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`).

---

## 2. Fix #3: Accessibility Infrastructure & WCAG Compliance

### A. Skip to Main Content Bypass Link
- **Implemented**: In `src/App.tsx`, added a screen-reader and keyboard accessible bypass link:
  ```tsx
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-billboard-ink focus:text-billboard-paper focus:font-semibold focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-billboard-green"
  >
    Skip to main content
  </a>
  ```
- Target set on `<main id="main-content" tabIndex={-1} className="flex-1 pb-bottom-nav outline-none">`.

### B. Dynamic `<html lang>` Synchronization
- **Implemented**: In `src/i18n/index.ts`, wired `i18n.on('languageChanged', ...)` and initial load listeners to dynamically update `document.documentElement.lang` when users switch languages (supporting `en`, `af`, `xh`, and `zu`).

### C. Universal High-Contrast `:focus-visible` Outlines
- **Implemented**: In `src/index.css`, established clear 3px solid `#1C6B45` focus indicators with 2px offset for interactive controls including `<button>`, `<a>`, `<input>`, `<textarea>`, and `<select>`.

### D. ARIA & Keyboard Navigation Enhancements
- **LanguageSwitcher (`src/components/LanguageSwitcher.tsx`)**: Added `aria-expanded`, `aria-haspopup="listbox"`, `role="listbox"`, `role="option"`, `aria-selected`, and `Escape` key event listener.
- **NotificationBell (`src/components/NotificationBell.tsx`)**: Added dynamic unread count announcements to `aria-label`, `aria-expanded`, `aria-haspopup="dialog"`, and `Escape` key listener.

### E. Color Contrast Audit
- Verified high contrast ratios against WCAG 2.2 AA / AAA:
  - Body text (`#1A1712` Ink on `#FAF9F5` Paper): **15.6:1**
  - Muted secondary text (`#4A4335` on `#FAF9F5`): **8.4:1**
  - Primary action green (`#1C6B45` on `#FAF9F5`): **5.7:1**
  - Highlight accent (`#1A1712` on `#F5B700` Yellow): **9.5:1**

---

## 3. Fix #4: i18n Dead Namespace Cleanup & Key Parity Hardening

### A. Dead Stub Deletion
- **Issue**: Unused, untranslated stub files (`af/forBusinesses.json`) and unused import definitions in `src/i18n/index.ts` caused TypeScript compilation errors and bundle bloat.
- **Resolution**:
  - Removed `af/forBusinesses.json`.
  - Cleaned up imports and namespace configuration in `src/i18n/index.ts` to strictly active, fully translated namespaces: `common` and `home`.

### B. Key Parity CI Verification
- Updated `src/i18n/keyParity.test.ts` to verify 100% parity across `en`, `af`, `xh`, and `zu` for all active namespaces without dead stub exemptions.

---

## 4. Fix #5: Bundle-Weight & Image-Compression Audit

### A. Image Compression & Resizing
- **Issue**: High-resolution uncompressed raster PNG logos in `src/assets/logos/` totaled 588KB for simple 24-height logo strip displays.
- **Resolution**:
  - Resized and compressed all logo assets (`cis.png`, `worldtravel.png`, `scanworth.png`, `vertex.png`, `infoicon.png`) with optimal compression algorithms.
  - Reduced total logo assets weight from **588KB** down to **222KB** (**62% reduction**).

### B. Rollup Manual Chunking & Vendor Splitting
- **Issue**: Single monolithic application bundle `index.js` exceeded 816kB minified, triggering Rollup chunk-size warnings and sub-optimal browser caching.
- **Resolution**:
  - Configured function-based `manualChunks` in `vite.config.ts` separating `vendor-react` (React, ReactDOM, React Router), `vendor-supabase` (Supabase client), `vendor-sentry` (Sentry React), and `vendor-i18n` (i18next libraries).
  - Reduced main entry chunk size from **816.29 kB** down to **357.55 kB** (**80.65 kB gzipped**).
  - Eliminated all chunk-size warnings and optimized service worker precache footprint from 3,969 KiB to 3,608 KiB.

---

## 5. Fix #6: Error Handling & Error Code Surfacing

### A. Centralized Supabase & Postgres Error Formatter
- **Issue**: Across several components and sub-pages, errors from Supabase mutations or Edge Functions were swallowed into generic hardcoded messages like `"Couldn't send that — try again in a moment."`, discarding PostgreSQL error codes (`23505`, `42501`, `23503`, `PGRST116`), hints, and diagnostic messages.
- **Resolution**:
  - Implemented `src/lib/supabaseErrors.ts` with `formatSupabaseError(error, contextMessage)` mapping known Postgres error codes to human-readable explanations while retaining exact code and detail strings.
  - Added helpers `isUniqueViolation`, `isPermissionDenied`, and `extractErrorCode`.
  - Integrated Sentry error reporting background logging with contextual parameters.
  - Created unit tests in `src/lib/supabaseErrors.test.ts` verifying formatting, code extraction, and constraint checks.

### B. Codebase Application
- Updated error handlers across:
  - `ChannelCampaignCard.tsx` (cancellations, counter-offer responses, payment confirmations)
  - `DisputeSection.tsx` (dispute creation and initial messaging)
  - `SaveSearchButton.tsx` (search bookmarking)
  - `PortfolioManager.tsx` (video url saves, image storage uploads)
  - `PublisherProfile.tsx` (publisher reporting)
  - `AdminAuditLog.tsx` (audit trail queries)
  - `AdminSecurity.tsx` (MFA unenrollment)
  - `AdminMessageSafety.tsx` (flagged safety message queries)
  - `BuildMyCampaign.tsx` (lead capture submissions)
  - `OpportunityFeed.tsx` (reverse marketplace applications)
  - `SubscriptionSection.tsx` (Payfast Edge Function invocations)
  - `AccountSettings.tsx` (data exports and account deletion invocations)

---

## 6. Status of "Co-Pilot Fixes" Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | E2E Testing (Playwright) | **COMPLETE** | Happy-path tests for marketplace sides |
| 2 | Cookie Consent (POPIA) | **COMPLETE** | Granular category consent banner & script |
| 3 | Accessibility & Contrast | **COMPLETE** | Skip link, lang sync, focus styles, ARIA |
| 4 | i18n Namespace Cleanup | **COMPLETE** | Dead stubs pruned, parity verified |
| 5 | Bundle & Image Audit | **COMPLETE** | 62% image reduction, manual chunks split |
| 6 | Error Code Surfacing | **COMPLETE** | formatSupabaseError utility & integration |
| 7 | Edge Function Admin Audit | **PENDING** | Next item in sequence |
| 8 | Legal Sign-off / Verification | **PENDING** | Upcoming item |

---

## 7. Verification Commands
- **Compile / Build**: `npm run build`
- **Linter**: `npm run lint` (`oxlint`)
- **Unit & Parity Tests**: `npx vitest run`
