-- Phase 107 — SARS-friendly tax invoice fields
--
-- Adds the physical business address fields the invoice PDF (src/lib/invoice.ts)
-- needs to show a recipient address, plus an optional VAT number — required by
-- SARS (South African Revenue Service) for a document to qualify as a valid
-- "tax invoice" once VAT is involved. See the VAT Act's tax invoice
-- requirements: supplier name/address/VAT no., recipient name/address (and
-- VAT no. if registered) for supplies over R5,000, a unique serial number,
-- issue date, description, and the VAT treatment of the amount charged.
--
-- ChatSched's own supplier-side VAT number (if/when registered) is kept in
-- src/lib/constants.ts as PLATFORM_VAT_NUMBER, not in this table — this
-- migration only adds the recipient-side (business/publisher) fields that
-- have to live per-profile.
--
-- All columns nullable: this is additive, matches the existing pattern for
-- every optional profile field (phone, industry, website, etc.), and a
-- business/publisher isn't required to have entered these to keep using the
-- platform — the invoice PDF simply omits a line it doesn't have data for.

alter table public.profiles
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  -- A profile's own VAT number, if they are a registered VAT vendor. Distinct
  -- from publishers.vat_number (schema_phase5.sql) which already exists for
  -- publisher rows — profiles had no equivalent column until now, and a
  -- business account needs one for the exact same SARS reason a publisher
  -- does.
  add column if not exists vat_number text;

comment on column public.profiles.address_line1 is 'Street address, line 1 — used on SARS-compliant tax invoices (src/lib/invoice.ts). Optional.';
comment on column public.profiles.address_line2 is 'Street address, line 2 (suburb/complex/unit) — optional.';
comment on column public.profiles.postal_code is 'Postal code — optional, shown alongside city/province on invoices.';
comment on column public.profiles.vat_number is 'This profile''s own VAT registration number, if registered. Optional — null means not a registered VAT vendor, and the invoice PDF states this rather than omitting it silently.';
