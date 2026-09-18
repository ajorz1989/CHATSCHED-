-- ChatSched — Phase 24 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase23_notifications.sql.
--
-- Fraud/authenticity checks — deliberately framed as decision support for
-- admin, not an automated verdict. Two independent pieces:
--
-- 1. Rule-based signals (src/lib/authenticitySignals.ts) are computed
--    entirely client-side from numbers already on the publishers row
--    (engagement vs. follower count, price vs. the existing pricing-engine
--    band, verification status) — no new columns needed for those, no cost
--    per view, and no false authority ("the algorithm says X") since
--    they're just visible, explainable arithmetic same as pricingEngine.ts
--    already is.
--
-- 2. An optional, admin-triggered AI second opinion
--    (publisher-authenticity-check edge function) that reads the same
--    self-reported fields a person reviewing the application already sees
--    (bio, audience description, category, platforms) and flags internal
--    inconsistencies a busy reviewer might skim past. It cannot verify a
--    follower count is real — it has no way to check that — and the UI
--    copy says so; it's a second pair of eyes on the text, not a
--    detector. Result is cached on the row (authenticity_risk/_notes/
--    _checked_at below) since re-running it on every page view would cost
--    money for a result that doesn't change unless the application does.

alter table public.publishers
  add column authenticity_risk text check (authenticity_risk in ('low', 'medium', 'high')),
  add column authenticity_notes text,
  add column authenticity_checked_at timestamptz;

comment on column public.publishers.authenticity_risk is
  'Set only by the publisher-authenticity-check edge function (admin-triggered,
   uses the Anthropic API) — an AI-assisted second opinion on internal
   consistency of the self-reported application text, not a verification
   result. Null until an admin runs a check.';

-- ── reports: a business flagging a publisher for admin review ──────────

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  reason text not null check (reason in ('fake_followers', 'no_response', 'inappropriate_content', 'scam_or_fraud', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index reports_publisher_id_idx on public.reports(publisher_id);
create index reports_status_idx on public.reports(status);

alter table public.reports enable row level security;

-- A reporter can see their own reports (so "you already reported this"
-- state is possible later); an admin can see and act on every report. No
-- one else can see a report — a publisher never sees who reported them or
-- why, which matters both for reporter safety and to stop retaliation.
create policy reports_select_own_or_admin
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

create policy reports_insert_own
  on public.reports for insert
  with check (reporter_id = auth.uid());

-- Only admin resolves a report (status/admin_notes/reviewed_at) — a
-- reporter's own row stays exactly as they submitted it once filed.
create policy reports_update_admin
  on public.reports for update
  using (public.is_admin());

-- ── notify admins when a report comes in ────────────────────────────────
-- Reuses create_notification() from schema_phase23_notifications.sql.

create or replace function public.notify_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher_name text;
  v_admin record;
begin
  select name into v_publisher_name from public.publishers where id = new.publisher_id;
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.create_notification(
      v_admin.id, 'new_report',
      'New report filed',
      format('A business reported %s (%s).', coalesce(v_publisher_name, 'a publisher'), replace(new.reason, '_', ' ')),
      '/admin'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_report on public.reports;
create trigger trg_notify_new_report
  after insert on public.reports
  for each row execute function public.notify_new_report();
