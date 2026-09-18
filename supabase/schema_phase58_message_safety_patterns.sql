-- ChatSched — Phase 58 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase57_message_safety.sql.
--
-- Supersedes scan_and_redact_message() from phase57 with a wider pattern
-- set, and fixes a real false-positive in what phase57 shipped: WhatsApp
-- is also a genuine Platform value in this app ("WhatsApp Channel" — see
-- src/lib/types.ts), so phase57's bare "whatsapp" match would have
-- flagged completely ordinary campaign conversation ("posting this on my
-- WhatsApp Channel"). Fixed here with a negative lookahead rather than
-- silently left for someone to notice in production.
--
-- No new columns, no new constraint values — flag_reason stays
-- phone_number / email / external_platform (see phase57's check
-- constraint). This migration only replaces the function body, additive
-- in the sense that matters here: nothing about phase57's schema changes,
-- create or replace is just how a function gets a new version in
-- Postgres. src/lib/messageSafety.ts mirrors this same pattern set — see
-- that file's own comment for why the duplication exists and isn't
-- solved outright.

create or replace function public.scan_and_redact_message()
returns trigger
language plpgsql
as $$
declare
  v_reason text := null;
  v_redacted text := new.body;
  v_email_pattern text := '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}';
  -- "john at gmail dot com", "jane at example dot co dot za"
  v_spelled_email_pattern text := '[a-zA-Z0-9._%-]+\s+at\s+[a-zA-Z0-9-]+(\s+dot\s+[a-zA-Z0-9-]+)+';
  v_phone_pattern text := '(\+27|0)[ .-]?[1-9][0-9][ .-]?[0-9]{3}[ .-]?[0-9]{4}';
  -- "oh eight two one two three four five six seven" — 9+ digit-words in a row.
  v_spelled_phone_pattern text := '((zero|oh|one|two|three|four|five|six|seven|eight|nine)[\s-]+){8,}(zero|oh|one|two|three|four|five|six|seven|eight|nine)';
  -- WhatsApp excluded when followed by "channel" — see the migration
  -- comment above. Instagram/Facebook/TikTok/YouTube/LinkedIn/X
  -- deliberately not included at all — this marketplace's campaigns run
  -- on those, so bare-word matching would flag most ordinary messages.
  v_platform_pattern text := '(whatsapp(?!\s+channel)|wa\.me|t\.me|\ytelegram\y|\ysignal app\y|\ydiscord\y)';
begin
  if v_redacted ~* v_email_pattern then
    v_reason := 'email';
    v_redacted := regexp_replace(v_redacted, v_email_pattern, '[contact details removed]', 'g');
  end if;

  if v_redacted ~* v_spelled_email_pattern then
    v_reason := coalesce(v_reason, 'email');
    v_redacted := regexp_replace(v_redacted, v_spelled_email_pattern, '[contact details removed]', 'gi');
  end if;

  if v_redacted ~ v_phone_pattern then
    v_reason := coalesce(v_reason, 'phone_number');
    v_redacted := regexp_replace(v_redacted, v_phone_pattern, '[contact details removed]', 'g');
  end if;

  if v_redacted ~* v_spelled_phone_pattern then
    v_reason := coalesce(v_reason, 'phone_number');
    v_redacted := regexp_replace(v_redacted, v_spelled_phone_pattern, '[contact details removed]', 'gi');
  end if;

  if v_redacted ~* v_platform_pattern then
    v_reason := coalesce(v_reason, 'external_platform');
    v_redacted := regexp_replace(v_redacted, v_platform_pattern, '[contact details removed]', 'gi');
  end if;

  if v_reason is not null then
    new.body := v_redacted;
    new.flagged := true;
    new.flag_reason := v_reason;
    new.flagged_at := now();
  end if;

  return new;
end;
$$;

-- Triggers themselves are unchanged (still fire before insert on both
-- tables, still point at the same function name) — replacing the
-- function body is enough, nothing to re-create here.
