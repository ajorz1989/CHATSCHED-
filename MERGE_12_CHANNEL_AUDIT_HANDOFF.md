# ChatSched — 12-Channel Audit Merge Handoff

**Status: merged into this codebase (`chatsched-final-form`). Written but
NOT run against a live dev server or real Supabase instance — same
standing caveat every SQL/test file in this project's history carries.
See "What was not verified" at the end.**

## What this document is

Two independently-evolved zips were merged:

1. **`chatsched-final-form-updated`** (this codebase, the target/base) —
   contains its own independent work since the two branches split,
   including a 13th channel (**In-Venue Screens & Displays**,
   `schema_phase96_in_venue_screens_channel.sql`), a Button/currency
   formatting cleanup pass across many files, an override-reason audit
   fix on the publisher-approval flow, and the two still-open product
   decisions already flagged in `MERGE_STATUS_AND_HANDOFF.md`
   (Messages.tsx disposition, the "12 channels" copy claim) — untouched
   here, not in scope for this pass.
2. **`ChatSched-12-channel-audit-implementation`** — a full pass over
   `ChatSched-12-Channel-Audit.md`'s findings, tracked live in
   `channel_12_audit_fixes.md` (now copied into this codebase's root for
   the historical record). 23 of 27 tracked items done or corrected; 4
   explicitly deferred with reasoning.

**Flag: `ChatSched-12-Channel-Audit.md` itself (the original findings
document, requested as required reading before starting) was not actually
present in the audit-implementation zip** — only `channel_12_audit_fixes.md`
was, which restates each finding inline (section numbers 1.2.1, 2.3, 3.1,
etc.) with enough context to work from. This merge was done against that
inline context, not the original findings document directly.

Per the request that started this merge: only the 12-channel audit's own
work was ported in. The 13th channel (In-Venue Screens) was **not**
retroactively extended with audit-style fixes (verification proof upload,
peak-hours field, bundle-suggestion pairing, etc.) — it merges through
cleanly as its own separate addition, exactly as it already existed.

## Real migration-numbering collision found and fixed

The audit's new migration was authored as
`schema_phase90_verification_proof_upload.sql`. By the time of this merge,
`chatsched-final-form` had **already used phase90** independently for
`schema_phase90_delete_account_retention.sql`, and had progressed through
`schema_phase96_in_venue_screens_channel.sql`. This is exactly the kind of
cross-session numbering collision this project has hit before (noted
twice in prior sessions' own handoff notes) — checked directly rather than
assumed away.

**Fix**: renumbered to `schema_phase97_verification_proof_upload.sql`, the
first free slot. No content change beyond the renumbering and a header
note explaining why. `run-all-migrations.sh` applies migrations by
numeric sort of the glob, not a hardcoded list, so no other file needed
updating for this. `DEPLOY.md` has no hardcoded phase list either —
checked directly, not assumed.

## File-by-file merge record

For every file the audit touched (per `channel_12_audit_fixes.md`), both
sides were read directly — not assumed — before merging.

### Clean additions (finalform had no independent changes in the touched region)

- **`src/lib/types.ts`** — `Publisher.verification_proof_urls` field
  re-added. Finalform's other changes to this file (new `request_metadata`
  field, `campaign_manager_id`/`publisher_manager_id` additions from
  `schema_phase94_manager_internal_roles.sql`) are in unrelated sections
  of the interface — no overlap.
- **`src/lib/channelOnboardingSchemas.ts`** — all 6 audit fields restored
  (podcast `showUrl`/`peakListeningTimes`, informal-retail
  `peakFootTrafficHours`, radio `icasaLicenceNumber`/`peakListeningTimes`,
  transport `peakOperatingHours`, restaurants `peakServiceTimes`),
  alongside finalform's new `InVenueScreensOnboardingFields` type and its
  `getInVenueScreensMetadata`/admin-summary additions — different
  channels' schemas, no line-level overlap. Brace-balance verified.
- **`src/components/MarketplaceProfileView.tsx`** — podcast/radio
  `listenLink` fully restored. This file had **no independent finalform
  changes at all** in the diff; the entire diff was the audit's own work
  being absent.
- **`src/components/CampaignCostCalculator.tsx`,
  `LiveInventoryBanner.tsx`, `BundleSuggestion.tsx`, `EarnedBadges.tsx`**
  — copied over as new files verbatim. Confirmed each dependency they
  import (`formatCurrency`, `getChannelBySlug`, the `publishers_public`
  view, the `ChannelSlug`/`Publisher` types) already exists in
  finalform before copying.
- **`src/pages/BusinessOpportunities.tsx`** — `BundleSuggestion` import +
  render call re-wired. Finalform's only independent change here was
  adding `"in-venue-screens": "In-Venue Screens"` to the `CHANNEL_LABEL`
  map — no overlap.

### Merged against real, independent finalform changes

- **`src/components/PublisherCard.tsx`** — Ownership Verified badge logic
  restored on top of finalform's independent migration to a shared
  `Button` component and `formatCurrency` (part of the earlier
  Button/currency cleanup pass this codebase already carries). Both kept.
- **`src/pages/PublisherProfile.tsx`** — Ownership Verified badge, the
  review-quote block (fix C5), and `EarnedBadges` wiring all restored,
  merged against finalform's own `Button` migration, `formatCurrency`
  migration, and an "escrow" → "payment protection"/"held payouts" copy
  change (unrelated wording fix). All of finalform's independent changes
  were preserved.
