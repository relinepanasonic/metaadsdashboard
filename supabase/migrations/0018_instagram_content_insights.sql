-- ============================================================================
-- 0018_instagram_content_insights.sql
-- Deeper Instagram data:
--  * per-post / Reels results (reach, views, saves, shares, watch time, ...)
--  * Stories results (captured daily while a story is live, 24h)
--  * profile activity per day: website taps, contact-button taps, follows and
--    unfollows
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- Requires 0017_instagram_demographics.sql to already be applied.
-- ============================================================================

alter table public.instagram_snapshots
  add column if not exists website_clicks     integer,
  add column if not exists profile_links_taps integer,
  add column if not exists follows            integer,
  add column if not exists unfollows          integer;

alter table public.instagram_posts
  add column if not exists media_product_type text,      -- REELS | FEED | STORY
  add column if not exists thumbnail_url      text,
  add column if not exists reach              integer,
  add column if not exists views              integer,
  add column if not exists saved              integer,
  add column if not exists shares             integer,
  add column if not exists total_interactions integer,
  add column if not exists avg_watch_time_ms  integer,   -- Reels only
  add column if not exists total_watch_ms     bigint,    -- Reels only
  add column if not exists follows            integer,   -- feed posts only
  add column if not exists profile_visits     integer,   -- feed posts only
  add column if not exists insights_updated_at timestamptz;

create table if not exists public.instagram_stories (
  story_id           text primary key,
  ig_user_id         text not null,
  posted_at          timestamptz,
  media_type         text,
  permalink          text,
  thumbnail_url      text,
  reach              integer,
  views              integer,
  replies            integer,
  shares             integer,
  total_interactions integer,
  follows            integer,
  profile_visits     integer,
  taps_forward       integer,
  taps_back          integer,
  exits              integer,
  swipes_forward     integer,
  updated_at         timestamptz not null default now()
);

create index if not exists instagram_stories_idx on public.instagram_stories (ig_user_id, posted_at desc);

alter table public.instagram_stories enable row level security;
drop policy if exists instagram_stories_all on public.instagram_stories;
create policy instagram_stories_all on public.instagram_stories for all using (true) with check (true);
