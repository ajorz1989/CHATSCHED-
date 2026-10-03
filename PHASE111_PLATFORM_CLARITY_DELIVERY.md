# Phase 111 — Ad platform clarity on publisher cards, profiles, rate cards and requests

Problem: platform labels came from three disagreeing sources, never said "ads run on",
followers/price weren't tied to a platform, and requests didn't ask for one.

## Run this first
`supabase/schema_phase111_rate_card_platform.sql` — adds nullable `platform` to
`publisher_rate_cards` (existing items show as "Any platform"). No change to the
publishers table, so `enforce_publisher_self_update()` is untouched.

## What changed
| Area | Change | Files |
|---|---|---|
| Single source of truth | `getAdPlatforms()` etc.; onboarding keys map to the canonical 8 `Platform` values; Facebook Page and Group stay separate | `lib/platforms.ts` (+ test) |
| Browse card | Labelled "Ads run on" row with icons; single platform shows "<Platform> only" | `AdPlatformBadges.tsx`, `PublisherCard.tsx` |
| Profile | Platform chips replaced by "Where your ad runs" (per-platform page link, followers, from-price); languages get their own label; duplicate primary/secondary badges removed; summed follower stat labelled "Combined followers (N platforms)" | `AdPlatformSection.tsx`, `PublisherProfile.tsx`, `MarketplaceProfileView.tsx` |
| Rate cards | Each item has a platform (required when the publisher lists platforms); display shows platform per line | `RateCardManager.tsx`, `RateCardDisplay.tsx`, `useRateCardItems.ts`, `types.ts`, dashboard |
| Requests | Platform picker (locked + labelled when only one); stored as a `Platform:` line in the campaign message | `PublisherProfile.tsx`, `ChannelRequestForm.tsx` |

## Verified
`tsc -b` clean, oxlint clean on touched files. Vitest: 5 failures, identical with and
without this change (i18n `home.json` key parity x4, `PublisherApply` admin-mode test x1).

## Not done
Per-platform engagement and per-platform placement types still live as single values on
the publisher; the request platform is a message line, not its own column on `requests`.
