-- ChatSched — Phase 90 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase89_atomic_opportunity_acceptance.sql.
-- (Renumbered from this project's original phase 81 — that slot was
-- independently taken by a different migration, schema_phase81_prevent_role_escalation.sql,
-- in the lineage this got merged into. Content unchanged from the original.)
--
-- Fixes: "claude to fix 2" item 15 — delete-account flow can erase
-- historical business/financial records.
--
-- ── The problem ──────────────────────────────────────────────────────────
-- supabase/functions/delete-account/index.ts calls auth.admin.deleteUser(),
-- which cascades through every `references auth.users(id) on delete
-- cascade` foreign key in the schema. That included payments.business_id,
-- requests.business_id, channel_requests.business_id, and
-- reviews.business_id — so a business account with a *completed, paid*
-- campaign could delete its own account and take the payment record, the
-- request record, and any review it left with it. That's a real accounting
-- and dispute-history problem: a publisher's income record for a booking
-- could vanish because the *other* party to the transaction deleted their
-- account, and a completed payment (the kind SARS' ~5-year recordkeeping
-- expectations are actually about) would disappear with no trace it ever
-- happened.
--
-- ── What this migration does, and doesn't, decide ──────────────────────
-- This implements the mechanism the finding asked for — anonymize/retain
-- completed financial and campaign records instead of cascading them — for
-- the four tables where it matters: payments, requests, channel_requests,
-- reviews. It does NOT decide (because that's a product/legal/accounting
-- call, not an engineering one):
--   • how long these now-orphaned rows should be kept before a separate,
--     scheduled purge job (SARS' general default is ~5 years for financial
--     records; that number is not verified against ChatSched's actual
--     obligations here and needs real sign-off before anyone relies on it
--     or builds a purge job against it);
--   • whether `requests.campaign_message` / `channel_requests.
--     advertising_method` free text on a completed record needs its own
--     scrub for anything the business typed that identifies them
--     personally. This migration does NOT touch those columns — only the
--     foreign key identity linking the row back to a specific auth user.
--
-- ── Why this is safe to apply unconditionally, not just to "completed" rows ──
-- supabase/functions/delete-account/index.ts already refuses to delete an
-- account (409, with a list of blockers) while it has anything in
-- requests/channel_requests/payments/disputes in a non-terminal status. So
-- by the time a deletion actually reaches auth.admin.deleteUser(), every
-- requests/channel_requests/payments/reviews row still attached to that
-- account is already in a terminal state (completed/declined/paid/failed/
-- cancelled) — there is no in-progress row left for this change to
-- accidentally orphan mid-campaign.
--
-- That said, this FK change applies to ALL deletions of these tables'
-- owning user, including ones triggered outside that Edge Function (e.g.
-- an admin deleting a user by hand from the Supabase dashboard, which
-- bypasses the blockers check entirely). In that case this change is
-- strictly safer than the previous behaviour: an in-progress request or
-- payment now survives, orphaned but still investigable, instead of
-- silently vanishing.
--
-- ── What "anonymize" means here, concretely ─────────────────────────────
-- Deleting the auth.users row already deletes the matching `profiles` row
-- (profiles.id → auth.users(id) on delete cascade, unchanged) — so the
-- business's name, company name, and phone number are gone, which is the
-- actual POPIA-erasure part. What this migration changes is only that
-- payments/requests/channel_requests/reviews no longer go with it: their
-- business_id becomes NULL (an orphaned, still-real record with amounts,
-- statuses, dates, and publisher-side identity intact) instead of the row
-- itself being deleted.
--
-- ── RLS impact (checked, none) ───────────────────────────────────────────
-- payments_select_own_or_admin, requests_select_own_or_admin, and
-- channel_requests_select_participant all gate business-side access on
-- `auth.uid() = business_id` — which was already unreachable post-deletion
-- (the business's own auth uid no longer exists/can't authenticate), so
-- nulling business_id doesn't take away access anyone still had. Publisher-
-- side access (requests_select_own_publisher, channel_requests_select_
-- participant's creator branch, reviews_select_public) is keyed off
-- publisher_id/creator_id, not business_id, so it's completely unaffected —
-- a creator keeps seeing their own income/reputation history either way.
-- Only admins can see an orphaned row directly now, which is the intended
-- outcome for a retained accounting record.

alter table public.payments
  alter column business_id drop not null,
  drop constraint payments_business_id_fkey,
  add constraint payments_business_id_fkey
    foreign key (business_id) references auth.users(id) on delete set null;

alter table public.requests
  alter column business_id drop not null,
  drop constraint requests_business_id_fkey,
  add constraint requests_business_id_fkey
    foreign key (business_id) references auth.users(id) on delete set null;

alter table public.channel_requests
  alter column business_id drop not null,
  drop constraint channel_requests_business_id_fkey,
  add constraint channel_requests_business_id_fkey
    foreign key (business_id) references auth.users(id) on delete set null;

alter table public.reviews
  alter column business_id drop not null,
  drop constraint reviews_business_id_fkey,
  add constraint reviews_business_id_fkey
    foreign key (business_id) references auth.users(id) on delete set null;

comment on column public.payments.business_id is
  'The business that made this payment. Null means the business later deleted their account (POPIA erasure) — the payment record itself is retained for accounting/dispute history; see schema_phase81_delete_account_retention.sql.';
comment on column public.requests.business_id is
  'The business that made this request. Null means the business later deleted their account — the request record is retained (it was already in a terminal status, completed or declined, at deletion time); see schema_phase81_delete_account_retention.sql.';
comment on column public.channel_requests.business_id is
  'The business side of this channel booking. Null means the business later deleted their account — the booking record is retained (it was already in a terminal status at deletion time); see schema_phase81_delete_account_retention.sql.';
comment on column public.reviews.business_id is
  'The business that left this review. Null means the business later deleted their account — the review (and the publisher''s reputation history it contributes to) is retained; see schema_phase81_delete_account_retention.sql.';
