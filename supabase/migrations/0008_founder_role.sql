-- ============================================================================
-- 0008_founder_role.sql
-- Adds a "founder" role: full access like Superadmin, but no one (including
-- Superadmins) can delete or reset the password of a Founder account except
-- the Founder themselves. Founder is a singleton — never invitable, only
-- assigned directly here.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('founder', 'superadmin', 'advertiser', 'client'));

-- Promote the account holder to Founder.
update public.app_users set role = 'founder' where email = 'professortokoonline@gmail.com';
