-- ChatSched: log primary PayFast Pay Now activation payments and notify admins
create table if not exists public.payfast_activation_events (
  id uuid primary key default gen_random_uuid(),
  pf_payment_id text,
  m_payment_id text,
  activation_type text not null check (activation_type in ('business','publisher')),
  amount numeric(12,2) not null check (amount >= 0),
  payer_email text,
  payer_name text,
  payment_status text not null,
  matched_user_id uuid references auth.users(id) on delete set null,
  match_status text not null check (match_status in ('auto_activated','already_active','action_required','failed','cancelled','ignored')),
  note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists payfast_activation_events_pf_payment_uidx
  on public.payfast_activation_events (pf_payment_id)
  where pf_payment_id is not null;

create unique index if not exists payfast_activation_events_m_payment_uidx
  on public.payfast_activation_events (m_payment_id)
  where m_payment_id is not null;

create index if not exists payfast_activation_events_created_idx
  on public.payfast_activation_events (created_at desc);

create index if not exists payfast_activation_events_status_idx
  on public.payfast_activation_events (match_status, created_at desc);

alter table public.payfast_activation_events enable row level security;

drop policy if exists payfast_activation_events_admin_select on public.payfast_activation_events;
create policy payfast_activation_events_admin_select
  on public.payfast_activation_events
  for select
  to authenticated
  using (is_admin());

grant select on table public.payfast_activation_events to authenticated;

create or replace function public.notify_payfast_activation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
  v_label text;
  v_amount text;
begin
  if new.payment_status <> 'COMPLETE' then
    return new;
  end if;

  v_label := case when new.activation_type = 'business'
    then 'Business activation'
    else 'Publisher Network activation'
  end;
  v_amount := 'R' || to_char(new.amount, 'FM999999990.00');

  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.create_notification(
      v_admin.id,
      'payfast_activation',
      case
        when new.match_status = 'action_required' then 'PayFast activation needs attention'
        when new.match_status = 'already_active' then 'PayFast activation payment received'
        else 'PayFast activation paid'
      end,
      case
        when new.match_status = 'action_required' then
          format('%s payment of %s from %s could not be matched to the expected ChatSched account. Review it now.', v_label, v_amount, coalesce(new.payer_email, 'an unknown payer'))
        when new.match_status = 'already_active' then
          format('%s payment of %s was received from %s, but that account was already active.', v_label, v_amount, coalesce(new.payer_email, 'an unknown payer'))
        else
          format('%s payment of %s was received from %s and the account was auto-activated.', v_label, v_amount, coalesce(new.payer_email, 'an unknown payer'))
      end,
      '/admin/payfast-activation-payments'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_payfast_activation_event on public.payfast_activation_events;
create trigger trg_notify_payfast_activation_event
  after insert on public.payfast_activation_events
  for each row execute function public.notify_payfast_activation_event();