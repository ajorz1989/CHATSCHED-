-- ChatSched — Phase 40 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase39_compliance.sql.
--
-- Wires up the screenshot upload path campaign_proof.screenshot_path
-- already had a column for but no storage backing (flagged as a known gap
-- in COMPLIANCE_DELIVERY_REPORT.md — "Screenshot upload for proof isn't
-- wired"). Useful precisely because a public post can be edited, deleted,
-- or made private after the fact — the screenshot is evidence that
-- survives that.
--
-- Deliberately a PRIVATE bucket, unlike portfolio-images
-- (schema_phase27_portfolio.sql), which is intentionally public — a
-- portfolio image is meant to be shown off on a public profile; a proof
-- screenshot is evidence tied to a specific business/creator/admin
-- relationship and has no reason to be publicly listable or guessable.
-- Reading one requires a signed URL, generated on demand, which
-- Supabase Storage only issues to a caller who already passes this
-- bucket's own SELECT policy below — same access boundary as the
-- campaign_proof row itself, not a separate one to keep in sync by hand.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-proof-screenshots', 'campaign-proof-screenshots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = false;

-- Path convention: {campaign_compliance_id}/{filename} — mirrors the
-- {auth.uid()}/{filename} convention portfolio-images uses, just keyed by
-- campaign instead of by user, since read/write access here is about who's
-- a participant on the CAMPAIGN, not just who uploaded the file (the
-- business who didn't upload it still needs to be able to view it).

create policy campaign_proof_screenshots_select_participant
  on storage.objects for select
  using (
    bucket_id = 'campaign-proof-screenshots'
    and exists (
      select 1 from public.campaign_compliance cc
      where cc.id = (storage.foldername(name))[1]::uuid
      and (cc.business_id = auth.uid()
           or exists (select 1 from public.publishers p where p.id = cc.publisher_id and p.user_id = auth.uid()))
    )
    or public.is_admin()
  );

-- Only the campaign's own creator can upload a screenshot for it — same
-- ownership check campaign_proof's own insert policy uses
-- (schema_phase39_compliance.sql), just expressed against the storage
-- path instead of a table row, since these two writes (the file, then the
-- campaign_proof row referencing it) happen as separate calls from the
-- client and each needs its own enforcement.
create policy campaign_proof_screenshots_insert_creator
  on storage.objects for insert
  with check (
    bucket_id = 'campaign-proof-screenshots'
    -- NOT `join public.publishers p on p.id = cc.publisher_id ... and
    -- p.user_id = auth.uid()` in the SAME subquery as the unqualified
    -- `name` reference below — confirmed directly against real Postgres:
    -- publishers has its own `name` column (its display name), and once
    -- `publishers` is joined into the SAME scope, an unqualified `name`
    -- resolves to the CLOSEST matching column in SQL's standard scoping
    -- rules — publishers.name, not the outer storage.objects row being
    -- inserted. That silently broke every creator upload against this
    -- policy (RLS violation on a technically-correct client request) from
    -- the day this migration shipped until a real Postgres run caught it.
    -- Neither `objects.name` nor `storage.objects.name` resolves inside a
    -- policy body either (tried both, both still failed the same way) —
    -- the actual fix is structural: keep `name` in a scope where nothing
    -- else could shadow it (just campaign_compliance, no `name` column of
    -- its own), and push the publishers/ownership check into its own
    -- nested EXISTS, mirroring campaign_proof_screenshots_select_participant
    -- above, which never had this bug for exactly this structural reason.
    and exists (
      select 1 from public.campaign_compliance cc
      where cc.id = (storage.foldername(name))[1]::uuid
      and exists (
        select 1 from public.publishers p where p.id = cc.publisher_id and p.user_id = auth.uid()
      )
    )
  );

-- No update or delete policy for anyone, including admins — evidence that
-- could be swapped out after submission isn't evidence. Same "append-only"
-- posture as campaign_disclosures.
