-- ============================================================================
-- 0003_allow_superadmin_invite.sql
-- Allows Superadmin to also generate invite links for new Superadmins.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.invites drop constraint if exists invites_role_check;
alter table public.invites add constraint invites_role_check
  check (role in ('superadmin', 'advertiser', 'client'));
