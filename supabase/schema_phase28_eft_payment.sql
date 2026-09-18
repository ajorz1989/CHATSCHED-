-- ChatSched — Phase 28 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase27_portfolio.sql.
--
-- Adds an on-site EFT payment option to the `requests` flow (the original
-- social-media/PayFast flow), alongside PayFast rather than instead of it —
-- PayFast is untouched. A business can now choose:
--   - "Pay by EFT" — real bank details shown on-site (PLATFORM_BANK_DETAILS
--     in constants.ts), business clicks "I've paid", admin confirms once it
--     lands, same manual-confirm shape the channel_requests flow
--     (influencer/website/podcast/radio) already uses.
--   - "Pay via PayFast" — unchanged, still redirects to PayFast, still
--     auto-confirms via payfast-notify's webhook.
--
-- `payments_insert_own` (schema_phase2.sql) already lets a business create
-- its own payment row — that's how payfast-checkout's client call already
-- worked, and it's exactly what an EFT payment row needs too. What's new
-- here is `method` to tell the two apart, and a narrow self-update path so
-- a business can mark "I've paid" without being able to mark itself PAID
-- outright (only admin can do that, via payments_update_admin).

alter table public.payments
  add column method text not null default 'payfast' check (method in ('payfast', 'eft')),
  add column eft_reference text,
  add column eft_confirmed_by_business_at timestamptz;

comment on column public.payments.eft_confirmed_by_business_at is
  'Set when the business clicks "I''ve made this payment" on an EFT
   payment — a claim, not a confirmation. Only an admin flipping status to
   ''paid'' (payments_update_admin) makes it official, same two-step shape
   as channel_requests.payment_submitted -> paid.';

-- A business may update ONLY eft_confirmed_by_business_at on its own
-- pending EFT payment — same permissive-policy-plus-strict-trigger shape as
-- enforce_publisher_self_update, enforce_dispute_update etc. elsewhere in
-- this schema. It can never touch status, amount, or method itself.
create policy payments_update_own_eft_confirm
  on public.payments for update
  using (auth.uid() = business_id and method = 'eft' and status = 'pending');

create or replace function public.enforce_payment_eft_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_confirmed_at timestamptz;
begin
  if public.is_admin() then
    return new; -- admin's own update path (payments_update_admin) is unrestricted, as before
  end if;
  if auth.uid() is null then
    return new; -- trusted server-side context (e.g. payfast-notify via service role)
  end if;

  new_confirmed_at := new.eft_confirmed_by_business_at;
  new := old;
  new.eft_confirmed_by_business_at := coalesce(old.eft_confirmed_by_business_at, new_confirmed_at);
  return new;
end;
$$;

drop trigger if exists trg_enforce_payment_eft_confirm on public.payments;
create trigger trg_enforce_payment_eft_confirm
  before update on public.payments
  for each row execute function public.enforce_payment_eft_confirm();

-- ── tightening a pre-existing gap while touching this table ──────────────
-- payments_insert_own (schema_phase2.sql) has never actually constrained
-- what a client-supplied insert can set beyond business_id — status,
-- payout_status, payfast_payment_id and paid_at were all take-the-client's-
-- word-for-it. That was harmless while the only caller was payfast-checkout
-- (which never sent anything but request_id/business_id/amount), but this
-- migration adds a second real caller (the EFT flow) and touches this exact
-- trust boundary, so it's the right moment to close it properly: every
-- insert is forced to the safe defaults server-side, no matter what the
-- client sends. A business choosing EFT already only ever needs to send
-- request_id, amount, and method — everything else starts at "not paid yet"
-- until an admin says otherwise.
create or replace function public.enforce_payment_insert_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new; -- trusted server-side/admin context
  end if;
  new.status := 'pending';
  new.payout_status := 'unpaid';
  new.payfast_payment_id := null;
  new.paid_at := null;
  new.payout_date := null;
  new.eft_confirmed_by_business_at := null;
  if new.method not in ('payfast', 'eft') then
    new.method := 'payfast';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_payment_insert_defaults on public.payments;
create trigger trg_enforce_payment_insert_defaults
  before insert on public.payments
  for each row execute function public.enforce_payment_insert_defaults();

-- Notify admins the moment a business claims they've paid by EFT — reuses
-- create_notification() from schema_phase23_notifications.sql, same as
-- every other notification trigger in this schema.
create or replace function public.notify_eft_payment_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
  v_publisher_name text;
begin
  if new.eft_confirmed_by_business_at is null or new.eft_confirmed_by_business_at is not distinct from old.eft_confirmed_by_business_at then
    return new;
  end if;
  select p.name into v_publisher_name from public.requests r join public.publishers p on p.id = r.publisher_id where r.id = new.request_id;
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.create_notification(
      v_admin.id, 'eft_payment_confirmed',
      'EFT payment claimed — needs confirmation',
      format('A business says they paid R%s by EFT for a %s campaign. Check the bank account and confirm.', new.amount, coalesce(v_publisher_name, 'a')),
      '/admin'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_eft_payment_confirmed on public.payments;
create trigger trg_notify_eft_payment_confirmed
  after update of eft_confirmed_by_business_at on public.payments
  for each row execute function public.notify_eft_payment_confirmed();
