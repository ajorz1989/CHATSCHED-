begin;

select plan(12);

select has_column(
  'public',
  'publishers',
  'social_verification_links',
  'publishers stores private Social Media verification links'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.publishers'::regclass
      and conname = 'social_verification_links_shape'
  ),
  'social verification links have a JSON array shape constraint'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.publishers'::regclass
      and tgname = 'trg_enforce_publisher_channel_verification'
      and not tgenabled = 'D'
  ),
  'publisher channel verification trigger is enabled'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'enforce_publisher_channel_verification'
      and prosecdef = true
  ),
  'publisher channel verification function is security definer'
);

select ok(
  exists (
    select 1
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'approve_publisher_application'
      and p.prosecdef = true
  ),
  'publisher approval RPC is security definer'
);

select ok(
  exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'approve_publisher_application'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
  )
  and not exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'approve_publisher_application'
      and grantee in ('anon', 'public')
      and privilege_type = 'EXECUTE'
  ),
  'publisher approval RPC is not publicly executable'
);

select ok(
  exists (
    select 1
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'approve_publisher_application'
      and array_to_string(p.proconfig, ',') ilike '%search_path=public, pg_catalog%'
  ),
  'publisher approval RPC pins its function search path'
);

select ok(
  exists (
    select 1
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'enforce_publisher_channel_verification'
      and array_to_string(p.proconfig, ',') ilike '%search_path=public, pg_catalog%'
  ),
  'verification trigger pins its function search path'
);

select ok(
  exists (
    select 1
    from public.channels
    where slug = 'in-venue-screens'
      and verification_required = true
  ),
  'In-Venue Screens remains classified as high-trust'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'publishers_public'
      and column_name = 'social_verification_links'
  ),
  'Social Media verification URLs are not exposed through publishers_public'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.publishers'::regclass
      and tgname = 'trg_enforce_publisher_channel_verification'
      and pg_get_triggerdef(oid) ilike '%before insert or update%'
  ),
  'verification enforcement runs before publisher writes'
);

select ok(
  exists (
    select 1
    from public.channels
    where verification_required = true
  ),
  'at least one high-trust channel is configured'
);

select * from finish();
rollback;