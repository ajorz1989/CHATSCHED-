-- ChatSched — Phase 54 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase53_content_approval.sql.
--
-- Structured deliverables. Previously a campaign was just one freeform
-- message ("Post on Instagram") with a single amount attached — no way to
-- say a booking is actually "1 Instagram Reel + 1 Instagram Story + 1
-- tracking link + 1 promo code, over a 7-day run", and no way to track
-- each of those pieces separately. This adds a deliverables table: one row
-- per promised item, each with its own lifecycle independent of the
-- others (the Reel can be published while the Story is still pending).
--
-- Deliberately separate from content_approvals (schema_phase53) rather
-- than merging into it — content_approvals is the single creative
-- brief/draft/approve/publish pass for the whole campaign; a deliverable
-- is a line item in what was promised, which may or may not go through
-- that same creative review depending on the channel. Keeping them
-- separate means adding deliverables doesn't require re-plumbing the
-- content approval state machine that already shipped.
--
-- Works for both flows (requests and channel_requests), same
-- exactly-one-parent convention used elsewhere in this schema.
--
-- ── State machine (exactly the 5 states asked for, no more) ────────────
--   pending    — defined by the business, nothing done yet
--   submitted  — creator submitted it (a link/reference to the actual
--                piece of content), awaiting business review
--   approved   — business approved it
--   published  — creator confirms it's actually live
--   verified   — ChatSched (admin) confirmed it — same "admin has final
--                say on verification" precedent as campaign_proof
--                (schema_phase39_compliance.sql's review_campaign_proof)
--
-- A business sending a submitted deliverable back for changes returns it
-- to 'pending' rather than introducing a sixth status — the 5 states
-- above are the complete set, deliberately matching what was asked for.

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  channel_request_id uuid references public.channel_requests(id) on delete cascade,
  request_id uuid references public.requests(id) on delete cascade,
  check (
    (channel_request_id is not null and request_id is null)
    or (channel_request_id is null and request_id is not null)
  ),

  label text not null,                 -- e.g. "Instagram Reel", "Promo code"
  quantity integer not null default 1 check (quantity > 0),
  notes text,                          -- business's spec for this item — e.g. a promo code's value, a link's destination, required hashtags
  sort_order integer not null default 0,

  status text not null default 'pending' check (status in (
    'pending', 'submitted', 'approved', 'published', 'verified'
  )),

  submission_url text,                 -- creator's link/reference for this specific piece
  submission_notes text,
  submitted_at timestamptz,

  business_notes text,                 -- set when a business sends a submission back to 'pending'
  approved_at timestamptz,

  published_at timestamptz,

  verified_at timestamptz,
  verified_by uuid references auth.users(id),

  created_at timestamptz not null default now()
);

create index deliverables_channel_request_id_idx on public.deliverables(channel_request_id);
create index deliverables_request_id_idx on public.deliverables(request_id);
create index deliverables_status_idx on public.deliverables(status);

alter table public.deliverables enable row level security;

