-- ChatSched — Phase 44 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase43_recently_viewed.sql.
--
-- Fixes pre-launch audit item #8: every platform_compliance_rules row
-- seeded in schema_phase39_compliance.sql was explicitly labeled
-- "Illustrative starting point — review current policy before relying on
-- this." That was deliberate at the time (brief section 2 explicitly
-- says "do not hard-code unsupported claims about platform policies")
-- but it meant a real business relying on the Compliance Centre today
-- would be reading placeholder text, not real guidance.
--
-- This migration replaces that placeholder content with real policy
-- summaries, each checked against an official source as of the
-- last_reviewed_at date set below — not memory, not assumption. Sources:
--   TikTok    — https://www.tiktok.com/legal/page/global/bc-policy/en (official policy text, fetched directly)
--   Instagram/Facebook — https://www.facebook.com/business/help/221149188908254 (Meta Business Help Center)
--   YouTube   — https://support.google.com/youtube/answer/154235 (YouTube Help)
--   X         — https://help.x.com/en/rules-and-policies/paid-partnerships-policy (X Help Center)
--   LinkedIn  — https://www.linkedin.com/help/linkedin/answer/a1627083 (LinkedIn Help)
--   Podcast/Website/Newsletter/Radio — no single platform ToS exists for
--     these; anchored instead to South Africa's Advertising Regulatory
--     Board Code of Advertising Practice (https://www.arb.org.za/The_Codes/),
--     the applicable general-advertising-law reference for ChatSched's
--     home market (see DEPLOY.md — "live across SA").
--
-- STILL NOT LEGAL ADVICE, and still not exhaustive — this migration
-- upgrades "illustrative placeholder" to "real policy, reviewed on the
-- date below, from an official source," not to "a law firm signed off on
-- this." That distinction is preserved deliberately in the `notes` field
-- of every row below, and PlatformRequirementCard.tsx's own disclaimer
-- ("requirements may change, always verify the current policy") is
-- unchanged by this migration — it still renders on every card.
--
-- ONE TIME-SENSITIVE THING WORTH FLAGGING EXPLICITLY: TikTok has
-- announced a new Branded Content Policy taking effect 31 August 2026.
-- As of this review (19 August 2026) that policy was not yet live, so
-- the content below reflects the CURRENT (soon to be previous) policy.
-- Whoever owns this table should re-review the TikTok row shortly after
-- 31 August 2026 — noted in that row's own `notes` field too, so it
-- isn't only visible here.
--
-- Raw UPDATEs, not the set_platform_compliance_rule() RPC — that RPC
-- requires public.is_admin() to pass, which needs a real auth.uid() from
-- an authenticated session. A migration has neither, the same reason the
-- original seed in schema_phase39 was a plain INSERT rather than a call
-- through the RPC. version is still bumped and last_reviewed_at still
-- set, by hand, to keep both meaningful for policy_version snapshotting
-- on any campaign that reads this table after this migration runs.

update public.platform_compliance_rules set
  content_restrictions = array[
    'Must not use surreptitious or subliminal advertising techniques',
    'The product or service must be clearly identified in the video itself (verbally and/or in the on-screen text/caption) — a bio link or profile visit cannot be the only way a viewer learns what''s being promoted',
    'Must not make false, deceptive, or misleading claims about the product or service'
  ],
  prohibited_categories = array['Financial Services', 'Healthcare'],
  restricted_categories = array[]::text[],
  required_creator_actions = array[
    'Turn on the "Disclose commercial content" toggle before publishing: Post screen -> More options -> Content disclosure and ads',
    'Select "Branded Content" (not "Your Brand") when the post promotes a third party''s product or service',
    'A caption hashtag alone (e.g. #ad) is not treated as sufficient on its own without the toggle enabled'
  ],
  required_business_actions = array[
    'Confirm the campaign category isn''t on TikTok''s Prohibited Industries list before booking (see the policy link on this card)',
    'Supply an approved campaign brief and destination URL'
  ],
  required_proof = array['Public video URL'],
  notes = 'TikTok has announced a new Branded Content Policy taking effect 31 August 2026 — the summary here reflects the policy that was live as of this review (last formally updated by TikTok in November 2023) and should be re-checked shortly after that date. TikTok has also been tightening automated enforcement of the disclosure toggle through 2026; a caption-only disclosure without the toggle enabled is being treated as non-compliant. Financial services and healthcare/pharma content are on TikTok''s own Prohibited Industries list for Branded Content, with some region-specific exceptions — see the full list at the policy link. This is general information, not legal advice — always verify against TikTok''s current policy and applicable law.',
  policy_reference = 'https://www.tiktok.com/legal/page/global/bc-policy/en',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'tiktok';

update public.platform_compliance_rules set
  content_restrictions = array[
    'Applies to Reels, Stories, feed posts, carousels, Live, and Threads — not just standard posts',
    'Both accounts (creator and business) need a Professional — Business or Creator — account to access the Branded Content tool',
    'Must not make false, deceptive, or misleading claims about the product or service'
  ],
  prohibited_categories = array[]::text[],
  restricted_categories = array['Financial Services', 'Healthcare'],
  required_creator_actions = array[
    'Use the Branded Content tool to tag the business partner — this requires the business to have already granted tagging permission — which triggers the "Paid partnership with [Brand]" label automatically',
    'Also add a written disclosure (e.g. "Ad" or "Sponsored") at the very start of the caption, before any hashtags — the Paid Partnership label satisfies Meta''s own policy, a written disclosure is what many creators are separately expected to include'
  ],
  required_business_actions = array[
    'Grant the creator tagging permission for your Page/Business account before the campaign starts',
    'Supply an approved campaign brief and destination URL'
  ],
  required_proof = array['Public post or Reel URL'],
  notes = '"Value" triggering disclosure is broad under Meta''s policy — money, free product, discounts, trips, or affiliate commission all count, not just direct payment. This is general information, not legal advice — always verify against Meta''s current Branded Content Policies and applicable law.',
  policy_reference = 'https://www.facebook.com/business/help/221149188908254',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'instagram';

update public.platform_compliance_rules set
  content_restrictions = array[
    'Applies to Reels, feed posts, Stories, and Live — not just standard posts',
    'Both accounts (creator and business) need a Professional — Business or Creator — account to access the Branded Content tool',
    'Must not make false, deceptive, or misleading claims about the product or service'
  ],
  prohibited_categories = array[]::text[],
  restricted_categories = array['Financial Services', 'Healthcare'],
  required_creator_actions = array[
    'Use the Branded Content tool to tag the business partner — this requires the business to have already granted tagging permission — which triggers the "Paid partnership with [Brand]" label automatically',
    'Also add a written disclosure (e.g. "Ad" or "Sponsored") at the very start of the caption or post text'
  ],
  required_business_actions = array[
    'Grant the creator tagging permission for your Page before the campaign starts',
    'Supply an approved campaign brief and destination URL'
  ],
  required_proof = array['Public post URL'],
  notes = 'Same underlying Meta policy and Branded Content tool as Instagram — "value" triggering disclosure is broad (money, free product, discounts, trips, affiliate commission), not just direct payment. This is general information, not legal advice — always verify against Meta''s current Branded Content Policies and applicable law.',
  policy_reference = 'https://www.facebook.com/business/help/221149188908254',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'facebook';

update public.platform_compliance_rules set
  content_restrictions = array[
    'Must not embed or burn advertiser-supplied video ads (pre-roll, mid-roll, post-roll) into the content itself — that''s YouTube''s separate ads product, not a disclosure mechanism',
    'Content directed at children needs a disclosure that''s understandable by children',
    'Must not make false, deceptive, or misleading claims about the product or service'
  ],
  prohibited_categories = array[]::text[],
  restricted_categories = array['Financial Services', 'Healthcare'],
  required_creator_actions = array[
    'Check "My video contains paid promotion" in the video''s details before publishing — this shows viewers an automatic disclosure banner for the first several seconds',
    'Also state the paid relationship in the video itself (verbally and/or on-screen) and in the description — YouTube''s checkbox alone is not treated as a substitute for a clear, direct disclosure'
  ],
  required_business_actions = array['Supply an approved campaign brief and destination URL'],
  required_proof = array['Public video URL'],
  notes = 'Applies regardless of channel size or payment type — including gifted-product-only deals where there''s any expectation of coverage. This is general information, not legal advice — always verify against YouTube''s current policy and applicable law.',
  policy_reference = 'https://support.google.com/youtube/answer/154235',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'youtube';

update public.platform_compliance_rules set
  content_restrictions = array[
    'Financial products or services — including crypto, loans, investment services, and buy-now-pay-later — are not eligible for organic "Paid Partnership" posts as of X''s March 2026 policy update; these must run through X''s formal advertising program instead',
    'Must not make false, deceptive, or misleading claims about the product or service'
  ],
  prohibited_categories = array['Financial Services'],
  restricted_categories = array[]::text[],
  required_creator_actions = array[
    'Use X''s "Paid Partnership" label — the flag icon in the post composer, or "Add content disclosure" from the post menu after publishing'
  ],
  required_business_actions = array[
    'Confirm the campaign isn''t financial-services content before booking — it isn''t eligible for an organic Paid Partnership post on X',
    'Supply an approved campaign brief and destination URL'
  ],
  required_proof = array['Public post URL'],
  notes = 'X moved from a caption-hashtag convention to a native "Paid Partnership" label in 2026 — a caption-only disclosure is no longer X''s primary mechanism. X''s Paid Partnerships Policy defines a fuller list of prohibited categories beyond financial services — check the live policy at the link for the complete list. This is general information, not legal advice — always verify against X''s current policy and applicable law.',
  policy_reference = 'https://help.x.com/en/rules-and-policies/paid-partnerships-policy',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'x';

update public.platform_compliance_rules set
  content_restrictions = array[
    'The Brand partnership label is only available on Public posts — switching visibility to Connections-only or Groups disables it',
    'Applies the same way to ghostwritten or agency-produced posts as to a creator''s own writing — who typed it doesn''t change whether it''s paid'
  ],
  prohibited_categories = array[]::text[],
  restricted_categories = array[]::text[],
  required_creator_actions = array[
    'Switch on the "Brand partnership" toggle when composing the post (only available on Public posts)',
    'State the relationship in the post text itself as well — don''t rely on the label alone'
  ],
  required_business_actions = array['Supply an approved campaign brief and destination URL'],
  required_proof = array['Public post URL'],
  notes = 'LinkedIn''s own guidance is less prescriptive than Meta/TikTok/YouTube''s — when in doubt, over-disclose rather than rely on the label alone. This is general information, not legal advice — always verify against LinkedIn''s current policy and applicable law.',
  policy_reference = 'https://www.linkedin.com/help/linkedin/answer/a1627083',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'linkedin';

-- Podcast / Website / Newsletter / Radio: no platform operates a
-- disclosure tool for these the way the social platforms above do — the
-- obligation comes from general advertising law, not a platform's terms
-- of service. Anchored to South Africa's ARB Code (ChatSched's home
-- market — see DEPLOY.md) rather than left unsourced.
update public.platform_compliance_rules set
  content_restrictions = array[
    'No platform-operated disclosure tool exists for podcasts — the obligation comes from general advertising law, not a platform ToS',
    'In South Africa, the ARB Code of Advertising Practice requires advertising to be "readily recognised as an advertisement" (Section II) regardless of medium'
  ],
  required_creator_actions = array['Include a clear spoken disclosure of the paid relationship near the start of the episode, not only in the show notes'],
  required_business_actions = array['Supply an approved campaign brief and destination URL'],
  required_proof = array['Episode URL or publish date'],
  notes = 'This is general-advertising-law guidance, not a specific platform''s policy — always verify against the Advertising Regulatory Board''s Code of Advertising Practice and any other law that applies in your jurisdiction. Not legal advice.',
  policy_reference = 'https://www.arb.org.za/The_Codes/',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'podcast';

