-- ChatSched — Phase 18 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase17_channel_marketplace.sql.
--
-- Lets an approved publisher/creator update their own price_per_post from
-- their dashboard (PricingPanel in PublisherDashboardView.tsx) — previously
-- only an admin could update any column on publishers at all
-- (publishers_update_admin, schema.sql). This adds a second, narrower path
-- for the row's own owner, without touching that existing admin policy.
--
-- Enforced twice, deliberately: MIN_PRICE_PER_POST = 50 in
-- src/lib/pricingEngine.ts gates the UI, and the trigger below gates the
-- database — the UI check is a courtesy, this one is the real guarantee.

-- Second, additive UPDATE policy — Postgres ORs multiple permissive
-- policies together, so this doesn't replace publishers_update_admin, it
-- just also lets a non-admin owner attempt an update on their own row. The
-- trigger below is what actually restricts *what* they're allowed to change.
create policy "publishers_update_own" on public.publishers
  for update using (user_id = auth.uid());

create or replace function public.enforce_publisher_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_price numeric;
begin
  -- Admin, or a trusted server-side context (auth.uid() is null outside a
  -- real user session) — no restriction, same as before this migration.
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if old.user_id is null or old.user_id <> auth.uid() then
    raise exception 'You can only update your own listing.';
  end if;

  new_price := new.price_per_post;
  if new_price is null or new_price < 50 then
    raise exception 'Price must be at least R50.';
  end if;

  -- A self-serve owner may only ever change price_per_post. Reset every
  -- other column to its stored value rather than maintaining an explicit
  -- column allowlist that would silently go stale the next time publishers
  -- gains a column — whatever else the client sent is simply discarded.
  new := old;
  new.price_per_post := new_price;
  return new;
end;
$$;

drop trigger if exists trg_enforce_publisher_self_update on public.publishers;
create trigger trg_enforce_publisher_self_update
  before update on public.publishers
  for each row execute function public.enforce_publisher_self_update();
