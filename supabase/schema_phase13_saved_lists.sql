-- ChatSched — Phase 13 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase12_blocked_dates.sql.
--
-- Backs Saved Lists with a real table for logged-in businesses. Previously
-- entirely localStorage (`mb_saved_lists`), which meant a business's
-- shortlists didn't survive a cleared cache or a new device, and were
-- invisible to admins — exactly the kind of buyer-intent signal worth
-- being able to see. Logged-out visitors keep working exactly as before;
-- see src/contexts/SavedListsContext.tsx for the client-side logic,
-- including a one-time migration of local lists on first login.
--
-- One row per list, with publisher_ids as an array column rather than a
-- join table — consistent with how publishers.platforms is already
-- modelled, and simple enough for this feature's scale.

create table if not exists public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  publisher_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_lists_business on public.saved_lists(business_id);

alter table public.saved_lists enable row level security;

create policy saved_lists_all_own on public.saved_lists
  for all using (business_id = auth.uid() or public.is_admin())
  with check (business_id = auth.uid() or public.is_admin());
