-- ChatSched — Phase 23 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase22_content_studio.sql.
--
-- In-app notification center (NotificationBell.tsx / useNotifications.ts) —
-- a bell icon with an unread count, separate from (and in addition to) the
-- existing email notifications (`notify` edge function / Resend). Rather
-- than hunting down and instrumenting every client call site that changes a
-- request/message/payment/subscription — which would silently miss admin
-- edits, future call sites, or anything done directly in the Supabase
-- dashboard — every notification is created by a database trigger, the
-- same "server is the source of truth" approach already used for the
-- request/channel_request state machines in this schema. That means the
-- bell stays accurate no matter which path caused the underlying change.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

-- A recipient can see their own notifications. Nobody can INSERT directly —
-- there's no insert policy at all, so only the trigger functions below
-- (SECURITY DEFINER, running as the table owner) can create rows. That's
-- deliberate: if a client could insert its own notification, any logged-in
-- user could forge a fake "payment received" or "request approved" row.
create policy notifications_select_own
  on public.notifications for select
  using (recipient_id = auth.uid());

-- A recipient can mark their own notifications read — but only read_at.
-- Same self-update pattern as enforce_publisher_self_update() in
-- schema_phase18/19/20/21: the policy stays permissive on which rows can be
-- touched, and this trigger is the real gate on which columns actually
-- change, resetting everything else to its stored value.
create policy notifications_update_own
  on public.notifications for update
  using (recipient_id = auth.uid());

create or replace function public.enforce_notification_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_read_at timestamptz;
begin
  if auth.uid() is null then
    return new; -- trusted server-side context, not a live user session
  end if;
  new_read_at := new.read_at;
  new := old;
  new.read_at := new_read_at;
  return new;
end;
$$;

drop trigger if exists trg_enforce_notification_self_update on public.notifications;
create trigger trg_enforce_notification_self_update
  before update on public.notifications
  for each row execute function public.enforce_notification_self_update();

