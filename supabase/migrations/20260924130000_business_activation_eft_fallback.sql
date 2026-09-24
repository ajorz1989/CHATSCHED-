-- ChatSched: manual EFT fallback for business activation
create table if not exists public.business_activation_eft_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.business_subscriptions(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  reference text not null unique,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);
create index if not exists business_activation_eft_business_idx on public.business_activation_eft_payments (business_id, created_at desc);
create index if not exists business_activation_eft_status_idx on public.business_activation_eft_payments (status, created_at desc);
alter table public.business_activation_eft_payments enable row level security;
create policy business_activation_eft_select_own on public.business_activation_eft_payments for select to authenticated using (business_id = auth.uid() or is_admin());
create policy business_activation_eft_insert_own on public.business_activation_eft_payments for insert to authenticated with check (business_id = auth.uid() and amount = 399.00);
create policy business_activation_eft_admin_all on public.business_activation_eft_payments for all to authenticated using (is_admin()) with check (is_admin());

create or replace function public.confirm_business_activation_eft(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not is_admin() then raise exception 'Only an admin can confirm an activation EFT'; end if;
  select * into p from public.business_activation_eft_payments where id=p_payment_id for update;
  if not found then raise exception 'EFT payment not found'; end if;
  if p.status <> 'pending' then raise exception 'EFT payment is already %', p.status; end if;
  update public.business_activation_eft_payments set status='confirmed', reviewed_at=now(), reviewed_by=auth.uid() where id=p_payment_id;
  update public.business_subscriptions set status='active', paid_at=now(), updated_at=now() where id=p.subscription_id and business_id=p.business_id and status <> 'active';
  insert into public.business_launch_credits (business_id, subscription_id, amount, remaining)
    select p.business_id, p.subscription_id, 199.00, 199.00
    where not exists (select 1 from public.business_launch_credits where business_id=p.business_id);
  update public.business_subscriptions set launch_credit_granted=true, updated_at=now() where id=p.subscription_id;
end; $$;
revoke all on function public.confirm_business_activation_eft(uuid) from public;
grant execute on function public.confirm_business_activation_eft(uuid) to authenticated;

create or replace function public.reject_business_activation_eft(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can reject an activation EFT'; end if;
  update public.business_activation_eft_payments set status='rejected', reviewed_at=now(), reviewed_by=auth.uid() where id=p_payment_id and status='pending';
  if not found then raise exception 'Pending EFT payment not found'; end if;
end; $$;
revoke all on function public.reject_business_activation_eft(uuid) from public;
grant execute on function public.reject_business_activation_eft(uuid) to authenticated;
