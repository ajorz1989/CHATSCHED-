-- ChatSched — Phase 111: per-platform rate cards
-- Run once in the Supabase SQL editor, after phase110.
--
-- Rate card line items had a label and a price but no platform, so a
-- "Story Post — R500" could mean Instagram or WhatsApp. This adds the
-- platform each price is for. Nullable on purpose: existing items keep
-- working and display as "Any platform" until the publisher re-adds them.
-- Uses the same 8 values as the Platform type in src/lib/types.ts.
--
-- No change to publishers / publishers_public / enforce_publisher_self_update():
-- this only touches publisher_rate_cards, which has its own owner-or-admin
-- RLS policy (phase 38).

alter table public.publisher_rate_cards
  add column if not exists platform text;

alter table public.publisher_rate_cards
  drop constraint if exists publisher_rate_cards_platform_check;

alter table public.publisher_rate_cards
  add constraint publisher_rate_cards_platform_check
  check (platform is null or platform in (
    'Facebook Page', 'Facebook Group', 'Instagram', 'TikTok',
    'WhatsApp Channel', 'X', 'LinkedIn', 'YouTube'
  ));
