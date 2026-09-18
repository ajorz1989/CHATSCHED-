/**
 * Message Safety — anti-bypass detection for on-platform messaging.
 *
 * Mirrors the trigger in supabase/schema_phase58_message_safety_patterns.sql
 * (which supersedes phase57's version of the same function), the real
 * enforcement boundary — see that file's comment for why a client-side-only
 * check isn't enough on its own. This module exists so the composer can
 * show a sender their message was redacted immediately, instead of waiting
 * on the insert to round-trip. Keep the two pattern sets in sync by hand —
 * same duplicate-with-a-comment precedent as the launch-credit math between
 * payfast-checkout and subscriptions.ts (see
 * PHASE2_SUBSCRIPTIONS_DELIVERY.md); a Postgres trigger can't import from
 * here any more than an edge function can.
 *
 * Known gap, not attempted here: contact info split across unrelated words
 * ("my number is oh EIGHT not two but TWO..."), leetspeak digit
 * substitution, or a number as an emoji/image string. This catches common
 * obfuscation (spelled-out digits, "at ... dot ..." emails), not every
 * determined workaround.
 */

export type FlagReason = "phone_number" | "email" | "external_platform";

export interface MessageScanResult {
  body: string;
  flagged: boolean;
  flagReason: FlagReason | null;
}

const REDACTED = "[contact details removed]";

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// "john at gmail dot com", "jane at example dot co dot za"
const SPELLED_EMAIL_PATTERN = /\b[a-zA-Z0-9._%-]+\s+at\s+[a-zA-Z0-9-]+(?:\s+dot\s+[a-zA-Z0-9-]+)+\b/gi;

// +27 or a leading 0, then a 9-digit SA number, optionally
// spaced/dashed/dotted into groups — e.g. 0821234567, +27 82 123 4567.
const SA_PHONE_PATTERN = /(\+27|0)[ .-]?[1-9][0-9][ .-]?[0-9]{3}[ .-]?[0-9]{4}/g;

// "oh eight two one two three four five six seven" — nine-plus digit-words
// in a row. Ordinary text essentially never strings together nine number
// words, so this is a low false-positive way to catch a spelled-out number.
const DIGIT_WORD = "(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)";
const SPELLED_PHONE_PATTERN = new RegExp(`\\b(?:${DIGIT_WORD}[\\s-]+){8,}${DIGIT_WORD}\\b`, "gi");

// Off-platform messaging apps named as somewhere to continue the chat.
// WhatsApp is deliberately excluded when followed by "channel" — it's
// also a real Platform value in this app (see the Platform type in
// types.ts: "WhatsApp Channel" is something businesses legitimately book
// campaigns on), so a bare match would flag completely ordinary campaign
// conversation. Instagram / Facebook / TikTok / YouTube / LinkedIn / X are
// deliberately not in this list at all, for the same reason more acutely —
// this marketplace's campaigns run ON those platforms, so matching their
// names would flag most conversations happening here.
const EXTERNAL_PLATFORM_PATTERN = /(whatsapp(?!\s+channel)|wa\.me|t\.me|\btelegram\b|\bsignal app\b|\bdiscord\b)/gi;

/**
 * Scans a message body for contact-info bypass attempts and redacts any
 * match. Pure — no Supabase, no I/O — so it's testable standalone and
 * safe to call from both MessageThread.tsx and Messages.tsx before insert.
 */
export function scanAndRedactMessage(body: string): MessageScanResult {
  let result = body;
  let reason: FlagReason | null = null;

  if (EMAIL_PATTERN.test(result)) {
    reason = "email";
    result = result.replace(EMAIL_PATTERN, REDACTED);
  }
  EMAIL_PATTERN.lastIndex = 0; // .test() on a /g regex advances lastIndex — reset before reuse

  if (SPELLED_EMAIL_PATTERN.test(result)) {
    reason = reason ?? "email";
    result = result.replace(SPELLED_EMAIL_PATTERN, REDACTED);
  }
  SPELLED_EMAIL_PATTERN.lastIndex = 0;

  if (SA_PHONE_PATTERN.test(result)) {
    reason = reason ?? "phone_number";
    result = result.replace(SA_PHONE_PATTERN, REDACTED);
  }
  SA_PHONE_PATTERN.lastIndex = 0;

  if (SPELLED_PHONE_PATTERN.test(result)) {
    reason = reason ?? "phone_number";
    result = result.replace(SPELLED_PHONE_PATTERN, REDACTED);
  }
  SPELLED_PHONE_PATTERN.lastIndex = 0;

  if (EXTERNAL_PLATFORM_PATTERN.test(result)) {
    reason = reason ?? "external_platform";
    result = result.replace(EXTERNAL_PLATFORM_PATTERN, REDACTED);
  }
  EXTERNAL_PLATFORM_PATTERN.lastIndex = 0;

  return { body: result, flagged: reason !== null, flagReason: reason };
}
