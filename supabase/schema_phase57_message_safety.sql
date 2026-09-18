-- ChatSched — Phase 57 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase56_channel_messaging.sql.
--
-- Anti-bypass detection for both message surfaces — `messages` (the
-- per-request/channel_request thread, schema_phase3/6/56) and
-- `conversation_messages` (the general "Contact Publisher" inbox,
-- schema_phase29). Both need it: a business or creator could otherwise
-- just use whichever surface isn't covered to swap contact details and
-- step off ChatSched entirely, which defeats the point either way.
--
-- Enforced server-side, before insert, on both tables — not only in the
-- client. A client-side-only check is trivially bypassed by anyone
-- calling the Supabase REST API directly with flagged: false, so this
-- follows the same precedent as enforce_channel_request_transition()
-- (schema_phase17.sql): the trigger is the real gate, the client is a
-- convenience.
--
-- Behaviour is redact, not block. The matched span in body is replaced
-- with a fixed placeholder, flagged/flag_reason/flagged_at are set, and
-- the (redacted) message still sends immediately. A hard block would
-- need either a queue for admin review — doesn't scale past pilot
-- volume, and nothing else in this repo relies on a human-in-the-loop
-- send path — or silently dropping a business's message with no
-- explanation, which is worse than telling them plainly what happened.
--
-- src/lib/messageSafety.ts mirrors this same pattern set in TypeScript,
-- purely so the composer can show the redaction to the sender instantly
-- instead of waiting on a round trip. That file is NOT the enforcement
-- boundary — this trigger is. Same duplicate-with-a-comment approach as
-- the launch-credit math between payfast-checkout and
-- src/lib/subscriptions.ts (see PHASE2_SUBSCRIPTIONS_DELIVERY.md), for
-- the same reason: nothing here can import from a Postgres function
-- either. Keep the two pattern sets in sync by hand.
--
-- Known gap, not attempted here: obfuscated contact info ("oh eight
-- two", digits split across unrelated words, a number typed as an
-- emoji/image) won't be caught by either pattern set. This catches the
-- common case; a determined, motivated workaround was never going to be
-- fully solvable by regex.

alter table public.messages
  add column flagged boolean not null default false,
  add column flag_reason text
    check (flag_reason is null or flag_reason in ('phone_number', 'email', 'external_platform')),
  add column flagged_at timestamptz;

alter table public.conversation_messages
  add column flagged boolean not null default false,
  add column flag_reason text
    check (flag_reason is null or flag_reason in ('phone_number', 'email', 'external_platform')),
  add column flagged_at timestamptz;

comment on column public.messages.flag_reason is
  'Keep this check constraint in sync with FlagReason in
   src/lib/messageSafety.ts, same convention as channel_slug
   (schema_phase17.sql).';

-- Partial indexes — cheap now, and exactly what an admin "flagged
-- messages" view (not built this phase, see delivery doc) would filter
-- on first.
create index messages_flagged_idx on public.messages(flagged) where flagged;
create index conversation_messages_flagged_idx on public.conversation_messages(flagged) where flagged;

-- One shared function — both tables have identical body/flagged/
-- flag_reason/flagged_at columns, so there's nothing table-specific to
-- branch on. Plain (not security definer): it only ever touches NEW, the
-- row already being inserted into the table it fires on, so it needs no
-- privilege beyond what the inserting user already has.
create or replace function public.scan_and_redact_message()
returns trigger
language plpgsql
as $$
declare
  v_reason text := null;
  v_redacted text := new.body;
begin
  -- Email first — checked ahead of the phone pattern so a domain's
  -- digits (rare, but possible) can't shadow an email match.
  if v_redacted ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    v_reason := 'email';
    v_redacted := regexp_replace(
      v_redacted, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
      '[contact details removed]', 'g'
    );
  end if;

  -- SA phone numbers: +27 or a leading 0, then a 9-digit number,
  -- optionally spaced/dashed/dotted into groups.
  if v_redacted ~ '(\+27|0)[ .-]?[1-9][0-9][ .-]?[0-9]{3}[ .-]?[0-9]{4}' then
    v_reason := coalesce(v_reason, 'phone_number');
    v_redacted := regexp_replace(
      v_redacted, '(\+27|0)[ .-]?[1-9][0-9][ .-]?[0-9]{3}[ .-]?[0-9]{4}',
      '[contact details removed]', 'g'
    );
  end if;

  -- Off-platform messaging apps named as somewhere to continue the chat.
  if v_redacted ~* '(whatsapp|wa\.me|t\.me|telegram|signal app)' then
    v_reason := coalesce(v_reason, 'external_platform');
    v_redacted := regexp_replace(
      v_redacted, '(whatsapp|wa\.me|t\.me|telegram|signal app)',
      '[contact details removed]', 'gi'
    );
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

drop trigger if exists trg_scan_message_messages on public.messages;
create trigger trg_scan_message_messages
  before insert on public.messages
  for each row execute function public.scan_and_redact_message();

drop trigger if exists trg_scan_message_conversation_messages on public.conversation_messages;
create trigger trg_scan_message_conversation_messages
  before insert on public.conversation_messages
  for each row execute function public.scan_and_redact_message();
