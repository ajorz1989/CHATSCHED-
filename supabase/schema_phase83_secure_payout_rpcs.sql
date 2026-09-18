-- ChatSched — Phase 83 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase82_restrict_public_publisher_columns.sql.
--
-- Fixes "Claude To fix 1..txt" item 7, CRITICAL — Payout RPCs are
-- insufficiently protected. Verified against the real source before
-- writing anything, including the operational context in
-- workers/README.md (this whole pipeline is explicitly documented as
-- "experimental, not-production-ready... nothing here runs unless you
-- deliberately start these processes yourself" — the live payout
-- mechanism today is the "Mark payout sent" button in Admin.tsx's
-- Requests tab, unrelated to any of this). That doesn't reduce the
-- severity of what's fixed here — every one of these tables and
-- functions is already deployed and reachable over the live API the
-- moment these migrations are applied, regardless of whether the Node
-- workers are ever started — but it's worth recording accurately rather
-- than implying this is the live money-movement path.
--
-- Confirmed, by reading schema_payouts_phase1.sql directly, that it
-- never once calls `alter table ... enable row level security` for any
-- of its four tables (publisher_ledger, payouts, payout_items,
-- payout_provider_events) — every other table in this schema does this
-- immediately after creation (see schema.sql line 104 onward for the
-- pattern). Combined with Supabase's default project-level grants
-- (`anon`/`authenticated` get full CRUD on every public-schema table
-- unless RLS says otherwise), this means today, with no RLS policy at
-- all, ANY authenticated user — not just admins — can directly
-- SELECT/INSERT/UPDATE/DELETE these tables via PostgREST: a publisher
-- could INSERT a positive `publisher_ledger` row crediting themselves,
-- or UPDATE `payouts.status` straight to 'completed', entirely bypassing
-- every RPC in schema_payouts_functions.sql.
--
-- Confirmed, by reading schema_payouts_functions.sql directly, that
-- create_payout_batch(), mark_payout_item_attempt(), and
-- update_payout_status() never check public.is_admin() at all —
-- approve_payout() already does (correctly, per the finding's own
-- text), so it is intentionally left unchanged here. Because these are
-- `security definer` functions, RLS on the underlying tables does NOT
-- protect them once called — a security definer function always runs
-- with the function owner's privileges regardless of RLS on the tables
-- it touches, so the only real gate for these three is an explicit
-- in-function authorization check, same as approve_payout() already
-- has.
--
-- Traced every real caller of these four functions before deciding how
-- to gate each one — not assumed:
--   - AdminPayouts.tsx calls create_payout_batch() and approve_payout()
--     via supabase.rpc(), i.e. as a real logged-in admin session
--     (auth.uid() is set).
--   - workers/payoutWorker.js calls mark_payout_item_attempt() via a
--     raw `pg` connection using DATABASE_URL — a direct Postgres
--     connection, not a PostgREST/Supabase-client session, so
--     auth.uid() is null there. The same is true of
--     workers/webhookServer.js's raw SQL (which doesn't call any of
--     these RPCs directly, but writes to the same tables the same way).
--     A raw DATABASE_URL connection already has unrestricted table
--     access regardless of any function-level check — the check below
--     exists to stop an ordinary authenticated app user from calling
--     these RPCs over the API, not to restrict the trusted worker.
--   - update_payout_status() has no caller anywhere in this codebase
--     today (its own comment calls it "Optional") — still live and
--     callable by anyone before this fix, so it needed the same
--     treatment regardless of being currently unused.
-- This is why the three functions below use the same
-- "auth.uid() is not null and not is_admin()" shape already established
-- in prevent_self_verification()/prevent_role_change() for exactly this
-- "real session vs. trusted server context" distinction, rather than a
-- bare `is_admin()` check that would incorrectly reject the worker's own
-- null-auth.uid() context. approve_payout()'s existing bare `is_admin()`
-- check is left as-is — it is meant to require an actual human admin
-- decision even from a trusted connection, and the finding's own text
-- confirms it's already correct.

-- ── 1. Enable RLS + admin-only policies on all four payout tables ───────
-- Confirmed via a full grep of src/ that the only frontend consumer of
-- any of these tables is AdminPayouts.tsx (admin-only page), reading
-- `payouts` joined with `payout_items`. No publisher-facing page reads
-- publisher_ledger, payout_items, or payouts today — EarningsDashboard.tsx
-- computes a publisher's own figures from `publishers`/`requests`
-- directly, not from this ledger. Admin-only matches actual current need
-- exactly; a future feature that needs a publisher to see their own
-- payout history can add a scoped SELECT policy then, as a deliberate
-- decision, rather than this leaving it open by default now.
alter table public.publisher_ledger enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_items enable row level security;
alter table public.payout_provider_events enable row level security;

