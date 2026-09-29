-- ============================================================================
-- 0022 — instagram_posts was missing media_url
-- ----------------------------------------------------------------------------
-- 0018 added thumbnail_url to instagram_posts for the post-cover thumbnails,
-- but never added media_url (only instagram_stories got it). The app started
-- selecting/writing media_url on instagram_posts too, which broke every
-- Instagram post read and the nightly sync until this runs.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.instagram_posts
  add column if not exists media_url text;
