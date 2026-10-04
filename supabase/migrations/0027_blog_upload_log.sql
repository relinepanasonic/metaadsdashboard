-- ============================================================================
-- 0027 — Blog Uploader log
-- ----------------------------------------------------------------------------
-- One row for every blog upload attempt to a website (manual "Publish now", the daily
-- auto-publish, success AND failure), plus one row when the ERP's AI Office hands a draft
-- to the Content Engine. Shown as a table with timestamps on SEO → Blog Engine → Blog Uploader.
-- Optional: everything works without it, you just don't get the history.
-- Run in Supabase (ProfMetaAds) → SQL Editor.
-- ============================================================================

create table if not exists public.blog_upload_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  site_id     uuid references public.search_console_sites(id) on delete set null,
  site_label  text,
  keyword_id  uuid,
  keyword     text,
  title       text,
  slug        text,
  event       text not null check (event in ('upload', 'received')),   -- upload = sent to the website; received = draft arrived from the AI Office
  status      text not null check (status in ('success', 'failed', 'received')),
  trigger     text not null default 'manual' check (trigger in ('manual', 'auto', 'ai-office')),
  by_user     text,                                                    -- who pressed the button (manual uploads)
  url         text,                                                    -- the live page, when it worked
  http_status integer,
  error       text
);
create index if not exists blog_upload_log_time_idx on public.blog_upload_log (created_at desc);
create index if not exists blog_upload_log_site_idx on public.blog_upload_log (site_id, created_at desc);

alter table public.blog_upload_log enable row level security;
drop policy if exists blog_upload_log_all on public.blog_upload_log;
create policy blog_upload_log_all on public.blog_upload_log for all using (true) with check (true);
