-- ChatSched — Phase 81 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase80_opportunities_all_channels.sql.
--
-- Fixes "Claude To fix 1..txt" item 5, CRITICAL — Admin role escalation
-- risk. Two independent holes, both real once traced against the actual
-- source rather than assumed from the finding's description:
--
--   1. handle_new_user() (schema.sql, redefined by schema_phase5.sql and
--      schema_phase7.sql) reads role straight out of
--      new.raw_user_meta_data ->> 'role' with only a fallback to
--      'business' if the key is absent — it never checks the value
--      itself. profiles_role_check (schema_phase5.sql) allows
--      ('business', 'admin', 'publisher'), so any client calling
--      supabase.auth.signUp() directly (bypassing Register.tsx's own
--      TypeScript-level "business" | "publisher" union, which only
--      constrains the UI, not the API) with
--      data: { role: 'admin' } in the signUp options becomes an admin
--      the instant their row is created. Confirmed by reading
--      handle_new_user() itself, not assumed from the finding text.
--
--   2. profiles_update_own_or_admin (schema.sql) is
--      `for update using (auth.uid() = id or public.is_admin())` with no
--      WITH CHECK and, unlike email_verified/phone_verified/
--      business_verified, no column-level trigger guard. Postgres RLS
--      UPDATE policies with no explicit WITH CHECK reuse the USING
--      clause as the check, so a logged-in business or publisher can run
--      `update profiles set role = 'admin' where id = auth.uid()` today
--      and it succeeds — nothing stops it. prevent_self_verification()
--      (schema_phase7.sql) protects the three verification columns this
--      exact way already; role was simply left out of it.
--
-- Fix mirrors the existing prevent_self_verification() pattern rather
-- than inventing a new one:
--   - A BEFORE UPDATE trigger resets new.role to old.role whenever the
--     acting session is a real logged-in non-admin (auth.uid() is not
--     null and not is_admin()). auth.uid() is null for trusted
--     server/service-role contexts (the SQL-editor "make yourself an
--     admin" UPDATE at the bottom of schema.sql, and any future
--     server-side admin-promotion path), so that path is untouched —
--     this only closes the client-facing hole.
--   - handle_new_user() is redefined once more (its third redefinition;
--     schema.sql -> schema_phase5.sql -> schema_phase7.sql -> here) so
--     signup can never seed role as anything but 'business' or
--     'publisher', regardless of what raw_user_meta_data contains. Every
--     column this function already handles (email_verified included, from
--     schema_phase7.sql) is carried over unchanged — only the role branch
--     changes.

-- ── 1. handle_new_user(): whitelist signup role, never trust 'admin' ────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  safe_role text;
begin
  -- Only 'business' and 'publisher' are ever creatable from signup
  -- metadata. Anything else — including 'admin', an unrecognised value,
  -- or absent — falls back to 'business', same default schema.sql always
  -- had before role existed at all.
  if requested_role = 'publisher' then
    safe_role := 'publisher';
  else
    safe_role := 'business';
  end if;

  insert into public.profiles (id, role, full_name, company_name, phone, email_verified)
  values (
    new.id,
    safe_role,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone',
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

-- ── 2. BEFORE UPDATE trigger: role is never client-writable ─────────────
-- Same shape and same auth.uid()-is-null carve-out as
-- prevent_self_verification() in schema_phase7.sql — RLS controls which
-- rows an update can touch, not which columns, so the column itself has
-- to be the thing that refuses to move.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ── 3. Admin promotion path stays exactly what schema.sql documents ─────
-- No change needed here — the bottom of schema.sql already says to run,
-- as yourself in the Supabase SQL editor (a trusted server-side context
-- where auth.uid() is null, not a client session):
--   update public.profiles set role = 'admin' where id = 'paste-uuid-here';
-- That path is what the trigger above is written to leave untouched.
