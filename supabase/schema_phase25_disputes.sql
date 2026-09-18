-- ChatSched — Phase 25 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase24_fraud_authenticity.sql.
--
-- Dispute resolution / ticketing — a structured escalation path for when a
-- business and a publisher/creator disagree about a specific campaign
-- (non-delivery, quality, payment), separate from:
--   - the existing per-request message thread (messages table, business
--     <-> admin only, on the `requests` flow) — informal, not an escalation
--   - reports (schema_phase24) — a business flagging a *publisher's
--     application/authenticity* in general, not a specific campaign dispute
--
-- Works across BOTH request flows (the original `requests` table, and the
-- 4 request-flow channels' `channel_requests`) via two nullable foreign
-- keys with an either-or check constraint, since a dispute is about
-- whichever campaign it's about regardless of which flow created it.
--
-- Same "derive it server-side, don't trust the client" approach as the
-- rest of this schema (enforce_publisher_self_update etc.): business_id,
-- publisher_id and opened_by_role are computed by a trigger from the
-- referenced request/channel_request and the caller's own auth.uid(), not
-- taken from whatever the insert statement claims — so a business can't
-- open a dispute attached to a campaign that isn't theirs, and can't
-- pretend to be the publisher side of it.

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  channel_request_id uuid references public.channel_requests(id) on delete cascade,
  business_id uuid not null references auth.users(id) on delete cascade,
  publisher_id uuid not null references public.publishers(id) on delete cascade,
  opened_by_role text not null check (opened_by_role in ('business', 'publisher')),
  category text not null check (category in ('payment_issue', 'quality_issue', 'non_delivery', 'communication', 'other')),
  subject text not null,
  status text not null default 'open' check (status in ('open', 'awaiting_response', 'resolved', 'closed')),
  resolution_outcome text check (resolution_outcome in ('refund_business', 'release_to_publisher', 'partial', 'no_action', 'other')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint disputes_one_campaign_ref check (
    (request_id is not null and channel_request_id is null) or
    (request_id is null and channel_request_id is not null)
  )
);

create index disputes_business_id_idx on public.disputes(business_id);
create index disputes_publisher_id_idx on public.disputes(publisher_id);
create index disputes_status_idx on public.disputes(status);

create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('business', 'publisher', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index dispute_messages_dispute_id_idx on public.dispute_messages(dispute_id, created_at);

alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;

-- ── disputes RLS ─────────────────────────────────────────────────────────

create policy disputes_select_participant_or_admin
  on public.disputes for select
  using (
    business_id = auth.uid()
    or exists (select 1 from public.publishers where id = publisher_id and user_id = auth.uid())
    or public.is_admin()
  );

-- Loose on purpose (same shape as enforce_publisher_self_update's policy):
-- real validation happens in enforce_dispute_insert() below, which derives
-- business_id/publisher_id/opened_by_role itself and raises if the caller
-- isn't actually a participant in the referenced campaign.
create policy disputes_insert_authenticated
  on public.disputes for insert
  with check (auth.uid() is not null);

-- Only admin resolves a dispute (status/resolution). Participants act
-- through dispute_messages instead — this is deliberate: a ticketing system
-- where either side can unilaterally mark their own dispute "resolved"
-- isn't much of one.
create policy disputes_update_admin
  on public.disputes for update
  using (public.is_admin());

create or replace function public.enforce_dispute_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_publisher_id uuid;
begin
  if new.request_id is not null then
    select business_id, publisher_id into v_business_id, v_publisher_id
    from public.requests where id = new.request_id;
  else
    select business_id, creator_id into v_business_id, v_publisher_id
    from public.channel_requests where id = new.channel_request_id;
  end if;

  if v_business_id is null then
    raise exception 'That campaign could not be found.';
  end if;

  new.business_id := v_business_id;
  new.publisher_id := v_publisher_id;

  if auth.uid() = v_business_id then
    new.opened_by_role := 'business';
  elsif exists (select 1 from public.publishers where id = v_publisher_id and user_id = auth.uid()) then
    new.opened_by_role := 'publisher';
  elsif not public.is_admin() then
    raise exception 'You can only open a dispute on your own campaign.';
  end if;

  new.status := 'open';
  new.resolution_outcome := null;
  new.resolution_notes := null;
  new.closed_at := null;
  return new;
end;
$$;

drop trigger if exists trg_enforce_dispute_insert on public.disputes;
create trigger trg_enforce_dispute_insert
  before insert on public.disputes
  for each row execute function public.enforce_dispute_insert();

-- Admin sets status/resolution; touch updated_at, and stamp closed_at once,
-- the same "derive it, don't trust it" way as everywhere else here.
create or replace function public.enforce_dispute_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then
    new.closed_at := now();
  elsif new.status not in ('resolved', 'closed') then
    new.closed_at := null;
  end if;
  -- Everything about which campaign/parties this dispute belongs to is
  -- fixed at creation — admin can change status/resolution, not reassign it.
  new.request_id := old.request_id;
  new.channel_request_id := old.channel_request_id;
  new.business_id := old.business_id;
  new.publisher_id := old.publisher_id;
  new.opened_by_role := old.opened_by_role;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_enforce_dispute_update on public.disputes;
create trigger trg_enforce_dispute_update
  before update on public.disputes
  for each row execute function public.enforce_dispute_update();

-- ── dispute_messages RLS ─────────────────────────────────────────────────

create policy dispute_messages_select_participant_or_admin
  on public.dispute_messages for select
  using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (d.business_id = auth.uid() or exists (select 1 from public.publishers where id = d.publisher_id and user_id = auth.uid()) or public.is_admin())
    )
  );

create policy dispute_messages_insert_participant_or_admin
  on public.dispute_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (d.business_id = auth.uid() or exists (select 1 from public.publishers where id = d.publisher_id and user_id = auth.uid()) or public.is_admin())
    )
  );

