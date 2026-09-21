-- Phase 107: Current channel launch state
-- All registered channels are live except:
--   transport = Minibus Taxi & Transport Media
--   informal-retail = Spaza Shops & Township Traders
-- Historical migrations are intentionally left unchanged; this migration
-- establishes the current operational state going forward.

update public.channels
set active = true
where slug in (
  'social-media',
  'influencer',
  'podcast',
  'website',
  'radio',
  'sports',
  'events',
  'community',
  'associations',
  'restaurants',
  'in-venue-screens'
);

update public.channels
set active = false
where slug in ('transport', 'informal-retail');
