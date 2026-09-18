-- ChatSched — Phase 55 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase54_deliverables.sql.
--
-- Agency pivot, step 1: the ChatSched Publisher Network (R99/month) and
-- ChatSched Business (R199/month, plus a one-time R199 launch credit)
-- subscriptions. Same shape as content_studio_subscriptions
-- (schema_phase22_content_studio.sql) — pending/active/past_due/cancelled
-- status, a PayFast recurring token, current_period_end — with two extra
-- states the agency pivot brief specifically asked for (grace_period,
-- suspended) that Content Studio never needed, plus a fifth column
-- (business_subscriptions.launch_credit_granted) so the notify webhook can
-- tell, race-safely, whether it's already issued this business's one-time
-- credit.
--
-- Deliberately NOT included here: any enforcement that blocks marketplace
-- use for a non-subscribed account. This migration only makes the
-- subscriptions real and billable — whether/when to require one is a
-- product decision, gated client-side behind
-- isSubscriptionEnforcementEnabled() in featureFlags.ts, defaulted off.
-- See PIVOT_PHASE1_AUDIT.md and PHASE2_SUBSCRIPTIONS_DELIVERY.md.

create table public.publisher_subscriptions (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled')),
  payfast_token text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled')),
  payfast_token text,
  current_period_end timestamptz,
  -- Set true the moment the launch credit is granted (first-ever completed
  -- payment on this subscription) and never unset. payfast-notify checks
  -- this — not "does a business_launch_credits row exist" — as the single
  -- guard against granting it twice on a retried/duplicate ITN, since it's
  -- flipped in the SAME update as the payment that earns it.
  launch_credit_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per business, ever — this is a one-time "welcome" credit tied to
-- first becoming a paying subscriber, not a monthly top-up. If that's
-- wrong and it should reissue every billing period, this table still
-- works — it would just become one row per period instead of a unique
-- constraint on business_id — but nothing in the brief said "every
-- month", and re-reading a discount into the subscription price each
-- period is a different, larger product decision than a launch incentive.
create table public.business_launch_credits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.business_subscriptions(id) on delete cascade,
  amount numeric(10,2) not null,
  remaining numeric(10,2) not null check (remaining >= 0 and remaining <= amount),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- How much launch credit was applied to a given campaign payment — set at
-- checkout time (the discount PayFast is actually charged against) and
-- only deducted from business_launch_credits.remaining once payfast-notify
-- confirms the payment actually completed, the same way payments.status
-- itself only ever changes from that webhook, never from checkout or the
-- browser's return page.
alter table public.payments add column if not exists credit_applied numeric(10,2) not null default 0;

alter table public.publisher_subscriptions enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.business_launch_credits enable row level security;

-- Same reasoning as content_studio_subscriptions: a user can see their own
-- row, never write to it directly. All writes are service-role, from
-- publisher-subscribe / business-subscribe (creating the pending row) and
-- payfast-notify (activating it, granting/redeeming credit).
create policy publisher_subscriptions_select_own
  on public.publisher_subscriptions for select
  using (publisher_id = auth.uid() or public.is_admin());

create policy business_subscriptions_select_own
  on public.business_subscriptions for select
  using (business_id = auth.uid() or public.is_admin());

create policy business_launch_credits_select_own
  on public.business_launch_credits for select
  using (business_id = auth.uid() or public.is_admin());

-- No updated_at trigger, matching content_studio_subscriptions and
-- schema_payouts_phase1.sql — every writer below sets it explicitly.
