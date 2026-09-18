-- ChatSched — Phase 91 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase90_delete_account_retention.sql.
-- (Renumbered from this project's original phase 82 — that slot was
-- independently taken by schema_phase82_restrict_public_publisher_columns.sql
-- in the lineage this got merged into. Content unchanged from the original.)
--
-- Fixes: "claude to fix 2" item 16 — public forms need server-side abuse
-- controls.
--
-- ── The problem ──────────────────────────────────────────────────────────
-- contact_messages, advertise_inquiries, agency_leads, partner_applications,
-- career_applications, work_with_us_applications, and community_questions
-- all had a public "for insert with check (true)" RLS policy (agency_leads'
-- was narrower — stage='new' and campaign_manager_id is null — but still
-- unconditionally open to anon otherwise). The only thing standing between
-- these and a flood of fake leads/applications/messages was a client-side
-- honeypot + minimum-fill-time check (src/hooks/useHoneypot.ts) — real
-- protection against a careless bot that runs the actual React app, but
-- nothing at all against a script that just POSTs to PostgREST directly,
-- skipping the app entirely.
--
-- ── The fix ───────────────────────────────────────────────────────────────
-- This migration closes the direct anon insert path on all seven tables.
-- The new supabase/functions/public-form-submit Edge Function is now the
-- only way to create a row in any of them (aside from admin/service-role
-- access, unchanged) — it applies real per-IP and per-email throttling
-- before writing, using the service role to insert (bypassing RLS, the
-- same "trusted server context" pattern already used by delete-account,
-- payfast-notify, etc. elsewhere in this schema).
--
-- public_form_submissions below is purely a rate-limit ledger — it is NOT
-- the lead data itself (that still lives in the seven existing tables,
-- structure unchanged). It records enough to count recent attempts
-- per (form, IP) and per (form, email) and nothing else: no name, no
-- message content, no free text. IP and email are stored as an
-- HMAC-SHA256 keyed on the service role key (not a plaintext value and
-- not a bare unsalted hash, which for an IPv4 address is trivially
-- reversible by brute force over ~4 billion values) — this is a light
-- POPIA-conscious measure given the table is admin/service-role-only
-- anyway (RLS enabled, zero policies — nobody can read it through the
-- API even with a valid anon/authenticated JWT), not a claim that it's
-- cryptographically anonymous.
--
-- Retention: a daily pg_cron job purges ledger rows older than 30 days —
-- comfortably longer than any throttling window the Edge Function uses,
-- so it never affects an active rate-limit decision, and short enough
-- that this table doesn't grow unbounded. pg_cron is already enabled by
-- schema_phase32_expire_channel_requests.sql; `if not exists` here just
-- makes this file safe to run standalone too. Unlike that phase's job,
-- this one is a plain SQL delete with no external HTTP call, so (unlike
-- the channel-request expiry cron) it doesn't need pg_net or a secret
-- documented separately in DEPLOY.md — it's safe to schedule directly in
-- this file.

create table public.public_form_submissions (
  id uuid primary key default gen_random_uuid(),
  -- One of the form identifiers the Edge Function's FORM_CONFIGS map
  -- knows about (see public-form-submit/index.ts): 'contact', 'advertise',
  -- 'partner_directory', 'partner_apply', 'careers', 'work_with_us',
  -- 'community_qa', 'agency_lead'. Not a foreign key — this table is
  -- infrastructure for throttling, not a join target.
  form text not null,
  ip_hash text not null,
  email_hash text,
  created_at timestamptz not null default now()
);

create index public_form_submissions_form_ip_idx
  on public.public_form_submissions(form, ip_hash, created_at);
create index public_form_submissions_form_email_idx
  on public.public_form_submissions(form, email_hash, created_at)
  where email_hash is not null;

alter table public.public_form_submissions enable row level security;
-- Deliberately zero policies: only the service role (which bypasses RLS
-- entirely) ever reads or writes this table. No anon/authenticated
-- access of any kind, including admins from the client — there is
-- nothing here an admin dashboard needs to show; investigate abuse from
-- the seven real tables' own created_at clustering instead.

create extension if not exists pg_cron;

select cron.schedule(
  'purge-old-public-form-submissions',
  '17 3 * * *', -- daily at 03:17 — off the hour, avoiding the exact-o'clock
                -- pile-up other scheduled jobs in a typical Supabase
                -- project tend to land on
  $$ delete from public.public_form_submissions where created_at < now() - interval '30 days' $$
);

-- ── Close the seven direct-insert paths ─────────────────────────────────
-- Each of these previously let anon insert unconditionally (or, for
-- agency_leads, near-unconditionally). Dropping them means an anon POST
-- straight to PostgREST now gets a normal RLS 403 instead of succeeding —
-- public-form-submit (service role) is the only remaining path in.
-- Nothing else about these tables changes: existing select/update/delete
-- policies (admin-only, in every case) are untouched.

drop policy "contact_insert_public" on public.contact_messages;
drop policy "advertise_inquiries_insert_public" on public.advertise_inquiries;
drop policy "partner_applications_insert_public" on public.partner_applications;
drop policy "career_applications_insert_public" on public.career_applications;
drop policy "work_with_us_insert_public" on public.work_with_us_applications;
drop policy "community_questions_insert_public" on public.community_questions;
drop policy "agency_leads_public_insert" on public.agency_leads;
