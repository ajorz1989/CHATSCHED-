-- ChatSched — Phase 53 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase52_community.sql.
--
-- Adds content approval to the Request Feature workflow (channel_requests —
-- influencer/website/podcast/radio). Previously, once payment was
-- confirmed a creator could mark a placement 'live' with nothing else in
-- between — no visibility for the business into what's actually about to
-- be posted on their behalf. This inserts a real approval gate between
-- 'paid' and 'live':
--
--   1. Business uploads a creative brief (image, video, caption, CTA,
--      link) once payment is confirmed.
--   2. Creator sees it awaiting their draft, prepares one (their own
--      image/video/caption built from the brief) and submits it.
--   3. Business reviews the draft: approve, or request changes.
--   4. Changes loop back to the creator; approval lets the creator
--      publish, which is the only path left open on channel_requests
--      from 'paid' to 'live' — see the extended state-machine function
--      below.
--
-- One content_approvals row per channel_request (1:1, enforced by the
-- unique constraint on channel_request_id) — a placement doesn't need a
-- history of multiple content proposals for this phase, just the current
-- one and how it got there.

-- ── content_approvals ────────────────────────────────────────────────────
create table public.content_approvals (
  id uuid primary key default gen_random_uuid(),
  channel_request_id uuid not null unique references public.channel_requests(id) on delete cascade,
  status text not null default 'awaiting_draft' check (status in (
    'awaiting_draft',     -- business has submitted the brief; creator hasn't drafted yet
    'awaiting_review',    -- creator submitted a draft; business must decide
    'changes_requested',  -- business asked for changes; creator must revise
    'approved',           -- business approved; creator may publish
    'published'           -- creator published — this is what unlocks channel_requests.live
  )),

  -- Business's creative brief. File paths point into the private
  -- content-approval-assets bucket below, keyed by this row's id — set via
  -- a follow-up update once the row exists and the files are uploaded (the
  -- bucket path needs this row's id as its folder), same two-step pattern
  -- ProofSubmissionCard/uploadProofScreenshot already uses.
  brief_image_path text,
  brief_video_path text,
  brief_caption text,
  brief_cta_label text,
  brief_link text,
  submitted_at timestamptz not null default now(),

  -- Creator's draft, prepared from the brief above.
  draft_image_path text,
  draft_video_path text,
  draft_caption text,
  draft_notes text,
  draft_submitted_at timestamptz,

  -- Business's decision on the current draft.
  change_request_notes text,
  reviewed_at timestamptz,
  approved_at timestamptz,

  -- Set once the creator actually publishes (moves channel_requests to 'live').
  published_at timestamptz
);

create index content_approvals_channel_request_id_idx on public.content_approvals(channel_request_id);
create index content_approvals_status_idx on public.content_approvals(status);

alter table public.content_approvals enable row level security;

-- Select: the business or creator on the linked channel_request, or admin —
-- same participant shape as channel_requests' own select policy.
create policy content_approvals_select_participant on public.content_approvals
  for select using (
    exists (
      select 1 from public.channel_requests cr
      where cr.id = channel_request_id
      and (cr.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- Insert: only the business on the request, only once payment is confirmed
-- (status = 'paid') — there's nothing to approve before the creator is
-- even paid for the placement — and always starting at 'awaiting_draft'.
create policy content_approvals_insert_business on public.content_approvals
  for insert with check (
    status = 'awaiting_draft'
    and exists (
      select 1 from public.channel_requests cr
      where cr.id = channel_request_id and cr.business_id = auth.uid() and cr.status = 'paid'
    )
  );

-- Update: permissive on which rows a participant can touch — the trigger
-- below is the real gate on which status transitions are legal, same
-- "policy stays permissive, trigger enforces the state machine" split used
-- throughout this schema (enforce_channel_request_transition, etc).
create policy content_approvals_update_participant on public.content_approvals
  for update using (
    exists (
      select 1 from public.channel_requests cr
      where cr.id = channel_request_id
      and (cr.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- The state machine. Only fires special-case logic when status actually
-- changes — updating a file path or brief/draft text alongside an
-- unchanged status passes straight through untouched, which is what lets
-- the business fill in brief_image_path/brief_video_path after the row
-- already exists, and lets a creator save draft fields before formally
-- submitting.
create or replace function public.enforce_content_approval_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_creator_id uuid;
  is_creator boolean;
  is_business boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  -- A null auth.uid() means a trusted server-side context, not a live user
  -- session subject to this guard — same allowance used across this schema.
  if auth.uid() is null then
    return new;
  end if;

  select business_id, creator_id into v_business_id, v_creator_id
  from public.channel_requests where id = old.channel_request_id;

  is_business := (auth.uid() = v_business_id);
  is_creator := exists (
    select 1 from public.publishers p where p.id = v_creator_id and p.user_id = auth.uid()
  );

  if public.is_admin() then
    raise exception 'Content approval status is between the business and creator, not admin-moderated.';
  end if;

  -- Creator submits (or resubmits, after changes were requested) a draft.
  if is_creator and old.status in ('awaiting_draft', 'changes_requested') and new.status = 'awaiting_review' then
    if coalesce(trim(new.draft_caption), '') = '' and new.draft_image_path is null and new.draft_video_path is null then
      raise exception 'Add a caption, image or video before submitting your draft.';
    end if;
    new.draft_submitted_at := now();
    -- Resubmitting clears the previous change request — it's been addressed.
    if old.status = 'changes_requested' then
      new.change_request_notes := null;
    end if;
    return new;
  end if;

  -- Business requests changes — needs an actual note, or the creator has
  -- nothing to act on.
  if is_business and old.status = 'awaiting_review' and new.status = 'changes_requested' then
    if coalesce(trim(new.change_request_notes), '') = '' then
      raise exception 'Let the creator know what to change.';
    end if;
    new.reviewed_at := now();
    return new;
  end if;

  -- Business approves the draft.
  if is_business and old.status = 'awaiting_review' and new.status = 'approved' then
    new.reviewed_at := now();
    new.approved_at := now();
    return new;
  end if;

  -- Creator publishes — this is what src/lib/contentApproval.ts pairs with
  -- a channel_requests paid->live update; see the extended transition
  -- function below for the corresponding gate on that side.
  if is_creator and old.status = 'approved' and new.status = 'published' then
    new.published_at := now();
    return new;
  end if;

  raise exception 'That status change is not allowed.';
end;
$$;

drop trigger if exists trg_enforce_content_approval_transition on public.content_approvals;
create trigger trg_enforce_content_approval_transition
  before update on public.content_approvals
  for each row execute function public.enforce_content_approval_transition();

-- ── Gate channel_requests' paid -> live transition on approved content ──
-- Full CREATE OR REPLACE of the same function extended by schema_phase35
-- (counter-offer) — everything else copied unchanged; only the
-- is_creator/paid->live branch gains a real precondition instead of being
-- unconditional.
create or replace function public.enforce_channel_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_creator boolean;
  is_business boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  is_business := (auth.uid() = old.business_id);
  is_creator := exists (
    select 1 from public.publishers p
    where p.id = old.creator_id and p.user_id = auth.uid()
  );

  if public.is_admin() then
    if old.status in ('declined', 'cancelled', 'completed') then
      raise exception 'This request is already closed.';
    end if;
    if new.status = 'paid' and old.status = 'payment_submitted' then
      new.paid_at := now();
      return new;
    end if;
    if new.status = 'completed' and old.status = 'live' then
      new.completed_at := now();
      return new;
    end if;
    if new.status in ('declined', 'cancelled') then
      return new; -- admin closing an overdue/unresponsive request (pending OR countered)
    end if;
    raise exception 'That status change is not allowed for an admin.';
  end if;

  if is_creator and old.status = 'pending' and new.status in ('awaiting_payment', 'declined') then
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'countered' then
    if new.counter_amount is null or new.counter_amount <= 0 then
      raise exception 'A counter-offer needs a real amount.';
    end if;
    new.countered_at := now();
    return new;
  end if;

  if is_business and old.status = 'countered' and new.status = 'awaiting_payment' then
    new.responded_at := now();
    new.proposed_amount := old.counter_amount;
    return new;
  end if;

  if is_business and old.status = 'countered' and new.status = 'cancelled' then
    return new;
  end if;

  -- NEW (phase 54): a placement can only go live once its content has been
  -- through approval — a content_approvals row exists and is 'approved' or
  -- already 'published' (the client moves content_approvals to 'published'
  -- and channel_requests to 'live' as two sequential calls from the same
  -- action — see publishContent() in contentApproval.ts — so by the time
  -- this second call lands, 'published' is the more common case).
  if is_creator and old.status = 'paid' and new.status = 'live' then
    if not exists (
      select 1 from public.content_approvals ca
      where ca.channel_request_id = old.id and ca.status in ('approved', 'published')
    ) then
      raise exception 'Content must be approved before this can go live — see the Content Approval panel.';
    end if;
    new.live_at := now();
    return new;
  end if;

  if is_business and old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;

  if is_business and old.status = 'awaiting_payment' and new.status = 'payment_submitted' then
    new.payment_submitted_at := now();
    return new;
  end if;

  raise exception 'That status change is not allowed.';
end;
$$;

-- ── content-approval-assets storage bucket ──────────────────────────────
-- Private (like campaign-proof-screenshots, not public like
-- portfolio-images) — a campaign's draft creative has no reason to be
-- publicly listable before it's actually posted, and the business's own
-- brief assets are internal to this one deal. Images and short video, with
-- a larger size cap than the image-only buckets elsewhere in this schema.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-approval-assets', 'content-approval-assets', false,
  52428800, -- 50MB — enough for a short vertical video, still bounded
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = false;

-- Path convention: {content_approval_id}/{filename} — same
-- keyed-by-the-shared-record convention as campaign-proof-screenshots,
-- since both the business and the creator need to read files the other
-- side uploaded, not just their own.
create policy content_approval_assets_select_participant on storage.objects
  for select using (
    bucket_id = 'content-approval-assets'
    and exists (
      select 1 from public.content_approvals ca
      join public.channel_requests cr on cr.id = ca.channel_request_id
      where ca.id = (storage.foldername(name))[1]::uuid
      and (cr.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

create policy content_approval_assets_insert_business on storage.objects
  for insert with check (
    bucket_id = 'content-approval-assets'
    and exists (
      select 1 from public.content_approvals ca
      join public.channel_requests cr on cr.id = ca.channel_request_id
      where ca.id = (storage.foldername(name))[1]::uuid and cr.business_id = auth.uid()
    )
  );

create policy content_approval_assets_insert_creator on storage.objects
  for insert with check (
    bucket_id = 'content-approval-assets'
    -- Same bug, same fix as campaign_proof_screenshots_insert_creator
    -- (schema_phase40) — confirmed there against real Postgres, not
    -- assumed to apply here too. `publishers` has its own `name` column,
    -- so joining it into the same subquery scope as the unqualified
    -- `name` reference below makes that reference resolve to
    -- publishers.name instead of the outer storage.objects row, silently
    -- breaking every creator upload against this policy. Fixed the same
    -- way: keep `name` in a scope with nothing to shadow it (content_approvals
    -- and channel_requests, neither of which has a `name` column), push
    -- the creator-ownership check into its own nested EXISTS.
    and exists (
      select 1 from public.content_approvals ca
      join public.channel_requests cr on cr.id = ca.channel_request_id
      where ca.id = (storage.foldername(name))[1]::uuid
      and exists (
        select 1 from public.publishers p where p.id = cr.creator_id and p.user_id = auth.uid()
      )
    )
  );

-- No update/delete policy for anyone, including admins — same append-only
-- posture as campaign-proof-screenshots; a replacement asset is a new
-- upload with a new path, not an edit of the old one.

-- ── Notifications (mirrors schema_phase23's pattern exactly) ───────────
create or replace function public.notify_content_approval_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_creator_user_id uuid;
  v_creator_name text;
begin
  if new.status = old.status then
    return new;
  end if;
  select cr.business_id, p.user_id, p.name
    into v_business_id, v_creator_user_id, v_creator_name
  from public.channel_requests cr
  join public.publishers p on p.id = cr.creator_id
  where cr.id = new.channel_request_id;

  if new.status = 'awaiting_review' then
    perform public.create_notification(
      v_business_id, 'content_approval_status_change',
      format('%s submitted a draft for your review', coalesce(v_creator_name, 'The creator')),
      'Approve it or request changes in your dashboard.',
      '/dashboard'
    );
  elsif new.status = 'changes_requested' then
    perform public.create_notification(
      v_creator_user_id, 'content_approval_status_change',
      'Changes requested on your draft',
      'The business asked for changes before this can go live.',
      '/dashboard'
    );
  elsif new.status = 'approved' then
    perform public.create_notification(
      v_creator_user_id, 'content_approval_status_change',
      'Your content was approved',
      'You can publish it whenever you''re ready.',
      '/dashboard'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_content_approval_status_change on public.content_approvals;
create trigger trg_notify_content_approval_status_change
  after update of status on public.content_approvals
  for each row execute function public.notify_content_approval_status_change();

create or replace function public.notify_new_content_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_user_id uuid;
begin
  select p.user_id into v_creator_user_id
  from public.channel_requests cr
  join public.publishers p on p.id = cr.creator_id
  where cr.id = new.channel_request_id;

  perform public.create_notification(
    v_creator_user_id, 'content_approval_status_change',
    'Content awaiting approval',
    'The business uploaded campaign content — prepare your draft in your dashboard.',
    '/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_content_approval on public.content_approvals;
create trigger trg_notify_new_content_approval
  after insert on public.content_approvals
  for each row execute function public.notify_new_content_approval();
