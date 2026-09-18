-- PL/pgSQL functions to create payout batches, approve batches, and mark item attempts.

create or replace function public.create_payout_batch(p_scheduled_for timestamptz default now(), p_minimum_payout_cents integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.payouts%rowtype;
  rec record;
  v_total integer := 0;
  v_items integer := 0;
  v_amount integer;
begin
  -- Create the batch record
  insert into public.payouts(status, total_amount_cents, total_items, scheduled_for, created_at, updated_at)
    values ('pending', 0, 0, p_scheduled_for, now(), now())
    returning * into v_batch;

  -- For each publisher compute available cents using the view
  for rec in select publisher_id, available_cents from public.publisher_available_balance loop
    if rec.available_cents >= p_minimum_payout_cents then
      v_amount := rec.available_cents;
      insert into public.payout_items(payout_id, publisher_id, amount_cents, currency, status, created_at, updated_at)
        values (v_batch.id, rec.publisher_id, v_amount, 'ZAR', 'pending', now(), now());
      v_total := v_total + v_amount;
      v_items := v_items + 1;
    end if;
  end loop;

  update public.payouts set total_amount_cents = v_total, total_items = v_items, updated_at = now() where id = v_batch.id;

  return jsonb_build_object('ok', true, 'payout_id', v_batch.id, 'items', v_items, 'total_amount_cents', v_total);
end;
$$;

-- Admin RPC to approve a payout batch. Only admins allowed.
create or replace function public.approve_payout(p_payout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.payouts%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not admin');
  end if;

  select * into v_p from public.payouts where id = p_payout_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'payout not found');
  end if;

  if v_p.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'payout not pending');
  end if;

  update public.payouts set status = 'approved', updated_at = now() where id = p_payout_id;

  return jsonb_build_object('ok', true, 'payout_id', p_payout_id);
end;
$$;

-- Worker RPC to mark payout item attempt (processing/sent/succeeded/failed). Worker should call this to record provider responses.
create or replace function public.mark_payout_item_attempt(p_item_id uuid, p_status text, p_provider_payout_id text default null, p_provider_response jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.payout_items%rowtype;
begin
  select * into v_item from public.payout_items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'item not found');
  end if;

  update public.payout_items set status = p_status, provider_payout_id = coalesce(p_provider_payout_id, provider_payout_id), provider_response = p_provider_response, updated_at = now() where id = p_item_id;

  -- If succeeded, insert a ledger entry for the payout (negative amount)
  if p_status = 'succeeded' then
    insert into public.publisher_ledger(publisher_id, amount_cents, currency, type, reference_id, created_at, meta)
      values (v_item.publisher_id, -v_item.amount_cents, v_item.currency, 'payout', v_item.id, now(), jsonb_build_object('provider_payout_id', p_provider_payout_id));
  end if;

  return jsonb_build_object('ok', true, 'item_id', p_item_id, 'status', p_status);
end;
$$;

-- Optional: mark whole payout as processing/completed
create or replace function public.update_payout_status(p_payout_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_p public.payouts%rowtype; begin
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'payout not found'); end if;
  update public.payouts set status = p_status, updated_at = now() where id = p_payout_id;
  return jsonb_build_object('ok', true, 'payout_id', p_payout_id, 'status', p_status);
end; $$;
