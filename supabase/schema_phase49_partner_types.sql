-- ChatSched — Phase 49 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase48_partners.sql.
--
-- /partners/apply — "Become a ChatSched Partner". This is a second, formal
-- entry point into the same partner_applications table from Phase 47, but
-- along a different axis: Phase 47's `category` is the applicant's
-- INDUSTRY (marketing agency, photographer, media organisation, etc.),
-- collected on the /partners directory page. `partner_type` here is the
-- FUNCTIONAL ROLE they'd play in the partner program itself — Agency,
-- Technology, Media, Community, or Referral Partner — collected on
-- /partners/apply. The two are independent and both optional at the
-- database level so either form can submit without the other's field;
-- the two application pages each still enforce their own field as
-- required client-side.

alter table public.partner_applications
  alter column category drop not null;

alter table public.partner_applications
  add column partner_type text
    check (partner_type in ('agency', 'technology', 'media', 'community', 'referral'));

create index partner_applications_partner_type_idx on public.partner_applications(partner_type);

-- Belt-and-braces: a submission should identify itself along at least one
-- of the two axes, even though each column is individually nullable.
alter table public.partner_applications
  add constraint partner_applications_category_or_type_chk
  check (category is not null or partner_type is not null);