-- Select: participant on the linked campaign (either flow), or admin.
create policy deliverables_select_participant on public.deliverables
  for select using (
    exists (
      select 1 from public.channel_requests cr
      where cr.id = channel_request_id
      and (cr.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
    )
    or exists (
      select 1 from public.requests r
      where r.id = request_id
      and (r.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = r.publisher_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- Insert: the business on the campaign, while it's still an active
-- engagement — not on something already declined/cancelled/completed,
-- where adding deliverables would be meaningless.
create policy deliverables_insert_business on public.deliverables
  for insert with check (
    status = 'pending'
    and (
      exists (
        select 1 from public.channel_requests cr
        where cr.id = channel_request_id and cr.business_id = auth.uid()
        and cr.status not in ('declined', 'cancelled', 'completed')
      )
      or exists (
        select 1 from public.requests r
        where r.id = request_id and r.business_id = auth.uid()
        and r.status not in ('declined', 'completed')
      )
    )
  );

-- Update: permissive on which rows a participant can touch — the trigger
-- below is the real gate on which status transitions are legal, same
-- split used throughout this schema.
create policy deliverables_update_participant on public.deliverables
  for update using (
    exists (
      select 1 from public.channel_requests cr
      where cr.id = channel_request_id
      and (cr.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
    )
    or exists (
      select 1 from public.requests r
      where r.id = request_id
      and (r.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = r.publisher_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- Delete: the business, and only while nothing has happened yet — a
-- deliverable that's been submitted/approved/published/verified is a
-- record of real activity, not something to quietly remove.
create policy deliverables_delete_business_pending on public.deliverables
  for delete using (
    status = 'pending'
    and (
      exists (select 1 from public.channel_requests cr where cr.id = channel_request_id and cr.business_id = auth.uid())
      or exists (select 1 from public.requests r where r.id = request_id and r.business_id = auth.uid())
    )
  );

create or replace function public.enforce_deliverable_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_creator_publisher_id uuid;
  is_creator boolean;
  is_business boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if auth.uid() is null then
    return new; -- trusted server-side context, not a live user session
  end if;

  if old.channel_request_id is not null then
    select business_id, creator_id into v_business_id, v_creator_publisher_id
    from public.channel_requests where id = old.channel_request_id;
  else
    select business_id, publisher_id into v_business_id, v_creator_publisher_id
    from public.requests where id = old.request_id;
  end if;

  is_business := (auth.uid() = v_business_id);
  is_creator := exists (
    select 1 from public.publishers p where p.id = v_creator_publisher_id and p.user_id = auth.uid()
  );

  -- Creator submits (or resubmits, after being sent back to pending).
  if is_creator and old.status = 'pending' and new.status = 'submitted' then
    if coalesce(trim(new.submission_url), '') = '' then
      raise exception 'Add a link before submitting this deliverable.';
    end if;
    new.submitted_at := now();
    return new;
  end if;

  -- Business sends it back for changes.
  if is_business and old.status = 'submitted' and new.status = 'pending' then
    if coalesce(trim(new.business_notes), '') = '' then
      raise exception 'Let the creator know what to change.';
    end if;
    return new;
  end if;

  -- Business approves.
  if is_business and old.status = 'submitted' and new.status = 'approved' then
    new.approved_at := now();
    return new;
  end if;

  -- Creator confirms it's live.
  if is_creator and old.status = 'approved' and new.status = 'published' then
    new.published_at := now();
    return new;
  end if;

  -- Admin verifies — same final-say precedent as review_campaign_proof.
  if public.is_admin() and old.status = 'published' and new.status = 'verified' then
    new.verified_at := now();
    new.verified_by := auth.uid();
    perform public.log_admin_action('deliverable_verified', 'deliverables', old.id, null);
    return new;
  end if;

  raise exception 'That status change is not allowed.';
end;
$$;

drop trigger if exists trg_enforce_deliverable_transition on public.deliverables;
create trigger trg_enforce_deliverable_transition
  before update on public.deliverables
  for each row execute function public.enforce_deliverable_transition();

-- ── Notifications (mirrors the existing per-status-change pattern) ─────
create or replace function public.notify_deliverable_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_creator_user_id uuid;
begin
  if new.status = old.status then
    return new;
  end if;

  if old.channel_request_id is not null then
    select cr.business_id, p.user_id into v_business_id, v_creator_user_id
    from public.channel_requests cr join public.publishers p on p.id = cr.creator_id
    where cr.id = old.channel_request_id;
  else
    select r.business_id, p.user_id into v_business_id, v_creator_user_id
    from public.requests r join public.publishers p on p.id = r.publisher_id
    where r.id = old.request_id;
  end if;

  if new.status = 'submitted' then
    perform public.create_notification(v_business_id, 'deliverable_status_change', format('"%s" submitted', new.label), 'Review it in your campaign workspace.', '/campaigns/' || coalesce(old.channel_request_id, old.request_id));
  elsif new.status = 'pending' and old.status = 'submitted' then
    perform public.create_notification(v_creator_user_id, 'deliverable_status_change', format('Changes requested on "%s"', new.label), coalesce(new.business_notes, ''), '/campaigns/' || coalesce(old.channel_request_id, old.request_id));
  elsif new.status = 'approved' then
    perform public.create_notification(v_creator_user_id, 'deliverable_status_change', format('"%s" approved', new.label), 'You can publish it whenever it''s live.', '/campaigns/' || coalesce(old.channel_request_id, old.request_id));
  elsif new.status = 'published' then
    perform public.create_notification(v_business_id, 'deliverable_status_change', format('"%s" is live', new.label), 'ChatSched will verify it shortly.', '/campaigns/' || coalesce(old.channel_request_id, old.request_id));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_deliverable_status_change on public.deliverables;
create trigger trg_notify_deliverable_status_change
  after update of status on public.deliverables
  for each row execute function public.notify_deliverable_status_change();

-- ── Campaign duration ────────────────────────────────────────────────────
-- "Campaign duration: 7 days" from the brief — a simple nullable duration
-- on the channel_request itself (the flow deliverables are wired into).
-- Not added to `requests` (the older social-media/PayFast flow): that
-- table only allows admin-driven updates today (requests_update_admin —
-- see schema.sql), so a business-editable field there would need a new
-- RPC rather than a plain column, which is a bigger change than this
-- phase's scope. channel_requests' own update policy is already
-- participant-permissive with the trigger as the real gate (see
-- schema_phase17_channel_marketplace.sql), and the trigger only
-- intervenes on status changes, so a business can set this alongside an
-- unchanged status exactly like content_approvals' brief fields.
alter table public.channel_requests add column if not exists duration_days integer check (duration_days is null or duration_days > 0);
