-- ChatSched — seed data
-- Optional, but recommended: run this after schema.sql so the site isn't
-- empty on first load.
--
-- Trimmed to Western Cape only (Cape Town / Stellenbosch) so this demo
-- data doesn't contradict Home/About/How It Works, which all specifically
-- say "piloting in Cape Town." The original prototype's seed set included
-- four more publishers spread across Gauteng, KwaZulu-Natal, and Pretoria —
-- fine as placeholder content, but inconsistent with a Cape Town-only pilot
-- story if it ever reached a real visitor.
--
-- These are still demo data, not real pages — replace or remove them with
-- real publishers you've actually recruited, from /admin, before this goes
-- in front of anyone outside your own testing.

insert into public.publishers
  (name, city, province, category, platforms, followers, engagement, price_per_post, rating, reviews, verified, bio, audience, initials, swatch)
values
  ('Bean & Bay Coffee Club', 'Cape Town', 'Western Cape', 'Food & Drink',
   ARRAY['Facebook Group'], 8400, 5.1, 120, 4.8, 6, true,
   'Cape Town coffee spot recommendations, giveaways and daily specials from the community.',
   '25-44, mostly local Cape Town residents', 'BB', 'from-billboard-yellow to-billboard-yellowDeep'),

  ('Cape Town Family Network', 'Cape Town', 'Western Cape', 'Family & Community',
   ARRAY['Facebook Group'], 31000, 4.2, 180, 4.9, 19, true,
   'The largest parenting and family community group in Cape Town - school info, playdates, recommendations.',
   '28-45, parents across Cape Town', 'CF', 'from-billboard-yellow to-billboard-red'),

  ('Cycle Works Workshop', 'Stellenbosch', 'Western Cape', 'Automotive',
   ARRAY['Facebook Page'], 7200, 3.8, 110, null, 1, false,
   'Bike and car servicing updates, workshop specials and local road safety posts.',
   '20-50, Stellenbosch and surrounds', 'CW', 'from-billboard-green to-billboard-ink'),

  ('Kaap Kicks', 'Cape Town', 'Western Cape', 'Fashion & Lifestyle',
   ARRAY['Instagram', 'TikTok'], 15600, 7.2, 200, 4.7, 9, true,
   'Sneaker culture, streetwear drops and thrift finds from the Cape Town scene.',
   '16-28, sneaker and streetwear community', 'KK', 'from-billboard-red to-billboard-yellow');
