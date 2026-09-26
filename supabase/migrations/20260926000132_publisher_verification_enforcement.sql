-- ChatSched — publisher verification enforcement
-- Live migration: 20260926000132_publisher_verification_enforcement
-- Makes high-trust channel verification and Social Media profile-link
-- verification server-enforced rather than UI-only.

alter table public.publishers
  add column if not exists social_verification_links jsonb not null default '[]'::jsonb;

alter table public.publishers
  drop constraint if exists social_verification_links_shape;

alter table public.publishers
  add constraint social_verification_links_shape
  check (
    jsonb_typeof(social_verification_links) = 'array'
    and jsonb_array_length(social_verification_links) <= 6
  );

comment on column public.publishers.social_verification_links is
  'Private publisher-submitted social profile URLs used by ChatSched admin to verify Social Media channel listings. Not exposed through publishers_public.';

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
  v_has_proof boolean := false;
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

    v_has_proof := coalesce(array_length(new.verification_proof_urls, 1), 0) > 0;

    if not v_checks_valid then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification is incomplete. Every required verification check must be confirmed before this publisher can be approved or verified.';
    end if;

    if not v_has_proof then
      raise exception using
        errcode = '23514',
        message = 'High-trust channel verification requires at least one verification evidence file before this publisher can be approved or verified.';
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

drop trigger if exists trg_enforce_publisher_channel_verification on public.publishers;
create trigger trg_enforce_publisher_channel_verification
  before insert or update on public.publishers
  for each row
  execute function public.enforce_publisher_channel_verification();

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
  v_is_social boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve publisher applications.';
  end if;

  select
    p.channel_slug,
    coalesce(c.verification_required, false),
    (p.channel_slug = 'social-media')
  into
    v_channel_slug,
    v_requires_verification,
    v_is_social
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

  update public.publishers
  set
    status = 'approved',
    verified = case when v_requires_verification or v_is_social then true else verified end,
    reviewed_at = now(),
    rejected_reason = null
  where id = p_publisher_id;
end;
$$;

revoke execute on function public.approve_publisher_application(uuid, text[]) from public, anon, authenticated;
grant execute on function public.approve_publisher_application(uuid, text[] ) to authenticated;