- **`src/pages/Admin.tsx`** — `VerificationProofThumbnails` component and
  its wiring into the verification checklist restored, merged against a
  genuinely substantive independent finalform change in the **same
  region**: an override-reason requirement on the "approve without every
  check confirmed" path (item 24 of a separate audit — required
  `overrideReason` field, logged into `admin_audit_log`), plus a
  network-error-handling fix on the authenticity-check button and the
  `formatSupabaseError`/`Button`/`formatCurrency` cleanup pass. This was
  the most delicate merge of the small files — the checklist-rendering
  JSX block had to accommodate both the new proof thumbnails (audit fix)
  and the new override-reason input (finalform's own fix) without either
  clobbering the other. Both are now present: thumbnails render above the
  checklist, override-reason input renders in the override-confirmation
  panel below it.
- **`src/pages/ChannelPage.tsx`** — `CampaignCostCalculator` and
  `LiveInventoryBanner` wired in cleanly (no overlap). The D6 "Be one of
  the first" callout was merged against a genuine editorial overlap:
  finalform had independently rewritten the coming-soon notice banner to
  include its own "apply now" link for publishers on dormant channels.
  **Both were kept** — the D6 callout adds incentive framing ("no
  competition yet, no queue") the plain apply link doesn't — but this is
  flagged **in-code** with a comment for a product decision on whether
  it's now redundant messaging, rather than resolved unilaterally.
- **`src/pages/PublisherApply.tsx`** — the largest merge, and a real
  finding in its own right: **finalform's copy of this file had none of
  the audit's B1/B5/B6/E3 fixes at all.** Its `checkEligibility()` still
  gated on the three authority checkboxes at the first screen (the exact
  pre-audit behavior the audit's B5 fix moved to the Review step), it had
  no proof-upload flow, no `LOW_BARRIER_CHANNELS` step-skip, and no
  earnings estimate. What it did have, independently: the full 13th
  channel's form section (`venueScreens*` fields, `FormState`,
  `initialState`, the `buildChannelMetadata` branch, and the rendered
  form section) and a currency-formatting cleanup pass
  (`formatCurrency`/`formatCurrencyRange` replacing raw `R{...}`
  interpolation in five places). Given the audit's fixes were completely
  absent rather than partially overlapping, this file was rebuilt from
  the **audit's fully-fixed version as the base**, with finalform's two
  independent additions layered on top — safer than trying to
  reconstruct the audit's B5/B6 logic from fragments against the older
  base. Verified by diffing the final merged file against the original
  finalform file: every line that disappeared was pre-audit behavior the
  audit's own fixes intentionally supersede (the checkbox-on-eligibility
  gate, the old submit-button disabled condition, the old ineligible-copy
  wording) — nothing of finalform's own work was lost in the process.

### Verified as already correctly excluded

- **`publishers_public` view**
  (`schema_phase82_restrict_public_publisher_columns.sql`) — checked
  directly that its column allowlist does not and should not include
  `verification_proof_urls`. No change needed; this was the audit's own
  stated design intent (C4's comment explicitly notes this field is
  correctly private).

## Verification performed on every touched file

- Brace/paren/bracket balance check (`{`/`}`, `(`/`)`, `[`/`]`) on every
  `.tsx`/`.ts` file touched, after every edit.
- Grep-confirmed no duplicate `const`/`function` declarations were
  introduced (e.g. `VERIFICATION_REQUIRED_CHANNELS` appears exactly once
  per file that needs its own copy, per the existing project convention
  of not sharing it across display vs. onboarding components).
- Grep-confirmed every newly-added import symbol
  (`formatCurrencyRange`, `InVenueScreensOnboardingFields`) is actually
  referenced more than once in its file (i.e., used, not dead).
- Diffed the final `PublisherApply.tsx` against the original,
  pre-merge `finalform` version line-by-line to confirm every removed
  line was pre-audit behavior, not lost finalform work.

## What was NOT verified (flagged plainly, not hidden)

Per the explicit instruction for this task: **nothing in the 12-channel
audit's own work has ever been run against a live server or real
Supabase instance**, and that status is unchanged by this merge — merging
files doesn't run them. Specifically still unverified:

- No `npm run build` / `npm run dev` / `tsc --noEmit` has been run on the
  merged codebase. No `node_modules` and no network access exist in this
  sandbox (`npm install` was attempted for a syntax-check tool and failed
  with a 403 — no registry access at all). All verification here is
  balance-checking and direct line-by-line review, not compilation.
- `schema_phase97_verification_proof_upload.sql` has never been run
  against a real Postgres/Supabase instance — same as when it was
  `schema_phase90` in the original audit branch. No pgTAP test exists for
  it either (the audit's own implementation log never wrote one for this
  migration — checked directly, not assumed).
- The proof-upload flow's actual behavior (file selection →
  publisher-row-scoped storage path → signed-URL admin display) has only
  been read and reasoned about, never exercised end-to-end.
- The `CampaignCostCalculator`, `LiveInventoryBanner`, and
  `BundleSuggestion` components have never rendered in a browser; their
  Tailwind classes and Supabase queries are written against the existing
  codebase's own conventions but unexercised.
- The in-code merge-flag comment in `ChannelPage.tsx` (D6 callout vs. the
  independent "apply now" copy) represents a genuine open product
  question — not something for me to resolve unilaterally.

## What was deliberately NOT ported (per explicit scope)

- No audit-style fixes (verification proof, peak-hours, ownership badge,
  bundle pairing, cost calculator, earned badges) were retroactively
  applied to the 13th channel (In-Venue Screens). It was explicitly out
  of scope for "the 12-channel audit's own work."
- The 4 items the audit itself explicitly deferred (Local Business
  Starter Kit landing page, the Preview simulator, the cross-channel
  Reach Estimator, the Verified Proof Wall) remain deferred — not
  attempted in this merge, consistent with the original audit's own
  reasoning for deferring them.
