-- ============================================================================
-- 0017_instagram_demographics.sql
-- Audience demographics per Instagram account: age, gender, city and country,
-- for followers and for the engaged audience. Instagram only returns these for
-- accounts with 100+ followers, and only as a current picture (no history), so
-- we keep one reading per account per month — the latest one seen that month —
-- which builds a month-to-month record on our side.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- Requires 0016_social_accounts.sql to already be applied.
-- ============================================================================

create table if not exists public.instagram_demographics (
  id             uuid primary key default gen_random_uuid(),
  ig_user_id     text not null,
  snapshot_month text not null,            -- 'YYYY-MM'
  audience       text not null check (audience in ('followers', 'engaged')),
  breakdown      text not null check (breakdown in ('age', 'gender', 'city', 'country')),
  key            text not null,            -- '18-24', 'F', 'Jakarta, ...', 'ID'
  value          integer not null,
  updated_at     timestamptz not null default now(),
  unique (ig_user_id, snapshot_month, audience, breakdown, key)
);

create index if not exists instagram_demographics_idx on public.instagram_demographics (ig_user_id, snapshot_month desc);

alter table public.instagram_demographics enable row level security;
drop policy if exists instagram_demographics_all on public.instagram_demographics;
create policy instagram_demographics_all on public.instagram_demographics for all using (true) with check (true);
