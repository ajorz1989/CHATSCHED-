-- ChatSched — Phase 14 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase13_saved_lists.sql.
--
-- A featured-listing upsell: an admin-granted, time-boxed boost that
-- sorts a publisher above the normal score ordering in Browse. Currently
-- the only planned revenue line is the 12% commission (PLATFORM_COMMISSION_RATE in
-- src/lib/constants.ts) — this is a second, margin-friendly one that
-- doesn't depend on transaction volume.
--
-- Deliberately admin-granted rather than self-serve checkout for now —
-- consistent with how this project has approached every other
-- trust-sensitive step so far (publisher approval, business verification,
-- payouts): a human in the loop until there's real demand to justify
-- building a self-serve payment flow for it.

alter table public.publishers add column if not exists featured boolean not null default false;
alter table public.publishers add column if not exists featured_until timestamptz;

-- A helper so "is this publisher currently featured" is one predicate
-- instead of repeating the boolean-and-not-expired check in every query.
create or replace function public.is_featured(p_featured boolean, p_featured_until timestamptz)
returns boolean
language sql
immutable
as $$
  select coalesce(p_featured, false) and (p_featured_until is null or p_featured_until > now());
$$;

create index if not exists idx_publishers_featured on public.publishers(featured, featured_until) where featured = true;
