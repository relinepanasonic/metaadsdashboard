-- ============================================================================
-- 0005_audience.sql
-- Value-Based Custom Audience data — matches Meta's audience upload template
-- (email x3, phone x3, madid, fn, ln, zip, ct, st, country, dob, doby, gen,
-- age, uid, value). Uploaded via CSV on the Audience page.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

-- One row per CSV upload, for grouping/filtering and cleanup.
create table if not exists public.audience_batches (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,             -- e.g. filename or user-given name
  row_count    integer not null default 0,
  uploaded_by  uuid references public.app_users(id),
  uploaded_at  timestamptz not null default now()
);

-- One row per audience record, matching Meta's CSV columns 1:1.
create table if not exists public.audience_records (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references public.audience_batches(id) on delete cascade,
  email1     text,
  email2     text,
  email3     text,
  phone1     text,
  phone2     text,
  phone3     text,
  madid      text,
  fn         text,
  ln         text,
  zip        text,
  ct         text,   -- city
  st         text,   -- state
  country    text,
  dob        text,   -- kept as raw text (source formats vary: MM/DD/YY etc.)
  doby       integer,-- year of birth
  gen        text,   -- gender
  age        integer,
  uid        text,
  value      numeric,
  created_at timestamptz not null default now()
);

create index if not exists audience_records_batch_idx on public.audience_records (batch_id);
create index if not exists audience_records_country_idx on public.audience_records (country);
create index if not exists audience_records_value_idx on public.audience_records (value);

-- ----------------------------------------------------------------------------
-- RLS: same permissive internal-tool model as the rest of this app (access is
-- enforced in application code by role, not at the RLS layer).
-- ----------------------------------------------------------------------------
alter table public.audience_batches enable row level security;
alter table public.audience_records enable row level security;

drop policy if exists audience_batches_all on public.audience_batches;
create policy audience_batches_all on public.audience_batches for all using (true) with check (true);

drop policy if exists audience_records_all on public.audience_records;
create policy audience_records_all on public.audience_records for all using (true) with check (true);
