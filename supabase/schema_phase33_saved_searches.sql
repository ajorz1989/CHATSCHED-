-- ChatSched — Phase 33 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
-- Purely additive.
--
-- What this adds: saved searches with real alerts. A business saves a
-- Browse filter set (`filters`, the same jsonb shape as browseFilters.ts's
-- Filters type — see src/lib/searchParamsCodec.ts for how it round-trips
-- through a /browse URL). The moment a new publisher becomes visible in
-- the directory — a fresh admin-added row that's already approved, or an
-- existing application flipping from pending_review to approved — every
-- saved search with alerts on is checked against it, and a matching
-- business gets a real in-app notification.
--
-- Why the trigger only checks structured fields, not the full filter set:
-- Browse.tsx's `query` (free-text keyword) and `ageDemographic`/`gender`
-- (regex heuristics over the audience-description text — see
-- browseFilters.ts) are fuzzy by design, meant for a human eyeballing
-- results, not something worth re-implementing as SQL regexes just to
-- decide whether to send an email. A saved search is still stored with
-- its full filter set (so "View results" restores the exact search), but
-- only channel/category/province/city/suburb/platforms/languages/
-- verifiedOnly/minFollowers/maxFollowers/minEngagement/maxPrice are
-- checked for alert matching — the same fields that would realistically
-- define "I want to hear about publishers like X", not "publishers whose
-- bio happens to contain a word I typed once."
--
-- Same "server is the source of truth" reasoning as Phase 23's
-- notification triggers: matching lives in a trigger on `publishers`
-- itself, not in application code that has to remember to call it —
-- so it fires correctly whichever path approved the publisher (by-hand
-- admin add, or the self-serve apply-then-approve flow), the same
-- guarantee Phase 23's own comment calls out for its own triggers.

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  alerts_enabled boolean not null default true,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now()
);

create index saved_searches_business_id_idx on public.saved_searches(business_id);
create index saved_searches_alerts_enabled_idx on public.saved_searches(alerts_enabled) where alerts_enabled = true;

comment on table public.saved_searches is
  'A business''s saved Browse filter set, with alerts_enabled controlling
   whether trg_notify_saved_search_matches (below) fires an in-app
   notification when a newly-approved publisher matches. Fully owner-only
   — nobody else, including admin, has a legitimate reason to read another
   business''s saved search criteria, so there is deliberately no
   is_admin() escape hatch on the select policy, unlike most other tables
   in this schema.';

alter table public.saved_searches enable row level security;

create policy "saved_searches_select_own" on public.saved_searches
  for select using (business_id = auth.uid());

create policy "saved_searches_insert_own" on public.saved_searches
  for insert with check (business_id = auth.uid());

create policy "saved_searches_update_own" on public.saved_searches
  for update using (business_id = auth.uid());

create policy "saved_searches_delete_own" on public.saved_searches
  for delete using (business_id = auth.uid());

-- ── notify_saved_search_matches ──────────────────────────────────────
-- Fires once per newly-approved publisher, loops every saved search with
-- alerts on, and creates an in-app notification (via the same
-- create_notification() helper Phase 23 defines) for each match. Doesn't
-- send email itself — supabase/functions/notify-saved-search-matches is
-- called separately from Admin.tsx right after the approval action, the
-- same client-invokes-an-edge-function-for-email pattern the `notify`
-- function already uses elsewhere in this schema (see that function's own
-- comment for why email stays a client-invoked call rather than also
-- living in a trigger: it needs RESEND_API_KEY, which only exists in an
-- Edge Function's environment, not inside Postgres).
create or replace function public.notify_saved_search_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search record;
  v_min_followers numeric;
  v_max_followers numeric;
  v_min_engagement numeric;
  v_max_price numeric;
  v_platforms text[];
  v_languages text[];
begin
  -- Only the moment a publisher actually becomes visible in the directory:
  -- either a fresh insert that's already approved (the admin "add by
  -- hand" path, which defaults status to approved), or an update that
  -- newly flips status into approved from something else. Never re-fires
  -- on every subsequent, unrelated update to an already-approved row.
  if tg_op = 'INSERT' then
    if new.status is distinct from 'approved' then
      return new;
    end if;
  else
    if new.status is distinct from 'approved' or old.status = 'approved' then
      return new;
    end if;
  end if;

  for v_search in
    select * from public.saved_searches where alerts_enabled = true
  loop
    v_min_followers := nullif(v_search.filters->>'minFollowers', '')::numeric;
    v_max_followers := nullif(v_search.filters->>'maxFollowers', '')::numeric;
    v_min_engagement := nullif(v_search.filters->>'minEngagement', '')::numeric;
    v_max_price := nullif(v_search.filters->>'maxPrice', '')::numeric;
    v_platforms := case when jsonb_typeof(v_search.filters->'platforms') = 'array'
      then array(select jsonb_array_elements_text(v_search.filters->'platforms')) else null end;
    v_languages := case when jsonb_typeof(v_search.filters->'languages') = 'array'
      then array(select jsonb_array_elements_text(v_search.filters->'languages')) else null end;

    if (nullif(v_search.filters->>'channel', '') is not null and v_search.filters->>'channel' <> new.channel_slug) then continue; end if;
    if (nullif(v_search.filters->>'category', '') is not null and v_search.filters->>'category' <> new.category) then continue; end if;
    if (nullif(v_search.filters->>'province', '') is not null and v_search.filters->>'province' <> new.province) then continue; end if;
    if (nullif(v_search.filters->>'city', '') is not null and new.city not ilike '%' || (v_search.filters->>'city') || '%') then continue; end if;
    if (nullif(v_search.filters->>'suburb', '') is not null and v_search.filters->>'suburb' <> new.suburb) then continue; end if;
    if (v_search.filters->>'verifiedOnly' = 'true' and new.verified is distinct from true) then continue; end if;
    if (v_platforms is not null and array_length(v_platforms, 1) > 0 and not (v_platforms && new.platforms)) then continue; end if;
    if (v_languages is not null and array_length(v_languages, 1) > 0 and not (v_languages && new.languages)) then continue; end if;
    if (v_min_followers is not null and new.followers < v_min_followers) then continue; end if;
    if (v_max_followers is not null and new.followers > v_max_followers) then continue; end if;
    if (v_min_engagement is not null and new.engagement < v_min_engagement) then continue; end if;
    if (v_max_price is not null and new.price_per_post > v_max_price) then continue; end if;

    perform public.create_notification(
      v_search.business_id, 'saved_search_match',
      format('New match for "%s"', v_search.name),
      format('%s just joined the directory and matches your saved search "%s".', new.name, v_search.name),
      '/saved-searches'
    );

    update public.saved_searches set last_alerted_at = now() where id = v_search.id;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_saved_search_matches on public.publishers;
create trigger trg_notify_saved_search_matches
  after insert or update of status on public.publishers
  for each row execute function public.notify_saved_search_matches();
