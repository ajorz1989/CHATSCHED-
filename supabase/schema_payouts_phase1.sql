-- Phase: payouts (initial)
-- Adds payout tables, ledger, and basic publisher payout metadata.

alter table public.publishers
  add column if not exists payout_method text default 'manual',
  add column if not exists payout_details jsonb,
  add column if not exists payout_account_verified_at timestamptz;

-- Ledger: track credits and debits for publishers (in cents)
create table if not exists public.publisher_ledger (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'ZAR',
  type text not null,
  reference_id uuid,
  created_at timestamptz not null default now(),
  meta jsonb
);
create index if not exists idx_publisher_ledger_publisher on public.publisher_ledger(publisher_id);

-- Payout batches
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  batch_ref text,
  status text not null default 'pending', -- pending | approved | processing | file_generated | sent | completed | failed | canceled
  total_amount_cents integer not null default 0,
  total_items integer not null default 0,
  scheduled_for timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  meta jsonb
);

-- Payout items
create table if not exists public.payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'ZAR',
  status text not null default 'pending', -- pending | processing | sent | succeeded | failed
  provider_payout_id text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  meta jsonb
);
create index if not exists idx_payouts_status_scheduled on public.payouts(status, scheduled_for);
create index if not exists idx_payout_items_status on public.payout_items(status);

-- Webhook events to ensure idempotency on provider callbacks
create table if not exists public.payout_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  payload jsonb,
  processed boolean default false,
  created_at timestamptz not null default now()
);
create unique index if not exists ux_payout_provider_event on public.payout_provider_events(provider, provider_event_id);

-- Helpful view: publisher available balance (simple sum of ledger minus payouts already recorded)
create or replace view public.publisher_available_balance as
select
  p.id as publisher_id,
  coalesce(sum(l.amount_cents), 0) - coalesce(paid.paid_cents, 0) as available_cents
from public.publishers p
left join public.publisher_ledger l on l.publisher_id = p.id
left join (
  select publisher_id, coalesce(sum(amount_cents),0) as paid_cents
  from public.payout_items pi
  join public.payouts po on po.id = pi.payout_id
  where pi.status in ('sent','succeeded')
  group by publisher_id
) paid on paid.publisher_id = p.id
group by p.id, paid.paid_cents;
