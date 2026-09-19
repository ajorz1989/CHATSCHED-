-- ChatSched — Phase 106 schema addition
-- Careers salary unit. Append-only follow-up to schema_phase105_careers_and_aj_creations.sql.

alter table public.careers
  add column if not exists salary_period text not null default 'unspecified'
  check (salary_period in ('hour', 'month', 'year', 'project', 'unspecified'));

comment on column public.careers.salary_period is
  'Unit for the optional salary range so a public job listing never leaves the pay period ambiguous.';
