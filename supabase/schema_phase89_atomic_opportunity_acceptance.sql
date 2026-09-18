-- ChatSched — Phase 89 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase88_atomic_launch_credit_redemption.sql.
--
-- Fixes "Claude To fix 1..txt" item 12, HIGH — Opportunity acceptance is
-- not atomic. Verified against the real source before writing anything:
--
--   src/pages/BusinessOpportunities.tsx's decide() function, on accept:
--     1. UPDATEs opportunity_applications.status = 'accepted' — this
--        alone fires close_out_accepted_opportunity() (schema_phase69),
--        an AFTER trigger that, once enough slots are filled, declines
--        every other pending application AND marks the opportunity
--        'filled'. That cascade has ALREADY happened, committed, the
--        moment this one UPDATE returns.
--     2. THEN, as a completely separate request with its result never
--        even checked (`await supabase.from("requests").insert(...)` —
--        no destructured {error}, no error handling at all), inserts the
--        actual requests/channel_requests row.
--   If step 2 fails for any reason — a constraint violation, a dropped
--   connection, anything — step 1 has already committed and its trigger
--   has already cascaded. The application shows as accepted (and, if it
--   was the last needed slot, the opportunity shows as filled and every
--   other applicant has already been declined) with no actual booking
--   ever created. Confirmed this is real by reading both the frontend
--   code and the trigger it silently depends on, not assumed from the
--   finding's own description.
--
-- Also confirmed a second race the finding's own wording doesn't name
-- directly but the required fix's own step 1 ("locks the application")
-- implies needs covering: for an opportunity needing more than one
-- publisher (publishers_needed > 1, schema_phase69), two concurrent
-- accept calls for two DIFFERENT pending applications on the SAME
-- opportunity could each check "is there still a slot open" before
-- either commits, and both proceed — overbooking the opportunity beyond
-- what it actually needed. Closed here by locking the OPPORTUNITY row,
-- not just the application, so two concurrent accepts for the same
-- opportunity serialize against each other.
--
-- Required fix, delivered as one RPC exactly matching the finding's own
-- five numbered steps: lock the application, verify state, create the
-- request/channel_request, update the application, all inside one
-- transaction that either fully commits or fully rolls back.

create or replace function public.accept_opportunity_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.opportunity_applications%rowtype;
  v_opp public.opportunities%rowtype;
  v_publisher public.publishers%rowtype;
  v_accepted_count integer;
  v_amount numeric;
begin
  -- 1. Lock the application.
  select * into v_app from public.opportunity_applications where id = p_application_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'application not found');
  end if;

  -- Also lock the opportunity itself — this is what actually closes the
  -- multi-slot race described above: a second concurrent accept call for
  -- a different application on this same opportunity now blocks here
  -- until the first one's transaction (including its trigger cascade)
  -- has fully committed, then re-reads the real, current slot count
  -- rather than a stale one.
  select * into v_opp from public.opportunities where id = v_app.opportunity_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'opportunity not found');
  end if;

  -- 2. Verify state — authorization, then both parties' current status.
  if auth.uid() is not null and auth.uid() <> v_opp.business_id and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not your opportunity');
  end if;

  if v_app.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'application is not pending');
  end if;

  if v_opp.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'opportunity is no longer open');
  end if;

  select count(*) into v_accepted_count
    from public.opportunity_applications
   where opportunity_id = v_opp.id and status = 'accepted';

  if v_accepted_count >= v_opp.publishers_needed then
    return jsonb_build_object('ok', false, 'error', 'opportunity is already fully booked');
  end if;

  select * into v_publisher from public.publishers where id = v_app.publisher_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'publisher not found');
  end if;

  v_amount := coalesce(v_app.proposed_amount, v_opp.budget_max, v_opp.budget_min, 0);

  -- 3. Create the request/channel_request — identical field mapping to
  -- BusinessOpportunities.tsx's own (former) insert, just executed here
  -- instead, so a failure raises and rolls back step 4 below with it,
  -- rather than step 4 having already committed independently.
  if v_publisher.channel_slug = 'social-media' then
    insert into public.requests (publisher_id, business_id, campaign_message, budget)
      values (v_app.publisher_id, v_opp.business_id, v_app.message, nullif(v_amount, 0));
  else
    insert into public.channel_requests (channel_slug, creator_id, business_id, campaign_message, advertising_method, proposed_amount)
      values (v_publisher.channel_slug, v_app.publisher_id, v_opp.business_id, v_app.message, coalesce(v_app.advertising_method, v_opp.title), v_amount);
  end if;

  -- 4. Update the application — still the one write that fires
  -- close_out_accepted_opportunity() (schema_phase69), completely
  -- unchanged; it just now runs as part of the SAME transaction as the
  -- insert above rather than a separate, already-committed request.
  update public.opportunity_applications
     set status = 'accepted', updated_at = now()
   where id = p_application_id;

  -- 5. Commits as one unit — the implicit transaction wrapping this
  -- entire function body. Any exception raised anywhere above (a bad
  -- channel_slug, a constraint violation on the insert, anything) rolls
  -- back the whole thing, including the status update and its trigger
  -- cascade — there is no longer a state where the application shows
  -- accepted but no booking exists.
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.accept_opportunity_application(uuid) from public;
grant execute on function public.accept_opportunity_application(uuid) to authenticated;
