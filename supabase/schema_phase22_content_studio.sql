-- ChatSched — Phase 22 schema additions
-- Run once in the Supabase SQL editor, AFTER schema_phase21_publisher_profile_edit.sql.
--
-- Backs the AI Content Studio (marketingSuite/ContentStudio.tsx): a
-- business-only, R99/month feature that generates ready-to-post copy for 9
-- formats from a photo and/or a text brief, using content-studio-generate
-- (Deno edge function, calls the Anthropic API with the cheapest current
-- model). content-studio-subscribe starts a PayFast recurring subscription
-- for it; payfast-notify's subscription branch keeps status/period in sync.

create table public.content_studio_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled')),
  payfast_token text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per generation call — purely a rate-limit ledger (see
-- CONTENT_STUDIO_DAILY_LIMIT / CONTENT_STUDIO_MONTHLY_LIMIT in
-- constants.ts, and the matching copies in content-studio-generate). Never
-- stores the uploaded photo or the generated copy itself — just enough to
-- count "how many calls has this business made, and when".
create table public.content_studio_generations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.profiles(id) on delete cascade,
  formats text[] not null,
  input_mode text not null check (input_mode in ('photo', 'text', 'photo_and_text')),
  created_at timestamptz not null default now()
);

create index content_studio_generations_business_created_idx
  on public.content_studio_generations (business_id, created_at desc);

alter table public.content_studio_subscriptions enable row level security;
alter table public.content_studio_generations enable row level security;

-- A business can see its own subscription and usage log — never write to
-- either directly. All writes happen server-side: content-studio-subscribe
-- and payfast-notify (subscriptions), content-studio-generate (usage log) —
-- all using the service-role client, which bypasses RLS entirely. This
-- keeps a business from, say, editing its own row to "active" without
-- actually paying, or forging usage-log rows to hide over-the-limit calls.
create policy content_studio_subscriptions_select_own
  on public.content_studio_subscriptions for select
  using (business_id = auth.uid() or public.is_admin());

create policy content_studio_generations_select_own
  on public.content_studio_generations for select
  using (business_id = auth.uid() or public.is_admin());

-- No trigger for updated_at here — matching the rest of this schema
-- (schema_payouts_phase1.sql etc.), every writer sets it explicitly
-- (content-studio-subscribe and payfast-notify both do `updated_at: now()`
-- alongside any status change) rather than relying on a DB trigger.
