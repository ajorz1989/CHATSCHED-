-- ChatSched — Phase 73 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase72_subscription_grace_period.sql.
--
-- Renumbered from 72 to 73 after a real collision with that migration's
-- own claim on 72 — this was originally written against a base that
-- didn't yet have PHASE23's grace-period work. Same call schema_phase71
-- itself made against schema_phase70 for the identical reason, per its
-- own header — one more instance of the parallel-session numbering
-- collision this repo's audits keep flagging, resolving the same way.
--
-- Fixes a real regression in schema_phase71, not a design choice.
--
-- ── What actually happened ──────────────────────────────────────────────
-- schema_phase71's own header says it "supersedes
-- enforce_channel_request_transition() (schema_phase17)... identical to
-- that version except for the one added check on the creator-accept
-- branch." That's the bug: by the time phase71 was written, the real,
-- live definition of this function was schema_phase53's — which had
-- already picked up two features phase17 never had:
--
--   1. schema_phase35's counter-offer state machine (pending -> countered,
--      countered -> awaiting_payment, countered -> cancelled).
--   2. schema_phase53/54's content-approval gate on going live (paid ->
--      live required an approved content_approvals row).
--
-- `create or replace function` replaces the entire body, not just the
-- lines that changed. Building phase71 off phase17 instead of phase53
-- silently deleted both features rather than gating or extending them.
-- Confirmed by a direct diff of the two function bodies, not assumed:
-- everything phase71 has is a strict subset of phase53's, minus a
-- subscription check phase71 legitimately added.
--
-- This was flagged in PHASE18_PROACTIVE_SUBSCRIPTION_GATE_DELIVERY.md as
-- "the counter-offer path... isn't gated," read (by that report and
-- everything downstream of it, including this session) as a deliberate
-- design choice. It wasn't a choice at all — the path doesn't gate
-- because it doesn't exist anymore. The frontend was never updated to
-- match: PublisherDashboardView.tsx still fires
-- `.update({ status: 'countered', ... })`, ChannelCampaignCard.tsx still
-- has a business-side "Accept counter" button doing
-- `countered -> awaiting_payment`. Every one of those calls has been
-- silently hitting this function's final `raise exception 'That status
-- change is not allowed.'` since phase71 shipped.
--
-- ── The fix ──────────────────────────────────────────────────────────
-- Full `create or replace`, built from schema_phase53's complete body
-- (the last correct version) with phase71's subscription check merged
-- into the accept branch — not phase71's body with pieces added back,
-- so there's no risk of missing a third silently-dropped feature the
-- same way phase71 missed these two. Confirmed by re-reading
-- schema_phase53's full function directly while writing this, not from
-- memory of what it "should" contain.

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

  -- Restored from schema_phase53, with schema_phase71's subscription
  -- check merged in — this is the one branch phase71 actually meant to
  -- change. Declining stays ungated, same reasoning phase71 gave: a
  -- lapsed subscription shouldn't trap a creator who wants to say no.
  if is_creator and old.status = 'pending' and new.status = 'awaiting_payment' then
    if not exists (
      select 1 from public.publisher_subscriptions
      where publisher_id = auth.uid() and status in ('active', 'grace_period')
    ) then
      raise exception 'An active Publisher Network subscription is required to accept new requests.';
    end if;
    new.responded_at := now();
    return new;
  end if;

  if is_creator and old.status = 'pending' and new.status = 'declined' then
    new.responded_at := now();
    return new;
  end if;

  -- RESTORED (was silently dropped by schema_phase71): creator counters
  -- instead of approving/declining outright. Deliberately NOT subject to
  -- the subscription check above — same reasoning as decline, and same
  -- reasoning phase71 itself gave for exempting decline: countering is a
  -- form of not-quite-accepting, not a new engagement being started.
  if is_creator and old.status = 'pending' and new.status = 'countered' then
    if new.counter_amount is null or new.counter_amount <= 0 then
      raise exception 'A counter-offer needs a real amount.';
    end if;
    new.countered_at := now();
    return new;
  end if;

  -- RESTORED (was silently dropped by schema_phase71): business accepts
  -- the counter.
  if is_business and old.status = 'countered' and new.status = 'awaiting_payment' then
    new.responded_at := now();
    new.proposed_amount := old.counter_amount;
    return new;
  end if;

  -- RESTORED (was silently dropped by schema_phase71): business declines
  -- the counter.
  if is_business and old.status = 'countered' and new.status = 'cancelled' then
    return new;
  end if;

  -- RESTORED (was silently dropped by schema_phase71): a placement can
  -- only go live once its content has actually been through approval.
  -- Without this, phase71 left going-live completely ungated for content
  -- compliance — not a subscription gap, a real "anything can go live
  -- with unapproved content" hole.
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

-- Trigger itself is unchanged (same function name, same table) — no need
-- to drop/recreate it, only the function body changed above, same as
-- every prior migration that's touched this function.
