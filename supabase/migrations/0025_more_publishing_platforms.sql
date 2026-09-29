-- ============================================================================
-- 0025 — X and YouTube Shorts as publishing destinations
-- ----------------------------------------------------------------------------
-- 0024 only allowed Instagram / Facebook / Threads / TikTok. This widens the two
-- platform checks so a brand can link X and YouTube accounts (Clients page) and
-- the Scheduler can post to them through Make.com.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.publish_profiles drop constraint if exists publish_profiles_platform_check;
alter table public.publish_profiles
  add constraint publish_profiles_platform_check check (platform in ('threads', 'x', 'tiktok', 'youtube'));

alter table public.scheduled_post_targets drop constraint if exists scheduled_post_targets_platform_check;
alter table public.scheduled_post_targets
  add constraint scheduled_post_targets_platform_check check (platform in ('instagram', 'facebook', 'threads', 'x', 'tiktok', 'youtube'));
