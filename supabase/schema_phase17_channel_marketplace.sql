-- ChatSched — Phase 17 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
-- Purely additive — nothing here removes a column, table, or row that's
-- already there, so the existing social-media/PayFast flow keeps working
-- byte-for-byte unchanged.
--
-- What this adds: a `channel_slug` (and optional `suburb`) on publishers so
-- the same directory can hold creators from any channel, and a brand new
-- channel_requests table powering the "Request Feature" workflow for the
-- four request-flow channels (influencer, website, podcast, radio) —
-- submit → creator approves/declines → business pays the platform → post
-- goes live → creator is paid. Deliberately a separate table from
-- requests/payments rather than merged into them: the payment mechanics
-- genuinely differ (no PayFast checkout here), and this keeps the mature,
-- already-live PayFast pipeline untouched.
--
-- ── The escrow/payment rule flow, and the overlap it fixes ─────────────
-- As briefed: creators get a 7-day approval window, businesses get a 7-day
-- payment window, payment must happen before a post goes live, and
-- creators are paid within 48 hours of going live. Read literally, the two
-- 7-day windows overlap: if both started counting from the same moment (the
-- request being submitted), a creator using the full 7 days to approve
-- would leave the business no real time left to pay inside "their" 7 days.
--
-- Fix: sequence the windows instead of running them concurrently.
--   1. pending             — business submits. approval_due_at = now() + 7d.
--   2. declined            — creator declined, or admin closed an overdue one.
--   3. cancelled           — business withdrew, or admin closed an unpaid one.
--   4. awaiting_payment    — creator approved *at that moment*, which is what
--                            starts the business's clock: payment_due_at =
--                            responded_at + 7d (not created_at + 7d).
--   5. payment_submitted   — business self-reports payment sent.
--   6. paid                — admin confirms funds received. This is the hard
--                            gate: there is no path to "live" that skips it.
--   7. live                — creator confirms the post is up. payout_due_at =
--                            live_at + 48h.
--   8. completed           — admin confirms the creator's payout was sent.
-- Every transition above is enforced server-side by
-- enforce_channel_request_transition() below, not just by the UI — a
-- creator's client can only ever move pending → {awaiting_payment,declined}
-- or paid → live; a business can only ever move pending → cancelled or
-- awaiting_payment → payment_submitted; only an admin can confirm payment or
-- payout. No auto-expiry job runs against approval_due_at/payment_due_at —
-- they're real, always-correct deadlines (generated columns, computed by
-- Postgres itself) surfaced in both dashboards and in Admin's "Overdue"
-- filter, but closing an overdue request is a manual admin action for now.

-- ── publishers: which channel does this row belong to? ─────────────────
alter table public.publishers
  add column channel_slug text not null default 'social-media'
    check (channel_slug in ('social-media', 'influencer', 'website', 'podcast', 'radio')),
  add column suburb text;

comment on column public.publishers.channel_slug is
  'Which advertising channel this publisher/creator belongs to. Defaults to
   social-media so every row that existed before this column did keeps
   working through the original directory/PayFast flow unchanged. Keep this
   check constraint in sync with ChannelSlug in src/lib/channelTypes.ts.';

comment on column public.publishers.suburb is
  'Free-text, optional. Powers the Cape Town pilot /suburbs browse page —
   not validated against a fixed list server-side, since publishers outside
   the pilot area have no matching list to validate against.';

-- ── channel_requests: the Request Feature workflow ──────────────────────
create table public.channel_requests (
  id uuid primary key default gen_random_uuid(),
  channel_slug text not null check (channel_slug in ('influencer', 'website', 'podcast', 'radio')),
  creator_id uuid not null references public.publishers(id) on delete cascade,
  business_id uuid not null references auth.users(id) on delete cascade,
  campaign_message text not null,
  advertising_method text not null,
  proposed_amount numeric not null check (proposed_amount > 0),
  status text not null default 'pending' check (status in (
    'pending', 'declined', 'cancelled', 'awaiting_payment',
    'payment_submitted', 'paid', 'live', 'completed'
  )),
  created_at timestamptz not null default now(),
  -- 7-day creator approval window, from submission. NOT a generated
  -- column — `timestamptz + interval` is STABLE, not IMMUTABLE (its
  -- result depends on the session's TimeZone setting for calendar-day
  -- arithmetic), and Postgres rejects STABLE expressions in `generated
  -- always as ... stored`. Confirmed directly against a real instance:
  -- this table's original form, three generated columns exactly like
  -- this one, could never actually be created in real Postgres — the
  -- very first `create table` statement in this file failed outright,
  -- which is also why every phase after this one that touches
  -- `channel_requests` had never been able to run either. Fixed here by
  -- making these plain columns instead, maintained by
  -- `set_channel_request_due_dates()` below (a trigger, not a generated
  -- expression, has no such restriction).
  approval_due_at timestamptz,
  responded_at timestamptz,
  -- 7-day business payment window, from the creator's response — not from
  -- created_at. This is the fix described above: sequenced, not concurrent.
  payment_due_at timestamptz,
  payment_submitted_at timestamptz,
  paid_at timestamptz,
  live_at timestamptz,
  -- 48-hour creator payout window, from going live.
  payout_due_at timestamptz,
  completed_at timestamptz
);

