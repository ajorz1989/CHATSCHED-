-- Ownership checks for digital channels — step 1 (the code-only ones).
--
-- Before: only Social Media needed proof of ownership (a bio code an admin
-- confirms, migration 20260929120000). Influencer and Website listings could be
-- approved on self-reported details alone.
--
-- Now a listing in any of these channels cannot be approved until its ownership
-- is confirmed:
--   social-media  bio code + public profile link   (unchanged, admin confirms)
--   influencer    bio code + public profile link   (same check as social media)
--   website       code on the site (meta tag, DNS TXT or /.well-known file),
--                 checked automatically by the verify-website-ownership edge
--                 function, or confirmed by an admin
-- Podcast and radio are not covered here (they need email confirmation and a
-- licence-number check, which need new admin tooling).
--
-- Reuses the existing columns on purpose: social_verification_code /
-- social_verification_confirmed* (already protected by
-- enforce_social_verification_self_update and already whitelisted in
-- enforce_publisher_self_update, and already exposed to the public directory as
-- the "ownership confirmed" signal). The column names say "social" for
-- historical reasons; they now mean "ownership confirmed" for every channel
-- that uses a code. No new columns, so nothing to add to the self-update
-- whitelist. Existing approved listings are untouched: the checks only run when
-- a listing is being approved.
--
-- Safe to run twice (create or replace).

comment on column public.publishers.social_verification_code is
  'A short code (e.g. CS-7A3B9) the publisher puts where only the owner can: in a social/influencer bio, or on their website (meta tag, DNS TXT, or /.well-known/chatsched-verification.txt). Generated via generate_social_verification_code(), never written directly by the client.';
comment on column public.publishers.social_verification_confirmed is
  'Ownership confirmed for the listing''s channel (social-media, influencer, website). Set by an admin (confirm_social_verification()) or, for websites, by the verify-website-ownership edge function after it finds the code on the site. Reset whenever a new code is generated.';

create or replace function public.enforce_publisher_channel_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_requires_verification boolean := false;
  v_needs_links boolean := false;
  v_needs_ownership_code boolean := false;
  v_requires_check boolean := false;
  v_checks_valid boolean := false;
  v_proof_valid boolean := false;
