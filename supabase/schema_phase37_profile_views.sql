-- ChatSched — Phase 37 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- Publisher-side traction visibility. Businesses already get real numbers
-- on their dashboard (CampaignRollup) the moment they start a campaign;
-- publishers previously got nothing until their first request landed —
-- no signal at all between "0 requests" and "is this platform even
-- working". This logs a real profile-view event every time a registered
-- business or creator opens a publisher's full profile (the gated view —
-- see RequireAuth/PublisherProfile.tsx's registered-viewer check; an
-- unregistered visitor only ever sees the card preview, not the real
-- profile, so there's nothing to log for them), and PublisherDashboardView
-- surfaces the aggregate with a nudge tailored to what the numbers show.
--
-- Deliberately count-only, never identity: a publisher sees "8 businesses
-- viewed your profile this week", never which businesses. Keeping browsing
-- behaviour private between businesses is worth more than the marginal
-- value of a publisher knowing exactly who looked — and avoids this
-- turning into something that reads as being watched. See Privacy.tsx's
-- "Technical information" bullet, updated alongside this migration.

create table public.publisher_profile_views (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_date date not null default current_date,
  created_at timestamptz not null default now(),
  -- One row per viewer per publisher per day — repeatedly refreshing a
  -- profile in one sitting (or coming back to compare later the same
  -- day) shouldn't inflate the count the way it would with no dedupe at
  -- all. A business genuinely revisiting on a different day still counts
  -- again, which is the right signal ("still interested"), not noise.
  unique (publisher_id, viewer_id, viewed_date)
);

create index publisher_profile_views_publisher_id_idx on public.publisher_profile_views(publisher_id);

alter table public.publisher_profile_views enable row level security;

-- Insert: any authenticated user logs their own view of someone else's
-- listing — never their own (checked here, not just in the client, since
-- a publisher inflating their own traction numbers is exactly the kind
-- of thing an RLS check exists for). "is distinct from" (not !=) so an
-- unclaimed listing (publishers.user_id is null) doesn't accidentally
-- block every insert — null != anything is NULL/not-true in SQL, which
-- would silently reject every view of an unclaimed listing otherwise.
create policy "publisher_profile_views_insert_own"
  on public.publisher_profile_views for insert
  with check (
    auth.uid() = viewer_id
    and (select user_id from public.publishers where id = publisher_id) is distinct from viewer_id
  );

-- Select: only the publisher who owns the listing, or an admin — a
-- business never sees this table at all, and specifically never sees
-- which OTHER businesses viewed the same listing.
create policy "publisher_profile_views_select_owner"
  on public.publisher_profile_views for select
  using (
    exists (select 1 from public.publishers p where p.id = publisher_id and p.user_id = auth.uid())
    or public.is_admin()
  );

-- No update/delete policy — view events are append-only.