-- Maintains the three "due at" columns above now that they're plain
-- columns rather than generated ones (see the comment on approval_due_at
-- for why they had to change). Runs before
-- trg_enforce_channel_request_transition below — Postgres fires same-event
-- BEFORE ROW triggers in trigger-name alphabetical order ('trg_e...' before
-- 'trg_s...'), so this sees whatever that trigger just set on
-- responded_at/live_at in the same UPDATE, not the stale pre-update value.
create or replace function public.set_channel_request_due_dates() returns trigger
language plpgsql
as $$
begin
  new.approval_due_at := new.created_at + interval '7 days';
  new.payment_due_at := case when new.responded_at is not null then new.responded_at + interval '7 days' else null end;
  new.payout_due_at := case when new.live_at is not null then new.live_at + interval '48 hours' else null end;
  return new;
end;
$$;

create trigger trg_set_channel_request_due_dates
  before insert or update on public.channel_requests
  for each row execute function public.set_channel_request_due_dates();

create index channel_requests_creator_id_idx on public.channel_requests(creator_id);
create index channel_requests_business_id_idx on public.channel_requests(business_id);
create index channel_requests_status_idx on public.channel_requests(status);

alter table public.channel_requests enable row level security;

-- Select: the business that made the request, the creator who received it
-- (via publishers.user_id), or an admin.
create policy "channel_requests_select_participant" on public.channel_requests
  for select using (
    auth.uid() = business_id
    or exists (select 1 from public.publishers p where p.id = creator_id and p.user_id = auth.uid())
    or public.is_admin()
  );

-- Insert: a business creates its own request, always starting at 'pending'
-- (with check blocks inserting straight into any later status).
create policy "channel_requests_insert_business" on public.channel_requests
  for insert with check (auth.uid() = business_id and status = 'pending');

-- Update: any participant may attempt an update on their own row — the
-- trigger below is the real gate on *which* status changes are legal, so
-- this policy stays deliberately permissive on "using" and relies on
-- enforce_channel_request_transition() rather than trying to encode the
-- full state machine twice (Postgres ORs multiple permissive policies'
-- USING/WITH CHECK clauses independently, which can't express "pending
-- only goes to awaiting_payment/declined, paid only goes to live" as two
-- separate policies without a trigger anyway — so the trigger is both
-- necessary and sufficient here).
create policy "channel_requests_update_participant" on public.channel_requests
  for update using (
    auth.uid() = business_id
    or exists (select 1 from public.publishers p where p.id = creator_id and p.user_id = auth.uid())
    or public.is_admin()
  );

-- The actual state machine. Runs before every update; silently no-ops when
-- status isn't changing (so touching other columns, if that's ever added,
-- doesn't require this function's involvement), and raises otherwise for
-- any transition + actor combination not explicitly allowed below.
create or replace function public.enforce_channel_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_creator boolean;
  is_business boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  -- A null auth.uid() means a trusted server-side context (migrations,
  -- seed scripts, a future service-role edge function) — not a live user
  -- session subject to this guard. Same allowance as
  -- prevent_self_verification() in schema_phase7.sql.
  if auth.uid() is null then
    return new;
  end if;

  is_business := (auth.uid() = old.business_id);
  is_creator := exists (
    select 1 from public.publishers p
    where p.id = old.creator_id and p.user_id = auth.uid()
  );

  if public.is_admin() then
    if old.status in ('declined', 'cancelled', 'completed') then
      raise exception 'This request is already closed.';
    end if;
    if new.status = 'paid' and old.status = 'payment_submitted' then
      new.paid_at := now();
      return new;
    end if;
    if new.status = 'completed' and old.status = 'live' then
      new.completed_at := now();
      return new;
    end if;
    if new.status in ('declined', 'cancelled') then
      return new; -- admin closing an overdue/unresponsive request
    end if;
    raise exception 'That status change is not allowed for an admin.';
  end if;

  if is_creator and old.status = 'pending' and new.status in ('awaiting_payment', 'declined') then
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'paid' and new.status = 'live' then
    new.live_at := now();
    return new;
  end if;

  if is_business and old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;

  if is_business and old.status = 'awaiting_payment' and new.status = 'payment_submitted' then
    new.payment_submitted_at := now();
    return new;
  end if;

  raise exception 'That status change is not allowed.';
end;
$$;

drop trigger if exists trg_enforce_channel_request_transition on public.channel_requests;
create trigger trg_enforce_channel_request_transition
  before update on public.channel_requests
  for each row execute function public.enforce_channel_request_transition();
