-- ChatSched — Phase 79 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase78_launch_seven_channels.sql.
--
-- NEXT_STAGE_DEVELOPMENT_BRIEF.md Task 2: give
-- `channels.verification_required` an actual admin-facing checklist,
-- sourced from each ChannelModule's own `eligibility.checks` array
-- (already defined per-channel in src/channels/*/index.ts, currently
-- unused anywhere except the publisher application form).
--
-- Checked first, per the brief's own instruction, whether an equivalent
-- table already exists: `publishers.admin_notes` is a single freeform
-- text column (one note, no structure, no per-check granularity) and
-- `admin_audit_log` (schema_phase15) is an append-only event stream —
-- neither can answer "what's the CURRENT verification state of this
-- publisher" the way the review screen needs to (e.g. re-showing
-- already-confirmed checks if an admin revisits an application after a
-- "request more info" round trip). Genuinely no equivalent; this table
-- is new.
--
-- Deliberately one row per publisher (not append-only) — this tracks
-- current state, not history. The actual audit trail for *approving
-- without every check confirmed* still goes through admin_audit_log via
-- log_admin_action(), same as every other admin action in this
-- codebase — this table isn't a substitute for that, it's what the
-- review screen reads back to render checkbox state.
create table public.publisher_verification_checks (
  publisher_id uuid primary key references public.publishers(id) on delete cascade,
  channel_slug text not null references public.channels(slug),
  -- The exact check strings (from that channel's eligibility.checks at
  -- the time) that were ticked — not just a count, so a later change to
  -- a channel's checklist wording doesn't silently invalidate or
  -- misrepresent what was actually confirmed.
  checks_confirmed text[] not null default '{}',
  checks_total integer not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

comment on table public.publisher_verification_checks is
  'Current verification-checklist state per publisher, for
   channels.verification_required channels only. One row per publisher,
   upserted on every checkbox change or approval — this is current
   state, not an audit trail (see admin_audit_log for that).';

create index publisher_verification_checks_channel_slug_idx
  on public.publisher_verification_checks(channel_slug);

alter table public.publisher_verification_checks enable row level security;

-- Same posture as every other admin-only operational table in this
-- codebase (admin_audit_log, campaign_compliance's admin-side policies)
-- — admin can read/write, nobody else can see or touch it at all. A
-- publisher has no reason to see which internal checks were ticked
-- against their own application.
create policy publisher_verification_checks_select_admin
  on public.publisher_verification_checks for select using (public.is_admin());

create policy publisher_verification_checks_insert_admin
  on public.publisher_verification_checks for insert with check (public.is_admin());

create policy publisher_verification_checks_update_admin
  on public.publisher_verification_checks for update using (public.is_admin()) with check (public.is_admin());

-- No delete policy for anyone, including admins — same "don't let the
-- record of a decision disappear" reasoning campaign_proof_screenshots
-- and campaign_proof use (schema_phase39/40). A publisher losing their
-- verification-checks row on, say, a channel switch would just mean the
-- checklist re-renders unticked next review, which is the safe default
-- anyway — nothing needs to actively delete this table's rows.