update public.platform_compliance_rules set
  content_restrictions = array[
    'No platform-operated disclosure tool exists for websites — the obligation comes from general advertising law, not a platform ToS',
    'In South Africa, the ARB Code of Advertising Practice requires advertising to be "readily recognised as an advertisement" (Section II) regardless of medium'
  ],
  required_creator_actions = array['Clearly label sponsored or affiliate content on the page itself, near the content — not only in a footer or terms page'],
  required_business_actions = array['Supply an approved campaign brief and destination URL'],
  required_proof = array['Published page URL'],
  notes = 'This is general-advertising-law guidance, not a specific platform''s policy — always verify against the Advertising Regulatory Board''s Code of Advertising Practice and any other law that applies in your jurisdiction. Not legal advice.',
  policy_reference = 'https://www.arb.org.za/The_Codes/',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'website';

update public.platform_compliance_rules set
  content_restrictions = array[
    'No platform-operated disclosure tool exists for newsletters — the obligation comes from general advertising law, not a platform ToS',
    'In South Africa, the ARB Code of Advertising Practice requires advertising to be "readily recognised as an advertisement" (Section II) regardless of medium'
  ],
  required_creator_actions = array['Clearly label the send as sponsored content, near the top — not only in a footer'],
  required_business_actions = array['Supply an approved campaign brief and destination URL'],
  required_proof = array['Send date and archive URL, where available'],
  notes = 'This is general-advertising-law guidance, not a specific platform''s policy — always verify against the Advertising Regulatory Board''s Code of Advertising Practice and any other law that applies in your jurisdiction. Not legal advice.',
  policy_reference = 'https://www.arb.org.za/The_Codes/',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'newsletter';

update public.platform_compliance_rules set
  content_restrictions = array[
    'No platform-operated disclosure tool exists for radio — the obligation comes from general advertising law, not a platform ToS',
    'In South Africa, the ARB Code of Advertising Practice requires advertising to be "readily recognised as an advertisement" (Section II) regardless of medium'
  ],
  required_creator_actions = array['Include a clear on-air verbal disclosure of the paid relationship'],
  required_business_actions = array['Supply an approved campaign brief and destination URL'],
  required_proof = array['Air date and station confirmation'],
  notes = 'This is general-advertising-law guidance, not a specific platform''s policy — always verify against the Advertising Regulatory Board''s Code of Advertising Practice, ICASA broadcasting requirements, and any other law that applies in your jurisdiction. Not legal advice.',
  policy_reference = 'https://www.arb.org.za/The_Codes/',
  last_reviewed_at = '2026-08-19',
  version = version + 1,
  updated_at = now()
where platform = 'radio';
