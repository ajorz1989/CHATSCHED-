-- ChatSched — Phase 114: cancellations, refunds, scheduled go-live, revenue
-- APPLIED to production (hbqobuecjrxhlfgfhdud) on 2026-10-05. Refund wording is for AJ's accountant.
--
-- Refund rules (decided Oct 2026; amounts are paid back by manual bank
-- transfer, admin marks them paid out):
--   Creator declines or lets a request lapse, before any payment: nothing owed.
--   Business cancels BEFORE its money has cleared: nothing owed.
--   Business cancels after funds cleared, and at least 48 hours before the
--     scheduled go-live: refund the creator price; ChatSched keeps the
--     booking fee.  (Social media rule, as specified by AJ. Applied to every
--     other channel too, the cleanest consistent default.)
--   Business cancels inside the 48-hour window, or after going live: no
--     automatic refund; the creator keeps their payout. Admin can override.
--   Creator cancels after funds cleared: business gets everything back,
--     including the booking fee.
--   Nothing goes live and no content is delivered (creator no-show): admin
--     cancels with a full refund.
--
-- The 48h clock needs a date: creators now set scheduled_live_at when they
-- accept. If it is missing, the business may cancel and is refunded as if
-- inside the safe window (a missing date is ChatSched's gap, not theirs).

alter table public.channel_requests
  add column if not exists scheduled_live_at timestamptz,
  add column if not exists cancelled_by text check (cancelled_by in ('business', 'creator', 'admin')),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists refund_status text not null default 'none'
    check (refund_status in ('none', 'due', 'paid_out')),
  add column if not exists refund_amount_cents bigint not null default 0 check (refund_amount_cents >= 0),
  add column if not exists refund_paid_out_at timestamptz;

-- Refund figures and cancellation columns are written only by the RPC below
-- (or by admin). Extend the snapshot guard from phase113.
create or replace function public.protect_cancellation_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() or current_setting('app.cancel_rpc', true) = '1' then
    return new;
  end if;
  new.cancelled_by := old.cancelled_by;
  new.cancelled_at := old.cancelled_at;
  new.cancel_reason := old.cancel_reason;
  new.refund_status := old.refund_status;
  new.refund_amount_cents := old.refund_amount_cents;
  new.refund_paid_out_at := old.refund_paid_out_at;
  return new;
end;
$$;

drop trigger if exists trg_protect_cancellation_columns on public.channel_requests;
create trigger trg_protect_cancellation_columns
  before update on public.channel_requests
  for each row execute function public.protect_cancellation_columns();

-- ── Cancel with the right refund ────────────────────────────────────────
create or replace function public.cancel_channel_request(p_request_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.channel_requests%rowtype;
  v_is_business boolean;
  v_is_creator boolean;
  v_is_admin boolean := public.is_admin();
  v_by text;
  v_refund bigint := 0;
begin
  select * into r from public.channel_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found.';
  end if;

  v_is_business := (auth.uid() = r.business_id);
  v_is_creator := exists (select 1 from public.publishers p where p.id = r.creator_id and p.user_id = auth.uid());
  if not (v_is_business or v_is_creator or v_is_admin) then
    raise exception 'Not allowed.';
  end if;
  if r.status in ('declined', 'cancelled', 'completed') then
    raise exception 'This request is already closed.';
  end if;
  if r.status = 'live' and not v_is_admin then
    raise exception 'A live placement can only be cancelled by ChatSched.';
  end if;

  v_by := case when v_is_admin then 'admin' when v_is_business then 'business' else 'creator' end;

  -- Money only moves if funds actually cleared.
  if r.funds_cleared_at is not null then
    if v_by = 'creator' then
      v_refund := coalesce(r.total_due_cents, 0);
    elsif v_by = 'business' then
      if r.scheduled_live_at is null or now() <= r.scheduled_live_at - interval '48 hours' then
        v_refund := coalesce(r.creator_price_cents, 0); -- booking fee kept
      else
        v_refund := 0;
      end if;
    else
      -- admin: full refund by default (creator no-show / ChatSched-side problem)
      v_refund := coalesce(r.total_due_cents, 0);
    end if;
  elsif r.status = 'payment_submitted' and v_by = 'business' then
    -- Business says it paid but we have not seen the money: flag for review,
    -- do not promise anything. Admin decides after checking the bank.
    v_refund := 0;
  end if;

  perform set_config('app.cancel_rpc', '1', true);
  update public.channel_requests set
    status = 'cancelled',
    cancelled_by = v_by,
    cancelled_at = now(),
    cancel_reason = p_reason,
    refund_amount_cents = v_refund,
    refund_status = case when v_refund > 0 then 'due' else 'none' end
  where id = r.id;

  return jsonb_build_object('refund_cents', v_refund, 'cancelled_by', v_by);
end;
$$;

revoke all on function public.cancel_channel_request(uuid, text) from public;
grant execute on function public.cancel_channel_request(uuid, text) to authenticated;

-- Admin marks a refund as paid out of the bank account.
create or replace function public.mark_refund_paid_out(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only.';
  end if;
  perform set_config('app.cancel_rpc', '1', true);
  update public.channel_requests
    set refund_status = 'paid_out', refund_paid_out_at = now()
  where id = p_request_id and refund_status = 'due';
end;
$$;
revoke all on function public.mark_refund_paid_out(uuid) from public;
grant execute on function public.mark_refund_paid_out(uuid) to authenticated;

-- ── Revenue from the stored snapshot (admin analytics) ──────────────────
-- Recognised only on cleared funds, net of refunds. Replaces
-- GMV × PLATFORM_COMMISSION_RATE in AdminAnalytics.
create or replace function public.admin_booking_revenue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only.';
  end if;

  select jsonb_build_object(
    'cleared_bookings', count(*),
    'gross_received_cents', coalesce(sum(total_due_cents), 0),
    'commission_cents', coalesce(sum(case
        when status = 'cancelled' and refund_amount_cents > 0 then 0
        else commission_cents end), 0),
    'booking_fee_cents', coalesce(sum(case
        when status = 'cancelled' and refund_amount_cents >= total_due_cents then 0
        else booking_fee_cents end), 0),
    'refunds_due_cents', coalesce(sum(case when refund_status = 'due' then refund_amount_cents else 0 end), 0),
    'refunds_paid_cents', coalesce(sum(case when refund_status = 'paid_out' then refund_amount_cents else 0 end), 0),
    'completed_bookings', count(*) filter (where status = 'completed')
  ) into v
  from public.channel_requests
  where funds_cleared_at is not null;

  return v;
end;
$$;
revoke all on function public.admin_booking_revenue() from public;
grant execute on function public.admin_booking_revenue() to authenticated;
