-- ChatSched — Phase 2 schema additions
-- Run once in the Supabase SQL editor, AFTER schema.sql.
-- Adds: an agreed amount per request, real payments (PayFast-backed),
-- manually-tracked payouts, and reviews.

alter table public.requests
  add column agreed_amount numeric;
comment on column public.requests.agreed_amount is
  'Set by an admin once a campaign is confirmed. The payment flow trusts this, never the business''s own suggested budget or the publisher''s list price, since the concierge model allows negotiated pricing.';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  business_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  payfast_payment_id text,
  payout_status text not null default 'unpaid' check (payout_status in ('unpaid', 'paid')),
  payout_date timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests(id) on delete cascade,
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  business_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index payments_request_id_idx on public.payments(request_id);
create index payments_business_id_idx on public.payments(business_id);
create index reviews_publisher_id_idx on public.reviews(publisher_id);

alter table public.payments enable row level security;
alter table public.reviews enable row level security;

-- payments: a business can see and create its own; only admins (dashboard)
-- or the payfast-notify Edge Function (service role, bypasses RLS entirely)
-- can update one — a business can never mark its own payment as paid.
create policy "payments_select_own_or_admin" on public.payments
  for select using (auth.uid() = business_id or public.is_admin());
create policy "payments_insert_own" on public.payments
  for insert with check (auth.uid() = business_id);
create policy "payments_update_admin" on public.payments
  for update using (public.is_admin());

-- reviews: publicly readable (they show on the public profile page).
-- A business can only review its own request, and only once that
-- request's campaign is marked completed by an admin.
create policy "reviews_select_public" on public.reviews
  for select using (true);
create policy "reviews_insert_own_completed" on public.reviews
  for insert with check (
    auth.uid() = business_id
    and exists (
      select 1 from public.requests r
      where r.id = request_id and r.business_id = auth.uid() and r.status = 'completed'
    )
  );
create policy "reviews_delete_admin" on public.reviews
  for delete using (public.is_admin());
