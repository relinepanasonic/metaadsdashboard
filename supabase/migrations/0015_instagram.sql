-- ============================================================================
-- 0015_instagram.sql
-- Organic Instagram data per client. clients.instagram_user_id is the numeric
-- Instagram Business Account id (shown in Meta Business Settings > Instagram
-- accounts). A daily job stores one snapshot row per account per day, so we
-- keep our own history (Instagram only exposes limited look-back), plus the
-- recent posts with their like/comment counts.
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- ============================================================================

alter table public.clients add column if not exists instagram_user_id text;

create table if not exists public.instagram_snapshots (
  id                uuid primary key default gen_random_uuid(),
  ig_user_id        text not null,
  snapshot_date     date not null,        -- the day the metrics describe
  followers_count   integer,              -- follower count at sync time (null on backfilled days)
  media_count       integer,
  reach             integer,
  views             integer,
  profile_views     integer,
  accounts_engaged  integer,
  total_interactions integer,
  created_at        timestamptz not null default now(),
  unique (ig_user_id, snapshot_date)
);

create index if not exists instagram_snapshots_idx on public.instagram_snapshots (ig_user_id, snapshot_date desc);

create table if not exists public.instagram_posts (
  media_id       text primary key,
  ig_user_id     text not null,
  caption        text,
  media_type     text,
  permalink      text,
  posted_at      timestamptz,
  like_count     integer,
  comments_count integer,
  updated_at     timestamptz not null default now()
);

create index if not exists instagram_posts_idx on public.instagram_posts (ig_user_id, posted_at desc);

alter table public.instagram_snapshots enable row level security;
alter table public.instagram_posts enable row level security;

drop policy if exists instagram_snapshots_all on public.instagram_snapshots;
create policy instagram_snapshots_all on public.instagram_snapshots for all using (true) with check (true);

drop policy if exists instagram_posts_all on public.instagram_posts;
create policy instagram_posts_all on public.instagram_posts for all using (true) with check (true);
