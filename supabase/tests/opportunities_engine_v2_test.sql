begin;

select plan(18);

select has_table('public', 'opportunity_types', 'opportunity types catalogue exists');
select has_column('public', 'opportunities', 'application_deadline', 'opportunity deadline exists');
select has_column('public', 'opportunities', 'campaign_start_at', 'campaign start exists');
select has_column('public', 'opportunities', 'campaign_end_at', 'campaign end exists');
select has_column('public', 'opportunities', 'deliverables', 'deliverables exists');
select has_column('public', 'opportunities', 'publisher_requirements', 'publisher requirements exists');
select has_column('public', 'opportunities', 'match_keywords', 'match keywords exists');

select ok(
  exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'opportunities'
      and constraint_name = 'opportunities_opportunity_type_fkey'
  ),
  'opportunity type foreign key exists'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunities'
      and policyname = 'opportunities_select_open_to_publishers'
      and qual like '%application_deadline%'
      and qual like '%publisher_subscriptions%'
  ),
  'publisher feed policy enforces deadline and active subscription'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunity_applications'
      and policyname = 'opportunity_applications_insert_publisher'
      and with_check like '%ps.publisher_id = p.id%'
      and with_check like '%ps.status = ''active''%'
  ),
  'publisher application policy joins subscription through publisher id'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunities'
      and policyname = 'opportunities_insert_own'
      and with_check like '%business_verified = true%'
      and with_check like '%status = ''active''%'
  ),
  'business posting policy requires verification and activation'
);

select ok(
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'expire_opportunities'
  ),
  'expiry function exists'
);

select ok(
  not exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'expire_opportunities'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ),
  'expiry function is not directly executable by API roles'
);

select ok(
  exists (
    select 1 from cron.job
    where jobname = 'expire-open-opportunities'
      and active = true
  ),
  'opportunity expiry cron is active'
);

select ok(
  (select count(*) from public.opportunity_types where active = true) >= 10,
  'opportunity catalogue is seeded'
);

select ok(
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'accept_opportunity_application'
      and prosecdef = true
  ),
  'atomic acceptance function remains security definer'
);

select ok(
  exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'accept_opportunity_application'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
  )
  and not exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'accept_opportunity_application'
      and grantee in ('anon', 'public')
      and privilege_type = 'EXECUTE'
  ),
  'atomic acceptance is executable by authenticated users, not anon/public'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunity_types'
      and policyname = 'opportunity_types_select_public'
  ),
  'opportunity type catalogue has read policy'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunity_types'
      and policyname = 'opportunity_types_admin_write'
  ),
  'opportunity type catalogue has admin write policy'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.opportunities'::regclass
      and tgname = 'trg_enforce_opportunity_update'
      and not tgenabled = 'D'
  ),
  'opportunity lifecycle trigger is enabled'
);

select * from finish();
rollback;