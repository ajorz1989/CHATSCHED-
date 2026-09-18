# Dashboard UX & Bug Audit — Fixes Delivered

Implements all 6 numbered bugs from `DASHBOARD_UX_AUDIT.md`. UX suggestions and the
"Ruled out" item were left as-is per the audit (suggestions are optional polish, not
bugs; the ruled-out pricing item was already confirmed correct).

## 1. Invoice/payout receipt on `channel_requests` (High) — fixed

`channel_requests` (the current, primary booking system) had no invoice/payout
download anywhere; only the legacy `requests` table did.

- **`src/components/ChannelCampaignCard.tsx`** (business side): added
  `downloadBusinessChannelInvoice()` and a "Download Invoice" button, shown once a
  request reaches `paid`/`live`/`completed`. Mirrors `RequestCard`'s pattern exactly —
  same `buildAndDownloadInvoice` call, `r.proposed_amount` as the settled amount, and
  the channel's real display name (via `getChannelBySlug()`) instead of a hardcoded
  "Social Media" label.
- **`src/components/PublisherDashboardView.tsx`** (publisher/payout side): added
  `downloadPublisherChannelInvoice()` (commission split shown, same as
  `downloadPublisherInvoice`) and wired it into `ChannelRequestCard`. This required
  passing `publisher` into `ChannelRequestCard` — it wasn't receiving it before, only
  `PublisherRequestCard` was. Removed the plain "✓ Paid out" line that's now
  superseded by the same info sitting next to the download button.

## 2. "Book again" double-submit guard (Medium) — fixed

**`src/pages/Dashboard.tsx`**: added `bookingAgain`/`confirmingBookAgain` state. The
button now disables for the duration of the insert, same pattern as `handlePay` /
`handleConfirmEft` elsewhere in the same file.

## 3. Native `alert()`/`confirm()` dialogs (Medium) — fixed, all 5 sites

- Dashboard.tsx's "Book again" flow (3× `alert()`, 1× `confirm()`) → replaced with an
  inline confirm step, inline error text, and an inline success message — the same
  visual pattern the EFT/PayFast flows in the same file already use.
- ChannelCampaignCard.tsx's `cancel()` (1× `confirm()`) → replaced with an inline
  "are you sure?" panel (Yes/Never mind), matching the counter-offer accept/decline UI
  already in the same component.

## 4. No self-service verification-email resend (Medium-High) — fixed

- **`src/lib/onboardingChecklist.ts`**: added `resendVerificationEmail()`, calling
  Supabase's `auth.resend({ type: "signup", email })` as the audit's fix direction
  specified.
- **`src/components/OnboardingChecklist.tsx`**: extended `ChecklistItem` with an
  optional `onAction`/`onActionLabel` (for an in-place action, distinct from the
  existing `actionTo`/`actionLabel` navigation link). Renders as a button with its own
  sending/sent/error state, so callers don't need to manage that themselves.
- Wired into both checklists' "Verify your email" / "Verify your account" item —
  business uses the authenticated user's `email`, publisher uses `publisher.email`
  (both already existed as real fields, just weren't threaded through).

## 5. Dismissing an in-progress checklist is permanent (Low-Medium) — fixed

**`src/components/OnboardingChecklist.tsx`**: dismissing no longer renders nothing.
It now leaves behind a small persistent "Show setup checklist" link that clears the
dismissal and brings the full checklist back — self-contained in the component, so no
changes were needed at either call site (Dashboard.tsx / PublisherDashboardView.tsx).

## 6. "Continue your campaign" stale-activity bug (Low) — fixed

**`src/components/BusinessHomeSummary.tsx`**: previously always preferred a legacy
`ongoingRequest` over a newer `ongoingChannelRequest` whenever both existed, with no
`created_at` comparison. Now computes the latest candidate from each list separately,
then picks the more recent of the two by `created_at` before rendering — a business
with one old stuck legacy request no longer gets stuck seeing it forever instead of
their actual recent activity.

## Verification

No real Node toolchain exists in this sandbox (standing caveat for this whole
project's history — nothing has ever been run against a live dev server here). Ran an
isolated `tsc --noEmit --noResolve` pass (same technique used across this project's
prior sessions) on every touched file. This caught one real bug introduced mid-fix and
it was corrected before delivery: `BusinessDashboardBody`'s `user` prop was typed as
`{ id: string }` and needed widening to `{ id: string; email?: string | null }` once
the verification-email fix started reading `user.email` there. Everything else
reported was pre-existing noise from the no-node_modules environment (unresolvable
imports, JSX intrinsic-element fallback typing, and the same `key`-prop / `React`
namespace quirks already flagged in this project's earlier sessions), not real issues.
