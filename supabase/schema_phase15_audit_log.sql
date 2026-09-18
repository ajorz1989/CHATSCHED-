-- ChatSched — Phase 15 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase14_featured_publishers.sql.
--
-- A lightweight admin audit log. Nothing currently records who approved,
-- rejected, or manually verified what, or when — fine with exactly one
-- admin who remembers everything; stops being fine the moment it isn't,
-- or a publisher disputes a rejection and you want a record of it.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id),
  action text not null,        -- e.g. 'publisher_approved', 'business_verified', 'payout_marked_sent'
  target_table text not null,  -- e.g. 'publishers', 'profiles', 'payments'
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

-- Only admins can read it. Nobody can update or delete rows through the
-- API at all, from any role — an audit log you can edit after the fact
-- isn't one.
create policy admin_audit_log_select_admin on public.admin_audit_log
  for select using (public.is_admin());

create policy admin_audit_log_insert_admin on public.admin_audit_log
  for insert with check (public.is_admin());

-- Convenience RPC so the frontend has one call to make instead of
-- composing this insert by hand at every admin action site. Silently
-- no-ops for a non-admin caller rather than throwing, so a failed log
-- write can never block the real action it's describing.
create or replace function public.log_admin_action(p_action text, p_target_table text, p_target_id uuid, p_detail jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, detail)
  values (auth.uid(), p_action, p_target_table, p_target_id, p_detail);
end;
$$;
