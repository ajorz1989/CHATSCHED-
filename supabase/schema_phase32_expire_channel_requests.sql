-- ChatSched — Phase 32 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- What this adds: just the two Postgres extensions the scheduled
-- request-expiry job needs (pg_cron to run on a timer, pg_net to call the
-- Edge Function over HTTP). Nothing else changes — channel_requests
-- already had approval_due_at/payment_due_at as generated columns since
-- Phase 17, and enforce_channel_request_transition() already allows the
-- pending→declined and awaiting_payment→cancelled transitions from a
-- trusted server-side context. This phase is what actually calls that on
-- a schedule instead of waiting for an admin to click the manual button.
--
-- Deliberately NOT included here: the `cron.schedule(...)` call itself.
-- That command needs your real project ref and CRON_SECRET value in its
-- body, and this file is meant to be safe to commit — see "Scheduled
-- request expiry" in supabase/DEPLOY.md for the exact command to run by
-- hand in the SQL editor once, after deploying the Edge Function and
-- setting the secret. Baking a real secret into a versioned migration
-- would leak it into git history the moment this file is committed.

-- I couldn't run this against a real Supabase project myself (same sandbox
-- limitation noted throughout DEPLOY.md), so if the two CREATE EXTENSION
-- statements below error out under the SQL editor's permissions, use the
-- Dashboard instead — Database → Extensions → search "pg_cron" / "pg_net"
-- → Enable. Same end result either way; the toggle just sidesteps any
-- privilege issue running CREATE EXTENSION directly ever hits.
create extension if not exists pg_cron;
create extension if not exists pg_net;

comment on extension pg_cron is
  'Schedules the expire-channel-requests Edge Function call — see
   supabase/DEPLOY.md ("Scheduled request expiry") for the actual
   cron.schedule(...) command, which is not in this file on purpose.';
