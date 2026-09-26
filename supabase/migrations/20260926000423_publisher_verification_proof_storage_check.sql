-- ChatSched — verify high-trust evidence paths exist in private storage
-- Live migration: 20260926000423_publisher_verification_proof_storage_check

create or replace function public.enforce_publisher_channel_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_requires_verification boolean := false;
  v_is_social boolean := false;
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

  v_is_social := new.channel_slug = 'social-media';

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

  if v_is_social and (
    (tg_op = 'INSERT' and (new.status = 'approved' or new.verified = true))
    or (
      tg_op = 'UPDATE'
      and (
        (old.status is distinct from 'approved' and new.status = 'approved')
        or (old.verified is distinct from true and new.verified = true)
      )
    )
  ) then
    if jsonb_typeof(new.social_verification_links) <> 'array'
       or jsonb_array_length(new.social_verification_links) = 0 then
      raise exception using
        errcode = '23514',
        message = 'Social Media verification requires at least one public social profile URL.';
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
        message = 'Every Social Media verification link must include a platform and a valid http or https URL.';
    end if;
  end if;

  return new;
end;
$$;
