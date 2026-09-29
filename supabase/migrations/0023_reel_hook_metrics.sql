-- ============================================================================
-- 0023 — two more per-Reel numbers (needed for the Hook / CTA badges)
-- ----------------------------------------------------------------------------
--  * skip_rate : % of plays that left within the first 3 seconds (Instagram's
--                reels_skip_rate) — the hook signal
--  * reposts   : how many times the Reel was reposted
-- Also adds media_url if 0022 hasn't been run yet (harmless if it has).
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.instagram_posts
  add column if not exists skip_rate numeric,
  add column if not exists reposts   integer,
  add column if not exists media_url text;
