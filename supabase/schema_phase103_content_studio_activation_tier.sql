-- ChatSched — Phase 103 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase102_public_home_metrics.sql.
--
-- Adds a free AI Content Studio tier unlocked by the ChatSched Business
-- once-off R399 activation fee (business_subscriptions.status = 'active',
-- schema_phase86), separate from and additive to the existing R99/month
-- content_studio_subscriptions product (schema_phase22).
--
-- IMPORTANT — reconciling this against the brief that requested it: the
-- brief described a single boolean `activation_fee_paid` gating Content
-- Studio, with a flat "15 calls/month" limit. That field doesn't exist —
-- the real once-off activation fee is tracked on business_subscriptions
-- (schema_phase86), and Content Studio is currently its OWN separate
-- recurring R99/month product (content_studio_subscriptions,
-- schema_phase22) with its own DAILY_LIMIT=15 / MONTHLY_LIMIT=150 already
-- live in production. Collapsing those into one gate would either (a)
-- silently delete the R99/month recurring product, or (b) require
-- activation-paying businesses to ALSO pay R99/month just to use a tool
-- the brief said activation should unlock. Neither seemed like a call to
-- make silently, so instead this is genuinely additive: activation alone
-- now unlocks a free, lower tier (15 generations/month — matching the
-- brief's number exactly); the existing paid subscription remains and
-- still gets the better model + higher limits. See
-- content-studio-generate/index.ts for the tier logic and
-- CHATSCHED_ACTIVATION_WORKFLOW_DELIVERY.md for the full writeup of this
-- decision, flagged for a product call rather than assumed.
--
-- No new table: content_studio_generations (schema_phase22) already logs
-- every generation per business_id/created_at, which is all a monthly
-- count needs — a second counter (e.g. monthly_ai_calls on profiles)
-- would be a second source of truth for the same fact and would drift,
-- exactly the kind of duplicated-number bug schema_phase99 found and
-- fixed for the commission rate. One log, two limits applied to it
-- depending on which tier earned the call.

alter table public.content_studio_generations
  add column if not exists tier text not null default 'subscription'
    check (tier in ('free_activation', 'subscription'));

comment on column public.content_studio_generations.tier is
  'Which product this generation was billed against: free_activation (unlocked by the once-off Business activation fee, 15/month, cheaper model) or subscription (the R99/month Content Studio product, 15/day + 150/month, upgraded model). Existing rows before this migration were all under the subscription product, hence the default.';

create index if not exists content_studio_generations_business_tier_created_idx
  on public.content_studio_generations (business_id, tier, created_at desc);

-- No RLS changes needed: content_studio_generations' existing
-- schema_phase22 policy (business can select its own rows, all writes
-- service-role-only from content-studio-generate) already covers the new
-- column — it's just another value on an existing row.
