-- ChatSched — Phase 38 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- Rate cards. publishers.price_per_post has always been a single flat
-- number — real pricing varies by format (a Story costs less than a
-- dedicated Reel, a bundle undercuts booking each separately), so a
-- publisher was stuck either picking one number that's wrong for most of
-- what they actually sell, or leaving money on the table. This adds
-- optional structured line items; nothing about price_per_post's
-- meaning or any of its existing consumers (Browse's price filter,
-- ComparePublishers, AudienceFinder's matching, MediaKit, the request
-- forms) changes — see the trigger below for how the two stay in sync.

create table public.publisher_rate_cards (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  price numeric not null check (price > 0),
  description text check (char_length(description) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index publisher_rate_cards_publisher_id_idx on public.publisher_rate_cards(publisher_id);

alter table public.publisher_rate_cards enable row level security;

-- Public, same as the rest of a publisher's listing — a rate card is
-- marketing, not sensitive data.
create policy "publisher_rate_cards_select_all"
  on public.publisher_rate_cards for select
  using (true);

-- Only the publisher who owns the listing, or an admin, can add/edit/
-- remove line items.
create policy "publisher_rate_cards_write_owner"
  on public.publisher_rate_cards for all
  using (
    exists (select 1 from public.publishers p where p.id = publisher_id and p.user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.publishers p where p.id = publisher_id and p.user_id = auth.uid())
    or public.is_admin()
  );

-- ── Keep price_per_post meaning "starting from" once a rate card exists ──
-- Every existing consumer of price_per_post (Browse's price filter,
-- ComparePublishers, AudienceFinder's matching, MediaKit, the pricing
-- suggestion engine) keeps working unchanged: it just now reads a number
-- that's kept in sync with the cheapest rate-card line item, rather than
-- a manually-typed flat price. A publisher with no rate card is
-- completely unaffected — this trigger never fires for them, and the
-- dashboard's plain price editor (PricingPanel in
-- PublisherDashboardView.tsx) still works exactly as before.
create or replace function public.sync_publisher_starting_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.publisher_id, old.publisher_id);
  cheapest numeric;
begin
  select min(price) into cheapest from public.publisher_rate_cards where publisher_id = pid;
  if cheapest is not null then
    update public.publishers set price_per_post = cheapest where id = pid;
  end if;
  return null;
end;
$$;

create trigger sync_publisher_starting_price_trigger
after insert or update or delete on public.publisher_rate_cards
for each row execute function public.sync_publisher_starting_price();