-- Derives sender_role server-side (never trust a client-sent role), and
-- blocks new messages on a closed dispute — reopen it first (admin sets
-- status back) rather than letting a closed ticket keep accumulating
-- replies nobody's obligated to look at.
create or replace function public.enforce_dispute_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.disputes%rowtype;
begin
  select * into v_dispute from public.disputes where id = new.dispute_id;
  if not found then
    raise exception 'Dispute not found.';
  end if;
  if v_dispute.status = 'closed' then
    raise exception 'This dispute is closed.';
  end if;

  if public.is_admin() then
    new.sender_role := 'admin';
  elsif auth.uid() = v_dispute.business_id then
    new.sender_role := 'business';
  elsif exists (select 1 from public.publishers where id = v_dispute.publisher_id and user_id = auth.uid()) then
    new.sender_role := 'publisher';
  else
    raise exception 'You are not a participant in this dispute.';
  end if;

  -- Ticket state machine: a participant reply signals "needs admin
  -- attention"; an admin reply signals "waiting on the participants". A
  -- resolved dispute reopens automatically if either side has more to say.
  if new.sender_role = 'admin' then
    update public.disputes set status = 'awaiting_response', updated_at = now() where id = new.dispute_id and status <> 'closed';
  else
    update public.disputes set status = 'open', updated_at = now() where id = new.dispute_id and status <> 'closed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_dispute_message_insert on public.dispute_messages;
create trigger trg_enforce_dispute_message_insert
  before insert on public.dispute_messages
  for each row execute function public.enforce_dispute_message_insert();

-- ── notifications (reuses create_notification() from schema_phase23) ────

create or replace function public.notify_new_dispute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher_user_id uuid;
  v_publisher_name text;
  v_admin record;
begin
  select user_id, name into v_publisher_user_id, v_publisher_name from public.publishers where id = new.publisher_id;

  perform public.create_notification(
    case when new.opened_by_role = 'business' then v_publisher_user_id else new.business_id end,
    'new_dispute',
    'New dispute opened',
    format('A dispute was opened: "%s".', new.subject),
    '/dashboard'
  );
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.create_notification(
      v_admin.id, 'new_dispute',
      'New dispute opened',
      format('A dispute was opened on a %s campaign: "%s".', coalesce(v_publisher_name, 'a'), new.subject),
      '/admin'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_dispute on public.disputes;
create trigger trg_notify_new_dispute
  after insert on public.disputes
  for each row execute function public.notify_new_dispute();

create or replace function public.notify_dispute_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher_user_id uuid;
begin
  if new.status = old.status or new.status not in ('resolved', 'closed') then
    return new;
  end if;
  select user_id into v_publisher_user_id from public.publishers where id = new.publisher_id;
  perform public.create_notification(new.business_id, 'dispute_resolved', 'Dispute ' || new.status, coalesce(new.resolution_notes, 'An admin has updated this dispute.'), '/dashboard');
  perform public.create_notification(v_publisher_user_id, 'dispute_resolved', 'Dispute ' || new.status, coalesce(new.resolution_notes, 'An admin has updated this dispute.'), '/dashboard');
  return new;
end;
$$;

drop trigger if exists trg_notify_dispute_resolution on public.disputes;
create trigger trg_notify_dispute_resolution
  after update of status on public.disputes
  for each row execute function public.notify_dispute_resolution();

create or replace function public.notify_new_dispute_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.disputes%rowtype;
  v_publisher_user_id uuid;
  v_admin record;
begin
  select * into v_dispute from public.disputes where id = new.dispute_id;
  select user_id into v_publisher_user_id from public.publishers where id = v_dispute.publisher_id;

  if new.sender_role = 'admin' then
    perform public.create_notification(v_dispute.business_id, 'dispute_message', 'New reply on your dispute', new.body, '/dashboard');
    perform public.create_notification(v_publisher_user_id, 'dispute_message', 'New reply on your dispute', new.body, '/dashboard');
  else
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform public.create_notification(v_admin.id, 'dispute_message', 'New reply on a dispute', new.body, '/admin');
    end loop;
    -- Also let the other participant know, not just admin.
    if new.sender_role = 'business' then
      perform public.create_notification(v_publisher_user_id, 'dispute_message', 'New reply on your dispute', new.body, '/dashboard');
    else
      perform public.create_notification(v_dispute.business_id, 'dispute_message', 'New reply on your dispute', new.body, '/dashboard');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_dispute_message on public.dispute_messages;
create trigger trg_notify_new_dispute_message
  after insert on public.dispute_messages
  for each row execute function public.notify_new_dispute_message();
