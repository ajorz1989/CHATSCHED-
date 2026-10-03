-- ChatSched — Phase 112: "All platforms" package line on rate cards
-- Run once in the Supabase SQL editor, after phase111.
--
-- Businesses can now book a publisher's whole platform set as one package, so
-- a rate card line needs a way to say "this price covers every platform".
-- Adds 'All platforms' to the allowed values; existing rows are unaffected.

alter table public.publisher_rate_cards
  drop constraint if exists publisher_rate_cards_platform_check;

alter table public.publisher_rate_cards
  add constraint publisher_rate_cards_platform_check
  check (platform is null or platform in (
    'Facebook Page', 'Facebook Group', 'Instagram', 'TikTok',
    'WhatsApp Channel', 'X', 'LinkedIn', 'YouTube',
    'All platforms'
  ));