begin
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  select coalesce(c.verification_required, false)
    into v_requires_verification
  from public.channels c
  where c.slug = new.channel_slug;

  v_needs_links := new.channel_slug in ('social-media', 'influencer');
  v_needs_ownership_code := new.channel_slug in ('social-media', 'influencer', 'website');

  v_requires_check :=
    v_requires_verification
    and (
      (tg_op = 'INSERT' and (new.status = 'approved' or new.verified = true))
      or (
        tg_op = 'UPDATE'
        and (
          (old.status is distinct from 'approved' and new.status = 'approved')
          or (old.verified is distinct from true and new.verified = true)
          or (
            old.channel_slug is distinct from new.channel_slug
            and (new.status = 'approved' or new.verified = true)
          )
        )
      )
    );

  if v_requires_check then
    select exists (
      select 1
      from public.publisher_verification_checks vc
      where vc.publisher_id = new.id
        and vc.channel_slug = new.channel_slug
        and vc.checks_total > 0
        and cardinality(vc.checks_confirmed) = vc.checks_total
        and cardinality(
          array(
            select distinct x
            from unnest(vc.checks_confirmed) as u(x)
          )
        ) = vc.checks_total
    )
    into v_checks_valid;

    select
      coalesce(array_length(new.verification_proof_urls, 1), 0) > 0
      and not exists (
        select 1
        from unnest(coalesce(new.verification_proof_urls, '{}'::text[])) as submitted(path)
        where not exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'publisher-verification-proof'
            and o.name = submitted.path
        )
      )
    into v_proof_valid;

    if not v_checks_valid then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification is incomplete. Every required verification check must be confirmed before this publisher can be approved or verified.';
    end if;

    if not v_proof_valid then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification requires at least one uploaded verification evidence file before this publisher can be approved or verified.';
    end if;
  end if;

  if v_needs_ownership_code and (
    (tg_op = 'INSERT' and (new.status = 'approved' or new.verified = true))
    or (
      tg_op = 'UPDATE'
      and (
        (old.status is distinct from 'approved' and new.status = 'approved')
        or (old.verified is distinct from true and new.verified = true)
      )
    )
  ) then
    if v_needs_links then
      if jsonb_typeof(new.social_verification_links) <> 'array'
         or jsonb_array_length(new.social_verification_links) = 0 then
        raise exception using
          errcode = '23514',
          message = 'This listing needs at least one public profile URL before it can be verified.';
      end if;

      if exists (
        select 1
        from jsonb_array_elements(new.social_verification_links) as link
        where coalesce(link->>'platform', '') = ''
           or coalesce(link->>'url', '') = ''
           or (link->>'url') !~* '^https?://'
      ) then
        raise exception using
          errcode = '23514',
          message = 'Every verification link must include a platform and a valid http or https URL.';
      end if;
    end if;

    if new.channel_slug = 'website'
       and nullif(trim(coalesce(new.channel_metadata->>'domain', '')), '') is null then
      raise exception using
        errcode = '23514',
        message = 'Website verification requires the website domain to be filled in on the listing.';
    end if;

    if not coalesce(new.social_verification_confirmed, false) then
      raise exception using
        errcode = '23514',
        message = 'Ownership of this listing must be confirmed (code found on the profile or website) before approval.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.approve_publisher_application(
  p_publisher_id uuid,
  p_checks_confirmed text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_channel_slug text;
  v_requires_verification boolean := false;
  v_needs_links boolean := false;
  v_needs_ownership_code boolean := false;
  v_social_links jsonb;
  v_confirmed boolean;
  v_domain text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve publisher applications.';
  end if;

  select
    p.channel_slug,
    coalesce(c.verification_required, false),
    (p.channel_slug in ('social-media', 'influencer')),
    (p.channel_slug in ('social-media', 'influencer', 'website')),
    p.social_verification_links,
    p.social_verification_confirmed,
    nullif(trim(coalesce(p.channel_metadata->>'domain', '')), '')
  into
    v_channel_slug,
    v_requires_verification,
    v_needs_links,
    v_needs_ownership_code,
    v_social_links,
    v_confirmed,
    v_domain
  from public.publishers p
  left join public.channels c on c.slug = p.channel_slug
  where p.id = p_publisher_id;

  if v_channel_slug is null then
    raise exception 'Publisher application not found.';
  end if;

  if v_requires_verification then
    if cardinality(coalesce(p_checks_confirmed, '{}')) = 0 then
      raise exception 'All high-trust verification checks must be confirmed before approval.';
    end if;

    insert into public.publisher_verification_checks (
      publisher_id,
      channel_slug,
      checks_confirmed,
      checks_total,
      updated_by,
      updated_at
    )
    values (
      p_publisher_id,
      v_channel_slug,
      p_checks_confirmed,
      cardinality(p_checks_confirmed),
      auth.uid(),
      now()
    )
    on conflict (publisher_id) do update
      set channel_slug = excluded.channel_slug,
          checks_confirmed = excluded.checks_confirmed,
          checks_total = excluded.checks_total,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
  end if;

  if v_needs_ownership_code then
    if v_needs_links and (jsonb_typeof(v_social_links) <> 'array' or jsonb_array_length(v_social_links) = 0) then
      raise exception 'This listing needs at least one public profile URL before it can be verified.';
    end if;
    if v_channel_slug = 'website' and v_domain is null then
      raise exception 'Website verification requires the website domain to be filled in on the listing.';
    end if;
    if not coalesce(v_confirmed, false) then
      raise exception 'Ownership of this listing must be confirmed (code found on the profile or website) before approval.';
    end if;
  end if;

  update public.publishers
  set
    status = 'approved',
    verified = case when v_requires_verification or v_needs_ownership_code then true else verified end,
    reviewed_at = now(),
    rejected_reason = null
  where id = p_publisher_id;
end;
$$;

revoke execute on function public.approve_publisher_application(uuid, text[]) from public, anon, authenticated;
grant execute on function public.approve_publisher_application(uuid, text[]) to authenticated;
