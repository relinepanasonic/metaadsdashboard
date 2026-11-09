-- ============================================================================
-- 0032 — Google Drive archive for social media files
-- ----------------------------------------------------------------------------
-- Published posts' photos and videos are copied to Google Drive (folder per
-- workspace > account > date) and then removed from Supabase Storage, so the
-- project stays under its storage quota.
--
--  drive_folders   remembers the Google Drive folder id for each path
--                  ("Workspace/@account/2026-11-09") so it is looked up once
--
-- Run this in Supabase (ProfMetaAds) → SQL Editor → paste → Run.
-- No other table changes: each media item in scheduled_posts.media simply gains
-- optional fields { removed, drive: { id, url, path } }.
-- ============================================================================

create table if not exists public.drive_folders (
  path       text primary key,
  folder_id  text not null,
  created_at timestamptz not null default now()
);

alter table public.drive_folders enable row level security;
drop policy if exists drive_folders_all on public.drive_folders;
create policy drive_folders_all on public.drive_folders for all using (true) with check (true);
