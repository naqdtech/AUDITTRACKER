-- ============================================================================
--  Audit Case Tracker — Supabase schema
--  Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================
--  This app uses its OWN tables (prefixed `audit_`) so it can safely live in
--  the SAME Supabase project as the ITR Filing Tracker without colliding with
--  its `clients` / `consultants` / `staff` / `app_settings` tables.
--
--  Design notes
--  ------------
--  * checklist is stored as JSONB on the audit_cases row. For a few-hundred
--    case workload this is simpler and faster than join tables, and maps 1:1
--    to the app's data model.
--  * No `users` table by design — staff assignment lives in the app; an
--    optional shared passcode (NEXT_PUBLIC_APP_PASSCODE) gates access.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.audit_cases (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,             -- assessee (as per PAN)
  alias           text,                      -- familiar / display name, searchable
  group_name      text,                      -- group / holding / family tag
  entity_type     text default 'firm',       -- 'individual' | 'firm' | 'llp' | 'company'
  pan             text,
  email           text,
  phone           text,
  it_portal_reg   boolean default false,
  it_portal_password text,
  assigned_staff  text,
  assessment_year text default '2026-27',
  itr_form        text,
  consultant      text default 'Direct Customer',
  due_category    text default 'oct31',      -- ITR statutory deadline bucket
  sources         text[] default '{}',       -- audit scope aspect keys
  subs            jsonb default '{}'::jsonb,
  counts          jsonb default '{}'::jsonb,  -- {bank: n, parties: n}
  review          jsonb,                     -- auditor verification checklist answers
  stage           text default 'onboarding', -- pipeline stage key
  -- 3CD (tax audit report) filing
  audit_form      text,                      -- '3CA-3CD' | '3CB-3CD'
  filing_3cd_date date,
  udin            text,
  -- ITR filing
  filing_date     date,
  ack_no          text,
  outcome_type    text,                      -- 'nil' | 'refund' | 'payable'
  outcome_amount  numeric,
  everify_date    date,
  -- billing
  fee_quoted      numeric,
  fee_status      text default 'pending',    -- 'pending' | 'invoiced' | 'collected'
  invoice         jsonb,                     -- generated invoice: {no,date,particulars,fy,amount}
  -- workflow
  pending_client  boolean default false,
  next_followup   date,
  notes           text,
  stage_since     timestamptz default now(),
  last_followup   timestamptz,
  checklist       jsonb default '[]'::jsonb, -- items: {id,label,group,done,nr,custom}
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Helpful indexes for the dashboard / filters
create index if not exists audit_cases_stage_idx       on public.audit_cases (stage);
create index if not exists audit_cases_updated_idx      on public.audit_cases (updated_at desc);
create index if not exists audit_cases_pending_idx      on public.audit_cases (pending_client);
create index if not exists audit_cases_group_idx        on public.audit_cases (group_name);
create index if not exists audit_cases_entity_type_idx  on public.audit_cases (entity_type);

-- Keep updated_at fresh on every write
create or replace function public.audit_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists audit_cases_set_updated_at on public.audit_cases;
create trigger audit_cases_set_updated_at
  before update on public.audit_cases
  for each row execute function public.audit_set_updated_at();

-- ============================================================================
--  Row Level Security
--  ------------------
--  No per-user login (assignment is in-app), so it uses the anon key with a
--  full-access policy. Keep the anon key private, set NEXT_PUBLIC_APP_PASSCODE,
--  and when you add Supabase Auth later tighten these to
--  `auth.role() = 'authenticated'`.
-- ============================================================================
alter table public.audit_cases enable row level security;
drop policy if exists "anon full access audit_cases" on public.audit_cases;
create policy "anon full access audit_cases"
  on public.audit_cases for all using (true) with check (true);

-- ============================================================================
--  Consultants (referral attribution)
-- ============================================================================
create table if not exists public.audit_consultants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  created_at      timestamptz default now()
);
insert into public.audit_consultants (name) values ('Direct Customer') on conflict do nothing;

alter table public.audit_consultants enable row level security;
drop policy if exists "anon full access audit_consultants" on public.audit_consultants;
create policy "anon full access audit_consultants"
  on public.audit_consultants for all using (true) with check (true);

-- ============================================================================
--  Staff
-- ============================================================================
create table if not exists public.audit_staff (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  created_at      timestamptz default now()
);
insert into public.audit_staff (name) values ('Dennis'), ('Shibily'), ('Dhilshad') on conflict do nothing;

alter table public.audit_staff enable row level security;
drop policy if exists "anon full access audit_staff" on public.audit_staff;
create policy "anon full access audit_staff"
  on public.audit_staff for all using (true) with check (true);

-- ============================================================================
--  App settings (key/value) — editable auditor-review template, invoice serial
-- ============================================================================
create table if not exists public.audit_settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);

alter table public.audit_settings enable row level security;
drop policy if exists "anon full access audit_settings" on public.audit_settings;
create policy "anon full access audit_settings"
  on public.audit_settings for all using (true) with check (true);

-- ============================================================================
--  Realtime — lets both staff screens sync live
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.audit_cases;
exception when duplicate_object then
  null;
end $$;
