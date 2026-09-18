-- ChatSched — Phase 97 schema additions
-- Run once in the Supabase SQL editor, AFTER
-- schema_phase96_in_venue_screens_channel.sql.
--
-- RENUMBERING NOTE (merge of the 12-channel-audit lineage into
-- chatsched-final-form): this migration was originally authored as
-- schema_phase90_verification_proof_upload.sql in the 12-channel-audit
-- branch. By the time that branch was merged back in, phase90 had
-- independently been used in the final-form lineage for
-- schema_phase90_delete_account_retention.sql, and the final-form
-- lineage had progressed through phase96 (in-venue-screens, the 13th
-- channel). Renumbered to 97 — the first free slot — with no other
-- change to the migration's content. This is exactly the kind of
-- cross-session migration-numbering collision this project has hit
-- twice before; re-verify the latest schema_phase number against
-- whichever codebase is actually current before adding the next one.
--
-- Implements 12-Channel Audit fix A1 (channel_12_audit_fixes.md) — the
-- single highest-priority finding in that audit: every physical-placement
-- channel's eligibility checklist explicitly promises verification beyond
-- self-attestation ("I understand physical placements need photo/video
-- proof, not just my word" — Sports, Events, Transport, Informal Retail,
-- Restaurants all say a version of this), but nothing in the codebase
-- actually captures that proof. Confirmed by reading PublisherApply.tsx
-- (no file input anywhere) and Admin.tsx's own review screen (re-shows the
-- same checklist to re-tick, with no photo/document attached to look at)
-- before writing this migration — not assumed from the audit document
-- alone.
--
-- Same PRIVATE bucket pattern as campaign-proof-screenshots
-- (schema_phase40_proof_screenshots.sql), not the public portfolio-images
-- one (schema_phase27_portfolio.sql) — this is verification evidence tied
-- to a specific application under admin review, not a public profile
-- asset. Same append-only posture too: no update/delete policy for
-- anyone, including admins — evidence that could be swapped out after
-- submission isn't evidence.
--
-- Path convention: {publisher_id}/{filename} — same shape as
-- campaign-proof-screenshots' {campaign_compliance_id}/{filename}, keyed
-- by the publishers row this evidence belongs to. A publisher applies
-- once (one `publishers` row is created at application time, before this
-- upload happens — PublisherApply.tsx's own submitApplication() creates
-- the row first, so the row's real id exists by the time proof is
-- uploaded in the same submission flow), so keying by publisher_id is
-- unambiguous, unlike campaign proof where the campaign is the shared
-- context between two different parties.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publisher-verification-proof', 'publisher-verification-proof', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = false;

-- Select: the publisher who owns this application, or an admin —
-- deliberately NOT the business side (unlike campaign-proof-screenshots,
-- this has no second legitimate party; a business never needs to see a
-- publisher's onboarding verification evidence).
--
-- Structured as a single EXISTS with no other `name`-bearing table joined
-- into the same scope — schema_phase40's own hard-won comment on why an
-- unqualified `name` reference silently breaks when a second table with
-- its own `name` column enters scope applies here just as much (publishers
-- has its own `name` column, exactly the trap that migration's insert
-- policy already fell into once).
create policy publisher_verification_proof_select_own_or_admin
  on storage.objects for select
  using (
    bucket_id = 'publisher-verification-proof'
    and (
      exists (
        select 1 from public.publishers p
        where p.id = (storage.foldername(name))[1]::uuid
        and p.user_id = auth.uid()
      )
      or public.is_admin()
    )
  );

create policy publisher_verification_proof_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'publisher-verification-proof'
    and exists (
      select 1 from public.publishers p
      where p.id = (storage.foldername(name))[1]::uuid
      and p.user_id = auth.uid()
    )
  );

-- No update/delete policy for anyone, including admins — same
-- append-only reasoning as campaign_proof_screenshots.

alter table public.publishers
  add column if not exists verification_proof_urls text[] not null default '{}',
  add constraint verification_proof_urls_max_5 check (array_length(verification_proof_urls, 1) is null or array_length(verification_proof_urls, 1) <= 5);

comment on column public.publishers.verification_proof_urls is
  'Storage paths (not public URLs — the bucket is private, read via a signed URL generated on demand) of up to 5 photo/video files in the publisher-verification-proof bucket, submitted as evidence for the eligibility.checks a verification_required channel already asks the applicant to self-attest to (PublisherApply.tsx). Admin''s existing application-review checklist (Admin.tsx) is the consumer — see 12-Channel Audit fix B1.';
