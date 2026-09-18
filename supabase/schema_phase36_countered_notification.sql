-- ChatSched — Phase 36 schema additions
-- Run once in the Supabase SQL editor, AFTER every prior schema_phase*.sql.
--
-- Fixes a real gap left by Phase 35 (counter-offer): a business gets
-- notified about every other channel_requests status change — approved,
-- declined, payment confirmed, live, payout sent — but NOT the moment a
-- creator counters. The only notification that existed for a counter was
-- the expiry job telling a business their counter-offer had *already*
-- lapsed (expire-channel-requests, reason: "counter_expired") — nothing
-- told them at the moment they still had time to act on it. A business
-- could lose a deal the counter-offer feature was specifically built to
-- save, simply because nothing surfaced it.
--
-- This is a straight CREATE OR REPLACE of
-- notify_channel_request_status_change() (schema_phase23), with one new
-- `elsif` branch for status = 'countered' — same shape, same table, same
-- trigger (trg_notify_channel_request_status_change, unchanged, still
-- fires `after update of status`). Postgres has no ALTER FUNCTION for
-- adding a branch to a plpgsql body, so — same as Phase 35 did for
-- enforce_channel_request_transition() — this is the full function body,
-- not a patch. Every other branch below is copied unchanged from
-- schema_phase23_notifications.sql.
--
-- Deliberately in-app only, matching every other branch in this same
-- function: the whole channel_requests flow has never sent email on a
-- status change (unlike the original `requests` flow, where the client
-- separately invokes the `notify` Edge Function after certain actions —
-- see Admin.tsx/Dashboard.tsx/PublisherProfile.tsx). Giving 'countered'
-- an email while nothing else in this table has one would be a bigger,
-- separate inconsistency to introduce than the bug this fixes.

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

  if new.status = 'countered' then
    perform public.create_notification(
      new.business_id, 'channel_request_status_change',
      format('%s countered your request', coalesce(v_creator_name, 'The creator')),
      format('They proposed R%s instead of R%s — review and respond before your window to reply closes.', new.counter_amount, new.proposed_amount),
      '/dashboard'
    );
  elsif new.status = 'awaiting_payment' then
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

-- Trigger itself is unchanged (same function name, same table) — no need
-- to drop/recreate it, only the function body changed above.