-- Small helper so every trigger function below stays a one-liner instead of
-- repeating the same insert shape nine times.
create or replace function public.create_notification(
  p_recipient_id uuid, p_type text, p_title text, p_body text, p_link text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (recipient_id, type, title, body, link)
  select p_recipient_id, p_type, p_title, p_body, p_link
  where p_recipient_id is not null;
$$;

-- ── requests (the original social-media/PayFast flow) ──────────────────

create or replace function public.notify_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher_name text;
  v_admin record;
begin
  select name into v_publisher_name from public.publishers where id = new.publisher_id;
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.create_notification(
      v_admin.id, 'new_request',
      'New campaign request',
      format('A business requested a campaign with %s.', coalesce(v_publisher_name, 'a publisher')),
      '/admin'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_request on public.requests;
create trigger trg_notify_new_request
  after insert on public.requests
  for each row execute function public.notify_new_request();

create or replace function public.notify_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher_name text;
begin
  if new.status = old.status then
    return new;
  end if;
  select name into v_publisher_name from public.publishers where id = new.publisher_id;
  perform public.create_notification(
    new.business_id, 'request_status_change',
    format('%s campaign: %s', coalesce(v_publisher_name, 'Your'), new.status),
    format('Your campaign request with %s is now "%s".', coalesce(v_publisher_name, 'a publisher'), new.status),
    '/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_request_status_change on public.requests;
create trigger trg_notify_request_status_change
  after update of status on public.requests
  for each row execute function public.notify_request_status_change();

-- ── messages (business <-> admin, on the requests flow) ────────────────

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.requests%rowtype;
  v_publisher_name text;
  v_admin record;
begin
  select * into v_request from public.requests where id = new.request_id;
  if not found then
    return new;
  end if;
  select name into v_publisher_name from public.publishers where id = v_request.publisher_id;

  if new.sender_role = 'business' then
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform public.create_notification(
        v_admin.id, 'new_message',
        'New message',
        format('New message about the %s campaign.', coalesce(v_publisher_name, 'a')),
        '/admin'
      );
    end loop;
  else
    perform public.create_notification(
      v_request.business_id, 'new_message',
      'New message',
      format('New message about your %s campaign.', coalesce(v_publisher_name, 'a')),
      '/dashboard'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- ── channel_requests (the 4 request-flow channels) ──────────────────────
-- No messages table exists for this flow yet, so only the request/status
-- events are covered here.

create or replace function public.notify_new_channel_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_user_id uuid;
  v_creator_name text;
begin
  select user_id, name into v_creator_user_id, v_creator_name from public.publishers where id = new.creator_id;
  perform public.create_notification(
    v_creator_user_id, 'new_channel_request',
    'New feature request',
    'A business sent you a feature request — review it in your dashboard.',
    '/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_channel_request on public.channel_requests;
create trigger trg_notify_new_channel_request
  after insert on public.channel_requests
  for each row execute function public.notify_new_channel_request();

create or replace function public.notify_channel_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_user_id uuid;
  v_creator_name text;
  v_admin record;
begin
  if new.status = old.status then
    return new;
  end if;
  select user_id, name into v_creator_user_id, v_creator_name from public.publishers where id = new.creator_id;

  if new.status = 'awaiting_payment' then
    perform public.create_notification(
      new.business_id, 'channel_request_status_change',
      format('%s approved your request', coalesce(v_creator_name, 'The creator')),
      'Payment is due within 7 days to keep it on track.',
      '/dashboard'
    );
  elsif new.status = 'declined' then
    perform public.create_notification(
      new.business_id, 'channel_request_status_change',
      format('%s declined your request', coalesce(v_creator_name, 'The creator')),
      'This feature request was declined.',
      '/dashboard'
    );
  elsif new.status = 'payment_submitted' then
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform public.create_notification(
        v_admin.id, 'channel_request_status_change',
        'Payment submitted — needs confirmation',
        format('A business reported payment sent for a %s campaign.', coalesce(v_creator_name, 'a')),
        '/admin'
      );
    end loop;
  elsif new.status = 'paid' then
    perform public.create_notification(
      v_creator_user_id, 'channel_request_status_change',
      'Payment confirmed',
      'Payment is confirmed — you can schedule and go live.',
      '/dashboard'
    );
  elsif new.status = 'live' then
    perform public.create_notification(
      new.business_id, 'channel_request_status_change',
      format('%s is live', coalesce(v_creator_name, 'Your placement')),
      'Your placement just went live.',
      '/dashboard'
    );
  elsif new.status = 'completed' then
    perform public.create_notification(
      v_creator_user_id, 'channel_request_status_change',
      'Payout sent',
      'Your payout for this campaign has been sent.',
      '/dashboard'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_channel_request_status_change on public.channel_requests;
create trigger trg_notify_channel_request_status_change
  after update of status on public.channel_requests
  for each row execute function public.notify_channel_request_status_change();

-- ── payments (paid confirmation to the business, payout to the creator) ─

create or replace function public.notify_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.requests%rowtype;
  v_publisher_name text;
  v_creator_user_id uuid;
begin
  select * into v_request from public.requests where id = new.request_id;
  if not found then
    return new;
  end if;
  select user_id, name into v_creator_user_id, v_publisher_name from public.publishers where id = v_request.publisher_id;

  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform public.create_notification(
      new.business_id, 'payment_paid',
      'Payment received',
      format('Your payment for the %s campaign was received. Download your invoice from your dashboard.', coalesce(v_publisher_name, 'a')),
      '/dashboard'
    );
  end if;

  if new.payout_status = 'paid' and old.payout_status is distinct from 'paid' then
    perform public.create_notification(
      v_creator_user_id, 'payout_paid',
      'Payout sent',
      'A payout has been sent to you — download the statement from your dashboard.',
      '/dashboard'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_payment_status_change on public.payments;
create trigger trg_notify_payment_status_change
  after update of status, payout_status on public.payments
  for each row execute function public.notify_payment_status_change();

-- ── AI Content Studio subscription ──────────────────────────────────────

create or replace function public.notify_content_studio_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'active' then
    perform public.create_notification(
      new.business_id, 'content_studio_subscription',
      'Content Studio is active',
      'Your AI Content Studio subscription is active — start generating content from your dashboard.',
      '/dashboard'
    );
  elsif new.status = 'past_due' then
    perform public.create_notification(
      new.business_id, 'content_studio_subscription',
      'Content Studio payment failed',
      'Your last Content Studio payment didn''t go through — resubscribe to keep using it.',
      '/dashboard'
    );
  elsif new.status = 'cancelled' then
    perform public.create_notification(
      new.business_id, 'content_studio_subscription',
      'Content Studio cancelled',
      'Your AI Content Studio subscription was cancelled.',
      '/dashboard'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_content_studio_subscription_change on public.content_studio_subscriptions;
create trigger trg_notify_content_studio_subscription_change
  after update of status on public.content_studio_subscriptions
  for each row execute function public.notify_content_studio_subscription_change();
