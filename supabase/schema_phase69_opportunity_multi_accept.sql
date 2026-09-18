-- ChatSched — Phase 69 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase68_opportunity_marketplace.sql.
--
-- Closes the limitation PHASE12_OPPORTUNITY_MARKETPLACE_DELIVERY.md
-- named directly: "a business can only accept one applicant per
-- opportunity." The brief's own example was "Need: 5 publishers" —
-- opportunities were missing a slot count entirely.
--
-- Additive: one new column, one function replaced in place (`create or
-- replace`, same trigger still attached — no drop/recreate needed since
-- the trigger's signature and firing condition don't change, only what
-- the function body does before declining the rest).

alter table public.opportunities
  add column if not exists publishers_needed integer not null default 1 check (publishers_needed > 0);

comment on column public.opportunities.publishers_needed is
  'How many applicants this opportunity needs, not how many have
   accepted so far — that''s a live count against opportunity_applications
   (status = ''accepted''), same "compute, don''t duplicate" reasoning
   agency_client_totals() and every other totals function in this schema
   already uses, not a second column that could drift from the real
   count.';

-- Replaces close_out_accepted_opportunity() from schema_phase68 in
-- place — same trigger (trg_close_out_accepted_opportunity, "after
-- update of status ... when (new.status = 'accepted')"), still fires on
-- every acceptance, but now only closes out the rest once enough slots
-- are actually filled instead of on the very first one. The count
-- includes the row this trigger is firing for: AFTER triggers see the
-- row already committed with its new value, so counting
-- status = 'accepted' here also counts the acceptance that just
-- happened, not just the ones before it.
create or replace function public.close_out_accepted_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publishers_needed integer;
  v_accepted_count integer;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select publishers_needed into v_publishers_needed
    from public.opportunities where id = new.opportunity_id;

    select count(*) into v_accepted_count
    from public.opportunity_applications
    where opportunity_id = new.opportunity_id and status = 'accepted';

    if v_accepted_count >= coalesce(v_publishers_needed, 1) then
      update public.opportunity_applications
      set status = 'declined', updated_at = now()
      where opportunity_id = new.opportunity_id
        and id <> new.id
        and status = 'pending';

      update public.opportunities
      set status = 'filled', updated_at = now()
      where id = new.opportunity_id and status = 'open';
    end if;
    -- Below the needed count: this application stays accepted, every
    -- other pending one stays pending and visible, the opportunity
    -- stays open. No partial-fill status — "open" already means
    -- "still taking applications AND still has room," which stays true
    -- until the count is met.
  end if;
  return new;
end;
$$;
