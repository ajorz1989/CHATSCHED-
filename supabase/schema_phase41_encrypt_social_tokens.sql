-- ChatSched — Phase 41 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase40_proof_screenshots.sql.
--
-- No structural change — access_token/refresh_token were already `text`
-- columns and stay `text` columns; what they hold changed, not their
-- type. This migration exists to record that change where the schema
-- lives, via column comments, and to say plainly what it does NOT do.
--
-- Fixes a pre-launch audit finding: social_connections.access_token /
-- .refresh_token (schema_phase34_social_connect.sql) held real YouTube/
-- Facebook/Instagram/TikTok credentials in plaintext. RLS already
-- restricts this table to service-role-only, which blocks API-layer
-- access — but not a leaked service-role key, an exposed database
-- backup, or direct DB access. As of this migration,
-- social-oauth-callback (the only writer of this table) encrypts both
-- columns with AES-256-GCM before every insert/update — see
-- supabase/functions/_shared/tokenCrypto.ts for the implementation and
-- supabase/functions/social-oauth-callback/index.ts for where it's
-- called. The encryption key (SOCIAL_TOKEN_ENCRYPTION_KEY) lives only as
-- an Edge Function secret, never in the database — a database-level
-- exposure alone no longer hands over usable credentials.
--
-- WHAT THIS MIGRATION DOES NOT DO: there is no UPDATE statement here
-- re-encrypting any existing plaintext rows. This product has never been
-- deployed, so there should be no real rows to migrate — but if this is
-- ever applied to an environment where social_connections already has
-- data, those existing rows are NOT touched by this migration and remain
-- plaintext until re-connected (which overwrites them via the upsert) or
-- handled by a one-off re-encryption script. Check for existing rows
-- before assuming this alone makes an already-populated table safe:
--   select count(*) from public.social_connections;

comment on column public.social_connections.access_token is
  'AES-256-GCM encrypted (schema_phase41) — see _shared/tokenCrypto.ts. Never plaintext as of the app writing this; do not insert an unencrypted value here.';
comment on column public.social_connections.refresh_token is
  'AES-256-GCM encrypted (schema_phase41) — see _shared/tokenCrypto.ts. Never plaintext as of the app writing this; do not insert an unencrypted value here.';
