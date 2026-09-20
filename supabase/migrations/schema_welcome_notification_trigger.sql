-- schema_welcome_notification_trigger.sql
--
-- Fires the welcome-signup Edge Function automatically whenever a new row
-- is inserted into the profiles table with role = 'publisher' OR 'business'.
--
-- Uses pg_net (available in every Supabase project) to make an async HTTP
-- POST to the Edge Function. The call is fire-and-forget — the INSERT
-- itself is never blocked or rolled back based on the notification result.
--
-- Prerequisites:
--   1. The welcome-signup Edge Function must be deployed:
--      supabase functions deploy welcome-signup
--   2. The SUPABASE_SERVICE_ROLE_KEY secret must be set on the function:
--      supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your key>
--   3. RESEND_API_KEY and RESEND_FROM must be set for emails to send.
--   4. pg_net must be enabled (it is by default on Supabase cloud):
--      create extension if not exists pg_net;

create extension if not exists pg_net schema extensions;

-- -----------------------------------------------------------------------
-- Trigger function
-- -----------------------------------------------------------------------
create or replace function public.trigger_welcome_signup_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _edge_url text;
  _service_key text;
  _payload jsonb;
begin
  -- Only fire for publisher and business roles.
  if NEW.role not in ('publisher', 'business') then
    return NEW;
  end if;

  -- Build the Edge Function URL from the Supabase project URL.
  -- vault.decrypted_secrets is available if you store secrets there;
  -- we use current_setting() which works with pg_config and also lets
  -- you override in tests. The SUPABASE_URL is always set by Supabase.
  _edge_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/welcome-signup';

  -- Service role key — stored as a Postgres setting so it never appears
  -- in the trigger body in plain text. Set it once:
  --   alter database postgres set app.settings.service_role_key = '<key>';
  -- (or use vault.decrypted_secrets if you prefer Vault).
  _service_key := current_setting('app.settings.service_role_key', true);

  if _edge_url is null or _service_key is null then
    -- Not configured yet — skip silently rather than erroring the INSERT.
    raise warning 'welcome_signup_trigger: app.settings not configured, skipping';
    return NEW;
  end if;

  _payload := jsonb_build_object(
    'user_id',      NEW.id,
    'role',         NEW.role,
    'display_name', coalesce(NEW.display_name, NEW.full_name, '')
  );

  -- Async HTTP POST via pg_net — does not block the INSERT.
  perform extensions.http_post(
    url     := _edge_url,
    body    := _payload::text,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _service_key
    )
  );

  return NEW;

exception when others then
  -- Never let the notification failure roll back the profile creation.
  raise warning 'welcome_signup_trigger: pg_net call failed: %', sqlerrm;
  return NEW;
end;
$$;

-- -----------------------------------------------------------------------
-- Attach trigger to profiles
-- -----------------------------------------------------------------------
drop trigger if exists on_profile_created_welcome on public.profiles;

create trigger on_profile_created_welcome
  after insert on public.profiles
  for each row
  execute function public.trigger_welcome_signup_notification();

-- -----------------------------------------------------------------------
-- Grant (function is security definer, but grant anyway for clarity)
-- -----------------------------------------------------------------------
grant execute on function public.trigger_welcome_signup_notification() to service_role;