create policy "publisher_ledger_admin_only" on public.publisher_ledger
  for all using (public.is_admin()) with check (public.is_admin());

create policy "payouts_admin_only" on public.payouts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "payout_items_admin_only" on public.payout_items
  for all using (public.is_admin()) with check (public.is_admin());

-- payout_provider_events is written exclusively by webhookServer.js over
-- its own raw DATABASE_URL connection (bypassing RLS entirely, same as
-- every other worker/webhook write in this file's own reasoning above) —
-- there is no legitimate PostgREST-level writer at all, so this is
-- read-only for admins (for debugging/auditing an IPN) and has no
-- insert/update/delete policy for any authenticated-role caller.
create policy "payout_provider_events_admin_read_only" on public.payout_provider_events
  for select using (public.is_admin());

-- Note: none of the above interferes with the SECURITY DEFINER functions
-- below — a security definer function's internal reads/writes run as the
-- function owner regardless of RLS on the tables it touches (this schema
-- does not set FORCE ROW LEVEL SECURITY anywhere, and doesn't start here
-- either, precisely so these RPCs keep working). What RLS does close is
-- direct client-side table access that bypasses the RPCs entirely.

-- ── 2. Revoke PUBLIC execute, grant only to authenticated ───────────────
-- Postgres grants EXECUTE on every new function to PUBLIC by default —
-- distinct from, and in addition to, the in-function is_admin() checks
-- below. Revoking it here means even a logged-out `anon` request can no
-- longer attempt any of these four RPCs at all, regardless of what the
-- function body would have decided — defense in depth, not a substitute
-- for the in-function checks that remain the real gate for logged-in
-- non-admin sessions.
revoke execute on function public.create_payout_batch(timestamptz, integer) from public;
revoke execute on function public.approve_payout(uuid) from public;
revoke execute on function public.mark_payout_item_attempt(uuid, text, text, jsonb) from public;
revoke execute on function public.update_payout_status(uuid, text) from public;

grant execute on function public.create_payout_batch(timestamptz, integer) to authenticated;
grant execute on function public.approve_payout(uuid) to authenticated;
grant execute on function public.mark_payout_item_attempt(uuid, text, text, jsonb) to authenticated;
grant execute on function public.update_payout_status(uuid, text) to authenticated;

-- ── 3. create_payout_batch(): admin-gated + serialized against races ────
-- Body otherwise unchanged from schema_payouts_functions.sql. Adds the
-- same auth.uid()-aware admin check as the rest of this file, plus a
-- transaction-scoped advisory lock so two concurrent batch-generation
-- calls can't both read the same publisher_available_balance figures and
-- create two payout_items for the same money ("lock the relevant
-- ledger/balance rows during batch generation", per the finding).
-- publisher_available_balance is an aggregate view (sums across
-- publisher_ledger and payout_items) with no single row to `for update`
-- lock per publisher; an advisory lock serializing the whole operation is
-- the standard, correct tool here — this is an infrequent, admin-
-- triggered batch job, not a hot path, so coarse-grained serialization
-- has no meaningful performance cost and fully eliminates the race.
create or replace function public.create_payout_batch(p_scheduled_for timestamptz default now(), p_minimum_payout_cents integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.payouts%rowtype;
  rec record;
  v_total integer := 0;
  v_items integer := 0;
  v_amount integer;
begin
  if auth.uid() is not null and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  -- Serialize concurrent batch generation for the duration of this
  -- transaction. Released automatically on commit/rollback.
  perform pg_advisory_xact_lock(hashtext('create_payout_batch'));

  insert into public.payouts(status, total_amount_cents, total_items, scheduled_for, created_at, updated_at)
    values ('pending', 0, 0, p_scheduled_for, now(), now())
    returning * into v_batch;

  for rec in select publisher_id, available_cents from public.publisher_available_balance loop
    if rec.available_cents >= p_minimum_payout_cents then
      v_amount := rec.available_cents;
      insert into public.payout_items(payout_id, publisher_id, amount_cents, currency, status, created_at, updated_at)
        values (v_batch.id, rec.publisher_id, v_amount, 'ZAR', 'pending', now(), now());
      v_total := v_total + v_amount;
      v_items := v_items + 1;
    end if;
  end loop;

  update public.payouts set total_amount_cents = v_total, total_items = v_items, updated_at = now() where id = v_batch.id;

  return jsonb_build_object('ok', true, 'payout_id', v_batch.id, 'items', v_items, 'total_amount_cents', v_total);
end;
$$;

-- ── 4. mark_payout_item_attempt(): worker/admin-gated, validated
--       transitions, idempotent ledger insert ──────────────────────────
-- Three changes from schema_payouts_functions.sql, all additive — the
-- successful-path behaviour callers already depend on
-- (workers/payoutWorker.js passing 'sent'/'failed') is unchanged:
--   1. auth.uid()-aware admin/worker check, same shape as everywhere
--      else in this file.
--   2. p_status is validated against an explicit allowed-transitions
--      table instead of being written straight through. Modelled on the
--      transitions payoutWorker.js and webhookServer.js actually use
--      today (pending/processing -> sent/failed; succeeded is reachable
--      from any non-terminal state since the function's own p_status =
--      'succeeded' branch already existed for it) plus the finding's
--      "add explicit allowed status transitions" requirement. succeeded
--      and failed are terminal — no transition out of either.
--   3. The ledger insert on succeeded is now idempotent — guarded by the
--      same "no existing payout ledger row for this item" check
--      workers/webhookServer.js's own raw SQL already uses for the exact
--      same insert, just missing here before this fix. This is the
--      literal gap the finding names: "creates a negative publisher
--      ledger entry every time it receives succeeded, without an
--      obvious idempotency guard."
create or replace function public.mark_payout_item_attempt(p_item_id uuid, p_status text, p_provider_payout_id text default null, p_provider_response jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.payout_items%rowtype;
  v_allowed boolean;
begin
  if auth.uid() is not null and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  select * into v_item from public.payout_items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'item not found');
  end if;

  v_allowed := case
    when v_item.status in ('succeeded', 'failed') then false -- terminal, no further transition
    when p_status not in ('pending', 'processing', 'sent', 'succeeded', 'failed') then false -- unknown status value
    when p_status = 'pending' then false -- never allowed to move backward to pending
    when v_item.status = 'pending' then p_status in ('processing', 'sent', 'succeeded', 'failed')
    when v_item.status = 'processing' then p_status in ('sent', 'succeeded', 'failed')
    when v_item.status = 'sent' then p_status in ('succeeded', 'failed')
    else false
  end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'error', 'invalid status transition', 'from', v_item.status, 'to', p_status);
  end if;

  update public.payout_items set status = p_status, provider_payout_id = coalesce(p_provider_payout_id, provider_payout_id), provider_response = p_provider_response, updated_at = now() where id = p_item_id;

  if p_status = 'succeeded' and not exists (
    select 1 from public.publisher_ledger where reference_id = v_item.id and type = 'payout'
  ) then
    insert into public.publisher_ledger(publisher_id, amount_cents, currency, type, reference_id, created_at, meta)
      values (v_item.publisher_id, -v_item.amount_cents, v_item.currency, 'payout', v_item.id, now(), jsonb_build_object('provider_payout_id', p_provider_payout_id));
  end if;

  return jsonb_build_object('ok', true, 'item_id', p_item_id, 'status', p_status);
end;
$$;

-- ── 5. update_payout_status(): worker/admin-gated, validated
--       transitions ─────────────────────────────────────────────────────
-- Unused by any current caller (its own original comment calls it
-- "Optional"), but live and callable by anyone before this fix, so it
-- gets the same treatment as the other two. 'approved' is deliberately
-- excluded from every allowed-transition list below — that transition
-- stays exclusively approve_payout()'s job (which already has its own
-- pending-only check and its own, intentionally stricter, bare
-- is_admin() gate), so this function can't be used to bypass it.
create or replace function public.update_payout_status(p_payout_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.payouts%rowtype;
  v_allowed boolean;
begin
  if auth.uid() is not null and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'payout not found');
  end if;

  v_allowed := case
    when v_p.status in ('completed', 'failed', 'canceled') then false -- terminal
    when p_status not in ('pending', 'approved', 'processing', 'file_generated', 'sent', 'completed', 'failed', 'canceled') then false
    when p_status = 'approved' then false -- must go through approve_payout()
    when v_p.status = 'pending' then p_status = 'canceled'
    when v_p.status = 'approved' then p_status in ('processing', 'canceled', 'failed')
    when v_p.status = 'processing' then p_status in ('file_generated', 'failed')
    when v_p.status = 'file_generated' then p_status in ('sent', 'failed')
    when v_p.status = 'sent' then p_status in ('completed', 'failed')
    else false
  end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'error', 'invalid status transition', 'from', v_p.status, 'to', p_status);
  end if;

  update public.payouts set status = p_status, updated_at = now() where id = p_payout_id;
  return jsonb_build_object('ok', true, 'payout_id', p_payout_id, 'status', p_status);
end;
$$;
