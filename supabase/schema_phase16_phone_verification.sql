-- ChatSched — Phase 16 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase15_audit_log.sql.
--
-- Backs real phone verification (OTP) for both a business's profile and a
-- publisher's listing. Both phone_verified flags are currently admin-set
-- manual toggles (Admin.tsx's toggleBusinessFlag, and the equivalent
-- publisher approval flow) — fine while every application is reviewed by
-- hand anyway, but the verification badges this feeds
-- (businessVerification.ts's Silver/Gold tiers, and a publisher's own
-- trust_score) are only as meaningful as what backs them.
--
-- This table is intentionally not reachable through normal client
-- queries at all — RLS is enabled with no policies for anon/authenticated
-- roles, so only the service role (used exclusively by the send-otp and
-- verify-otp Edge Functions) can read or write it. A one-time code is not
-- something the client should ever be able to select back out.

create table if not exists public.phone_otp_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_table text not null check (target_table in ('profiles', 'publishers')),
  target_id uuid not null,
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_otp_user_target on public.phone_otp_requests(user_id, target_table, target_id, created_at desc);

alter table public.phone_otp_requests enable row level security;
-- Deliberately no policies here — default deny for anon/authenticated.
-- Only the service role (Edge Functions) can touch this table.
