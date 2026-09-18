-- ChatSched — Phase 87 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase86_once_off_activation_pricing.sql.
--
-- Delivers the second half of "Claude To fix 1..txt" item 10's commercial
-- spec — "Secondary placements: from R99/month" — per the explicit
-- clarification this was built to: "Make the R99/ for featured/advertise
-- products for businesses and publisher in house." This file covers the
-- PUBLISHER side, self-serve: a recurring R99/month purchase of the
-- existing Featured Placement concept (publishers.featured/featured_until,
-- schema_phase14_featured_publishers.sql), which until now was admin-
-- granted only, with no price and no self-serve path at all.
--
-- The BUSINESS side ("Advertise" — schema_phase51_advertise.sql's
-- website_advertising / newsletter_sponsorship / featured_placement /
-- sponsored_article / brand_partnership products) is deliberately NOT
-- converted to self-serve checkout here — that system was built as
-- inquiry-only by design (its own header comment: "no fixed rate card
-- yet"), covering five distinct, real-world-priced ad products, not one
-- fixed-price item. Building a full self-serve payment flow for all five
-- is a materially larger undertaking than "align pricing to spec," so
-- the business side of this item is delivered as a real starting price
-- (R99/month, for the featured_placement product specifically) shown on
-- the Advertise page, with the inquiry flow itself unchanged — see the
-- "claude fixes" writeup for item 10 for the full reasoning.
--
-- Reuses the recurring PayFast pattern this same task just retired from
-- publisher_subscriptions/business_subscriptions (schema_phase86) — this
-- is the one genuinely recurring product left after that conversion, so
-- the pattern has a real home again rather than being duplicated
-- needlessly.

create table public.featured_placement_subscriptions (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null unique references public.publishers(id) on delete cascade,
  -- Deliberately simpler than the old publisher_subscriptions/
  -- business_subscriptions lifecycle (schema_phase55/72) — no
  -- grace_period/suspended dunning window. This is a cosmetic visibility
  -- boost, not core marketplace access; a missed payment simply drops
  -- the listing's featured status immediately (via the trigger below)
  -- until the next payment lands, rather than needing a forgiveness
  -- period the way core membership access once did.
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled')),
  payfast_token text,
  current_period_end timestamptz,
  payfast_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.featured_placement_subscriptions enable row level security;

create policy "featured_placement_subscriptions_select_own_or_admin" on public.featured_placement_subscriptions
  for select using (
    exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid())
    or public.is_admin()
  );

-- No client insert/update/delete policy at all — same reasoning as
-- publisher_subscriptions/business_subscriptions always had: only
-- featured-placement-subscribe and payfast-notify (both service-role)
-- ever write this table.

comment on table public.featured_placement_subscriptions is
  'Self-serve R99/month Featured Placement for a publisher listing (item 10 — "Secondary placements: from R99/month"). Keeps public.publishers.featured/featured_until in sync via sync_featured_placement_status() below, so every existing "is featured" check (is_featured(), PublisherCard.tsx, Admin.tsx''s own manual toggle) needed zero changes. The admin manual toggle in Admin.tsx is independent of this table and still works exactly as before — this table only ever ADDS a second, self-serve way to become featured, it does not replace or gate the admin one.';

-- ── Keep publishers.featured/featured_until in sync automatically ───────
-- Every existing "is this publisher featured" check in the codebase reads
-- publishers.featured/featured_until directly (is_featured(),
-- PublisherCard.tsx) — rather than teaching all of them about this new
-- table too, this trigger keeps those two columns as a derived mirror of
-- whichever mechanism (admin toggle OR this table) most recently applied.
-- active -> featured on, extended to this row's own current_period_end.
-- past_due/cancelled -> featured off immediately (see the status comment
-- above for why there's no grace window here).
create or replace function public.sync_featured_placement_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.publishers set featured = true, featured_until = new.current_period_end where id = new.publisher_id;
  elsif new.status in ('past_due', 'cancelled') then
    update public.publishers set featured = false where id = new.publisher_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_featured_placement_status on public.featured_placement_subscriptions;
create trigger trg_sync_featured_placement_status
  after insert or update of status on public.featured_placement_subscriptions
  for each row execute function public.sync_featured_placement_status();
