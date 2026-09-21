-- ============================================================================
-- 0019_founders.sql
-- Makes nicojapar@gmail.com a Founder, alongside
-- professortokoonline@gmail.com. Safe to run any number of times.
-- The accounts themselves (with a temporary password that must be changed at
-- first sign-in) are created by scripts/provision-founders, not by SQL.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('founder', 'superadmin', 'advertiser', 'client'));

update public.app_users
set role = 'founder'
where lower(email) = 'nicojapar@gmail.com';
