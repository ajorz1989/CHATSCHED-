# Agency Pivot — Message Safety Delivery

Builds on `PIVOT_PHASE1_AUDIT.md` and `PHASE2_SUBSCRIPTIONS_DELIVERY.md`.
Confirmed decision going in: route all campaign communication through
ChatSched — this is the completion of that phase, not the start of it.

**Revised since first delivered.** The "Judgment calls made" section
below was originally written to disclose five deliberate scope calls,
not as a to-do list. Asked to fix all five anyway — three had real gaps
worth closing (admin visibility, a kill switch, pattern coverage), and
closing the third one surfaced an actual bug in what had already
shipped. That's now fixed too. Each item below says what it was, and
what changed.

## Where this actually picked up

`schema_phase56_channel_messaging.sql` was already in the codebase by the
time I got to this — the 4 newer channels' `channel_requests` already had
a real thread (reusing `messages`, the same table the original flow uses,
via a new nullable `channel_request_id` parent column), business/creator/
admin all sharing it, plus a genuine bug fix along the way (publishers
couldn't mark messages read on the original flow's thread; that migration
fixed it). I also confirmed the general "Contact Publisher" inbox
(`conversations`, schema_phase29) was already reachable from all 4 newer
channels, un-gated. So the gap was specifically anti-bypass detection —
that's what phase57 (and now phase58) build.

## What's built

**Schema:**
- `supabase/schema_phase57_message_safety.sql` — `flagged` /
  `flag_reason` / `flagged_at` on both `messages` and
  `conversation_messages`, enforced by a `before insert` trigger,
  partial indexes on `flagged`.
- `supabase/schema_phase58_message_safety_patterns.sql` (new this pass)
  — replaces the trigger function with a wider pattern set and fixes a
  false positive in phase57's version (see "The bug" below). No schema
  change, no new `flag_reason` values — just `create or replace
  function`.

**Application layer** — `src/lib/messageSafety.ts` (+ `.test.ts`, now 14
tests, up from 8): email, spelled-out email ("name at gmail dot com"),
SA phone numbers, spelled-out phone numbers ("oh eight two..."), and
named off-platform messaging apps (WhatsApp-as-destination, Telegram,
Signal, Discord, wa.me, t.me).

**Wired into both send paths** — `MessageThread.tsx` (the `messages`
thread, covers both `requests` and `channel_requests`) and `Messages.tsx`
(the general `conversation_messages` inbox). Both scan before insert and
show a one-line notice that clears once the sender starts typing again.

**Admin visibility** — `src/pages/AdminMessageSafety.tsx` (new), wired
into `Admin.tsx` as a "Message Safety" tab, same pattern as
`AdminCompliance`/`AdminChannelRequests`/`AdminSecurity` (self-contained,
own data fetch, rendered as an in-page tab rather than a new route).
Three queries — `conversation_messages`, `messages` where
`request_id` is set, `messages` where `channel_request_id` is set —
merged and sorted client-side, since the two parent columns have
different business/publisher joins. Shows what got flagged, why,
which surface, and the business/publisher pair. Read-only monitoring,
not a moderation queue — see "Still open" below.

**Kill switch** — `isMessageSafetyPrescanEnabled()` in `featureFlags.ts`,
defaulted ON. Read "The scope of the flag" below before treating it as a
full kill switch — it isn't quite one, on purpose, and the doc comment
on the function says why.

## The bug

Fixing "no pattern coverage for obfuscation" meant looking hard at the
pattern set that already shipped, and that turned up a real problem, not
just a gap: phase57's `external_platform` match on bare `whatsapp` would
have flagged **"Happy to post this on my WhatsApp Channel next week"** —
completely ordinary campaign conversation, since WhatsApp Channel is a
real `Platform` value in this app (`src/lib/types.ts`). Fixed with a
negative lookahead (`whatsapp(?!\s+channel)`) in both the SQL trigger and
the TS mirror, and it's the reason Instagram/Facebook/TikTok/YouTube/
LinkedIn/X are deliberately **not** in the platform-mention list at all —
this marketplace's campaigns run on those, so bare-word matching would
flag most conversations happening here. `messageSafety.test.ts` now
explicitly asserts campaign mentions of all six don't trigger anything,
so this can't regress quietly.

## The scope of the flag

`isMessageSafetyPrescanEnabled()` only controls the client-side pre-scan
in `MessageThread.tsx`/`Messages.tsx` — it can't touch the trigger, which
runs on every insert regardless, because a Vite env var can't reach into
Postgres. Turning it off doesn't disable redaction; it just means the
sender finds out when the message reloads instead of instantly. To make
that safe rather than misleading, the notice is no longer driven by the
client's own guess — both send paths now do `.insert(...).select
("flagged").single()` and read the notice off what the trigger actually
stored. So the notice stays correct with the flag either way, and a real
database-level kill switch (if ever needed) means disabling the trigger,
which is a migration, not an env var — documented plainly in the
function's own comment rather than implying more than the flag delivers.

## Toolchain

| Command | Result |
|---|---|
| `npm run build` | ✅ 0 type errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm test` | ✅ 17 test files, **123/123 passing** (was 109 before Phase 3 started, 117 after the first pass, 123 now) |

## Judgment calls made — original five, now resolved or confirmed

1. **Redact, don't block, no admin review queue.** Kept as-is — still
   the right call, same reasoning as before (doesn't scale, nothing else
   in this repo gates sending on a human). What actually needed fixing
   wasn't the redact-not-block philosophy, it was that flagging fed
   nowhere an admin could see — closed by the new admin tab.
2. **Enforced server-side, not just client.** Already complete when
   first delivered (the phase57 trigger). No change needed — confirmed,
   not re-done.
3. **Covered both message tables.** Already complete. No change needed —
   confirmed, not re-done.
4. **No feature flag.** Reversed — added `isMessageSafetyPrescanEnabled()`
   as a real kill switch for the client-side pre-scan, matching the
   existing channel-flag convention. See "The scope of the flag" above
   for exactly what it does and doesn't control — didn't want to ship a
   flag that looked like more than it is.
5. **Deliberately narrow pattern set.** Genuinely expanded: spelled-out
   digits, spelled-out email, and a wider (but more careful) platform
   list. Still not exhaustive — see "Not done" below — but the common
   obfuscation cases from the original disclosure are now handled.

## Not done / still open

- **No reviewed/resolved workflow.** The new admin tab is monitoring,
  not moderation — there's no `reviewed_at`/`reviewed_by` column, so
  there's nothing to mark done. A reasonable next increment, not
  attempted here.
- **Never run against real Postgres.** Same standing sandbox limitation
  as everything else in this repo, phase58's trigger replacement
  included.
- **Obfuscation coverage is wider, not complete.** Digits split across
  unrelated filler words, leetspeak substitution, and a number sent as
  an image or emoji string still won't be caught by either pattern set.
- **`messages` and `conversation_messages` remain two separate tables.**
  Noted in the first delivery, still true, still a bigger refactor than
  this work, not attempted here.

## Next

Same as the first delivery: margin/economics is already underway
elsewhere (extending `AdminAnalytics.tsx`) — worth finding out what
migration number it lands on before either side calls one final, same
zip-reconciliation risk as before, just with three threads running
against this codebase instead of two now. Agency core (campaign
managers, leads, clients CRM, managed-campaign workflow) is still the one
major piece of the original recommended order nobody's built.
